"""
Rotas de recebimento NF-e — fluxo de conferência às cegas com aprovação hierárquica.

Ciclo de vida de uma NFeReceivingSession:
  aguardando_conferencia  (criado pelo watcher ao detectar XML na pasta)
  em_conferencia          (conferente iniciou — via POST /nfe/receiving/start)
  pending_review          (conferente fechou — via POST /nfe/receiving/close)
                           ↓ itens NÃO entram no estoque ainda
  approved                (supervisor aprovou — via POST /nfe/receiving/{id}/approve)
                           → itens são aplicados ao estoque neste momento
  rejected                (supervisor reprovou — via POST /nfe/receiving/{id}/reject)
                           → conferente recebe alerta, nova sessão pode ser criada
                             com reconferencia_de apontando para esta
"""
from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path
from typing import Any
import json
import re
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api import deps
from backend.app.api.routes_wms import (
    _append_audit_log,
    _get_state_snapshot,
    _get_sync_state,
    _next_revision_value,
    _normalize_unit,
    _revision_from_sync_state,
    _safe_float,
    _safe_int,
    _validate_products_snapshot_state,
)
from backend.app.core.config import settings
from backend.app.core.database import get_db
from backend.app.core.nfe_parser import NFeParserError, blind_payload, parse_nfe_file
from backend.app.models.auth import User
from backend.app.models.inventory import Product, LicensePlate, StockItem, Task
from backend.app.models.receiving import NFeReceivingSession
from backend.app.models.sync import SyncState
from backend.app.services import task_service, slotting_service

router = APIRouter()

# ---------------------------------------------------------------------------
# Payloads
# ---------------------------------------------------------------------------

class ReceivingStartPayload(BaseModel):
    chave_acesso: str = Field(min_length=44, max_length=44)
    placa_veiculo: str | None = None
    operador_id: str | None = None
    depot_id: str
    reconferencia_de: str | None = None  # session_id da sessão reprovada que está sendo refeita


class ReceivingLineItem(BaseModel):
    """Um item da tabela de conferência com qtd total + breakdown por condição."""
    codigo_produto: str | None = None
    descricao: str | None = None
    ean: str | None = None
    ncm: str | None = None
    unidade_conferida: str | None = None
    qty_conferida: float           # total físico contado
    qty_ok: float = 0.0            # ← novo: OK (vai para estoque normal)
    qty_avariadas: float = 0.0     # ← novo: Avariadas (vai para estoque bloqueado)
    qty_devolvidas: float = 0.0    # ← novo: Devolvidas (não entra no estoque)
    lote: str | None = None
    validade: str | None = None
    observacao: str | None = None
    foto_avaria_base64: str | None = None
    item_extra: bool = False


class ReceivingClosePayload(BaseModel):
    session_id: str
    itens_conferidos: list[ReceivingLineItem]
    placa_veiculo: str | None = None
    observacao_fechamento: str | None = None
    expected_revision: str | None = None


class ApprovePayload(BaseModel):
    observacao: str | None = None
    expected_revision: str | None = None


class RejectPayload(BaseModel):
    motivo_reprovacao: str = Field(min_length=1, max_length=1000)
    expected_revision: str | None = None


# ---------------------------------------------------------------------------
# Helpers internos
# ---------------------------------------------------------------------------

def _nfe_xml_dir() -> Path:
    return Path(settings.NFE_XML_DIR).expanduser().resolve()


def _normalize_plate(value: str | None) -> str | None:
    text = re.sub(r"[^A-Za-z0-9]", "", str(value or "").upper())
    return text[:8] or None


def _normalize_text(value: Any, limit: int = 255) -> str | None:
    text = re.sub(r"\s+", " ", str(value or "").strip())
    return text[:limit] if text else None


def _current_timestamp() -> datetime:
    return datetime.now(UTC)


def _load_json_field(raw: str | None) -> list[dict[str, Any]]:
    try:
        return json.loads(raw) if raw else []
    except json.JSONDecodeError:
        return []


def _find_xml_path_by_key(chave_acesso: str) -> Path:
    xml_dir = _nfe_xml_dir()
    if not xml_dir.exists():
        raise HTTPException(status_code=404, detail="Diretório de XML de NF-e não encontrado.")
    for path in sorted(xml_dir.glob("*.xml")):
        try:
            parsed = parse_nfe_file(path)
        except NFeParserError:
            continue
        if parsed.chave_acesso == chave_acesso:
            return path
    raise HTTPException(status_code=404, detail="NF-e não encontrada para a chave informada.")


def _format_duration_seconds(started_at: datetime | None, ended_at: datetime | None) -> int | None:
    if not started_at or not ended_at:
        return None
    return max(0, int((ended_at - started_at).total_seconds()))


