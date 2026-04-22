from typing import Optional
from datetime import datetime
import uuid
from sqlalchemy.orm import Mapped, mapped_column, DeclarativeBase
from sqlalchemy import DateTime, Boolean, String, Integer
from sqlalchemy.sql import func
from backend.app.core.database import Base

class TimestampMixin:
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
