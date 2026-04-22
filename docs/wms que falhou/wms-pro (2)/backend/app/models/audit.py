from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from backend.app.core.database import Base
from backend.app.models.base_class import TimestampMixin


class AuditLog(Base, TimestampMixin):
    __tablename__ = "audit_logs"

    user_id: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    username: Mapped[Optional[str]] = mapped_column(String, nullable=True, index=True)
    action: Mapped[str] = mapped_column(String, index=True)
    table_name: Mapped[str] = mapped_column(String, index=True)
    record_id: Mapped[Optional[str]] = mapped_column(String, nullable=True, index=True)
    old_value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    new_value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String, nullable=True, index=True)
    created_at_event: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
