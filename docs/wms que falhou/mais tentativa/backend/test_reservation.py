import asyncio
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from app.services.separation_service import SeparationService
from app.services.inventory_service import InventoryService
from app.models.auth import User
from app.models.inventory import Product, Drawer, StockItem
from app.models.separation import RomaneioSeparacao
from sqlalchemy import select

DATABASE_URL = "sqlite+aiosqlite:////home/leonamramosfoli/Documentos/wms_agora_vai/wms_v2.db"
engine = create_async_engine(DATABASE_URL)
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def test_reservation():
    async with async_session() as db:
        user = (await db.execute(select(User))).scalars().first()
        product = (await db.execute(select(Product))).scalars().first()
        drawer = (await db.execute(select(Drawer))).scalars().first()

        print(f"--- TESTE DE RESERVA ---")
        
        # 1. Limpa estoque anterior do teste para isolar
        # (Opcional, mas vamos apenas garantir que temos saldo AVAILABLE)
        await InventoryService.allocate_product(db, product.id, drawer.id, 20, user, lot="LOTE-RES")
        
        # Pega o item que acabamos de criar/atualizar
        stmt = select(StockItem).where(StockItem.product_id == product.id, StockItem.status == "AVAILABLE")
        stock_item = (await db.execute(stmt)).scalars().first()
        initial_qty = stock_item.quantity
        
        print(f"Saldo Inicial Disponível: {initial_qty}")

        # 2. Reserva 5 unidades
        print("Reservando 5 unidades para Picking...")
        reserved = await SeparationService.reserve_stock_for_picking(db, stock_item.id, 5, user)
        
        # 3. Validações
        await db.refresh(stock_item)
        print(f"Saldo Disponível após reserva: {stock_item.quantity} (Status: {stock_item.status})")
        print(f"Item Reservado ID: {reserved.id} | Qtd: {reserved.quantity} | Status: {reserved.status}")

        if stock_item.quantity == initial_qty - 5 and reserved.status == "RESERVED":
            print("✅ SUCESSO: Reserva e Split funcionando!")
        else:
            print("❌ FALHA: Erro na lógica de reserva.")

if __name__ == "__main__":
    asyncio.run(test_reservation())