async def _load_product_catalog(db: AsyncSession) -> tuple[dict[str, Product], dict[str, Product], dict[str, Product]]:
    rows = (await db.execute(select(Product))).scalars().all()
    by_code: dict[str, Product] = {}
    by_ean: dict[str, Product] = {}
    by_name: dict[str, Product] = {}
    for row in rows:
        if row.code:
            by_code[row.code.strip().upper()] = row
        if row.ean:
            by_ean[row.ean.strip().upper()] = row
        if row.name:
            by_name[row.name.strip().upper()] = row
    return by_code, by_ean, by_name


def _find_catalog_product(
    item: dict[str, Any],
    by_code: dict[str, Product],
    by_ean: dict[str, Product],
    by_name: dict[str, Product],
) -> Product | None:
    code = _normalize_text(item.get("codigo_produto") or "", 80)
    ean = _normalize_text(item.get("ean") or "", 40)
    desc = _normalize_text(item.get("descricao") or "", 255)
    if code and code.upper() in by_code:
        return by_code[code.upper()]
    if ean and ean.upper() in by_ean:
        return by_ean[ean.upper()]
    if desc and desc.upper() in by_name:
        return by_name[desc.upper()]
    return None


def _drawer_key_for(shelf_id: str, floor_number: int, drawer_number: int) -> str:
    return f"{shelf_id}{floor_number}.G{drawer_number}"


def _collect_drawer_usage(products_all: dict[str, Any], drawer_key: str) -> float:
    return sum(_safe_float(item.get("kgTotal") or item.get("kg")) for item in (products_all.get(drawer_key) or []))


def _find_destination_drawer(
    state: dict[str, Any],
    depot_id: str,
    incoming_kg: float,
    *,
    product_code: str | None = None,
    blocked_only: bool = False,
) -> str | None:
    shelves = (state.get("shelvesAll") or {}).get(depot_id) or []
    depot_products = (state.get("productsAll") or {}).setdefault(depot_id, {})
    eligible_shelves = []
    for shelf in shelves:
        shelf_type = (shelf.get("type") or shelf.get("shelf_type") or "normal").lower()
        if blocked_only and shelf_type != "blocked":
            continue
        if not blocked_only and shelf_type != "normal":
            continue
        eligible_shelves.append(shelf)

    for prefer_existing in (True, False):
        for shelf in eligible_shelves:
            floors = _safe_int(shelf.get("floors"))
            drawers = _safe_int(shelf.get("drawers"))
            max_kg = _safe_float(shelf.get("maxKg") or 50)
            shelf_id = shelf.get("id")
            if not shelf_id or floors <= 0 or drawers <= 0:
                continue
            for floor_number in range(1, floors + 1):
                for drawer_number in range(1, drawers + 1):
                    drawer_key = _drawer_key_for(shelf_id, floor_number, drawer_number)
                    current_items = depot_products.get(drawer_key) or []
                    has_same_product = any(
                        (item.get("code") or "").upper() == (product_code or "").upper()
                        for item in current_items
                    )
                    if prefer_existing and not has_same_product:
                        continue
                    if not prefer_existing and has_same_product:
                        continue
                    current_kg = _collect_drawer_usage(depot_products, drawer_key)
                    if current_kg + incoming_kg <= max_kg + 0.11:
                        return drawer_key
    return None


def _find_blocked_destination(state: dict[str, Any], incoming_kg: float, product_code: str | None) -> tuple[str, str] | None:
    for depot in state.get("depots") or []:
        depot_id = depot.get("id")
        if not depot_id:
            continue
        drawer_key = _find_destination_drawer(state, depot_id, incoming_kg, product_code=product_code, blocked_only=True)
        if drawer_key:
            return depot_id, drawer_key
    return None


