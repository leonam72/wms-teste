from typing import Optional
from pathlib import Path
import os
import sys
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator


def get_runtime_root() -> Path:
    if getattr(sys, "frozen", False):
        return Path(getattr(sys, "_MEIPASS", Path(sys.executable).resolve().parent))
    return Path(__file__).resolve().parents[3]


def get_runtime_db_url() -> str:
    env_value = os.getenv("DATABASE_URL_SQLITE", "").strip()
    if env_value:
        return env_value
    base_path = Path(sys.executable).resolve().parent if getattr(sys, "frozen", False) else get_runtime_root()
    db_path = (base_path / "wms.db").resolve()
    return f"sqlite+aiosqlite:///{db_path}"

class Settings(BaseSettings):
    PROJECT_NAME: str = "WMS Pro"
    API_V1_STR: str = "/api"
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 12  # 12 hours
    
    # Database
    DATABASE_URL_SQLITE: str = get_runtime_db_url()
    DATABASE_URL_POSTGRES: Optional[str] = None  # Start with local only

    # Sync
    SYNC_ENABLED: bool = False
    SYNC_INTERVAL_SECONDS: int = 60
    NFE_XML_DIR: str = "./nfe_xml"  # relativo ao diretório de execução; configure via .env

    # CORS
    BACKEND_CORS_ORIGINS: list[str] = [
        "http://127.0.0.1:8000",
        "http://localhost:8000",
    ]

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True)

    @field_validator("SECRET_KEY")
    @classmethod
    def validate_secret_key(cls, value: str) -> str:
      secret = (value or "").strip()
      insecure_values = {
        "",
        "changethis",
        "change_this_to_a_secure_random_key_in_production",
      }
      if secret in insecure_values:
        raise ValueError("SECRET_KEY insegura ou ausente. Defina uma chave forte via .env.")
      if len(secret) < 32:
        raise ValueError("SECRET_KEY muito curta. Use pelo menos 32 caracteres.")
      return secret

settings = Settings()
