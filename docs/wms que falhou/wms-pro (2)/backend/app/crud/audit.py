import json
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.audit import AuditLog


def _serialize_value(value: Any) -> str | None:
    if value is None:
        return None
    return json.dumps(value, ensure_ascii=False, default=str, sort_keys=True)


async def create_audit_log(
    db: AsyncSession,
    *,
    user_id: str | None,
    username: str | None,
    action: str,
    table_name: str,
    record_id: str | None = None,
    old_value: Any = None,
    new_value: Any = None,
    ip_address: str | None = None,
) -> AuditLog:
    row = AuditLog(
        user_id=user_id,
        username=username,
        action=action,
        table_name=table_name,
        record_id=record_id,
        old_value=_serialize_value(old_value),
        new_value=_serialize_value(new_value),
        ip_address=ip_address,
    )
    db.add(row)
    await db.flush()
    return row
