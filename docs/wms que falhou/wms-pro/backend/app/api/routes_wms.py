from __future__ import annotations

import csv
import json
import io
import re
import uuid
import sqlite3
import zipfile
from datetime import date, datetime, timedelta, UTC
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import delete, select, update, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.app.api import deps
from backend.app.core.config import settings
from backend.app.core.database import get_db
from backend.app.models.auth import ROLE_CONFERENTE, ROLE_SEPARADOR, User
from backend.app.models.audit import AuditLog
from backend.app.models.floorplan import FloorPlanObject, FloorPlanShelf
from backend.app.models.inventory import Depot, Drawer, Expiry, InventoryMovement, Product, QualitySummary, Shelf, StockItem, StockQualityState
from backend.app.models.separation import DivergenciaSeparacao, HistoricoSeparacao, ItemSeparacao, LockSeparador, RomaneioSeparacao, RotaSeparacao, TarefaSeparador
from backend.app.models.sync import BlindCountPoolItem, SyncQueue, SyncState, SyncStatus, WmsStateSnapshot

router = APIRouter()
CAPACITY_EPSILON_KG = 0.11
SEPARATOR_LOCK_TIMEOUT_MINUTES = 10
ALLOWED_UNITS = {"UN", "KG", "CX", "LT", "PT", "PC", "FD"}

def _normalize_unit(unit: Any) -> str:
    u = str(unit or "UN").strip().upper()
    return u if u in ALLOWED_UNITS else "UN"


def _sqlite_db_file() -> Path:
    raw_path = settings.DATABASE_URL_SQLITE.replace("sqlite+aiosqlite:///", "", 1)
    db_path = Path(raw_path)
    if not db_path.is_absolute():
        db_path = Path(__file__).resolve().parents[3] / db_path
    return db_path.resolve()


def _json_changed(left: Any, right: Any) -> bool:
    return json.dumps(left, sort_keys=True, default=str) != json.dumps(right, sort_keys=True, default=str)


def _enforce_state_permissions(current_user: User, previous_state: dict[str, Any], next_state: dict[str, Any]) -> None:
    if (previous_state.get("depots") or []) and not (next_state.get("depots") or []):
        deps.ensure_permission(current_user, "clear.all")

    if _json_changed(previous_state.get("floorplan") or {}, next_state.get("floorplan") or {}):
        deps.ensure_permission(current_user, "layout.edit")

    if _json_changed(previous_state.get("depots") or [], next_state.get("depots") or []):
        deps.ensure_permission(current_user, "settings.manage")

    if _json_changed(previous_state.get("shelvesAll") or {}, next_state.get("shelvesAll") or {}):
        deps.ensure_permission(current_user, "structure.manage")

    previous_records = {item.get("id"): item for item in (previous_state.get("outboundRecords") or []) if item.get("id")}
    next_records = {item.get("id"): item for item in (next_state.get("outboundRecords") or []) if item.get("id")}
    for record_id, record in next_records.items():
        if record_id in previous_records and not _json_changed(previous_records[record_id], record):
            continue
        kind = (record.get("kind") or "shipment").lower()
        if kind == "discard":
            deps.ensure_permission(current_user, "discard.process")
        else:
            deps.ensure_permission(current_user, "shipment.process")


def _revision_from_sync_state(sync_state: SyncState | None) -> str:
    if not sync_state:
        return "0"
    return f"{sync_state.version}:{sync_state.updated_at.isoformat() if sync_state.updated_at else ''}"


def _next_revision_value(sync_state: SyncState, timestamp: datetime) -> str:
    return f"{sync_state.version}:{timestamp.isoformat()}"


def _merge_snapshot_state(previous_state: dict[str, Any], patch: dict[str, Any]) -> dict[str, Any]:
    next_state = dict(previous_state or {})
    next_state.update(patch)
    return next_state


def _json_dumps_safe(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, default=str)


def _safe_float(value: Any) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def _safe_int(value: Any) -> int:
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def _normalize_search_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip()).lower()


def _serialize_separator_user(user: User) -> dict[str, Any]:
    return {
        "id": user.id,
        "username": user.username,
        "full_name": user.full_name,
        "role": user.role,
    }


def _user_display_name(user: User | None) -> str | None:
    if not user:
        return None
    return user.full_name or user.username or None


def _compute_separation_duration_seconds(romaneio: RomaneioSeparacao) -> int | None:
    started_at = romaneio.iniciado_em_separacao_at
    finished_at = romaneio.separacao_concluida_at or romaneio.conferencia_final_at or romaneio.saida_confirmada_at
    if not started_at or not finished_at:
        return None
    return max(0, int((finished_at - started_at).total_seconds()))


