from datetime import timedelta
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core import security
from backend.app.core.config import settings
from backend.app.core.rate_limit import check_login_allowed_async, clear_login_attempts, register_login_failure
from backend.app.core.database import get_db
from backend.app.crud import audit as crud_audit
from backend.app.crud import users as crud_users
from backend.app.models.auth import ROLE_ADMIN, ROLE_GERENTE, ROLE_MASTER
from backend.app.schemas import auth as schemas
from backend.app.api import deps

router = APIRouter()

def _serialize_user(user) -> schemas.UserRead:
    return schemas.UserRead(
        id=user.id,
        username=user.username,
        full_name=user.full_name,
        role=user.role,
        is_active=user.is_active,
        parent_user_id=user.parent_user_id,
        last_login_at=user.last_login_at.isoformat() if user.last_login_at else None,
        permissions=sorted(deps.user_permissions(user)),
    )

@router.post(
    "/login",
    response_model=schemas.Token,
    summary="Autenticar usuário",
    description="Realiza login via OAuth2 Password Flow, aplica rate limiting por IP/usuário e devolve o token JWT.",
)
async def login_access_token(
    request: Request,
    db: AsyncSession = Depends(get_db),
    form_data: OAuth2PasswordRequestForm = Depends()
) -> Any:
    """
    OAuth2 compatible token login, get an access token for future requests
    """
    client_ip = request.client.host if request.client else None
    allowed, retry_after = await check_login_allowed_async(client_ip, form_data.username)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Muitas tentativas de login. Tente novamente em {retry_after}s.",
            headers={"Retry-After": str(retry_after)},
        )
    user = await crud_users.authenticate(
        db, username=form_data.username, password=form_data.password
    )
    if not user:
        register_login_failure(client_ip, form_data.username)
        await crud_audit.create_audit_log(
            db,
            user_id=None,
            username=form_data.username,
            action="login_failed",
            table_name="users",
            record_id=None,
            old_value=None,
            new_value={"username": form_data.username},
            ip_address=client_ip,
        )
        await db.commit()
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    elif not user.is_active:
        register_login_failure(client_ip, form_data.username)
        await crud_audit.create_audit_log(
            db,
            user_id=user.id,
            username=user.username,
            action="login_inactive",
            table_name="users",
            record_id=user.id,
            old_value=None,
            new_value={"username": user.username},
            ip_address=client_ip,
        )
        await db.commit()
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    clear_login_attempts(client_ip, form_data.username)
    await crud_users.touch_last_login(db, user)
    await crud_audit.create_audit_log(
        db,
        user_id=user.id,
        username=user.username,
        action="login_success",
        table_name="users",
        record_id=user.id,
        old_value=None,
        new_value={"last_login_at": user.last_login_at.isoformat() if user.last_login_at else None},
        ip_address=client_ip,
    )
    await db.commit()
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return {
        "access_token": security.create_access_token(
            user.username, expires_delta=access_token_expires
        ),
        "token_type": "bearer",
    }

@router.get("/me", response_model=schemas.UserRead, summary="Usuário atual", description="Retorna o usuário autenticado e suas permissões efetivas.")
async def read_users_me(
    current_user = Depends(deps.get_current_active_user),
) -> Any:
    return _serialize_user(current_user)

@router.post("/change-password", response_model=schemas.UserRead, summary="Alterar a própria senha", description="Permite ao usuário autenticado trocar sua própria senha.")
async def change_my_password(
    payload: schemas.UserPasswordChange,
    db: AsyncSession = Depends(get_db),
    request: Request = None,
    current_user = Depends(deps.get_current_active_user),
) -> Any:
    user = await crud_users.authenticate(db, current_user.username, payload.current_password)
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Senha atual inválida.")
    try:
        updated = await crud_users.reset_password(db, current_user, payload.new_password)
    except ValueError as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(err))
    await crud_audit.create_audit_log(
        db,
        user_id=current_user.id,
        username=current_user.username,
        action="change_password",
        table_name="users",
        record_id=current_user.id,
        old_value={"password_changed": False},
        new_value={"password_changed": True},
        ip_address=(request.client.host if request and request.client else None),
    )
    await db.commit()
    return _serialize_user(updated)

@router.get("/users", response_model=list[schemas.UserRead], summary="Listar usuários", description="Lista usuários gerenciáveis conforme a hierarquia de perfis.")
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(deps.get_current_active_user),
) -> Any:
    # FIX M-02: filtra pelo conjunto de roles que o actor pode gerenciar
    # Evita enumeração de usuários fora do escopo (ex: supervisor vendo admins)
    manageable = deps.allowed_manage_roles(current_user)
    if not manageable:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permissão insuficiente.")
    users = await crud_users.list_users(db)
    # Sempre inclui o próprio usuário na lista (para exibição de perfil)
    filtered = [u for u in users if u.role in manageable or u.id == current_user.id]
    return [_serialize_user(user) for user in filtered]

