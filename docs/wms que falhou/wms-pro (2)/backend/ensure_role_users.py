import asyncio
import logging

from backend.app.core.database import SessionLocal
from backend.app.crud.users import create_user, get_user_by_username, reset_password, update_user


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DEFAULT_PASSWORD = "Teste@12345"

DEFAULT_USERS = [
    ("master_test", "master", "Master Teste"),
    ("admin_test", "admin", "Admin Teste"),
    ("gerente_test", "gerente", "Gerente Teste"),
    ("supervisor_test", "supervisor", "Supervisor Teste"),
    ("qualidade_test", "qualidade", "Qualidade Teste"),
    ("conferente_test", "conferente", "Conferente Teste"),
    ("separador_test", "separador", "Separador Teste"),
    ("visualizador_test", "visualizador", "Visualizador Teste"),
]


async def ensure_role_users() -> None:
    async with SessionLocal() as db:
        admin_user = await get_user_by_username(db, "admin")
        admin_id = admin_user.id if admin_user else None

        for username, role, full_name in DEFAULT_USERS:
            user = await get_user_by_username(db, username)
            if not user:
                await create_user(
                    db,
                    username=username,
                    password=DEFAULT_PASSWORD,
                    role=role,
                    full_name=full_name,
                    parent_user_id=admin_id,
                )
                logger.info("Created user %s with role %s", username, role)
                continue

            changed = False
            update_kwargs = {"parent_user_id": user.parent_user_id}
            if user.role != role:
                update_kwargs["role"] = role
                changed = True
            if user.full_name != full_name:
                update_kwargs["full_name"] = full_name
                changed = True
            if not user.is_active:
                update_kwargs["is_active"] = True
                changed = True
            if user.parent_user_id is None and admin_id and username != "admin":
                update_kwargs["parent_user_id"] = admin_id
                changed = True

            if changed:
                await update_user(db, user, **update_kwargs)
                logger.info("Updated user %s to match role %s", username, role)
            else:
                logger.info("User %s already configured", username)
            await reset_password(db, user, DEFAULT_PASSWORD)
            logger.info("Reset password for %s", username)


if __name__ == "__main__":
    asyncio.run(ensure_role_users())
