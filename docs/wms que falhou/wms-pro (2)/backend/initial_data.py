import asyncio
import logging
from backend.app.core.database import SessionLocal
from backend.app.crud.users import get_user_by_username, create_user

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

INITIAL_USERNAME = "admin"
INITIAL_PASSWORD = "Admin@123"   # Troque após o primeiro login
INITIAL_ROLE     = "master"


async def init_db() -> None:
    async with SessionLocal() as db:
        user = await get_user_by_username(db, INITIAL_USERNAME)
        if not user:
            logger.info("Criando usuário administrador inicial...")
            await create_user(db, INITIAL_USERNAME, INITIAL_PASSWORD, INITIAL_ROLE)
            logger.info(
                "Usuário '%s' criado com perfil '%s'. "
                "ATENÇÃO: troque a senha no primeiro login (CONFIG → Usuários).",
                INITIAL_USERNAME, INITIAL_ROLE,
            )
        else:
            logger.info("Usuário '%s' já existe — nenhuma alteração.", INITIAL_USERNAME)

if __name__ == "__main__":
    asyncio.run(init_db())