async def _build_separation_request_payload(
    db: AsyncSession,
    row: RomaneioSeparacao,
) -> dict[str, Any]:
    separator_ids = {
        user_id for user_id in {
            row.separador_responsavel_id,
            row.conferencia_final_por_id,
            *[task.separador_id for task in (row.tarefas or []) if task.separador_id],
            *[task.concluida_por_id for task in (row.tarefas or []) if task.concluida_por_id],
            *[div.reportado_por_id for div in (row.divergencias or []) if div.reportado_por_id],
        } if user_id
    }
    users_by_id: dict[str, User] = {}
    if separator_ids:
        user_rows = (
            await db.execute(select(User).where(User.id.in_(separator_ids)))
        ).scalars().all()
        users_by_id = {user.id: user for user in user_rows}

    responsible_user = users_by_id.get(row.separador_responsavel_id or "")
    if not responsible_user and row.tarefas:
        separator_rank: dict[str, int] = {}
        for task in row.tarefas:
            candidate_id = task.concluida_por_id or task.separador_id
            if not candidate_id:
                continue
            separator_rank[candidate_id] = separator_rank.get(candidate_id, 0) + 1
        if separator_rank:
            top_separator_id = max(
                separator_rank.items(),
                key=lambda item: (item[1], item[0]),
            )[0]
            responsible_user = users_by_id.get(top_separator_id)

    requested_units = sum(_safe_int(item.quantidade_solicitada) for item in (row.itens or []))
    separated_units = sum(
        _safe_int((task.rota.metadata_json or {}).get("allocated_quantity") if task.rota else 0)
        for task in (row.tarefas or [])
        if task.status == "concluida" and (task.item.status if task.item else None) != "nao_achei"
    )
    not_found_units = sum(
        _safe_int(item.quantidade_solicitada)
        for item in (row.itens or [])
        if item.status == "nao_achei"
    )
    latest_divergence = next((
        {
            "tipo": div.tipo,
            "status": div.status,
            "descricao": div.descricao,
            "created_at": div.created_at.isoformat() if div.created_at else None,
        }
        for div in sorted(
            (row.divergencias or []),
            key=lambda current: current.created_at or datetime.min.replace(tzinfo=UTC),
            reverse=True,
        )
    ), None)
    duration_seconds = _compute_separation_duration_seconds(row)
    can_finalize = row.status in {"separacao_concluida", "aguardando_conferencia_final"}
    conference_user = users_by_id.get(row.conferencia_final_por_id or "")
    routes_by_item_id: dict[str, list[RotaSeparacao]] = {}
    for route in sorted(
        (row.rotas or []),
        key=lambda current: (
            current.ordem_coleta if current.ordem_coleta is not None else 999999,
            current.sequencia if current.sequencia is not None else 999999,
            current.created_at or datetime.min.replace(tzinfo=UTC),
        ),
    ):
        if not route.item_id:
            continue
        routes_by_item_id.setdefault(route.item_id, []).append(route)

    tasks_by_item_id: dict[str, list[TarefaSeparador]] = {}
    for task in sorted(
        (row.tarefas or []),
        key=lambda current: (
            current.prioridade if current.prioridade is not None else 999999,
            current.atribuida_at or datetime.min.replace(tzinfo=UTC),
            current.created_at or datetime.min.replace(tzinfo=UTC),
        ),
    ):
        if not task.item_id:
            continue
        tasks_by_item_id.setdefault(task.item_id, []).append(task)

    item_payloads: list[dict[str, Any]] = []
    unique_addresses: list[dict[str, Any]] = []
    seen_addresses: set[tuple[str, str, str, str]] = set()
    for item in sorted(
        (row.itens or []),
        key=lambda current: (
            current.sequencia if current.sequencia is not None else 999999,
            current.created_at or datetime.min.replace(tzinfo=UTC),
        ),
    ):
        item_routes = routes_by_item_id.get(item.id, [])
        item_tasks = tasks_by_item_id.get(item.id, [])
        item_addresses = []
        for route in item_routes:
            route_meta = route.metadata_json or {}
            address = {
                "deposito": route.zona or "-",
                "prateleira": route.corredor or "-",
                "gaveta": route.drawer_key or "-",
                "quantidade": _safe_int(route_meta.get("allocated_quantity")),
                "peso": _safe_float(route_meta.get("allocated_kg")),
                "validade": route_meta.get("nearest_expiry"),
                "lote": route_meta.get("lot"),
            }
            item_addresses.append(address)
            address_key = (
                address["deposito"],
                address["prateleira"],
                address["gaveta"],
                str(address["lote"] or ""),
            )
            if address_key not in seen_addresses:
                seen_addresses.add(address_key)
                unique_addresses.append(address)
        item_payloads.append({
            "id": item.id,
            "sequencia": item.sequencia,
            "codigo": (item.metadata_json or {}).get("product_code"),
            "nome": (item.metadata_json or {}).get("product_name"),
            "status": item.status,
            "unidade": item.unidade_medida or "un",
            "quantidade_solicitada": _safe_int(item.quantidade_solicitada),
            "quantidade_reservada": _safe_int(item.quantidade_reservada),
            "quantidade_coletada": _safe_int(item.quantidade_coletada),
            "peso_solicitado": _safe_float(item.peso_solicitado),
            "peso_reservado": _safe_float(item.peso_reservado),
            "peso_coletado": _safe_float(item.peso_coletado),
            "lote": item.codigo_lote,
            "enderecos": item_addresses,
            "separadores": [
                _user_display_name(users_by_id.get(task.concluida_por_id or task.separador_id or "")) or "—"
                for task in item_tasks
            ],
        })

    divergence_payloads = []
    for div in sorted(
        (row.divergencias or []),
        key=lambda current: current.created_at or datetime.min.replace(tzinfo=UTC),
        reverse=True,
    ):
        metadata_item = (div.metadata_json or {}).get("item") or {}
        divergence_payloads.append({
            "id": div.id,
            "tipo": div.tipo,
            "status": div.status,
            "severidade": div.severidade,
            "descricao": div.descricao,
            "reportado_por": _user_display_name(users_by_id.get(div.reportado_por_id or "")) or "—",
            "created_at": div.created_at.isoformat() if div.created_at else None,
            "aberta_at": div.aberta_at.isoformat() if div.aberta_at else None,
            "codigo": metadata_item.get("codigo"),
            "nome": metadata_item.get("nome"),
            "observacao": (div.metadata_json or {}).get("observacao"),
        })

    return {
        "id": row.id,
        "codigo": row.codigo,
        "status": row.status,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "rota_gerada_at": row.rota_gerada_at.isoformat() if row.rota_gerada_at else None,
        "aguardando_separacao_at": row.aguardando_separacao_at.isoformat() if row.aguardando_separacao_at else None,
        "iniciado_em_separacao_at": row.iniciado_em_separacao_at.isoformat() if row.iniciado_em_separacao_at else None,
        "separacao_concluida_at": row.separacao_concluida_at.isoformat() if row.separacao_concluida_at else None,
        "conferencia_final_at": row.conferencia_final_at.isoformat() if row.conferencia_final_at else None,
        "saida_confirmada_at": row.saida_confirmada_at.isoformat() if row.saida_confirmada_at else None,
        "item_count": len(row.itens or []),
        "route_count": len(row.rotas or []),
        "task_count": len(row.tarefas or []),
        "nao_achei_count": sum(1 for item in (row.itens or []) if item.status == "nao_achei"),
        "open_divergence_count": sum(1 for div in (row.divergencias or []) if div.status in {"aberta", "em_analise"}),
        "latest_divergence": latest_divergence,
        "summary": {
            "requested_units": requested_units,
            "separated_units": separated_units,
            "not_found_units": not_found_units,
            "responsible_separator": _user_display_name(responsible_user) or "—",
            "duration_seconds": duration_seconds,
        },
        "conferente": _user_display_name(conference_user) or "—",
        "separador": _user_display_name(responsible_user) or "—",
        "itens": item_payloads,
        "enderecos": unique_addresses,
        "divergencias": divergence_payloads,
        "can_finalize": can_finalize,
        "metadata": row.metadata_json or {},
    }


async def _get_separator_users(db: AsyncSession) -> list[User]:
    result = await db.execute(
        select(User)
        .where(User.role == ROLE_SEPARADOR, User.is_active.is_(True))
        .order_by(User.username.asc())
    )
    return list(result.scalars().all())


async def _get_conferente_users(db: AsyncSession) -> list[User]:
    result = await db.execute(
        select(User)
        .where(User.role == ROLE_CONFERENTE, User.is_active.is_(True))
        .order_by(User.username.asc())
    )
    return list(result.scalars().all())


def _build_separator_task_payload(
    *,
    romaneio_codigo: str,
    task_id: str,
    route_id: str | None,
    route_plan: dict[str, Any],
    item_plan: dict[str, Any],
    status_value: str,
    separator_users: list[User],
) -> dict[str, Any]:
    return {
        "module": "separador",
        "romaneio": romaneio_codigo,
        "task_id": task_id,
        "route_id": route_id,
        "produto": {
            "codigo": item_plan["product_code"],
            "nome": item_plan["product_name"],
        },
        "quantidade": route_plan["allocated_quantity"],
        "endereco": {
            "deposito": route_plan.get("depot_name"),
            "prateleira": route_plan.get("shelf_code"),
            "gaveta": route_plan.get("drawer_key"),
            "label": " / ".join(
                part for part in [route_plan.get("depot_name"), route_plan.get("shelf_code"), route_plan.get("drawer_key")] if part
            ),
        },
        "validade": route_plan.get("nearest_expiry"),
        "status": status_value,
        "usuarios": [_serialize_separator_user(user) for user in separator_users],
    }


