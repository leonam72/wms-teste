"""
NFe folder watcher — monitora pasta configurada em NFE_XML_DIR.

Usa watchdog para detectar novos XMLs. Ao detectar um arquivo .xml:
  1. Tenta parsear como NF-e válida
  2. Verifica se já existe sessão para a mesma chave de acesso
  3. Se não existir: cria um registro de sessão no status 'aguardando_conferencia'
     para que o painel de recebimento mostre o XML como pendente imediatamente

Inicia como lifespan task do FastAPI (asyncio + thread watchdog).
"""
from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import UTC, datetime
from pathlib import Path
from threading import Thread

logger = logging.getLogger(__name__)

try:
    from watchdog.events import FileCreatedEvent, FileSystemEventHandler
    from watchdog.observers import Observer
    _WATCHDOG_AVAILABLE = True
except ImportError:
    _WATCHDOG_AVAILABLE = False
    logger.warning("[nfe-watcher] watchdog não instalado — instale com: pip install watchdog")

from backend.app.core.config import settings
from backend.app.core.database import SessionLocal
from backend.app.core.nfe_parser import NFeParserError, parse_nfe_file
from backend.app.models.receiving import NFeReceivingSession

_observer: "Observer | None" = None  # type: ignore[name-defined]
_loop: asyncio.AbstractEventLoop | None = None


class _NFeHandler(FileSystemEventHandler if _WATCHDOG_AVAILABLE else object):  # type: ignore[misc]
    """Reage a criação de arquivos .xml na pasta monitorada."""

    def on_created(self, event: "FileCreatedEvent") -> None:  # type: ignore[override]
        if event.is_directory:
            return
        path = Path(str(event.src_path))
        if path.suffix.lower() != ".xml":
            return
        logger.info("[nfe-watcher] Novo arquivo detectado: %s", path.name)
        if _loop and _loop.is_running():
            asyncio.run_coroutine_threadsafe(_handle_new_xml(path), _loop)


async def _handle_new_xml(path: Path) -> None:
    """Tenta registrar a NF-e como pendente no banco de dados."""
    await asyncio.sleep(0.5)  # aguarda o arquivo ser gravado completamente
    try:
        parsed = parse_nfe_file(path)
    except NFeParserError as exc:
        logger.warning("[nfe-watcher] XML inválido ignorado %s: %s", path.name, exc)
        return

    async with SessionLocal() as db:
        from sqlalchemy import select
        existing = (
            await db.execute(
                select(NFeReceivingSession).where(
                    NFeReceivingSession.chave_acesso == parsed.chave_acesso
                ).limit(1)
            )
        ).scalars().first()

        if existing:
            logger.info(
                "[nfe-watcher] NF-e %s já tem sessão (%s), ignorando.",
                parsed.numero_nf,
                existing.status,
            )
            return

        session = NFeReceivingSession(
            id=str(uuid.uuid4()),
            chave_acesso=parsed.chave_acesso,
            numero_nf=parsed.numero_nf,
            serie=parsed.serie,
            emitente_nome=parsed.emitente.get("nome"),
            emitente_cnpj=parsed.emitente.get("cnpj"),
            status="aguardando_conferencia",
            started_at=datetime.now(UTC),
            version=1,
        )
        db.add(session)
        await db.commit()
        logger.info(
            "[nfe-watcher] NF-e %s (chave %s) registrada como aguardando_conferencia.",
            parsed.numero_nf,
            parsed.chave_acesso,
        )


def start_watcher(loop: asyncio.AbstractEventLoop) -> None:
    """Inicia o observer watchdog em thread dedicada."""
    global _observer, _loop

    if not _WATCHDOG_AVAILABLE:
        logger.warning("[nfe-watcher] watchdog indisponível — instale com: pip install watchdog")
        return

    xml_dir = Path(settings.NFE_XML_DIR).expanduser().resolve()
    if not xml_dir.exists():
        logger.warning(
            "[nfe-watcher] Pasta NFE_XML_DIR não encontrada: %s — watcher não iniciado.",
            xml_dir,
        )
        return

    _loop = loop
    handler = _NFeHandler()
    _observer = Observer()
    _observer.schedule(handler, str(xml_dir), recursive=False)

    thread = Thread(target=_observer.start, daemon=True, name="nfe-watcher")
    thread.start()
    logger.info("[nfe-watcher] Monitorando pasta: %s", xml_dir)


def stop_watcher() -> None:
    """Para o observer watchdog."""
    global _observer
    if _observer and _observer.is_alive():
        _observer.stop()
        _observer.join(timeout=5)
        logger.info("[nfe-watcher] Parado.")
    _observer = None
