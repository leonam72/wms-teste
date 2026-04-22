from backend.app.core.database import Base
from datetime import datetime, date
from typing import Optional, List, Dict, Any
from sqlalchemy import String, Integer, JSON, Enum, Text
from sqlalchemy.orm import Mapped, mapped_column
from backend.app.models.base_class import TimestampMixin
import enum

class SyncStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class SyncQueue(Base, TimestampMixin):
    __tablename__ = "sync_queue"
    
    entity_type: Mapped[str] = mapped_column(String, index=True)
    entity_id: Mapped[str] = mapped_column(String, index=True)
    operation: Mapped[str] = mapped_column(String) # create, update, delete
    payload: Mapped[dict] = mapped_column(JSON)
    status: Mapped[SyncStatus] = mapped_column(default=SyncStatus.PENDING, index=True)
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    last_error: Mapped[Optional[str]] = mapped_column(String)

class SyncState(Base, TimestampMixin):
    __tablename__ = "sync_state"
    # Single row usually
    last_pulled_at: Mapped[Optional[datetime]] = mapped_column(default=None)
    last_pushed_at: Mapped[Optional[datetime]] = mapped_column(default=None)


class WmsStateSnapshot(Base, TimestampMixin):
    __tablename__ = "wms_state_snapshots"

    snapshot_key: Mapped[str] = mapped_column(String, unique=True, index=True, default="default")
    revision: Mapped[Optional[str]] = mapped_column(String, index=True)
    state_json: Mapped[dict] = mapped_column(JSON)
    source: Mapped[Optional[str]] = mapped_column(String, default="system")
    notes: Mapped[Optional[str]] = mapped_column(Text)


class BlindCountPoolItem(Base, TimestampMixin):
    __tablename__ = "blind_count_pool_items"

    unload_id: Mapped[str] = mapped_column(String, index=True)
    item_key: Mapped[str] = mapped_column(String, unique=True, index=True)
    payload_json: Mapped[dict] = mapped_column(JSON)
