from __future__ import annotations
from datetime import datetime
from typing import Optional, List
from sqlalchemy import String, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..core.database import Base, TimestampMixin

class User(Base, TimestampMixin):
    __tablename__ = "users"

    username: Mapped[str] = mapped_column(String, unique=True, index=True)
    full_name: Mapped[Optional[str]] = mapped_column(String)
    password_hash: Mapped[str] = mapped_column(String)
    role: Mapped[str] = mapped_column(String(32), default="conferente")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    parent_user_id: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"), index=True)
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    parent_user: Mapped[Optional["User"]] = relationship("User", remote_side="User.id", backref="managed_users")
