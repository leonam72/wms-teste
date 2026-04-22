import asyncio
import random
from datetime import date, timedelta, datetime
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.database import engine, Base, SessionLocal
from backend.app.models import (
    User, Depot, Shelf, Drawer, Product, StockItem, Expiry,
    ReceivingSession, ReceivingItem, AuditLog, RomaneioSeparacao, ItemSeparacao,
    FloorPlanShelf
)
from backend.app.services.auth_service import AuthService

async def mega_seed():
    print("🚀 INICIANDO CARGA INDUSTRIAL DE DADOS (MEGA SEED)...")
    
    # 1. Reset Total do Banco
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    async with SessionLocal() as db:
        # 2. Usuário Master
        master = User(
            username="master", 
            full_name="SISTEMA MASTER", 
            password_hash=AuthService.get_password_hash("wms123"), 
            role="master", 
            is_active=True
        )
        db.add(master)
        await db.flush() # Preserva na sessão sem commitar ainda
        master_id = master.id

        # 3. Depósitos e Estrutura (5 CDs)
        print("🏢 Gerando CDs e Gavetas...")
        all_drawer_ids = []
        for i in range(1, 6):
            d = Depot(name=f"CENTRO DE DISTRIBUIÇÃO 0{i}", address=f"LOGÍSTICA AVE, KM {i*10}")
            db.add(d)
            await db.flush()
            depot_id = d.id

            for s_code in ["A", "B", "C"]:
                shelf = Shelf(depot_id=depot_id, code=s_code, floors=4, drawers_per_floor=8)
                db.add(shelf)
                await db.flush()
                shelf_id = shelf.id
                
                db.add(FloorPlanShelf(depot_id=depot_id, shelf_id=shelf_id, x=random.randint(50, 1200), y=random.randint(50, 600)))
                
                for f in range(1, 5):
                    for g in range(1, 9):
                        d_key = f"CD0{i}-{s_code}{f}-G{g:02d}"
                        drawer = Drawer(shelf_id=shelf_id, floor_number=f, drawer_number=g, drawer_key=d_key)
                        db.add(drawer)
                        await db.flush()
                        all_drawer_ids.append(drawer.id)

        # 4. Produtos (200 SKUs)
        print("📦 Cadastrando 200 produtos...")
        categories = ["ALIMENTOS", "LIMPEZA", "ELETRÔNICOS", "TEXTIL", "QUÍMICOS", "PEÇAS"]
        all_product_ids = []
        for i in range(1, 201):
            p = Product(
                code=f"SKU-{1000+i}",
                name=f"PRODUTO INDUSTRIAL MODELO {i:03d}",
                sku=f"ID-{i*77}-X",
                category=random.choice(categories),
                is_perishable=(i % 5 == 0),
                expiry_control=True
            )
            db.add(p)
            await db.flush()
            all_product_ids.append(p.id)

        # 5. Estoque e Variações (~1000)
        print("🚛 Gerando estoque e validades...")
        for p_id in all_product_ids:
            for _ in range(5):
                drawer_id = random.choice(all_drawer_ids)
                qty = random.randint(50, 200)
                lot = f"LOT-{random.randint(2023, 2024)}-{random.randint(100, 999)}"
                stock = StockItem(product_id=p_id, drawer_id=drawer_id, quantity=qty, lot=lot)
                db.add(stock)
                await db.flush()

                # Vencimento aleatório
                days = random.choice([-15, -5, 2, 10, 30, 90, 360])
                db.add(Expiry(stock_item_id=stock.id, date_value=date.today() + timedelta(days=days)))

        # 6. Inbound e Outbound (Logs Finais)
        db.add(AuditLog(operator_id=master_id, action_tag="[SYSTEM]", description="MEGA CARGA INDUSTRIAL CONCLUÍDA"))
        
        print("💾 Salvando dados no banco de dados...")
        await db.commit()
    
    print("✨ MEGA SEED FINALIZADO! O WMS ESTÁ REALMENTE POPULADO.")

if __name__ == "__main__":
    asyncio.run(mega_seed())
