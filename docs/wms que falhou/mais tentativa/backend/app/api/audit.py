from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from ..models.audit import AuditLog
from .deps import get_current_user, get_db

router = APIRouter(dependencies=[Depends(get_current_user)])

@router.get("/")
async def list_audit_logs(
    db: AsyncSession = Depends(get_db)
):
    # Lista os últimos 100 logs com o operador
    stmt = (
        select(AuditLog)
        .options(selectinload(AuditLog.operator))
        .order_by(AuditLog.created_at.desc())
        .limit(100)
    )
    result = await db.execute(stmt)
    return result.scalars().all()
