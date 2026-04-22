from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from ..models.separation import RomaneioSeparacao, ItemSeparacao, TarefaSeparador
from ..models.inventory import StockItem, Product, Expiry, Drawer
from ..services.audit_service import AuditService
from ..models.auth import User

class SeparationService:
    @staticmethod
    async def create_romaneio(db: AsyncSession, codigo: str, itens_data: list):
        """Cria um novo romaneio de separação."""
        romaneio = RomaneioSeparacao(codigo=codigo, status="pendente")
        db.add(romaneio)
        await db.flush()
        
        for item in itens_data:
            db.add(ItemSeparacao(
                romaneio_id=romaneio.id,
                product_id=item['product_id'],
                quantity=item['quantity']
            ))
            
        await db.commit()
        return romaneio

    @staticmethod
    async def get_picking_suggestions(db: AsyncSession, romaneio_id: str):
        """
        Gera sugestões de onde retirar os produtos (FEFO).
        Busca apenas itens 'AVAILABLE'.
        """
        stmt = select(ItemSeparacao).where(ItemSeparacao.romaneio_id == romaneio_id)
        itens = (await db.execute(stmt)).scalars().all()
        
        suggestions = []
        for item in itens:
            # Regra WMS-BR-002: Somente AVAILABLE e Ordenado por FEFO
            stmt_stock = (
                select(StockItem)
                .join(Expiry, StockItem.id == Expiry.stock_item_id, isouter=True)
                .where(StockItem.product_id == item.product_id)
                .where(StockItem.quantity > 0)
                .where(StockItem.status == "AVAILABLE")
                .order_by(Expiry.date_value.asc().nullslast())
                .options(selectinload(StockItem.drawer), selectinload(StockItem.product))
            )
            stocks = (await db.execute(stmt_stock)).scalars().all()
            
            needed = item.quantity
            for stock in stocks:
                if needed <= 0: break
                take = min(stock.quantity, needed)
                suggestions.append({
                    "product": stock.product.name,
                    "drawer": stock.drawer.drawer_key,
                    "lot": stock.lot,
                    "qty_to_pick": take,
                    "item_id": item.id,
                    "stock_item_id": stock.id
                })
                needed -= take
                
        return suggestions

    @staticmethod
    async def reserve_stock_for_picking(db: AsyncSession, stock_item_id: str, quantity: int, operator: User):
        """Reserva uma quantidade do estoque para picking mudando status para RESERVED."""
        stock = await db.get(StockItem, stock_item_id)
        if not stock or stock.status != "AVAILABLE":
            raise ValueError("Item não disponível para reserva")
        
        if stock.quantity < quantity:
            raise ValueError("Saldo insuficiente para reserva")

        product = await db.get(Product, stock.product_id)
        drawer = await db.get(Drawer, stock.drawer_id)

        if stock.quantity == quantity:
            # Reserva total: Apenas muda o status
            stock.status = "RESERVED"
            reserved_item = stock
        else:
            # Reserva parcial: Split do item
            stock.quantity -= quantity
            reserved_item = StockItem(
                product_id=stock.product_id,
                drawer_id=stock.drawer_id,
                quantity=quantity,
                lot=stock.lot,
                status="RESERVED"
            )
            db.add(reserved_item)

        await AuditService.log(
            db, operator, "[RESERVE]", 
            f"RESERVA PARA PICKING: {quantity} UN de {product.name} na gaveta {drawer.drawer_key}",
            "product", product.id
        )
        
        await db.commit()
        return reserved_item