def _serialize_separator_queue(queue_row: SyncQueue) -> dict[str, Any]:
    payload = queue_row.payload or {}
    return {
        "queue_id": queue_row.id,
        "entity_id": queue_row.entity_id,
        "operation": queue_row.operation,
        "status": queue_row.status.value if isinstance(queue_row.status, SyncStatus) else str(queue_row.status),
        "created_at": queue_row.created_at.isoformat() if queue_row.created_at else None,
        "updated_at": queue_row.updated_at.isoformat() if queue_row.updated_at else None,
        "romaneio": payload.get("romaneio"),
        "produto": payload.get("produto"),
        "quantidade": payload.get("quantidade"),
        "endereco": payload.get("endereco"),
        "deposito": (payload.get("endereco") or {}).get("deposito"),
        "prateleira": (payload.get("endereco") or {}).get("prateleira"),
        "gaveta": (payload.get("endereco") or {}).get("gaveta"),
        "validade": payload.get("validade"),
        "task_status": payload.get("status"),
        "usuarios": payload.get("usuarios") or [],
    }


async def _get_active_separator_task_lock(db: AsyncSession, task_id: str) -> LockSeparador | None:
    result = await db.execute(
        select(LockSeparador)
        .where(
            LockSeparador.resource_type == "separation_task",
            LockSeparador.resource_id == task_id,
            LockSeparador.ativo.is_(True),
        )
        .order_by(LockSeparador.adquirido_at.desc())
        .limit(1)
    )
    return result.scalars().first()


async def _release_separator_task_lock(
    db: AsyncSession,
    *,
    task: TarefaSeparador,
    lock: LockSeparador,
    now: datetime,
    reason: str,
    released_by_id: str | None = None,
) -> None:
    if not lock.ativo:
        return

    lock.ativo = False
    lock.liberado_at = now
    lock.liberado_por_id = released_by_id
    lock.metadata_json = {
        **(lock.metadata_json or {}),
        "release_reason": reason,
        "released_at": now.isoformat(),
    }

    if reason in {"cancel", "timeout"} and task.status == "em_andamento" and not task.concluida_at:
        task.status = "pendente"
        task.iniciada_at = None
        if task.item and task.item.status == "em_coleta":
            task.item.status = "reservado"
            task.item.coleta_iniciada_at = None
            task.item.ultima_movimentacao_at = now
            task.item.ultima_atualizacao_por_id = released_by_id or lock.user_id

    db.add(HistoricoSeparacao(
        romaneio_id=task.romaneio_id,
        item_id=task.item_id,
        actor_user_id=released_by_id,
        entity_type="locks_separador",
        entity_id=lock.id,
        acao="lock_liberado",
        status_anterior="ativo",
        status_novo="inativo",
        descricao=f"Reserva da tarefa liberada por {reason}.",
        payload_json={
            "task_id": task.id,
            "lock_id": lock.id,
            "release_reason": reason,
            "locked_by_user_id": lock.user_id,
        },
        evento_em=now,
    ))


async def _release_expired_separator_locks(db: AsyncSession, now: datetime) -> None:
    result = await db.execute(
        select(LockSeparador)
        .where(
            LockSeparador.resource_type == "separation_task",
            LockSeparador.ativo.is_(True),
            LockSeparador.expira_at.is_not(None),
            LockSeparador.expira_at <= now,
        )
    )
    expired_locks = list(result.scalars().all())
    if not expired_locks:
        return

    task_ids = [lock.tarefa_id for lock in expired_locks if lock.tarefa_id]
    if not task_ids:
        return
    tasks_result = await db.execute(
        select(TarefaSeparador)
        .options(selectinload(TarefaSeparador.item))
        .where(TarefaSeparador.id.in_(task_ids))
    )
    tasks_by_id = {task.id: task for task in tasks_result.scalars().all()}

    for lock in expired_locks:
        task = tasks_by_id.get(lock.tarefa_id or "")
        if not task:
            lock.ativo = False
            lock.liberado_at = now
            lock.metadata_json = {
                **(lock.metadata_json or {}),
                "release_reason": "timeout",
                "released_at": now.isoformat(),
            }
            continue
        await _release_separator_task_lock(
            db,
            task=task,
            lock=lock,
            now=now,
            reason="timeout",
            released_by_id=None,
        )
    await db.commit()


def _serialize_separator_feed_item(
    queue_row: SyncQueue,
    task: TarefaSeparador | None,
    active_lock: LockSeparador | None,
    current_user: User,
) -> dict[str, Any]:
    payload = _serialize_separator_queue(queue_row)
    payload["task_status"] = task.status if task else payload.get("task_status")
    payload["is_reserved"] = bool(active_lock)
    payload["reserved_by_me"] = bool(active_lock and active_lock.user_id == current_user.id)
    payload["lock_expires_at"] = active_lock.expira_at.isoformat() if active_lock and active_lock.expira_at else None
    return payload


def _build_nao_achei_notification_payload(
    *,
    romaneio_codigo: str,
    task: TarefaSeparador,
    current_user: User,
    observation: str | None,
    now: datetime,
    conferente_users: list[User],
) -> dict[str, Any]:
    item = task.item
    route = task.rota
    return {
        "module": "conferente",
        "tipo": "nao_achei",
        "romaneio": romaneio_codigo,
        "task_id": task.id,
        "item_id": task.item_id,
        "route_id": task.rota_id,
        "usuario": {
            "id": current_user.id,
            "username": current_user.username,
            "full_name": current_user.full_name,
        },
        "data": now.isoformat(),
        "item": {
            "codigo": (item.metadata_json or {}).get("product_code") if item else None,
            "nome": (item.metadata_json or {}).get("product_name") if item else None,
            "quantidade_solicitada": item.quantidade_solicitada if item else None,
            "unidade_medida": item.unidade_medida if item else None,
        },
        "endereco": {
            "deposito": route.zona if route else None,
            "prateleira": route.corredor if route else None,
            "gaveta": route.drawer_key if route else None,
        },
        "observacao": observation or None,
        "usuarios": [_serialize_separator_user(user) for user in conferente_users],
    }


async def _get_effective_state(db: AsyncSession) -> dict[str, Any]:
    snapshot = await _get_state_snapshot(db)
    if snapshot.state_json:
        return snapshot.state_json
    bootstrap = await _build_bootstrap_payload(db)
    return bootstrap.get("state") or {}


def _parse_drawer_key(drawer_key: str) -> tuple[str, int, int]:
    match = re.match(r"^([A-Za-z]+)(\d+)\.G(\d+)$", drawer_key or "")
    if not match:
        return drawer_key or "", 9999, 9999
    shelf_code, floor_number, drawer_number = match.groups()
    return shelf_code, int(floor_number), int(drawer_number)


def _nearest_expiry_from_payload(item: dict[str, Any]) -> str | None:
    expiries = sorted(expiry for expiry in (item.get("expiries") or []) if expiry)
    return expiries[0] if expiries else None


