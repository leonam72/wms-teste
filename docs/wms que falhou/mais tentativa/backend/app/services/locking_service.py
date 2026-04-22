from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from ..models.separation import LockSeparador
from datetime import datetime, timedelta

class LockingService:
    @staticmethod
    async def acquire_lock(db: AsyncSession, resource_type: str, resource_id: str, user_id: str, minutes: int = 30) -> Optional[LockSeparador]:
        """
        Tenta adquirir uma trava em um recurso (ex: uma tarefa de picking ou uma gaveta).
        """
        # 1. Verificar se já existe trava ativa
        query = select(LockSeparador).where(
            and_(
                LockSeparador.resource_type == resource_type,
                LockSeparador.resource_id == resource_id,
                LockSeparador.ativo == True,
                LockSeparador.expira_at > datetime.utcnow()
            )
        )
        result = await db.execute(query)
        existing_lock = result.scalar_one_or_none()
        
        if existing_lock:
            if existing_lock.user_id == user_id:
                return existing_lock # Já é dele
            return None # Outro usuário está com o recurso
            
        # 2. Criar Nova Trava
        new_lock = LockSeparador(
            user_id=user_id,
            resource_type=resource_type,
            resource_id=resource_id,
            ativo=True,
            adquirido_at=datetime.utcnow(),
            expira_at=datetime.utcnow() + timedelta(minutes=minutes)
        )
        db.add(new_lock)
        await db.commit()
        return new_lock
