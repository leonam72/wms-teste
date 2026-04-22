from datetime import date, timedelta
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from ..models.inventory import StockItem, StockQualityState, Shelf

class QualityService:
    @staticmethod
    def calculate_expiry_status(expiry_date: Optional[date]) -> str:
        if not expiry_date:
            return "none"
        today = date.today()
        if expiry_date < today:
            return "expired"
        if expiry_date <= today + timedelta(days=30):
            return "expiring"
        return "ok"

    @classmethod
    async def update_item_quality(cls, db: AsyncSession, stock_item_id: str):
        """
        Atualiza o estado de qualidade de um item específico sem reconstruir tudo.
        """
        from sqlalchemy import select
        # 1. Buscar item e sua prateleira (para ver se é quarentena/bloqueado)
        query = select(StockItem, Shelf.shelf_type).join(Shelf, isouter=True).where(StockItem.id == stock_item_id)
        result = await db.execute(query)
        item_data = result.first()
        
        if not item_data: return

        item, shelf_type = item_data
        # Pegar validade mais próxima
        nearest_expiry = None
        if item.expiries:
            nearest_expiry = min(e.date_value for e in item.expiries)

        expiry_status = cls.calculate_expiry_status(nearest_expiry)

        # 2. Upsert no StockQualityState
        # (Lógica simplificada para o MVP - No Real usaríamos um merge/upsert)
        quality_state = StockQualityState(
            stock_item_id=item.id,
            expiry_status=expiry_status,
            is_quarantine=(shelf_type == "quarantine"),
            is_blocked=(shelf_type == "blocked"),
            nearest_expiry=nearest_expiry
        )
        # db.add(quality_state) ...
        return quality_state
