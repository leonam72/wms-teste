from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from datetime import datetime
from ..models.receiving import ReceivingSession, ReceivingItem
from ..models.auth import User

class ReceivingService:
    @staticmethod
    async def create_session_from_nfe(db: AsyncSession, nfe_data: dict, operator: User) -> ReceivingSession:
        """Cria uma sessão de conferência cega baseada em uma NF-e."""
        stmt = select(ReceivingSession).where(ReceivingSession.nfe_access_key == nfe_data['chave_acesso'])
        existing = (await db.execute(stmt)).scalar_one_or_none()
        
        if existing:
            return existing

        session = ReceivingSession(
            nfe_access_key=nfe_data['chave_acesso'],
            nfe_number=nfe_data['numero_nf'],
            issuer_name=nfe_data['emitente_nome'],
            issuer_cnpj=nfe_data['emitente_cnpj'],
            status="PENDING",
            operator_id=operator.id,
            started_at=datetime.utcnow()
        )
        db.add(session)
        await db.flush()

        for item in nfe_data['itens']:
            db.add(ReceivingItem(
                session_id=session.id,
                product_code=item.get('codigo'),
                ean=item.get('ean'),
                description=item.get('descricao'),
                expected_qty=item.get('quantidade', 0),
                counted_qty=0,
                unit=item.get('unidade', 'UN'),
                lot=item.get('lote'),
                expiry=item.get('validade')
            ))

        await db.commit()
        await db.refresh(session)
        return session

    @staticmethod
    async def list_pending_sessions(db: AsyncSession):
        stmt = select(ReceivingSession).where(ReceivingSession.status != "VALIDATED")
        return (await db.execute(stmt)).scalars().all()

    @staticmethod
    async def get_session_divergence(db: AsyncSession, session_id: str):
        """Calcula e retorna o relatório de divergência da sessão."""
        stmt = (
            select(ReceivingSession)
            .where(ReceivingSession.id == session_id)
            .options(selectinload(ReceivingSession.items))
        )
        result = await db.execute(stmt)
        session = result.scalar_one_or_none()
        
        if not session:
            raise ValueError("Sessão não encontrada")

        divergences = []
        has_divergence = False

        for item in session.items:
            diff = item.expected_qty - item.counted_qty
            status = "CONFORME"
            if diff > 0:
                status = "FALTA"
                has_divergence = True
            elif diff < 0:
                status = "SOBRA"
                has_divergence = True
            
            divergences.append({
                "product_code": item.product_code,
                "description": item.description,
                "expected_qty": item.expected_qty,
                "counted_qty": item.counted_qty,
                "divergence": abs(diff),
                "status": status
            })

        return {
            "session_id": session.id,
            "nfe_number": session.nfe_number,
            "issuer_name": session.issuer_name,
            "items": divergences,
            "has_divergence": has_divergence
        }
