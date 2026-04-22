from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from ..models.inventory import StockItem, Drawer, Product, Shelf, Expiry
from ..services.audit_service import AuditService
from ..models.auth import User
from typing import Optional
from datetime import date

class InventoryService:
    @staticmethod
    async def allocate_product(
        db: AsyncSession, 
        product_id: str, 
        drawer_id: str, 
        quantity: int, 
        operator: User,
        lot: Optional[str] = None,
        expiry_date: Optional[date] = None,
        status: str = "AVAILABLE"
    ):
        product = await db.get(Product, product_id)
        drawer = await db.get(Drawer, drawer_id)

        if not product or not drawer:
            raise ValueError("Produto ou Gaveta não encontrada")

        # Busca item existente para consolidar (Mesmo produto, gaveta, lote e STATUS)
        conditions = [
            StockItem.product_id == product_id,
            StockItem.drawer_id == drawer_id,
            StockItem.status == status
        ]
        if lot:
            conditions.append(StockItem.lot == lot)
        else:
            conditions.append(StockItem.lot == None)

        stmt = select(StockItem).where(*conditions)
        existing_item = (await db.execute(stmt)).scalar_one_or_none()

        if existing_item:
            existing_item.quantity += quantity
            active_item = existing_item
        else:
            active_item = StockItem(
                product_id=product_id,
                drawer_id=drawer_id,
                quantity=quantity,
                lot=lot,
                status=status
            )
            db.add(active_item)

        # Log de Auditoria
        await AuditService.log(
            db, operator, "[MOVE]", 
            f"ALOCAÇÃO ({status}): {quantity} UN de {product.name} na gaveta {drawer.drawer_key}",
            "product", product.id
        )

        if expiry_date:            # Verifica se já existe um registro de expiração para o item
            # (Se for item novo, cria. Se for existente, opcionalmente atualiza se for diferente)
            # Para simplificar, assumimos que lotes idênticos têm validade idêntica.
            expiry_stmt = select(Expiry).where(Expiry.stock_item_id == active_item.id)
            existing_expiry = (await db.execute(expiry_stmt)).scalar_one_or_none()
            
            if not existing_expiry:
                db.add(Expiry(stock_item=active_item, date_value=expiry_date))
        
        await db.commit()
        return active_item

    @staticmethod
    async def move_stock(
        db: AsyncSession,
        item_id: str,
        to_drawer_id: str,
        quantity: int,
        operator: User
    ):
        """Move uma quantidade de um StockItem para outra gaveta."""
        item = await db.get(StockItem, item_id, options=[])
        target_drawer = await db.get(Drawer, to_drawer_id)
        
        if not item or not target_drawer:
            raise ValueError("Item ou Gaveta de destino não encontrada")
        
        if item.status != "AVAILABLE":
            raise ValueError("Somente itens com status 'AVAILABLE' podem ser movidos")
            
        if item.quantity < quantity:
            raise ValueError("Saldo insuficiente para movimentação")

        # 1. Subtrai do item original
        item.quantity -= quantity
        
        # 2. Adiciona ou cria no destino (Mantém o status original)
        stmt = select(StockItem).where(
            StockItem.product_id == item.product_id,
            StockItem.drawer_id == to_drawer_id,
            StockItem.lot == item.lot,
            StockItem.status == item.status
        )
        target_item = (await db.execute(stmt)).scalar_one_or_none()
        
        if target_item:
            target_item.quantity += quantity
        else:
            target_item = StockItem(
                product_id=item.product_id,
                drawer_id=to_drawer_id,
                quantity=quantity,
                lot=item.lot,
                status=item.status
            )
            db.add(target_item)

        # Log de Auditoria
        product = await db.get(Product, item.product_id)
        await AuditService.log(
            db, operator, "[MOVE]", 
            f"TRANSFERÊNCIA: {quantity} UN de {product.name} para gaveta {target_drawer.drawer_key}",
            "product", product.id
        )

        await db.commit()
        return target_item
