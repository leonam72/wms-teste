from sqlalchemy.ext.asyncio import AsyncSession
from ..models.audit import AuditLog
from ..models.auth import User

class AuditService:
    @staticmethod
    async def log(db: AsyncSession, operator: User, tag: str, description: str, entity_type: str = None, entity_id: str = None):
        """Registra um evento de auditoria no banco de dados."""
        new_log = AuditLog(
            operator_id=operator.id,
            action_tag=tag,
            description=description,
            entity_type=entity_type,
            entity_id=entity_id
        )
        db.add(new_log)
        await db.flush()
        return new_log
