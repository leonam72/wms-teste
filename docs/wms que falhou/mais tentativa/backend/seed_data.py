import asyncio
from backend.app.core.database import engine, Base, SessionLocal
from backend.app.models import (
    User, Depot, Shelf, Drawer, Product, StockItem, Expiry,
    ReceivingSession, ReceivingItem, AuditLog, RomaneioSeparacao, ItemSeparacao
)
from backend.app.services.auth_service import AuthService
from datetime import date, timedelta, datetime

async def seed_data():
    print("🧹 Limpando e reinicializando banco para teste...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    async with SessionLocal() as db:
        # 1. Usuários
        master = User(
            username="master", full_name="SISTEMA MASTER",
            password_hash=AuthService.get_password_hash("wms123"),
            role="master", is_active=True
        )
        op1 = User(
            username="op01", full_name="OPERADOR LOGÍSTICO 01",
            password_hash=AuthService.get_password_hash("op123"),
            role="operator", is_active=True
        )
        db.add_all([master, op1])
        await db.flush()

        # 2. Estrutura Física
        depot = Depot(name="CD SÃO PAULO", address="AV. INDUSTRIAL, 1000")
        db.add(depot)
        await db.flush()

        # Criar 3 Estantes (A, B, C)
        for code in ["A", "B", "C"]:
            shelf = Shelf(depot_id=depot.id, code=code, floors=4, drawers_per_floor=6)
            db.add(shelf)
            await db.flush()
            # Criar as Gavetas
            for f in range(1, 5):
                for d in range(1, 7):
                    db.add(Drawer(shelf_id=shelf.id, drawer_key=f"{code}{f}-{d}"))

        # 3. Catálogo de Produtos
        p1 = Product(code="PROD001", name="SMARTPHONE GALAXY S24", sku="PHN-S24-BLK", category="ELETRÔNICOS", weight_kg=0.2)
        p2 = Product(code="PROD002", name="MONITOR LG 29 POL", sku="MON-LG29-ULTRA", category="INFORMÁTICA", weight_kg=4.5)
        p3 = Product(code="PROD003", name="CABO HDMI 2.0 2M", sku="CBL-HDMI-2M", category="ACESSÓRIOS", weight_kg=0.1)
        p4 = Product(code="PROD004", name="MOUSE GAMER RGB", sku="MSE-GMR-RGB", category="PERIFÉRICOS", weight_kg=0.15)
        db.add_all([p1, p2, p3, p4])
        await db.flush()

        # 4. Estoque e Validades (FEFO)
        # Gaveta A1-1: Smartphone com validade próxima (ALERTA)
        item1 = StockItem(product_id=p1.id, drawer_id="1", quantity=10, lot="LOT2024-01") # ID 1 = A1-1
        db.add(item1)
        db.add(Expiry(stock_item=item1, date_value=date.today() + timedelta(days=5)))

        # Gaveta B2-2: Monitor (sem validade)
        db.add(StockItem(product_id=p2.id, drawer_id="30", quantity=5, lot="LOTE-UNICO"))

        # 5. Recebimento (Inbound)
        session = ReceivingSession(
            nfe_access_key="35240400011122233344455566677788899900011122",
            nfe_number="15420", issuer_name="TECH DISTRIBUIDORA LTDA",
            issuer_cnpj="11.222.333/0001-44", status="PENDING", operator_id=master.id,
            started_at=datetime.utcnow()
        )
        db.add(session)
        await db.flush()
        db.add(ReceivingItem(session_id=session.id, product_code="PROD001", description="SMARTPHONE GALAXY S24", expected_qty=50, counted_qty=12, unit="UN"))

        # 6. Separação (Outbound)
        romaneio = RomaneioSeparacao(codigo="ROM-2024-001", status="pendente", prioridade=1)
        db.add(romaneio)
        await db.flush()
        db.add(ItemSeparacao(romaneio_id=romaneio.id, product_id=p1.id, quantity=2))

        # 7. Audit Log
        db.add(AuditLog(operator_id=master.id, action_tag="[SYSTEM]", description="CARGA INICIAL DE TESTES EXECUTADA"))

        await db.commit()
    print("✨ WMS Populado com sucesso para testes!")

if __name__ == "__main__":
    asyncio.run(seed_data())
