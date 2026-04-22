import bcrypt
from datetime import datetime, timedelta
from typing import Optional
from jose import jwt

# Configurações de Segurança (Devem vir do config.py no futuro)
SECRET_KEY = "WMS_AGORA_VAI_SUPER_SECRET_2026"
ALGORITHM = "HS256"

class AuthService:
    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """Verifica a senha usando a biblioteca bcrypt diretamente."""
        try:
            return bcrypt.checkpw(
                plain_password.encode('utf-8'), 
                hashed_password.encode('utf-8')
            )
        except Exception:
            return False

    @staticmethod
    def get_password_hash(password: str) -> str:
        """Gera o hash da senha usando a biblioteca bcrypt diretamente."""
        salt = bcrypt.gensalt()
        return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

    @staticmethod
    def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
        to_encode = data.copy()
        expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
        to_encode.update({"exp": expire})
        return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
