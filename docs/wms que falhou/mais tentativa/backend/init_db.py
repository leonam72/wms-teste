import asyncio
from backend.app.core.database import engine, Base, SessionLocal
from backend.app.models import (
    User, Depot, Shelf, Drawer, Product, StockItem, Expiry,
    ReceivingSession, ReceivingItem, FloorPlanShelf, FloorPlanObject, 
    AuditLog, RomaneioSeparacao, ItemSeparacao, TarefaSeparador
)
from backend.app.services.auth_service import AuthService
from sqlalchemy import select

async def init_db():
    print("🚀 Iniciando criação do banco de dados...")
    async with engine.begin() as conn:
        # No SQLAlchemy 2.0 com aiosqlite, o metadata já deve ter os modelos registrados via imports acima
        await conn.run_sync(Base.metadata.drop_all) # Limpa tudo para garantir o schema novo
        await conn.run_sync(Base.metadata.create_all)
    
    async with SessionLocal() as db:
        # 1. Criar Usuário Master
        master_user = User(
            username="master",
            full_name="SISTEMA MASTER",
            password_hash=AuthService.get_password_hash("wms123"),
            role="master",
            is_active=True
        )
        db.add(master_user)
        
        # 2. Criar Estrutura Inicial
        depot = Depot(name="DEPÓSITO CENTRAL", address="RUA PRINCIPAL, 100")
        db.add(depot)
        await db.flush()
        
        shelf = Shelf(depot_id=depot.id, code="A", floors=3, drawers_per_floor=5)
        db.add(shelf)
        
        # 3. Criar um log inicial para testar a tabela AuditLog
        db.add(AuditLog(
            operator_id=None,
            action_tag="[SYSTEM]",
            description="BANCO DE DADOS INICIALIZADO COM SUCESSO"
        ))

        await db.commit()
    print("✨ Banco de dados reinicializado com sucesso!")

if __name__ == "__main__":
    asyncio.run(init_db())