def _build_snapshot_stock_candidates(state: dict[str, Any]) -> list[dict[str, Any]]:
    depots_payload = state.get("depots") or []
    depot_map = {depot.get("id"): depot for depot in depots_payload if depot.get("id")}
    shelves_all = state.get("shelvesAll") or {}
    products_all = state.get("productsAll") or {}
    today = date.today().isoformat()
    rows: list[dict[str, Any]] = []

    for depot_id, drawers in products_all.items():
        depot = depot_map.get(depot_id) or {}
        shelf_map = {shelf.get("id"): shelf for shelf in (shelves_all.get(depot_id) or []) if shelf.get("id")}
        for drawer_key, items in (drawers or {}).items():
            shelf_code, floor_number, drawer_number = _parse_drawer_key(drawer_key)
            shelf = shelf_map.get(shelf_code) or {}
            for raw_item in items or []:
                code = str(raw_item.get("code") or "").strip()
                if not code:
                    continue
                quantity = _safe_int(raw_item.get("qty"))
                kg_total = _safe_float(raw_item.get("kgTotal") or raw_item.get("kg"))
                nearest_expiry = _nearest_expiry_from_payload(raw_item)
                is_expired = bool(nearest_expiry and nearest_expiry < today)
                rows.append({
                    "depot_id": depot_id,
                    "depot_name": depot.get("name") or depot_id,
                    "drawer_key": drawer_key,
                    "shelf_code": shelf_code,
                    "floor_number": floor_number,
                    "drawer_number": drawer_number,
                    "shelf_type": shelf.get("type") or "normal",
                    "product_code": code,
                    "product_name": raw_item.get("name") or code,
                    "unit": raw_item.get("unit") or "un",
                    "category": raw_item.get("category"),
                    "family": raw_item.get("family"),
                    "quantity": quantity,
                    "kg_total": kg_total,
                    "kg_per_unit": (kg_total / quantity) if quantity > 0 else 0.0,
                    "lot": raw_item.get("lot") or "",
                    "entry": raw_item.get("entry") or "",
                    "nearest_expiry": nearest_expiry,
                    "is_expired": is_expired,
                    "expiries": raw_item.get("expiries") or [],
                })
    return rows


def _build_separation_plan(
    requested_items: list[dict[str, Any]],
    stock_rows: list[dict[str, Any]],
) -> dict[str, Any]:
    today = date.today().isoformat()
    stock_by_code: dict[str, list[dict[str, Any]]] = {}
    for row in stock_rows:
        stock_by_code.setdefault(row["product_code"], []).append(dict(row))

    planned_items: list[dict[str, Any]] = []
    route_lines: list[dict[str, Any]] = []

    for line_index, requested in enumerate(requested_items, start=1):
        product_code = str(requested.get("product_code") or "").strip()
        product_name = str(requested.get("product_name") or "").strip() or product_code
        requested_quantity = _safe_int(requested.get("quantity"))
        if not product_code or requested_quantity <= 0:
            raise HTTPException(status_code=400, detail=f"Item inválido na linha {line_index}.")

        candidates = [
            candidate for candidate in stock_by_code.get(product_code, [])
            if not candidate.get("is_expired") and _safe_int(candidate.get("quantity")) > 0
        ]
        candidates.sort(
            key=lambda candidate: (
                candidate.get("nearest_expiry") or "9999-12-31",
                candidate.get("entry") or "9999-12-31",
                candidate.get("depot_name") or "",
                candidate.get("shelf_code") or "",
                candidate.get("floor_number") or 9999,
                candidate.get("drawer_number") or 9999,
            )
        )
        available_quantity = sum(_safe_int(candidate.get("quantity")) for candidate in candidates)
        if available_quantity < requested_quantity:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Saldo insuficiente para {product_name} - {product_code}. "
                    f"Disponível: {available_quantity}. Solicitado: {requested_quantity}."
                ),
            )

        remaining = requested_quantity
        allocations: list[dict[str, Any]] = []
        for candidate in candidates:
            if remaining <= 0:
                break
            available = _safe_int(candidate.get("quantity"))
            if available <= 0:
                continue
            take_quantity = min(available, remaining)
            remaining -= take_quantity
            kg_per_unit = _safe_float(candidate.get("kg_per_unit"))
            take_kg = round(take_quantity * kg_per_unit, 3)
            allocations.append({
                **candidate,
                "allocated_quantity": take_quantity,
                "allocated_kg": take_kg,
                "priority_rule": (
                    "validade_curta" if (candidate.get("nearest_expiry") or "9999-12-31") >= today else "ignorado_vencido"
                ),
            })

        total_kg = round(sum(_safe_float(item.get("allocated_kg")) for item in allocations), 3)
        planned_items.append({
            "sequencia": line_index,
            "product_code": product_code,
            "product_name": product_name,
            "quantity": requested_quantity,
            "kg_total": total_kg,
            "unit": requested.get("unit") or allocations[0].get("unit") or "un",
            "routes": allocations,
        })
        route_lines.extend(allocations)

    route_lines.sort(
        key=lambda line: (
            line.get("depot_name") or "",
            line.get("shelf_code") or "",
            line.get("floor_number") or 9999,
            line.get("drawer_number") or 9999,
            line.get("nearest_expiry") or "9999-12-31",
            line.get("product_code") or "",
        )
    )

    return {
        "items": planned_items,
        "route_lines": route_lines,
        "summary": {
            "total_items": len(planned_items),
            "total_routes": len(route_lines),
            "total_quantity": sum(_safe_int(item.get("quantity")) for item in planned_items),
            "total_kg": round(sum(_safe_float(item.get("kg_total")) for item in planned_items), 3),
        },
    }


def _inventory_scope_changed(previous_state: dict[str, Any], next_state: dict[str, Any]) -> bool:
    return (
        _json_changed(previous_state.get("productsAll") or {}, next_state.get("productsAll") or {})
        or _json_changed(previous_state.get("history") or [], next_state.get("history") or [])
    )


def _ensure_inventory_permission(current_user: User) -> None:
    if any(deps.user_has_permission(current_user, perm) for perm in ("entry.register", "shipment.process", "quality.manage", "blind.count")):
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permissão insuficiente para alterar inventário.")


async def _append_audit_log(
    db: AsyncSession,
    current_user: User,
    action: str,
    table_name: str,
    old_value: Any = None,
    new_value: Any = None,
    record_id: str | None = None,
) -> None:
    db.add(AuditLog(
        user_id=current_user.id,
        username=current_user.username,
        action=action,
        table_name=table_name,
        record_id=record_id,
        old_value=_json_dumps_safe(old_value) if old_value is not None else None,
        new_value=_json_dumps_safe(new_value) if new_value is not None else None,
    ))


