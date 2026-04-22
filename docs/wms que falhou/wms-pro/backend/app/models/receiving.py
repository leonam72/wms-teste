from __future__ import annotations

from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, Index
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.core.database import Base
from backend.app.models.base_class import TimestampMixin


class NFeReceivingSession(Base, TimestampMixin):
    """
    Sessão de recebimento / conferência cega de NF-e.

    Ciclo de vida do status:
        em_conferencia  → conferente preenche e fecha
        pending_review  → aguardando aprovação do supervisor
        approved        → supervisor aprovou → itens entram no estoque
        rejected        → supervisor reprovou → volta para reconferência
        falta / excesso / avaria  → status de divergência (legado, mantido por compat)
    """
    __tablename__ = "nfe_receiving_sessions"
    __table_args__ = (
        Index("ix_nfe_receiving_sessions_status_started", "status", "started_at"),
        Index("ix_nfe_receiving_sessions_chave_status", "chave_acesso", "status"),
        Index("ix_nfe_receiving_sessions_aprovacao", "status", "aprovado_em"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True)
    chave_acesso: Mapped[str] = mapped_column(String(44), index=True)
    numero_nf: Mapped[str | None] = mapped_column(String(32), index=True)
    serie: Mapped[str | None] = mapped_column(String(16))
    emitente_nome: Mapped[str | None] = mapped_column(String(255), index=True)
    emitente_cnpj: Mapped[str | None] = mapped_column(String(18), index=True)
    placa_veiculo: Mapped[str | None] = mapped_column(String(16), index=True)
    depot_id: Mapped[str | None] = mapped_column(ForeignKey("depots.id"), nullable=True, index=True)
    operador_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    operador_username: Mapped[str | None] = mapped_column(String(255), index=True)

    # Status principal do ciclo de vida
    status: Mapped[str] = mapped_column(String(32), default="em_conferencia", index=True)

    # Timestamps operacionais
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    duracao_segundos: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Itens (legado — flat list serializada, mantida por compatibilidade)
    itens_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Itens separados por condição (novo fluxo)
    itens_ok_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    itens_avariados_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    itens_devolvidos_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Fechamento
    observacao_fechamento: Mapped[str | None] = mapped_column(Text, nullable=True)
    motivo_falta: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Aprovação
    aprovador_id: Mapped[str | None] = mapped_column(String, nullable=True)
    aprovador_username: Mapped[str | None] = mapped_column(String(255), nullable=True)
    aprovado_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    motivo_reprovacao: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Reconferência — aponta para a sessão original que foi reprovada
    reconferencia_de: Mapped[str | None] = mapped_column(String, nullable=True)

    version: Mapped[int] = mapped_column(Integer, default=1)
