from typing import Optional
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.app.models.auth import ROLE_ORDER, User
from backend.app.core.security import get_password_hash, verify_password

async def get_user_by_username(db: AsyncSession, username: str) -> Optional[User]:
    result = await db.execute(select(User).where(User.username == username))
    return result.scalars().first()

async def get_user_by_id(db: AsyncSession, user_id: str) -> Optional[User]:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalars().first()

async def list_users(db: AsyncSession) -> list[User]:
    result = await db.execute(select(User).order_by(User.username.asc()))
    return list(result.scalars().all())

def validate_password_strength(password: str) -> None:
    text = str(password or "")
    if len(text) < 8:
        raise ValueError("A senha deve ter pelo menos 8 caracteres.")

def validate_role(role: str) -> str:
    value = str(role or "").strip().lower()
    if value not in ROLE_ORDER:
        raise ValueError("Perfil de usuário inválido.")
    return value

async def create_user(
    db: AsyncSession,
    username: str,
    password: str,
    role: str = "conferente",
    full_name: str | None = None,
    parent_user_id: str | None = None,
) -> User:
    validate_password_strength(password)
    role_value = validate_role(role)
    hashed = get_password_hash(password)
    user = User(
        username=username,
        full_name=full_name,
        password_hash=hashed,
        role=role_value,
        parent_user_id=parent_user_id,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user

async def update_user(
    db: AsyncSession,
    user: User,
    *,
    full_name: str | None = None,
    role: str | None = None,
    is_active: bool | None = None,
    parent_user_id: str | None = None,
) -> User:
    if full_name is not None:
        user.full_name = full_name
    if role is not None:
        user.role = validate_role(role)
    if is_active is not None:
        user.is_active = bool(is_active)
    if parent_user_id is not None:
        user.parent_user_id = parent_user_id
    await db.commit()
    await db.refresh(user)
    return user

async def reset_password(db: AsyncSession, user: User, password: str) -> User:
    validate_password_strength(password)
    user.password_hash = get_password_hash(password)
    await db.commit()
    await db.refresh(user)
    return user

async def touch_last_login(db: AsyncSession, user: User) -> None:
    user.last_login_at = datetime.now(timezone.utc)
    await db.commit()

async def authenticate(db: AsyncSession, username: str, password: str) -> Optional[User]:
    user = await get_user_by_username(db, username)
    if not user:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user