def _build_stock_entry(
    item: dict[str, Any],
    matched_product: Product | None,
    *,
    qty: float,
    unit: str,
    lot: str | None,
    validade: str | None,
    lpn: str | None = None,
    status: str = "available",
) -> dict[str, Any]:
    qty_value = max(0.0, float(qty))
    if matched_product and matched_product.length_cm and matched_product.width_cm and matched_product.height_cm:
        kg_per_unit = round(max(0.02, (matched_product.length_cm * matched_product.width_cm * matched_product.height_cm) / 80000), 3)
    elif matched_product and matched_product.unit and matched_product.unit.upper() == "KG":
        kg_per_unit = 1.0
    else:
        kg_per_unit = 0.08
    kg_total = round(qty_value * kg_per_unit, 3)
    expiries = [validade] if validade else []
    
    entry = {
        "code": (matched_product.code if matched_product and matched_product.code else item.get("codigo_produto") or item.get("codigo") or "SEM-COD").strip(),
        "name": matched_product.name if matched_product and matched_product.name else (item.get("descricao") or "ITEM NF-E"),
        "sku": matched_product.sku if matched_product else None,
        "ean": matched_product.ean if matched_product and matched_product.ean else item.get("ean"),
        "category": matched_product.category if matched_product else None,
        "family": matched_product.family if matched_product else None,
        "supplier": None,
        "unit": _normalize_unit(matched_product.unit if matched_product and matched_product.unit else unit),
        "brand": matched_product.brand if matched_product else item.get("marca"),
        "manufacturer": matched_product.manufacturer if matched_product else item.get("fabricante"),
        "model": matched_product.model if matched_product else None,
        "ncm": matched_product.ncm if matched_product and matched_product.ncm else item.get("ncm"),
        "anvisa": matched_product.anvisa if matched_product else None,
        "tempMin": matched_product.temp_min if matched_product else None,
        "tempMax": matched_product.temp_max if matched_product else None,
        "minStock": matched_product.min_stock if matched_product else None,
        "maxStock": matched_product.max_stock if matched_product else None,
        "reorderPoint": matched_product.reorder_point if matched_product else None,
        "lengthCm": matched_product.length_cm if matched_product else None,
        "widthCm": matched_product.width_cm if matched_product else None,
        "heightCm": matched_product.height_cm if matched_product else None,
        "perishable": "yes" if matched_product and matched_product.is_perishable else ("yes" if validade else "no"),
        "serialControl": matched_product.serial_control if matched_product else "none",
        "expiryControl": "yes" if validade else ("yes" if matched_product and matched_product.expiry_control else "no"),
        "notes": item.get("observacao") or "Recebimento NF-e",
        "qty": int(qty_value) if float(qty_value).is_integer() else round(qty_value, 3),
        "kg": kg_total,
        "kgTotal": kg_total,
        "kgPerUnit": kg_per_unit,
        "lot": lot,
        "entry": _current_timestamp().date().isoformat(),
        "expiries": expiries,
        "status": status,
    }
    if lpn:
        entry["lpn"] = lpn
    return entry


def _build_expected_map(parsed_nfe: dict[str, Any]) -> dict[str, dict[str, Any]]:
    expected: dict[str, dict[str, Any]] = {}
    for item in parsed_nfe["itens"]:
        code = (item.get("codigo") or "").strip()
        if not code:
            continue
        current = expected.setdefault(code, {
            "codigo": code,
            "descricao": item.get("descricao"),
            "ean": item.get("ean"),
            "ncm": item.get("ncm"),
            "unidade": item.get("unidade_comercial") or item.get("unidade_tributaria") or "UN",
            "qty_nota": 0.0,
            "marca": item.get("marca"),
            "fabricante": item.get("fabricante"),
        })
        current["qty_nota"] += _safe_float(item.get("quantidade_comercial"))
    return expected


def _validate_line_sum(item: ReceivingLineItem) -> str | None:
    """Valida que ok + avariadas + devolvidas == qty_conferida. Retorna mensagem de erro ou None."""
    subtotal = round(item.qty_ok + item.qty_avariadas + item.qty_devolvidas, 6)
    total = round(item.qty_conferida, 6)
    if abs(subtotal - total) > 0.001:
        code = item.codigo_produto or item.descricao or "item"
        return (
            f"Produto {code}: OK ({item.qty_ok}) + Avariadas ({item.qty_avariadas}) "
            f"+ Devolvidas ({item.qty_devolvidas}) = {subtotal} ≠ {total} (qtd conferida)."
        )
    return None