def _validate_products_snapshot_state(next_state: dict[str, Any]) -> None:
    depots_payload = next_state.get("depots") or []
    shelves_all = next_state.get("shelvesAll") or {}
    products_all = next_state.get("productsAll") or {}
    depots_by_id = {depot.get("id"): depot for depot in depots_payload if depot.get("id")}

    for depot_id, depot_products in products_all.items():
        # dep_discard é um depósito virtual criado pelo frontend para descartes —
        # não existe na tabela de depósitos do banco, mas é válido no inventário.
        if depot_id == "dep_discard":
            depot = {"id": "dep_discard", "allowOvercapacity": True, "special": "discard"}
            depots_by_id["dep_discard"] = depot
        elif depot_id not in depots_by_id:
            raise HTTPException(status_code=400, detail=f"Depósito inválido no inventário: {depot_id}")
        depot = depots_by_id[depot_id]
        shelf_map = {shelf.get("id"): shelf for shelf in (shelves_all.get(depot_id) or []) if shelf.get("id")}
        depot_drawer_capacity = 0.0
        depot_drawer_used = 0.0
        shelf_usage: dict[str, float] = {}

        for shelf in shelf_map.values():
            depot_drawer_capacity += float(shelf.get("floors") or 0) * float(shelf.get("drawers") or 0) * float(shelf.get("maxKg") or 50)

        for drawer_key, items in (depot_products or {}).items():
            match = re.match(r"^([A-Za-z]+)(\d+)\.G(\d+)$", drawer_key or "")
            if not match:
                raise HTTPException(status_code=400, detail=f"Gaveta inválida no inventário: {drawer_key}")
            shelf_code, floor_number_text, drawer_number_text = match.groups()
            floor_number = int(floor_number_text)
            drawer_number = int(drawer_number_text)
            if depot_id == "dep_discard" and shelf_code == "DESC" and drawer_number == 1 and floor_number > 1:
                drawer_number = floor_number
                floor_number = 1
            shelf = shelf_map.get(shelf_code)
            if not shelf:
                raise HTTPException(status_code=400, detail=f"Prateleira inexistente para a gaveta {drawer_key} no depósito {depot_id}")
            if floor_number < 1 or floor_number > int(shelf.get("floors") or 0):
                raise HTTPException(status_code=400, detail=f"Andar inválido na gaveta {drawer_key}")
            if drawer_number < 1 or drawer_number > int(shelf.get("drawers") or 0):
                raise HTTPException(status_code=400, detail=f"Número de gaveta inválido em {drawer_key}")

            drawer_used = 0.0
            for item in items or []:
                qty = float(item.get("qty") or 0)
                kg = float(item.get("kgTotal") or item.get("kg") or 0)
                if qty <= 0:
                    raise HTTPException(status_code=400, detail=f"Quantidade inválida para item em {drawer_key}")
                if kg < 0:
                    raise HTTPException(status_code=400, detail=f"Peso inválido para item em {drawer_key}")
                drawer_used += kg
                depot_drawer_used += kg
                shelf_usage[shelf_code] = shelf_usage.get(shelf_code, 0.0) + kg

            if not depot.get("allowOvercapacity"):
                drawer_capacity = float(shelf.get("maxKg") or 50)
                if drawer_used - drawer_capacity > CAPACITY_EPSILON_KG:
                    raise HTTPException(status_code=400, detail=f"Capacidade da gaveta excedida em {drawer_key}")

        if not depot.get("allowOvercapacity"):
            for shelf_code, used_kg in shelf_usage.items():
                shelf = shelf_map[shelf_code]
                shelf_capacity = float(shelf.get("floors") or 0) * float(shelf.get("drawers") or 0) * float(shelf.get("maxKg") or 50)
                if used_kg - shelf_capacity > CAPACITY_EPSILON_KG:
                    raise HTTPException(status_code=400, detail=f"Capacidade da prateleira excedida em {shelf_code} / {depot_id}")
            if depot_drawer_used - depot_drawer_capacity > CAPACITY_EPSILON_KG:
                raise HTTPException(status_code=400, detail=f"Capacidade total do depósito excedida em {depot_id}")


async def _get_sync_state(db: AsyncSession) -> SyncState:
    result = await db.execute(select(SyncState).limit(1))
    sync_state = result.scalars().first()
    if not sync_state:
      sync_state = SyncState()
      db.add(sync_state)
      await db.flush()
    return sync_state


async def _get_state_snapshot(db: AsyncSession) -> WmsStateSnapshot:
    result = await db.execute(
        select(WmsStateSnapshot).where(WmsStateSnapshot.snapshot_key == "default").limit(1)
    )
    snapshot = result.scalars().first()
    if not snapshot:
        snapshot = WmsStateSnapshot(snapshot_key="default", state_json={})
        db.add(snapshot)
        await db.flush()
    return snapshot


async def _save_snapshot_patch(
    db: AsyncSession,
    current_user: User,
    patch: dict[str, Any],
    expected_revision: str | None = None,
) -> dict[str, Any]:
    # FIX C-02: UPDATE atômico do version com WHERE garante que dois requests
    # concorrentes não passem pela mesma revisão silenciosamente.
    sync_state = await _get_sync_state(db)
    snapshot = await _get_state_snapshot(db)
    current_revision = _revision_from_sync_state(sync_state)
    if expected_revision and expected_revision != current_revision:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"message": "Estado desatualizado no cliente. Recarregue os dados antes de salvar.", "current_revision": current_revision},
        )
    previous_state = snapshot.state_json or {}
    next_state = _merge_snapshot_state(previous_state, patch)
    _enforce_state_permissions(current_user, previous_state, next_state)
    now = datetime.now(UTC)
    # UPDATE atômico: falha se version mudou desde o SELECT (TOCTOU fix)
    result = await db.execute(
        update(SyncState)
        .where(SyncState.id == sync_state.id, SyncState.version == sync_state.version)
        .values(version=SyncState.version + 1, last_pushed_at=now, updated_at=now)
    )
    if result.rowcount == 0:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"message": "Conflito de concorrência detectado. Recarregue e tente novamente.", "current_revision": current_revision},
        )
    sync_state.version += 1  # atualiza o objeto em memória para formar a revisão
    revision_value = _next_revision_value(sync_state, now)
    snapshot.revision = revision_value
    snapshot.state_json = next_state
    snapshot.source = current_user.username or getattr(current_user, "email", None) or "system"
    snapshot.notes = f"Snapshot parcial atualizado por {snapshot.source}"
    await _append_audit_log(
        db,
        current_user,
        action="snapshot_patch",
        table_name="wms_state_snapshots",
        record_id=snapshot.id,
        old_value={"keys": list(previous_state.keys())},
        new_value={"keys": list(next_state.keys()), "revision": revision_value},
    )
    await db.commit()
    return {"revision": revision_value, "state": next_state}


async def _save_unloads_snapshot_and_pool(
    db: AsyncSession,
    current_user: User,
    blind_records: list[dict[str, Any]],
    active_unload_id: str | None,
    expected_revision: str | None = None,
) -> dict[str, Any]:
    sync_state = await _get_sync_state(db)
    snapshot = await _get_state_snapshot(db)
    current_revision = _revision_from_sync_state(sync_state)
    if expected_revision and expected_revision != current_revision:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"message": "Estado desatualizado no cliente. Recarregue os dados antes de salvar.", "current_revision": current_revision},
        )
    previous_state = snapshot.state_json or {}
    patch = {
        "blindCountRecords": blind_records,
        "activeBlindUnloadId": active_unload_id,
    }
    next_state = _merge_snapshot_state(previous_state, patch)
    _enforce_state_permissions(current_user, previous_state, next_state)

    # FIX M-04: DELETE por unload_id, não global — preserva descargas de outros usuários
    incoming_unload_ids = {r.get("id") for r in blind_records if r.get("id")}
    if incoming_unload_ids:
        await db.execute(
            delete(BlindCountPoolItem).where(BlindCountPoolItem.unload_id.in_(incoming_unload_ids))
        )
    for record in blind_records:
        unload_id = record.get("id")
        if not unload_id:
            continue
        for item in record.get("poolItems") or []:
            item_key = item.get("id")
            if not item_key:
                continue
            db.add(BlindCountPoolItem(
                unload_id=unload_id,
                item_key=item_key,
                payload_json=item,
            ))

    now = datetime.now(UTC)
    # FIX C-02: UPDATE atômico para _save_unloads também
    result = await db.execute(
        update(SyncState)
        .where(SyncState.id == sync_state.id, SyncState.version == sync_state.version)
        .values(version=SyncState.version + 1, last_pushed_at=now, updated_at=now)
    )
    if result.rowcount == 0:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"message": "Conflito de concorrência detectado. Recarregue e tente novamente."},
        )
    sync_state.version += 1
    revision_value = _next_revision_value(sync_state, now)
    snapshot.revision = revision_value
    snapshot.state_json = next_state
    snapshot.source = current_user.username or getattr(current_user, "email", None) or "system"
    snapshot.notes = f"Descargas atualizadas por {snapshot.source}"
    await _append_audit_log(
        db,
        current_user,
        action="unloads_patch",
        table_name="wms_state_snapshots",
        record_id=snapshot.id,
        old_value={"blindCountRecords": len(previous_state.get("blindCountRecords") or [])},
        new_value={"blindCountRecords": len(blind_records), "activeBlindUnloadId": active_unload_id, "revision": revision_value},
    )
    await db.commit()
    return {"revision": revision_value, "state": next_state}


