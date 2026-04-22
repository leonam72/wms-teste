from typing import Generator
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core import security
from backend.app.core.config import settings
from backend.app.core.database import get_db
from backend.app.models.auth import (
    ROLE_ADMIN,
    ROLE_CONFERENTE,
    ROLE_GERENTE,
    ROLE_MASTER,
    ROLE_ORDER,
    ROLE_PERMISSIONS,
    ROLE_QUALIDADE,
    ROLE_SEPARADOR,
    ROLE_SUPERVISOR,
    ROLE_VISUALIZADOR,
    User,
)
from backend.app.crud import users as crud_users
from backend.app.schemas.auth import TokenPayload

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")

async def get_current_user(
    db: AsyncSession = Depends(get_db),
    token: str = Depends(oauth2_scheme)
) -> User:
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[security.ALGORITHM]
        )
        token_data = TokenPayload(**payload)
    except (JWTError, ValidationError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate credentials",
        )
    user = await crud_users.get_user_by_username(db, username=token_data.sub)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate credentials",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate credentials",
        )
    return user

async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    # is_active já verificado em get_current_user — mantido para compatibilidade
    return current_user

async def get_current_active_superuser(
    current_user: User = Depends(get_current_user),
) -> User:
    if current_user.role not in {ROLE_ADMIN, ROLE_MASTER}:
        raise HTTPException(
            status_code=400, detail="The user doesn't have enough privileges"
        )
    return current_user

def get_role_permissions(role: str) -> set[str]:
    return set(ROLE_PERMISSIONS.get(role or ROLE_CONFERENTE, set()))

def user_permissions(user: User) -> set[str]:
    return get_role_permissions(user.role)

def user_has_permission(user: User, permission: str) -> bool:
    perms = user_permissions(user)
    if user.role == ROLE_MASTER:
      return True
    return permission in perms

def allowed_manage_roles(user: User) -> set[str]:
    role = user.role
    if role == ROLE_SUPERVISOR:
        return {ROLE_VISUALIZADOR, ROLE_SEPARADOR, ROLE_CONFERENTE, ROLE_QUALIDADE}
    if role == ROLE_GERENTE:
        return {ROLE_SUPERVISOR, ROLE_VISUALIZADOR, ROLE_SEPARADOR, ROLE_CONFERENTE, ROLE_QUALIDADE}
    if role == ROLE_ADMIN:
        return {ROLE_GERENTE, ROLE_SUPERVISOR, ROLE_VISUALIZADOR, ROLE_SEPARADOR, ROLE_CONFERENTE, ROLE_QUALIDADE}
    if role == ROLE_MASTER:
        return set(ROLE_ORDER)
    return set()

def ensure_permission(user: User, permission: str) -> User:
    if user_has_permission(user, permission):
        return user
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Permissão insuficiente para esta operação.",
    )

def ensure_can_manage_role(actor: User, target_role: str) -> None:
    if target_role not in allowed_manage_roles(actor):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seu perfil não pode criar ou editar este tipo de usuário.",
        )