@router.post("/users", response_model=schemas.UserRead, status_code=status.HTTP_201_CREATED, summary="Criar usuário", description="Cria um novo usuário respeitando a hierarquia de perfis.")
async def create_user(
    payload: schemas.UserCreate,
    db: AsyncSession = Depends(get_db),
    request: Request = None,
    current_user = Depends(deps.get_current_active_user),
) -> Any:
    deps.ensure_can_manage_role(current_user, payload.role)
    existing = await crud_users.get_user_by_username(db, payload.username)
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Usuário já existe.")
    try:
        user = await crud_users.create_user(
            db,
            username=payload.username.strip(),
            password=payload.password,
            role=payload.role,
            full_name=payload.full_name.strip() if payload.full_name else None,
            parent_user_id=current_user.id,
        )
    except ValueError as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(err))
    await crud_audit.create_audit_log(
        db,
        user_id=current_user.id,
        username=current_user.username,
        action="create",
        table_name="users",
        record_id=user.id,
        old_value=None,
        new_value={"username": user.username, "role": user.role, "is_active": user.is_active},
        ip_address=(request.client.host if request and request.client else None),
    )
    await db.commit()
    return _serialize_user(user)

@router.patch("/users/{user_id}", response_model=schemas.UserRead, summary="Atualizar usuário", description="Atualiza papel, nome ou status ativo de um usuário gerenciável.")
async def update_user(
    user_id: str,
    payload: schemas.UserUpdate,
    db: AsyncSession = Depends(get_db),
    request: Request = None,
    current_user = Depends(deps.get_current_active_user),
) -> Any:
    if not deps.allowed_manage_roles(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permissão insuficiente.")
    user = await crud_users.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado.")
    deps.ensure_can_manage_role(current_user, user.role)
    if payload.role:
        deps.ensure_can_manage_role(current_user, payload.role)
    if user.id == current_user.id and payload.is_active is False:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Você não pode desativar a própria conta.")
    previous = {"full_name": user.full_name, "role": user.role, "is_active": user.is_active}
    try:
        updated = await crud_users.update_user(
            db,
            user,
            full_name=payload.full_name.strip() if isinstance(payload.full_name, str) else payload.full_name,
            role=payload.role,
            is_active=payload.is_active,
            parent_user_id=user.parent_user_id,
        )
    except ValueError as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(err))
    await crud_audit.create_audit_log(
        db,
        user_id=current_user.id,
        username=current_user.username,
        action="update",
        table_name="users",
        record_id=updated.id,
        old_value=previous,
        new_value={"full_name": updated.full_name, "role": updated.role, "is_active": updated.is_active},
        ip_address=(request.client.host if request and request.client else None),
    )
    await db.commit()
    return _serialize_user(updated)

@router.post("/users/{user_id}/reset-password", response_model=schemas.UserRead, summary="Redefinir senha de usuário", description="Redefine a senha de um usuário gerenciável.")
async def reset_user_password(
    user_id: str,
    payload: schemas.UserPasswordReset,
    db: AsyncSession = Depends(get_db),
    request: Request = None,
    current_user = Depends(deps.get_current_active_user),
) -> Any:
    if not deps.allowed_manage_roles(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permissão insuficiente.")
    user = await crud_users.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado.")
    deps.ensure_can_manage_role(current_user, user.role)
    try:
        updated = await crud_users.reset_password(db, user, payload.password)
    except ValueError as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(err))
    await crud_audit.create_audit_log(
        db,
        user_id=current_user.id,
        username=current_user.username,
        action="reset_password",
        table_name="users",
        record_id=updated.id,
        old_value={"password_changed": False},
        new_value={"password_changed": True},
        ip_address=(request.client.host if request and request.client else None),
    )
    await db.commit()
    return _serialize_user(updated)

@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Excluir usuário", description="Exclui permanentemente um usuário gerenciável.")
async def delete_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    request: Request = None,
    current_user = Depends(deps.get_current_active_user),
) -> None:
    if current_user.role not in {ROLE_GERENTE, ROLE_ADMIN, ROLE_MASTER}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permissão insuficiente.")
    user = await crud_users.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado.")
    deps.ensure_can_manage_role(current_user, user.role)
    if user.id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Você não pode excluir a própria conta.")
    snapshot = {
        "username": user.username,
        "full_name": user.full_name,
        "role": user.role,
        "is_active": user.is_active,
        "parent_user_id": user.parent_user_id,
    }
    await crud_audit.create_audit_log(
        db,
        user_id=current_user.id,
        username=current_user.username,
        action="delete",
        table_name="users",
        record_id=user.id,
        old_value=snapshot,
        new_value=None,
        ip_address=(request.client.host if request and request.client else None),
    )
    await db.delete(user)
    await db.commit()