def _product_to_payload(product: Product, stock_item: StockItem, expiries: list[Expiry]) -> dict[str, Any]:
    return {
        "code": product.code,
        "name": product.name,
        "sku": product.sku,
        "ean": product.ean,
        "category": product.category,
        "family": product.family,
        "supplier": product.supplier,
        "unit": product.unit,
        "brand": product.brand,
        "manufacturer": product.manufacturer,
        "model": product.model,
        "ncm": product.ncm,
        "anvisa": product.anvisa,
        "tempMin": product.temp_min,
        "tempMax": product.temp_max,
        "minStock": product.min_stock,
        "maxStock": product.max_stock,
        "reorderPoint": product.reorder_point,
        "lengthCm": product.length_cm,
        "widthCm": product.width_cm,
        "heightCm": product.height_cm,
        "perishable": "yes" if product.is_perishable else "no",
        "serialControl": product.serial_control or "none",
        "expiryControl": "yes" if product.expiry_control else "no",
        "notes": stock_item.notes or product.notes,
        "qty": stock_item.quantity,
        "kg": stock_item.kg,
        "kgTotal": stock_item.kg,
        "kgPerUnit": stock_item.kg_per_unit,
        "lot": stock_item.lot,
        "entry": stock_item.entry_date.isoformat() if stock_item.entry_date else "",
        "expiries": sorted(expiry.date_value.isoformat() for expiry in expiries),
    }


async def _rebuild_quality_views(db: AsyncSession) -> None:
    await db.execute(delete(QualitySummary))
    await db.execute(delete(StockQualityState))
    await db.flush()

    depots_result = await db.execute(
        select(Depot)
        .options(
            selectinload(Depot.shelves)
            .selectinload(Shelf.drawers)
            .selectinload(Drawer.stock_items)
            .selectinload(StockItem.product),
            selectinload(Depot.shelves)
            .selectinload(Shelf.drawers)
            .selectinload(Drawer.stock_items)
            .selectinload(StockItem.expiries),
        )
    )
    depots = depots_result.scalars().unique().all()
    today = date.today()
    now = datetime.now(UTC)
    summaries: dict[tuple[str, str | None], dict[str, Any]] = {
        ("global", None): {
            "label": "GLOBAL",
            "expired_count": 0,
            "expiring_count": 0,
            "quarantine_count": 0,
            "blocked_count": 0,
            "short_expiry_count": 0,
            "overdue_total_days": 0,
        }
    }

    for depot in depots:
        summaries[("depot", depot.id)] = {
            "label": depot.name,
            "expired_count": 0,
            "expiring_count": 0,
            "quarantine_count": 0,
            "blocked_count": 0,
            "short_expiry_count": 0,
            "overdue_total_days": 0,
        }
        for shelf in depot.shelves:
            shelf_type = shelf.shelf_type or "normal"
            for drawer in shelf.drawers:
                for stock_item in drawer.stock_items:
                    expiries = sorted(expiry.date_value for expiry in stock_item.expiries if expiry.date_value)
                    nearest_expiry = expiries[0] if expiries else None
                    days_to_expiry = (nearest_expiry - today).days if nearest_expiry else None
                    expiry_status = "none"
                    days_overdue = None
                    if nearest_expiry:
                        if days_to_expiry is not None and days_to_expiry < 0:
                            expiry_status = "expired"
                            days_overdue = abs(days_to_expiry)
                        elif days_to_expiry is not None and days_to_expiry <= 30:
                            expiry_status = "expiring"
                        else:
                            expiry_status = "ok"

                    db.add(StockQualityState(
                        stock_item_id=stock_item.id,
                        depot_id=depot.id,
                        shelf_id=shelf.id,
                        drawer_id=drawer.id,
                        drawer_key=drawer.drawer_key,
                        product_code=stock_item.product.code if stock_item.product else None,
                        shelf_type=shelf_type,
                        nearest_expiry=nearest_expiry,
                        expiry_status=expiry_status,
                        days_to_expiry=days_to_expiry,
                        days_overdue=days_overdue,
                        has_expiry=bool(nearest_expiry),
                        is_quarantine=shelf_type == "quarantine",
                        is_blocked=shelf_type == "blocked",
                        computed_at=now,
                    ))

                    for scope_key in (("global", None), ("depot", depot.id)):
                        summary = summaries[scope_key]
                        if expiry_status == "expired":
                            summary["expired_count"] += 1
                            summary["overdue_total_days"] += days_overdue or 0
                        elif expiry_status == "expiring":
                            summary["expiring_count"] += 1
                        if days_to_expiry is not None and 0 <= days_to_expiry <= 15:
                            summary["short_expiry_count"] += 1
                        if shelf_type == "quarantine":
                            summary["quarantine_count"] += 1
                        elif shelf_type == "blocked":
                            summary["blocked_count"] += 1

    for (scope_type, scope_id), summary in summaries.items():
        db.add(QualitySummary(
            scope_type=scope_type,
            scope_id=scope_id,
            label=summary["label"],
            expired_count=summary["expired_count"],
            expiring_count=summary["expiring_count"],
            quarantine_count=summary["quarantine_count"],
            blocked_count=summary["blocked_count"],
            short_expiry_count=summary["short_expiry_count"],
            overdue_total_days=summary["overdue_total_days"],
            computed_at=now,
        ))
    await db.flush()


