"""
Rate limiting de login persistido em SQLite.

Estratégia: tabela `login_attempts` com TTL de janela deslizante.
Sobrevive a restarts e funciona corretamente com múltiplos workers.
"""
from __future__ import annotations
import asyncio
from sqlalchemy import text
from backend.app.core.database import engine

LOGIN_WINDOW_SECONDS = 60
LOGIN_ATTEMPT_LIMIT = 5

# Fallback em memória para quando o banco ainda não está disponível (startup)
from collections import defaultdict, deque
from time import time as _time
_memory_fallback: dict[str, deque[float]] = defaultdict(deque)


def _bucket_key(ip_address: str | None, username: str | None) -> str:
    ip = (ip_address or "unknown").strip()
    user = (username or "").strip().lower()
    return f"{ip}::{user}"


async def _ensure_table() -> None:
    """Cria a tabela de rate limit se não existir."""
    async with engine.begin() as conn:
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS login_attempts (
                bucket_key TEXT NOT NULL,
                attempted_at REAL NOT NULL
            )
        """))
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_login_attempts_bucket ON login_attempts(bucket_key)"
        ))


async def _count_recent(bucket: str) -> int:
    """Conta tentativas recentes para o bucket."""
    cutoff = _time() - LOGIN_WINDOW_SECONDS
    async with engine.connect() as conn:
        result = await conn.execute(
            text("SELECT COUNT(*) FROM login_attempts WHERE bucket_key = :b AND attempted_at > :c"),
            {"b": bucket, "c": cutoff},
        )
        row = result.fetchone()
        return row[0] if row else 0


async def _oldest_attempt(bucket: str) -> float | None:
    async with engine.connect() as conn:
        cutoff = _time() - LOGIN_WINDOW_SECONDS
        result = await conn.execute(
            text("SELECT MIN(attempted_at) FROM login_attempts WHERE bucket_key = :b AND attempted_at > :c"),
            {"b": bucket, "c": cutoff},
        )
        row = result.fetchone()
        return row[0] if row and row[0] else None


async def _register_failure_db(bucket: str) -> None:
    async with engine.begin() as conn:
        await conn.execute(
            text("INSERT INTO login_attempts(bucket_key, attempted_at) VALUES (:b, :t)"),
            {"b": bucket, "t": _time()},
        )
        # Limpar entradas antigas periodicamente
        cutoff = _time() - LOGIN_WINDOW_SECONDS * 2
        await conn.execute(
            text("DELETE FROM login_attempts WHERE attempted_at < :c"),
            {"c": cutoff},
        )


async def _clear_attempts_db(bucket: str) -> None:
    async with engine.begin() as conn:
        await conn.execute(
            text("DELETE FROM login_attempts WHERE bucket_key = :b"),
            {"b": bucket},
        )


def check_login_allowed(ip_address: str | None, username: str | None) -> tuple[bool, int]:
    """Versão síncrona-compatível: usa fallback em memória."""
    key = _bucket_key(ip_address, username)
    now = _time()
    bucket = _memory_fallback[key]
    while bucket and now - bucket[0] > LOGIN_WINDOW_SECONDS:
        bucket.popleft()
    if len(bucket) >= LOGIN_ATTEMPT_LIMIT:
        retry_after = max(1, int(LOGIN_WINDOW_SECONDS - (now - bucket[0])))
        return False, retry_after
    return True, 0


async def check_login_allowed_async(ip_address: str | None, username: str | None) -> tuple[bool, int]:
    """Consulta o bucket persistido para manter o rate limit consistente entre workers."""
    key = _bucket_key(ip_address, username)
    try:
        count = await _count_recent(key)
        if count >= LOGIN_ATTEMPT_LIMIT:
            oldest_attempt = await _oldest_attempt(key)
            now = _time()
            if oldest_attempt is None:
                return False, LOGIN_WINDOW_SECONDS
            retry_after = max(1, int(LOGIN_WINDOW_SECONDS - (now - oldest_attempt)))
            return False, retry_after
        return True, 0
    except Exception:
        return check_login_allowed(ip_address, username)


def register_login_failure(ip_address: str | None, username: str | None) -> None:
    """Registra falha em memória e agenda escrita assíncrona no banco."""
    key = _bucket_key(ip_address, username)
    now = _time()
    bucket = _memory_fallback[key]
    while bucket and now - bucket[0] > LOGIN_WINDOW_SECONDS:
        bucket.popleft()
    bucket.append(now)
    # Tenta persistir no banco de forma assíncrona se houver loop ativo
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(_register_failure_db(key))
    except RuntimeError:
        pass  # Sem loop = só memória


def clear_login_attempts(ip_address: str | None, username: str | None) -> None:
    """Limpa tentativas em memória e agenda limpeza no banco."""
    key = _bucket_key(ip_address, username)
    _memory_fallback.pop(key, None)
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(_clear_attempts_db(key))
    except RuntimeError:
        pass
