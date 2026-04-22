from typing import Generator, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from ..core.database import SessionLocal
from ..core.config import settings
from ..models.auth import User
from sqlalchemy import select

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

async def get_db() -> Generator:
    async with SessionLocal() as session:
        yield session

async def get_current_user(
    db: AsyncSession = Depends(get_db), 
    token: str = Depends(oauth2_scheme)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception
    return user

def check_permissions(required_perm: str):
    """
    Middleware para checar permissões baseadas no ROLE do usuário.
    """
    async def permission_dependency(current_user: User = Depends(get_current_user)):
        from ..models.auth import ROLE_PERMISSIONS
        user_perms = ROLE_PERMISSIONS.get(current_user.role, set())
        if required_perm not in user_perms:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions"
            )
        return current_user
    return permission_dependency