async def _build_bootstrap_payload(db: AsyncSession) -> dict[str, Any]:
    sync_state = await _get_sync_state(db)
    snapshot = await _get_state_snapshot(db)
    depots_result = await db.execute(
        select(Depot)
        .options(
            selectinload(Depot.shelves)
            .selectinload(Shelf.drawers)
            .selectinload(Drawer.stock_items)
            .selectinload(StockItem.product),
            selectinload(Depot.shelves)
            .selectinload(Shelf.drawers)
            .selectinload(Drawer.stock_items)
            .selectinload(StockItem.expiries),
        )
        .order_by(Depot.created_at.asc())
    )
    depots = depots_result.scalars().unique().all()

    floorplan_shelves = (
        await db.execute(select(FloorPlanShelf).order_by(FloorPlanShelf.created_at.asc()))
    ).scalars().all()
    floorplan_objects = (
        await db.execute(select(FloorPlanObject).order_by(FloorPlanObject.created_at.asc()))
    ).scalars().all()
    movements = (
        await db.execute(select(InventoryMovement).order_by(InventoryMovement.happened_at.desc(), InventoryMovement.created_at.desc()).limit(500))
    ).scalars().all()

    depots_payload: list[dict[str, Any]] = []
    shelves_all: dict[str, list[dict[str, Any]]] = {}
    products_all: dict[str, dict[str, list[dict[str, Any]]]] = {}
    shelf_id_to_code: dict[str, str] = {}
    shelf_id_to_depot: dict[str, str] = {}

    for depot in depots:
        depots_payload.append({
            "id": depot.id,
            "name": depot.name,
            "address": depot.address or "",
            "city": depot.city or "",
            "manager": depot.manager or "",
            "phone": depot.phone or "",
            "notes": depot.notes or "",
            "allowOvercapacity": bool(depot.allow_overcapacity),
        })
        shelves_all[depot.id] = []
        products_all[depot.id] = {}

        for shelf in sorted(depot.shelves, key=lambda item: item.code):
            shelf_id_to_code[shelf.id] = shelf.code
            shelf_id_to_depot[shelf.id] = depot.id
            shelves_all[depot.id].append({
                "id": shelf.code,
                "type": shelf.shelf_type or "normal",
                "floors": shelf.floors,
                "drawers": shelf.drawers_per_floor,
                "maxKg": shelf.max_kg_per_drawer,
            })
            for drawer in sorted(shelf.drawers, key=lambda item: (item.floor_number, item.drawer_number)):
                key = drawer.drawer_key
                products_all[depot.id][key] = []
                for stock_item in sorted(drawer.stock_items, key=lambda item: item.created_at):
                    products_all[depot.id][key].append(
                        _product_to_payload(stock_item.product, stock_item, list(stock_item.expiries))
                    )

    floorplan_layout: dict[str, dict[str, Any]] = {}
    for floorplan_shelf in floorplan_shelves:
        shelf_code = shelf_id_to_code.get(floorplan_shelf.shelf_id)
        depot_id = shelf_id_to_depot.get(floorplan_shelf.shelf_id)
        scoped_key = f"{depot_id}::{shelf_code}" if depot_id and shelf_code else None
        if scoped_key and scoped_key not in floorplan_layout:
            floorplan_layout[scoped_key] = {
                "x": floorplan_shelf.x,
                "y": floorplan_shelf.y,
            }

    floorplan_objects_payload = [
        {
            "id": obj.id,
            "type": obj.obj_type,
            "style": obj.style_class or "label",
            "text": obj.text or "",
            "x": obj.x,
            "y": obj.y,
            "w": obj.w,
            "h": obj.h,
        }
        for obj in floorplan_objects
    ]

    history_payload = [
        {
            "ts": movement.happened_at.isoformat() if movement.happened_at else movement.created_at.isoformat(),
            "icon": movement.icon or "•",
            "action": movement.action,
            "detail": movement.detail or "",
            "user": movement.username or "",
        }
        for movement in movements
    ]

    computed_state = {
        "depots": depots_payload,
        "activeDepotId": depots_payload[0]["id"] if depots_payload else None,
        "shelvesAll": shelves_all,
        "productsAll": products_all,
        "history": history_payload,
        "floorplan": {
            "layout": floorplan_layout,
            "objects": floorplan_objects_payload,
            "objSeq": len(floorplan_objects_payload),
        },
    }

    return {
        "revision": _revision_from_sync_state(sync_state),
        "state": snapshot.state_json or computed_state,
    }


