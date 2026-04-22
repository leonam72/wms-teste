from __future__ import annotations
from typing import List, Optional
from datetime import datetime
from sqlalchemy import String, Integer, Float, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from ..core.database import Base, TimestampMixin

class ReceivingSession(Base, TimestampMixin):
    """Sessão de recebimento originada de um XML (Inbound)."""
    __tablename__ = "receiving_sessions"
    
    nfe_access_key: Mapped[str] = mapped_column(String, unique=True, index=True)
    nfe_number: Mapped[str] = mapped_column(String)
    issuer_name: Mapped[str] = mapped_column(String)
    issuer_cnpj: Mapped[str] = mapped_column(String)
    
    status: Mapped[str] = mapped_column(String, default="PENDING") # PENDING, COUNTING, VALIDATED
    operator_id: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"))
    
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    items: Mapped[List["ReceivingItem"]] = relationship(back_populates="session", cascade="all, delete-orphan")
    operator: Mapped[Optional["User"]] = relationship()

class ReceivingItem(Base, TimestampMixin):
    """Itens extraídos da NFe que precisam ser contados no físico."""
    __tablename__ = "receiving_items"
    
    session_id: Mapped[str] = mapped_column(ForeignKey("receiving_sessions.id"))
    product_code: Mapped[str] = mapped_column(String, index=True) # cProd da NF
    ean: Mapped[Optional[str]] = mapped_column(String, index=True) # cEAN da NF
    description: Mapped[str] = mapped_column(String)
    
    expected_qty: Mapped[float] = mapped_column(Float, default=0.0)
    counted_qty: Mapped[float] = mapped_column(Float, default=0.0)
    unit: Mapped[str] = mapped_column(String) # CX, FD, UN
    
    lot: Mapped[Optional[str]] = mapped_column(String)
    expiry: Mapped[Optional[str]] = mapped_column(String)
    
    session: Mapped["ReceivingSession"] = relationship(back_populates="items")