def _session_summary(session: NFeReceivingSession) -> dict[str, Any]:
    """Serializa uma sessão de recebimento.

    Usa getattr() com fallback em colunas adicionadas pela migration a1b2c3d4e5f6
    para garantir compatibilidade com bancos ainda não migrados.
    """
    itens     = _load_json_field(session.itens_json)
    itens_ok  = _load_json_field(getattr(session, "itens_ok_json",  None))
    itens_av  = _load_json_field(getattr(session, "itens_avariados_json", None))
    itens_dev = _load_json_field(getattr(session, "itens_devolvidos_json", None))
    aprovado_em_raw = getattr(session, "aprovado_em", None)
    return {
        "session_id":           session.id,
        "chave_acesso":         session.chave_acesso,
        "numero_nf":            session.numero_nf,
        "serie":                session.serie,
        "emitente":             {"nome": session.emitente_nome, "cnpj": session.emitente_cnpj},
        "operador":             session.operador_username,
        "placa_veiculo":        session.placa_veiculo,
        "depot_id":             session.depot_id,
        "status":               session.status,
        "started_at":           session.started_at.isoformat() if session.started_at else None,
        "ended_at":             session.ended_at.isoformat() if session.ended_at else None,
        "duracao_segundos":     session.duracao_segundos,
        "observacao_fechamento":session.observacao_fechamento,
        "aprovador":            getattr(session, "aprovador_username", None),
        "aprovado_em":          aprovado_em_raw.isoformat() if aprovado_em_raw else None,
        "motivo_reprovacao":    getattr(session, "motivo_reprovacao", None),
        "reconferencia_de":     getattr(session, "reconferencia_de", None),
        "total_itens":          len(itens or itens_ok),
        "itens_ok":             len(itens_ok),
        "itens_avariados":      len(itens_av),
        "itens_devolvidos":     len(itens_dev),
        "itens":                itens,
        "itens_ok_list":        itens_ok,
        "itens_avariados_list": itens_av,
        "itens_devolvidos_list":itens_dev,
    }


# ---------------------------------------------------------------------------
# Rotas
# ---------------------------------------------------------------------------