async def _replace_state(db: AsyncSession, payload: dict[str, Any], current_user: User) -> None:
    state = payload.get("state") or {}
    depots_payload = state.get("depots") or []
    active_depot_id = state.get("activeDepotId")
    shelves_all = state.get("shelvesAll") or {}
    products_all = state.get("productsAll") or {}
    history_payload = state.get("history") or []
    floorplan = state.get("floorplan") or {}
    snapshot = await _get_state_snapshot(db)

    sync_state = await _get_sync_state(db)
    expected_revision = payload.get("expected_revision")
    current_revision = _revision_from_sync_state(sync_state)
    if expected_revision and expected_revision != current_revision:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"message": "Estado desatualizado no cliente. Recarregue os dados antes de salvar.", "current_revision": current_revision},
        )
    _enforce_state_permissions(current_user, snapshot.state_json or {}, state)

    for model in (QualitySummary, StockQualityState, Expiry, StockItem, InventoryMovement, Drawer, FloorPlanShelf, FloorPlanObject, Shelf, Product, Depot):
        await db.execute(delete(model))
    await db.flush()

    product_by_code: dict[str, Product] = {}
    shelf_by_code_per_depot: dict[tuple[str, str], Shelf] = {}
    drawer_by_key_per_depot: dict[tuple[str, str], Drawer] = {}
    quality_entries: list[dict[str, Any]] = []
    quality_summary: dict[tuple[str, str | None], dict[str, Any]] = {
        ("global", None): {
            "label": "GLOBAL",
            "expired_count": 0,
            "expiring_count": 0,
            "quarantine_count": 0,
            "blocked_count": 0,
            "short_expiry_count": 0,
            "overdue_total_days": 0,
        }
    }

    for depot_data in depots_payload:
        depot = Depot(
            id=depot_data.get("id"),
            name=depot_data.get("name") or "Depósito",
            address=depot_data.get("address"),
            city=depot_data.get("city"),
            manager=depot_data.get("manager"),
            phone=depot_data.get("phone"),
            notes=depot_data.get("notes"),
            allow_overcapacity=bool(depot_data.get("allowOvercapacity")),
        )
        db.add(depot)
        await db.flush()
        quality_summary[("depot", depot.id)] = {
            "label": depot.name,
            "expired_count": 0,
            "expiring_count": 0,
            "quarantine_count": 0,
            "blocked_count": 0,
            "short_expiry_count": 0,
            "overdue_total_days": 0,
        }

        for shelf_data in shelves_all.get(depot.id, []):
            shelf = Shelf(
                depot_id=depot.id,
                code=shelf_data.get("id"),
                shelf_type=shelf_data.get("type") or "normal",
                floors=int(shelf_data.get("floors") or 1),
                drawers_per_floor=int(shelf_data.get("drawers") or 1),
                max_kg_per_drawer=float(shelf_data.get("maxKg") or 50),
            )
            db.add(shelf)
            await db.flush()
            shelf_by_code_per_depot[(depot.id, shelf.code)] = shelf

            for floor in range(1, shelf.floors + 1):
                for drawer_number in range(1, shelf.drawers_per_floor + 1):
                    key = f"{shelf.code}{floor}.G{drawer_number}"
                    drawer = Drawer(
                        shelf_id=shelf.id,
                        floor_number=floor,
                        drawer_number=drawer_number,
                        drawer_key=key,
                    )
                    db.add(drawer)
                    await db.flush()
                    drawer_by_key_per_depot[(depot.id, key)] = drawer

        for drawer_key, items in products_all.get(depot.id, {}).items():
            drawer = drawer_by_key_per_depot.get((depot.id, drawer_key))
            if not drawer:
                continue
            for item in items:
                code = item.get("code")
                if not code:
                    continue
                product = product_by_code.get(code)
                if not product:
                    product = Product(
                        code=code,
                        name=item.get("name") or code,
                        sku=item.get("sku"),
                        ean=item.get("ean"),
                        category=item.get("category"),
                        family=item.get("family"),
                        supplier=item.get("supplier"),
                        unit=item.get("unit"),
                        brand=item.get("brand"),
                        manufacturer=item.get("manufacturer"),
                        model=item.get("model"),
                        ncm=item.get("ncm"),
                        anvisa=item.get("anvisa"),
                        temp_min=item.get("tempMin"),
                        temp_max=item.get("tempMax"),
                        min_stock=item.get("minStock"),
                        max_stock=item.get("maxStock"),
                        reorder_point=item.get("reorderPoint"),
                        length_cm=item.get("lengthCm"),
                        width_cm=item.get("widthCm"),
                        height_cm=item.get("heightCm"),
                        is_perishable=item.get("perishable") in {"yes", "frozen"},
                        serial_control=item.get("serialControl"),
                        expiry_control=item.get("expiryControl", "yes") != "no",
                        notes=item.get("notes"),
                    )
                    db.add(product)
                    await db.flush()
                    product_by_code[code] = product

                stock_item = StockItem(
                    product_id=product.id,
                    drawer_id=drawer.id,
                    quantity=int(item.get("qty") or 1),
                    kg=float(item.get("kgTotal") or item.get("kg") or 0),
                    kg_per_unit=item.get("kgPerUnit"),
                    lot=item.get("lot"),
                    entry_date=datetime.fromisoformat(item["entry"]).date() if item.get("entry") else None,
                    notes=item.get("notes"),
                )
                db.add(stock_item)
                await db.flush()
                expiry_dates: list[date] = []
                for expiry_value in item.get("expiries") or []:
                    if not expiry_value:
                        continue
                    expiry_date = datetime.fromisoformat(expiry_value).date()
                    expiry_dates.append(expiry_date)
                    db.add(Expiry(stock_item_id=stock_item.id, date_value=expiry_date))

                nearest_expiry = min(expiry_dates) if expiry_dates else None
                days_to_expiry = (nearest_expiry - date.today()).days if nearest_expiry else None
                expiry_status = "none"
                days_overdue = None
                if nearest_expiry:
                    if days_to_expiry is not None and days_to_expiry < 0:
                        expiry_status = "expired"
                        days_overdue = abs(days_to_expiry)
                    elif days_to_expiry is not None and days_to_expiry <= 30:
                        expiry_status = "expiring"
                    else:
                        expiry_status = "ok"
                shelf_type = shelf.shelf_type or "normal"
                quality_entries.append({
                    "stock_item_id": stock_item.id,
                    "depot_id": depot.id,
                    "shelf_id": shelf.id,
                    "drawer_id": drawer.id,
                    "drawer_key": drawer.drawer_key,
                    "product_code": product.code,
                    "shelf_type": shelf_type,
                    "nearest_expiry": nearest_expiry,
                    "expiry_status": expiry_status,
                    "days_to_expiry": days_to_expiry,
                    "days_overdue": days_overdue,
                    "has_expiry": bool(nearest_expiry),
                    "is_quarantine": shelf_type == "quarantine",
                    "is_blocked": shelf_type == "blocked",
                })
                for scope_key in (("global", None), ("depot", depot.id)):
                    summary = quality_summary[scope_key]
                    if expiry_status == "expired":
                        summary["expired_count"] += 1
                        summary["overdue_total_days"] += days_overdue or 0
                    elif expiry_status == "expiring":
                        summary["expiring_count"] += 1
                    if days_to_expiry is not None and 0 <= days_to_expiry <= 15:
                        summary["short_expiry_count"] += 1
                    if shelf_type == "quarantine":
                        summary["quarantine_count"] += 1
                    elif shelf_type == "blocked":
                        summary["blocked_count"] += 1

        if depot.id == active_depot_id or (not active_depot_id and depot_data == depots_payload[0]):
            for layout_key, coords in (floorplan.get("layout") or {}).items():
                shelf_code = layout_key.split("::", 1)[1] if "::" in layout_key else layout_key
                shelf = shelf_by_code_per_depot.get((depot.id, shelf_code))
                if not shelf:
                    continue
                db.add(FloorPlanShelf(
                    depot_id=depot.id,
                    shelf_id=shelf.id,
                    x=float(coords.get("x") or 0),
                    y=float(coords.get("y") or 0),
                    rotation=0.0,
                ))

            for obj in floorplan.get("objects") or []:
                db.add(FloorPlanObject(
                    id=obj.get("id"),
                    depot_id=depot.id,
                    obj_type=obj.get("type") or "textbox",
                    x=float(obj.get("x") or 0),
                    y=float(obj.get("y") or 0),
                    w=float(obj.get("w") or 0),
                    h=float(obj.get("h") or 0),
                    text=obj.get("text"),
                    style_class=obj.get("style"),
                ))

    for event in history_payload:
        payload_json = json.dumps(event, ensure_ascii=False)
        happened_at = datetime.fromisoformat(event["ts"].replace("Z", "+00:00")) if event.get("ts") else datetime.now(UTC)
        db.add(InventoryMovement(
            action=event.get("action") or "Evento",
            icon=event.get("icon"),
            detail=event.get("detail"),
            happened_at=happened_at,
            user_id=current_user.id,
            username=event.get("user") or current_user.username,
            drawer_key=event.get("drawerKey"),
            product_code=event.get("productCode"),
            payload_json=payload_json,
        ))

    now = datetime.now(UTC)
    for quality_entry in quality_entries:
        db.add(StockQualityState(
            stock_item_id=quality_entry["stock_item_id"],
            depot_id=quality_entry["depot_id"],
            shelf_id=quality_entry["shelf_id"],
            drawer_id=quality_entry["drawer_id"],
            drawer_key=quality_entry["drawer_key"],
            product_code=quality_entry["product_code"],
            shelf_type=quality_entry["shelf_type"],
            nearest_expiry=quality_entry["nearest_expiry"],
            expiry_status=quality_entry["expiry_status"],
            days_to_expiry=quality_entry["days_to_expiry"],
            days_overdue=quality_entry["days_overdue"],
            has_expiry=quality_entry["has_expiry"],
            is_quarantine=quality_entry["is_quarantine"],
            is_blocked=quality_entry["is_blocked"],
            computed_at=now,
        ))

    for (scope_type, scope_id), summary in quality_summary.items():
        db.add(QualitySummary(
            scope_type=scope_type,
            scope_id=scope_id,
            label=summary["label"],
            expired_count=summary["expired_count"],
            expiring_count=summary["expiring_count"],
            quarantine_count=summary["quarantine_count"],
            blocked_count=summary["blocked_count"],
            short_expiry_count=summary["short_expiry_count"],
            overdue_total_days=summary["overdue_total_days"],
            computed_at=now,
        ))

    sync_state.last_pushed_at = datetime.now(UTC)
    sync_state.version += 1
    snapshot.revision = _revision_from_sync_state(sync_state)
    snapshot.state_json = _merge_snapshot_state(snapshot.state_json or {}, state)
    snapshot.source = current_user.username or getattr(current_user, "email", None) or "system"
    snapshot.notes = f"Snapshot atualizado por {snapshot.source}"
    await db.commit()


