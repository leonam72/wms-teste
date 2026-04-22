from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.core.database import Base
from backend.app.models.base_class import TimestampMixin

ROLE_VISUALIZADOR = "visualizador"
ROLE_SEPARADOR = "separador"
ROLE_CONFERENTE = "conferente"
ROLE_QUALIDADE = "qualidade"
ROLE_SUPERVISOR = "supervisor"
ROLE_GERENTE = "gerente"
ROLE_ADMIN = "admin"
ROLE_MASTER = "master"

ROLE_ORDER = [
    ROLE_VISUALIZADOR,
    ROLE_SEPARADOR,
    ROLE_CONFERENTE,
    ROLE_QUALIDADE,
    ROLE_SUPERVISOR,
    ROLE_GERENTE,
    ROLE_ADMIN,
    ROLE_MASTER,
]

ROLE_PERMISSIONS: dict[str, set[str]] = {
    ROLE_CONFERENTE: {
        "entry.register",
        "shipment.process",
        "product.manage",
        "view.basic",
    },
    ROLE_VISUALIZADOR: {
        "view.basic",
    },
    ROLE_SEPARADOR: {
        "view.basic",
        "separation.execute",
    },
    ROLE_QUALIDADE: {
        "entry.register",
        "quality.manage",
        "discard.process",
        "product.manage",
        "view.basic",
    },
    ROLE_SUPERVISOR: {
        "entry.register",
        "blind.count",
        "shipment.process",
        "quality.manage",
        "discard.process",
        "structure.manage",
        "product.manage",
        "user.manage.low",
        "view.basic",
    },
    ROLE_GERENTE: {
        "entry.register",
        "blind.count",
        "shipment.process",
        "quality.manage",
        "discard.process",
        "layout.edit",
        "structure.manage",
        "settings.manage",
        "product.manage",
        "user.manage.mid",
        "view.basic",
    },
    ROLE_ADMIN: {
        "entry.register",
        "blind.count",
        "shipment.process",
        "quality.manage",
        "discard.process",
        "layout.edit",
        "structure.manage",
        "settings.manage",
        "product.manage",
        "user.manage.high",
        "clear.all",
        "view.basic",
    },
    ROLE_MASTER: {
        "entry.register",
        "blind.count",
        "shipment.process",
        "quality.manage",
        "discard.process",
        "layout.edit",
        "structure.manage",
        "settings.manage",
        "product.manage",
        "user.manage.master",
        "clear.all",
        "view.basic",
    },
}

class User(Base, TimestampMixin):
    __tablename__ = "users"

    username: Mapped[str] = mapped_column(String, unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String, nullable=True)
    password_hash: Mapped[str] = mapped_column(String)
    role: Mapped[str] = mapped_column(String(32), default=ROLE_CONFERENTE)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    parent_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    parent_user: Mapped["User | None"] = relationship("User", remote_side="User.id", backref="managed_users")
