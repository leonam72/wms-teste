from __future__ import annotations
from typing import Optional
from sqlalchemy import String, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..core.database import Base, TimestampMixin

class AuditLog(Base, TimestampMixin):
    """Registro de auditoria para ações operacionais."""
    __tablename__ = "audit_logs"
    
    operator_id: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"))
    action_tag: Mapped[str] = mapped_column(String, index=True) # [LOGIN], [INBOUND], [MOVE], [OUT]
    description: Mapped[str] = mapped_column(Text)
    
    # Referência opcional para entidades
    entity_type: Mapped[Optional[str]] = mapped_column(String) # product, stock_item, session
    entity_id: Mapped[Optional[str]] = mapped_column(String)
    
    operator: Mapped[Optional["User"]] = relationship()