@router.get("/nfe/list", summary="Listar NF-es disponíveis e seu status")
async def list_nfe_xmls(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    deps.ensure_permission(current_user, "entry.register")
    xml_dir = _nfe_xml_dir()

    sessions = (
        await db.execute(select(NFeReceivingSession).order_by(NFeReceivingSession.updated_at.desc()))
    ).scalars().all()
    latest_by_key: dict[str, NFeReceivingSession] = {}
    for session in sessions:
        latest_by_key.setdefault(session.chave_acesso, session)

    items = []
    if xml_dir.exists():
        for path in sorted(xml_dir.glob("*.xml")):
            try:
                parsed = parse_nfe_file(path)
            except NFeParserError:
                continue
            latest = latest_by_key.get(parsed.chave_acesso)
            items.append({
                "arquivo": path.name,
                "chave_acesso": parsed.chave_acesso,
                "numero_nf": parsed.numero_nf,
                "emitente": {
                    "nome": parsed.emitente.get("nome"),
                    "cnpj": parsed.emitente.get("cnpj"),
                },
                "data_emissao": parsed.data_emissao,
                "valor_total": parsed.valor_total,
                "status": latest.status if latest else "nova",
                "session_id": latest.id if latest else None,
            })
    return {"items": items, "dir": str(xml_dir)}


@router.get("/nfe/receiving/sessions", summary="Listar sessões de recebimento")
async def list_receiving_sessions(
    status_filter: str | None = Query(default=None, alias="status"),
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    deps.ensure_permission(current_user, "entry.register")
    query = select(NFeReceivingSession).order_by(NFeReceivingSession.started_at.desc()).limit(100)
    sessions = (await db.execute(query)).scalars().all()
    filtered = []
    for session in sessions:
        if status_filter and session.status != status_filter:
            continue
        started_date = session.started_at.date().isoformat() if session.started_at else None
        if date_from and started_date and started_date < date_from:
            continue
        if date_to and started_date and started_date > date_to:
            continue
        filtered.append(_session_summary(session))
    return {"items": filtered}


@router.get("/nfe/receiving/pending-approval", summary="Listar conferências aguardando aprovação")
async def list_pending_approval(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Exclusivo para supervisores+. Lista todas as sessões em pending_review."""
    deps.ensure_permission(current_user, "blind.count")
    sessions = (
        await db.execute(
            select(NFeReceivingSession)
            .where(NFeReceivingSession.status == "pending_review")
            .order_by(NFeReceivingSession.ended_at.desc())
        )
    ).scalars().all()
    return {"items": [_session_summary(s) for s in sessions]}


@router.get("/nfe/{chave_acesso}", summary="Detalhar NF-e para conferência cega")
async def get_nfe_blind_details(
    chave_acesso: str,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    deps.ensure_permission(current_user, "entry.register")
    path = _find_xml_path_by_key(chave_acesso)
    parsed = parse_nfe_file(path)
    return blind_payload(parsed)  # quantidades omitidas — blind_payload não as inclui


@router.post("/nfe/receiving/start", summary="Iniciar sessão de conferência")
async def start_receiving_session(
    payload: ReceivingStartPayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    deps.ensure_permission(current_user, "entry.register")
    chave = payload.chave_acesso.strip()
    if len(chave) != 44 or not chave.isdigit():
        raise HTTPException(status_code=400, detail="Chave de acesso inválida.")

    path = _find_xml_path_by_key(chave)
    parsed = parse_nfe_file(path)

    # Verificar se há sessão em andamento para esta NF-e
    open_session = (
        await db.execute(
            select(NFeReceivingSession).where(
                NFeReceivingSession.chave_acesso == chave,
                NFeReceivingSession.status == "em_conferencia",
            ).limit(1)
        )
    ).scalars().first()
    if open_session:
        raise HTTPException(status_code=409, detail="Já existe uma sessão em andamento para esta NF-e.")

    # Se existe sessão aguardando do watcher, reutilizar o ID; senão criar novo
    watcher_session = (
        await db.execute(
            select(NFeReceivingSession).where(
                NFeReceivingSession.chave_acesso == chave,
                NFeReceivingSession.status == "aguardando_conferencia",
            ).limit(1)
        )
    ).scalars().first()

    now = _current_timestamp()

    if watcher_session:
        watcher_session.status = "em_conferencia"
        watcher_session.placa_veiculo = _normalize_plate(payload.placa_veiculo)
        watcher_session.depot_id = payload.depot_id
        watcher_session.operador_id = current_user.id
        watcher_session.operador_username = current_user.username
        watcher_session.started_at = now
        watcher_session.reconferencia_de = payload.reconferencia_de
        watcher_session.version += 1
        session = watcher_session
    else:
        session = NFeReceivingSession(
            id=str(uuid.uuid4()),
            chave_acesso=parsed.chave_acesso,
            numero_nf=parsed.numero_nf,
            serie=parsed.serie,
            emitente_nome=parsed.emitente.get("nome"),
            emitente_cnpj=parsed.emitente.get("cnpj"),
            placa_veiculo=_normalize_plate(payload.placa_veiculo),
            depot_id=payload.depot_id,
            operador_id=current_user.id,
            operador_username=current_user.username,
            status="em_conferencia",
            started_at=now,
            reconferencia_de=payload.reconferencia_de,
            version=1,
        )
        db.add(session)

    await _append_audit_log(
        db, current_user, action="receiving_start",
        table_name="nfe_receiving_sessions", record_id=session.id,
        new_value={"chave_acesso": session.chave_acesso, "numero_nf": session.numero_nf,
                   "depot_id": session.depot_id, "reconferencia_de": payload.reconferencia_de},
    )
    await db.commit()

    return {
        "session": {
            "id": session.id,
            "chave_acesso": session.chave_acesso,
            "numero_nf": session.numero_nf,
            "serie": session.serie,
            "emitente": {"nome": session.emitente_nome, "cnpj": session.emitente_cnpj,
                         "uf": parsed.emitente.get("uf")},
            "transportadora": parsed.transportadora,
            "placa_veiculo": session.placa_veiculo,
            "depot_id": session.depot_id,
            "operador": session.operador_username,
            "started_at": session.started_at.isoformat(),
            "status": session.status,
            "reconferencia_de": session.reconferencia_de,
        },
        "blind": blind_payload(parsed),  # produtos sem quantidades
    }


@router.post("/nfe/receiving/close", summary="Fechar conferência — vai para fila de aprovação")
async def close_receiving_session(
    payload: ReceivingClosePayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Fecha a conferência. NÃO aplica os itens ao estoque.
    Muda status para pending_review e aguarda aprovação do supervisor.

    Valida: para cada linha, OK + Avariadas + Devolvidas == Qtd conferida.
    """
    deps.ensure_permission(current_user, "entry.register")

    session = (
        await db.execute(
            select(NFeReceivingSession).where(NFeReceivingSession.id == payload.session_id).limit(1)
        )
    ).scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Sessão de recebimento não encontrada.")
    if session.status != "em_conferencia":
        raise HTTPException(status_code=409, detail=f"Sessão no status '{session.status}' não pode ser fechada.")

    # Validar soma por linha
    errors: list[str] = []
    for item in payload.itens_conferidos:
        err = _validate_line_sum(item)
        if err:
            errors.append(err)
    if errors:
        raise HTTPException(
            status_code=422,
            detail={"message": "Soma de condições não bate com a quantidade conferida.", "erros": errors},
        )

    if not payload.itens_conferidos:
        raise HTTPException(status_code=400, detail="Nenhum item conferido foi informado.")

    # Carregar NF-e para calcular divergências (sem expor quantidades ao conferente)
    path = _find_xml_path_by_key(session.chave_acesso)
    parsed = parse_nfe_file(path)
    expected_map = _build_expected_map({"itens": parsed.itens})

    itens_ok: list[dict[str, Any]] = []
    itens_avariados: list[dict[str, Any]] = []
    itens_devolvidos: list[dict[str, Any]] = []
    divergencias: list[dict[str, Any]] = []
    todos_itens: list[dict[str, Any]] = []

    now = _current_timestamp()

    for raw in payload.itens_conferidos:
        qty_total = max(0.0, _safe_float(raw.qty_conferida))
        if qty_total <= 0:
            continue

        code = _normalize_text(raw.codigo_produto, 80) or ""
        expected = expected_map.get(code)
        qty_nota = _safe_float(expected.get("qty_nota")) if expected else 0.0
        item_extra = bool(raw.item_extra or not expected)
        diff = round(qty_total - qty_nota, 3)

        divergencia_tipo = None
        if item_extra:
            divergencia_tipo = "extra"
        elif raw.qty_avariadas > 0:
            divergencia_tipo = "avaria"
        elif diff < 0:
            divergencia_tipo = "falta"
        elif diff > 0:
            divergencia_tipo = "excesso"

        base = {
            "codigo_produto": code or None,
            "descricao": _normalize_text(raw.descricao, 255) or (expected.get("descricao") if expected else None),
            "ean": _normalize_text(raw.ean, 40) or (expected.get("ean") if expected else None),
            "ncm": _normalize_text(raw.ncm, 16) or (expected.get("ncm") if expected else None),
            "unidade_conferida": _normalize_unit(raw.unidade_conferida or (expected.get("unidade") if expected else "UN")),
            "qty_nota": qty_nota,
            "qty_conferida": qty_total,
            "qty_ok": max(0.0, _safe_float(raw.qty_ok)),
            "qty_avariadas": max(0.0, _safe_float(raw.qty_avariadas)),
            "qty_devolvidas": max(0.0, _safe_float(raw.qty_devolvidas)),
            "lote": _normalize_text(raw.lote, 80),
            "validade": _normalize_text(raw.validade, 40),
            "observacao": _normalize_text(raw.observacao, 1000),
            "foto_avaria_base64": raw.foto_avaria_base64,
            "item_extra": item_extra,
            "divergencia_tipo": divergencia_tipo,
            "diff": diff,
        }
        todos_itens.append(base)

        if divergencia_tipo:
            divergencias.append(base)

        qty_ok = max(0.0, _safe_float(raw.qty_ok))
        qty_av = max(0.0, _safe_float(raw.qty_avariadas))

        if qty_ok > 0:
            itens_ok.append({**base, "_qty_para_estoque": qty_ok})
        if qty_av > 0:
            itens_avariados.append({**base, "_qty_para_estoque": qty_av})
        if max(0.0, _safe_float(raw.qty_devolvidas)) > 0:
            itens_devolvidos.append({**base, "_qty_para_estoque": _safe_float(raw.qty_devolvidas)})

    # Determinar status final da sessão
    has_avaria = any(i.get("divergencia_tipo") == "avaria" for i in todos_itens)
    has_falta = any(i.get("divergencia_tipo") == "falta" for i in todos_itens)
    has_excesso = any(i.get("divergencia_tipo") in ("excesso", "extra") for i in todos_itens)

    # Salvar sessão como pending_review — NÃO toca no estoque
    session.status = "pending_review"
    session.ended_at = now
    session.duracao_segundos = _format_duration_seconds(session.started_at, now)
    session.placa_veiculo = _normalize_plate(payload.placa_veiculo or session.placa_veiculo)
    session.observacao_fechamento = _normalize_text(payload.observacao_fechamento, 4000)
    session.itens_json = json.dumps(todos_itens, ensure_ascii=False, default=str)
    session.itens_ok_json = json.dumps(itens_ok, ensure_ascii=False, default=str)
    session.itens_avariados_json = json.dumps(itens_avariados, ensure_ascii=False, default=str)
    session.itens_devolvidos_json = json.dumps(itens_devolvidos, ensure_ascii=False, default=str)
    session.version += 1

    await _append_audit_log(
        db, current_user, action="receiving_close",
        table_name="nfe_receiving_sessions", record_id=session.id,
        new_value={
            "status": "pending_review",
            "numero_nf": session.numero_nf,
            "total_itens": len(todos_itens),
            "divergencias": len(divergencias),
            "has_avaria": has_avaria,
            "has_falta": has_falta,
        },
    )
    await db.commit()

    return {
        "session_id": session.id,
        "status": session.status,
        "summary": {
            "numero_nf": session.numero_nf,
            "emitente": session.emitente_nome,
            "placa_veiculo": session.placa_veiculo,
            "duracao_segundos": session.duracao_segundos,
            "total_itens": len(todos_itens),
            "itens_ok": len(itens_ok),
            "itens_avariados": len(itens_avariados),
            "itens_devolvidos": len(itens_devolvidos),
            "divergencias": len(divergencias),
        },
        "divergencias": divergencias,
        "message": "Conferência registrada. Aguardando aprovação do supervisor para entrada no estoque.",
    }


@router.post("/nfe/receiving/{session_id}/approve", summary="Aprovar conferência e aplicar ao estoque")
async def approve_receiving_session(
    session_id: str,
    payload: ApprovePayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Supervisor+ aprova a conferência.
    Neste momento os itens OK e Avariados são aplicados ao estoque.
    Itens Devolvidos não entram no estoque.
    """
    deps.ensure_permission(current_user, "blind.count")

    session = (
        await db.execute(
            select(NFeReceivingSession).where(NFeReceivingSession.id == session_id).limit(1)
        )
    ).scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Sessão não encontrada.")
    if session.status != "pending_review":
        raise HTTPException(status_code=409, detail=f"Sessão no status '{session.status}' não pode ser aprovada.")

    sync_state = await _get_sync_state(db)
    snapshot = await _get_state_snapshot(db)
    current_revision = _revision_from_sync_state(sync_state)
    if payload.expected_revision and payload.expected_revision != current_revision:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"message": "Estado desatualizado. Recarregue antes de aprovar.", "current_revision": current_revision},
        )

    by_code, by_ean, by_name = await _load_product_catalog(db)
    itens_ok = _load_json_field(session.itens_ok_json)
    itens_avariados = _load_json_field(session.itens_avariados_json)

    next_state = dict(snapshot.state_json or {})
    next_state.setdefault("productsAll", {})
    next_state.setdefault("history", [])
    now = _current_timestamp()

    # Aplicar itens OK ao estoque normal
    for idx, item in enumerate(itens_ok):
        matched = _find_catalog_product(item, by_code, by_ean, by_name)
        qty = _safe_float(item.get("_qty_para_estoque") or item.get("qty_ok"))
        if qty <= 0:
            continue
        
        # Gera LPN automática para o item recebido
        generated_lpn = f"LPN-{session.id[:8]}-{idx+1:03d}"
        
        stock_entry = _build_stock_entry(
            item, matched, qty=qty,
            unit=item.get("unidade_conferida", "UN"),
            lot=item.get("lote"),
            validade=item.get("validade"),
            lpn=generated_lpn,
            status="available"
        )
        incoming_kg = _safe_float(stock_entry.get("kgTotal"))
        depot_id = session.depot_id or ""
        
        # USA O NOVO MOTOR DE SLOTTING
        drawer_key = slotting_service.find_best_drawer(
            next_state, 
            depot_id, 
            stock_entry.get("code"),
            stock_entry.get("family"),
            incoming_kg,
            is_quarantine=False
        )
        
        if not drawer_key:
            raise HTTPException(
                status_code=409,
                detail=f"Sem capacidade para alocar {stock_entry.get('code')} no depósito {depot_id}."
            )
        next_state["productsAll"].setdefault(depot_id, {}).setdefault(drawer_key, []).append(stock_entry)
        
        # 3. Cria a tarefa de Putaway no banco relacional (Motor de Tarefas)
        # Primeiro criamos a LPN no banco (se não existir)
        new_lpn = LicensePlate(
            code=generated_lpn,
            lpn_type="pallet",
            drawer_id=None, # Ainda na doca
            status="active"
        )
        db.add(new_lpn)
        await db.flush() # Para pegar o ID se necessário
        
        await task_service.create_putaway_task(
            db,
            task_type="putaway",
            license_plate_id=new_lpn.id,
            product_id=matched.id if matched else None,
            quantity=int(qty),
            from_drawer_id=None, # Origem: Doca/Recebimento
            to_drawer_id=None, # Destino sugerido será calculado depois ou via DrawerKey
            creator_id=current_user.id,
            notes=f"Recebimento NF {session.numero_nf}"
        )

        next_state["history"].insert(0, {
            "ts": now.isoformat(), "action": "receiving_approved",
            "detail": f"NF {session.numero_nf}: {stock_entry.get('code')} (LPN: {generated_lpn}) → {drawer_key}",
            "icon": "📥", "user": current_user.username,
            "depotId": depot_id, "depotName": depot_id,
            "to": drawer_key, "drawerKey": drawer_key,
            "productCode": stock_entry.get("code"),
            "lpn": generated_lpn
        })

    # Aplicar itens avariados ao estoque bloqueado
    for idx, item in enumerate(itens_avariados):
        matched = _find_catalog_product(item, by_code, by_ean, by_name)
        qty = _safe_float(item.get("_qty_para_estoque") or item.get("qty_avariadas"))
        if qty <= 0:
            continue
        
        stock_entry = _build_stock_entry(
            item, matched, qty=qty,
            unit=item.get("unidade_conferida", "UN"),
            lot=item.get("lote"),
            validade=item.get("validade"),
            status="quarantine" # Itens avariados entram como quarentena
        )
        incoming_kg = _safe_float(stock_entry.get("kgTotal"))
        
        # USA O NOVO MOTOR DE SLOTTING PARA AVARIAS (is_quarantine=True)
        # Tenta achar área de quarentena automaticamente em qualquer depósito
        target_depot_id = None
        target_drawer_key = None
        
        for depot in (next_state.get("depots") or []):
            d_id = depot.get("id")
            if not d_id: continue
            
            res = slotting_service.find_best_drawer(
                next_state,
                d_id,
                stock_entry.get("code"),
                stock_entry.get("family"),
                incoming_kg,
                is_quarantine=True
            )
            if res:
                target_depot_id = d_id
                target_drawer_key = res
                break
        
        if not target_drawer_key:
            raise HTTPException(status_code=409, detail="Nenhuma área de quarentena disponível para itens avariados.")
        
        next_state["productsAll"].setdefault(target_depot_id, {}).setdefault(target_drawer_key, []).append(stock_entry)
        next_state["history"].insert(0, {
            "ts": now.isoformat(), "action": "receiving_avaria_approved",
            "detail": f"NF {session.numero_nf}: {stock_entry.get('code')} → {target_drawer_key} (QUARENTENA)",
            "icon": "🛡", "user": current_user.username,
            "depotId": target_depot_id, "depotName": target_depot_id,
            "to": target_drawer_key, "drawerKey": target_drawer_key,
            "productCode": stock_entry.get("code"),
        })

    _validate_products_snapshot_state(next_state)

    result = await db.execute(
        update(SyncState)
        .where(SyncState.id == sync_state.id, SyncState.version == sync_state.version)
        .values(version=SyncState.version + 1, last_pushed_at=now, updated_at=now)
    )
    if result.rowcount == 0:
        await db.rollback()
        raise HTTPException(status_code=409, detail={"message": "Conflito de concorrência. Recarregue e tente novamente."})

    sync_state.version += 1
    revision_value = _next_revision_value(sync_state, now)
    snapshot.revision = revision_value
    snapshot.state_json = next_state
    snapshot.source = current_user.username or "system"
    snapshot.notes = f"Recebimento NF-e {session.numero_nf} aprovado por {snapshot.source}"

    session.status = "approved"
    session.aprovador_id = current_user.id
    session.aprovador_username = current_user.username
    session.aprovado_em = now
    session.version += 1

    await _append_audit_log(
        db, current_user, action="receiving_approved",
        table_name="nfe_receiving_sessions", record_id=session.id,
        new_value={"numero_nf": session.numero_nf, "itens_ok": len(itens_ok), "itens_avariados": len(itens_avariados)},
    )
    await db.commit()

    return {
        "session_id": session.id,
        "status": "approved",
        "revision": revision_value,
        "message": f"NF-e {session.numero_nf} aprovada. Itens aplicados ao estoque.",
    }


@router.post("/nfe/receiving/{session_id}/reject", summary="Reprovar conferência — devolve para reconferência")
async def reject_receiving_session(
    session_id: str,
    payload: RejectPayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Supervisor+ reprova a conferência.
    Nenhum item entra no estoque.
    A sessão fica em 'rejected' e o conferente pode criar uma nova sessão
    com reconferencia_de apontando para esta.
    """
    deps.ensure_permission(current_user, "blind.count")

    session = (
        await db.execute(
            select(NFeReceivingSession).where(NFeReceivingSession.id == session_id).limit(1)
        )
    ).scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Sessão não encontrada.")
    if session.status != "pending_review":
        raise HTTPException(status_code=409, detail=f"Sessão no status '{session.status}' não pode ser reprovada.")

    now = _current_timestamp()
    session.status = "rejected"
    session.aprovador_id = current_user.id
    session.aprovador_username = current_user.username
    session.aprovado_em = now
    session.motivo_reprovacao = _normalize_text(payload.motivo_reprovacao, 1000)
    session.version += 1

    await _append_audit_log(
        db, current_user, action="receiving_rejected",
        table_name="nfe_receiving_sessions", record_id=session.id,
        new_value={"numero_nf": session.numero_nf, "motivo": session.motivo_reprovacao},
    )
    await db.commit()

    return {
        "session_id": session.id,
        "status": "rejected",
        "motivo_reprovacao": session.motivo_reprovacao,
        "message": f"NF-e {session.numero_nf} reprovada. Conferente deverá refazer a conferência.",
    }
