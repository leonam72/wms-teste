import os
from pathlib import Path
from pydantic_settings import BaseSettings

# Define a raiz do projeto relativa a este arquivo (config.py está em backend/app/core/)
# .parent -> core/
# .parent.parent -> app/
# .parent.parent.parent -> backend/
# .parent.parent.parent.parent -> raiz do projeto (wms_agora_vai)
BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
DB_PATH = BASE_DIR / "wms_v2.db"

class Settings(BaseSettings):
    PROJECT_NAME: str = "WMS Agora Vai"
    SECRET_KEY: str = "WMS_AGORA_VAI_SUPER_SECRET_2026"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    
    # DATABASE_URL 100% Relativa e Portátil
    DATABASE_URL: str = f"sqlite+aiosqlite:///{DB_PATH}"

    class Config:
        env_file = ".env"

settings = Settings()
print(f"📡 SSoT Ativo: {DB_PATH}")
