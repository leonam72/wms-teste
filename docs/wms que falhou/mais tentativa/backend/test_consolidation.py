import asyncio
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from app.services.inventory_service import InventoryService
from app.models.auth import User
from app.models.inventory import Product, Drawer, StockItem
from sqlalchemy import select, delete

DATABASE_URL = "sqlite+aiosqlite:////home/leonamramosfoli/Documentos/wms_agora_vai/wms_v2.db"
engine = create_async_engine(DATABASE_URL)
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def test_consolidation():
    async with async_session() as db:
        # Limpar estado anterior
        await db.execute(delete(StockItem))
        await db.commit()

        # Pega o primeiro usuário, produto e gaveta
        user = (await db.execute(select(User))).scalars().first()
        product = (await db.execute(select(Product))).scalars().first()
        drawer = (await db.execute(select(Drawer))).scalars().first()

        print(f"Testando consolidação para Produto: {product.name} na Gaveta: {drawer.drawer_key}")

        # 1. Primeira alocação (10 unidades)
        print("Executando alocação 1 (10 un)...")
        await InventoryService.allocate_product(db, product.id, drawer.id, 10, user, lot="LOTE-TESTE")

        # 2. Segunda alocação (5 unidades) - Deve consolidar
        print("Executando alocação 2 (5 un)...")
        await InventoryService.allocate_product(db, product.id, drawer.id, 5, user, lot="LOTE-TESTE")

        # 3. Verificação
        stmt = select(StockItem).where(StockItem.product_id == product.id, StockItem.drawer_id == drawer.id)
        items = (await db.execute(stmt)).scalars().all()

        print(f"Total de registros de StockItem encontrados: {len(items)}")
        for item in items:
            print(f"Item ID: {item.id} | Qtd: {item.quantity} | Lote: {item.lot}")

        if len(items) == 1 and items[0].quantity == 15:
            print("✅ SUCESSO: Consolidação funcionando!")
        else:
            print("❌ FALHA: Registros duplicados ou quantidade incorreta.")

if __name__ == "__main__":
    asyncio.run(test_consolidation())
