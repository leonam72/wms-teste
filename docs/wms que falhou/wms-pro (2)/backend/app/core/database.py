from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from backend.app.core.config import settings

# Primary Local DB (SQLite)
engine = create_async_engine(
    settings.DATABASE_URL_SQLITE,
    echo=False,
    connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL_SQLITE else {}
)

SessionLocal = async_sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)

class Base(DeclarativeBase):
    pass

async def get_db():
    async with SessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
