from __future__ import annotations
from datetime import datetime
from typing import Optional, List
from sqlalchemy import String, Integer, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..core.database import Base, TimestampMixin

class RomaneioSeparacao(Base, TimestampMixin):
    __tablename__ = "romaneio_separacao"
    codigo: Mapped[str] = mapped_column(String, unique=True, index=True)
    status: Mapped[str] = mapped_column(String(64), default="rascunho")
    prioridade: Mapped[int] = mapped_column(Integer, default=0)
    
    itens: Mapped[List["ItemSeparacao"]] = relationship(back_populates="romaneio", cascade="all, delete-orphan")

class ItemSeparacao(Base, TimestampMixin):
    __tablename__ = "itens_separacao"
    romaneio_id: Mapped[str] = mapped_column(ForeignKey("romaneio_separacao.id"))
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"))
    quantity: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(64), default="pendente")
    
    romaneio: Mapped["RomaneioSeparacao"] = relationship(back_populates="itens")

class RotaSeparacao(Base, TimestampMixin):
    __tablename__ = "rotas_separacao"
    romaneio_id: Mapped[str] = mapped_column(ForeignKey("romaneio_separacao.id"))
    sequencia: Mapped[int] = mapped_column(Integer)
    drawer_key: Mapped[str] = mapped_column(String)
    
    romaneio: Mapped["RomaneioSeparacao"] = relationship()

class TarefaSeparador(Base, TimestampMixin):
    __tablename__ = "tarefas_separador"
    romaneio_id: Mapped[str] = mapped_column(ForeignKey("romaneio_separacao.id"))
    item_id: Mapped[str] = mapped_column(ForeignKey("itens_separacao.id"))
    separador_id: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String(32), default="pendente")
    iniciada_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    
    romaneio: Mapped["RomaneioSeparacao"] = relationship()

class LockSeparador(Base, TimestampMixin):
    __tablename__ = "locks_separador"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    resource_type: Mapped[str] = mapped_column(String(64)) # task, drawer
    resource_id: Mapped[str] = mapped_column(String(36))
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)
    expira_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    adquirido_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

class DivergenciaSeparacao(Base, TimestampMixin):
    __tablename__ = "divergencias_separacao"
    romaneio_id: Mapped[str] = mapped_column(ForeignKey("romaneio_separacao.id"))
    item_id: Mapped[Optional[str]] = mapped_column(ForeignKey("itens_separacao.id"))
    reportado_por_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String(32), default="aberta")
    tipo: Mapped[str] = mapped_column(String(64))
    descricao: Mapped[str] = mapped_column(String)
    
    romaneio: Mapped["RomaneioSeparacao"] = relationship()
