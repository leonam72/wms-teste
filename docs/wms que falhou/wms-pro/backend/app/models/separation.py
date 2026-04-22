from datetime import datetime
from typing import List, Optional

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from backend.app.core.database import Base
from backend.app.models.base_class import TimestampMixin

ROMANEIO_STATUS_VALUES = (
    "rascunho",
    "rota_gerada",
    "aguardando_separacao",
    "em_separacao",
    "separacao_concluida",
    "aguardando_conferencia_final",
    "saida_confirmada",
    "cancelado",
)

ITEM_STATUS_VALUES = (
    "pendente",
    "reservado",
    "em_coleta",
    "coletado",
    "nao_achei",
    "divergente",
)

TAREFA_STATUS_VALUES = (
    "pendente",
    "em_andamento",
    "concluida",
    "cancelada",
)

DIVERGENCIA_STATUS_VALUES = (
    "aberta",
    "em_analise",
    "resolvida",
    "cancelada",
)

LOCK_SCOPE_VALUES = (
    "romaneio",
    "item",
    "rota",
    "estoque",
    "tarefa",
)

HISTORICO_ENTITY_TYPE_VALUES = (
    "romaneio_separacao",
    "itens_separacao",
    "rotas_separacao",
    "tarefas_separador",
    "locks_separador",
    "historico_separacao",
    "divergencias_separacao",
)


def _quoted(values: tuple[str, ...]) -> str:
    return ", ".join(f"'{value}'" for value in values)


class RomaneioSeparacao(Base, TimestampMixin):
    __tablename__ = "romaneio_separacao"
    __table_args__ = (
        UniqueConstraint("codigo", name="uq_romaneio_separacao_codigo"),
        CheckConstraint(
            f"status in ({_quoted(ROMANEIO_STATUS_VALUES)})",
            name="ck_romaneio_separacao_status_valid",
        ),
        Index("ix_romaneio_separacao_status_created", "status", "created_at"),
        Index("ix_romaneio_separacao_depot_status", "depot_id", "status"),
    )

    codigo: Mapped[str] = mapped_column(String, index=True)
    status: Mapped[str] = mapped_column(String(64), default="rascunho", index=True)
    referencia_externa: Mapped[Optional[str]] = mapped_column(String, index=True)
    descricao: Mapped[Optional[str]] = mapped_column(Text)
    observacoes: Mapped[Optional[str]] = mapped_column(Text)
    prioridade: Mapped[int] = mapped_column(Integer, default=0)
    depot_id: Mapped[Optional[str]] = mapped_column(ForeignKey("depots.id"), index=True)
    criado_por_id: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"), index=True)
    atualizado_por_id: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"), index=True)
    separador_responsavel_id: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"), index=True)
    conferencia_final_por_id: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"), index=True)
    rota_gerada_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    aguardando_separacao_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    iniciado_em_separacao_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    separacao_concluida_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    conferencia_final_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    saida_confirmada_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    cancelado_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    metadata_json: Mapped[Optional[dict]] = mapped_column(JSON)

    itens: Mapped[List["ItemSeparacao"]] = relationship(
        back_populates="romaneio",
        cascade="all, delete-orphan",
    )
    rotas: Mapped[List["RotaSeparacao"]] = relationship(
        back_populates="romaneio",
        cascade="all, delete-orphan",
    )
    tarefas: Mapped[List["TarefaSeparador"]] = relationship(
        back_populates="romaneio",
        cascade="all, delete-orphan",
    )
    locks: Mapped[List["LockSeparador"]] = relationship(
        back_populates="romaneio",
        cascade="all, delete-orphan",
    )
    historicos: Mapped[List["HistoricoSeparacao"]] = relationship(
        back_populates="romaneio",
        cascade="all, delete-orphan",
    )
    divergencias: Mapped[List["DivergenciaSeparacao"]] = relationship(
        back_populates="romaneio",
        cascade="all, delete-orphan",
    )


class ItemSeparacao(Base, TimestampMixin):
    __tablename__ = "itens_separacao"
    __table_args__ = (
        CheckConstraint(
            f"status in ({_quoted(ITEM_STATUS_VALUES)})",
            name="ck_itens_separacao_status_valid",
        ),
        CheckConstraint("quantidade_solicitada >= 0", name="ck_itens_separacao_qtd_solicitada_non_negative"),
        CheckConstraint("quantidade_reservada >= 0", name="ck_itens_separacao_qtd_reservada_non_negative"),
        CheckConstraint("quantidade_coletada >= 0", name="ck_itens_separacao_qtd_coletada_non_negative"),
        CheckConstraint("peso_solicitado >= 0", name="ck_itens_separacao_peso_solicitado_non_negative"),
        CheckConstraint("peso_reservado >= 0", name="ck_itens_separacao_peso_reservado_non_negative"),
        CheckConstraint("peso_coletado >= 0", name="ck_itens_separacao_peso_coletado_non_negative"),
        UniqueConstraint("romaneio_id", "sequencia", name="uq_itens_separacao_romaneio_sequencia"),
        Index("ix_itens_separacao_romaneio_status", "romaneio_id", "status"),
        Index("ix_itens_separacao_produto_status", "product_id", "status"),
    )

    romaneio_id: Mapped[str] = mapped_column(ForeignKey("romaneio_separacao.id"), index=True)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"), index=True)
    stock_item_id: Mapped[Optional[str]] = mapped_column(ForeignKey("stock_items.id"), index=True)
    drawer_id: Mapped[Optional[str]] = mapped_column(ForeignKey("drawers.id"), index=True)
    separador_id: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"), index=True)
    reservado_por_id: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"), index=True)
    ultima_atualizacao_por_id: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"), index=True)
    status: Mapped[str] = mapped_column(String(64), default="pendente", index=True)
    sequencia: Mapped[int] = mapped_column(Integer, default=1)
    codigo_lote: Mapped[Optional[str]] = mapped_column(String, index=True)
    unidade_medida: Mapped[Optional[str]] = mapped_column(String(32))
    quantidade_solicitada: Mapped[int] = mapped_column(Integer, default=0)
    quantidade_reservada: Mapped[int] = mapped_column(Integer, default=0)
    quantidade_coletada: Mapped[int] = mapped_column(Integer, default=0)
    peso_solicitado: Mapped[float] = mapped_column(Numeric(12, 3), default=0)
    peso_reservado: Mapped[float] = mapped_column(Numeric(12, 3), default=0)
    peso_coletado: Mapped[float] = mapped_column(Numeric(12, 3), default=0)
    reservado_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    coleta_iniciada_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    coletado_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    ultima_movimentacao_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), server_default=func.now())
    observacoes: Mapped[Optional[str]] = mapped_column(Text)
    metadata_json: Mapped[Optional[dict]] = mapped_column(JSON)

    romaneio: Mapped["RomaneioSeparacao"] = relationship(back_populates="itens")
    rotas: Mapped[List["RotaSeparacao"]] = relationship(
        back_populates="item",
        cascade="all, delete-orphan",
    )
    tarefas: Mapped[List["TarefaSeparador"]] = relationship(
        back_populates="item",
        cascade="all, delete-orphan",
    )
    locks: Mapped[List["LockSeparador"]] = relationship(back_populates="item")
    historicos: Mapped[List["HistoricoSeparacao"]] = relationship(back_populates="item")
    divergencias: Mapped[List["DivergenciaSeparacao"]] = relationship(back_populates="item")


class RotaSeparacao(Base, TimestampMixin):
    __tablename__ = "rotas_separacao"
    __table_args__ = (
        UniqueConstraint("romaneio_id", "sequencia", name="uq_rotas_separacao_romaneio_sequencia"),
        Index("ix_rotas_separacao_romaneio_sequencia", "romaneio_id", "sequencia"),
        Index("ix_rotas_separacao_drawer", "drawer_id", "ordem_coleta"),
    )

    romaneio_id: Mapped[str] = mapped_column(ForeignKey("romaneio_separacao.id"), index=True)
    item_id: Mapped[Optional[str]] = mapped_column(ForeignKey("itens_separacao.id"), index=True)
    depot_id: Mapped[Optional[str]] = mapped_column(ForeignKey("depots.id"), index=True)
    shelf_id: Mapped[Optional[str]] = mapped_column(ForeignKey("shelves.id"), index=True)
    drawer_id: Mapped[Optional[str]] = mapped_column(ForeignKey("drawers.id"), index=True)
    stock_item_id: Mapped[Optional[str]] = mapped_column(ForeignKey("stock_items.id"), index=True)
    gerada_por_id: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"), index=True)
    sequencia: Mapped[int] = mapped_column(Integer, default=1)
    ordem_coleta: Mapped[int] = mapped_column(Integer, default=1)
    drawer_key: Mapped[Optional[str]] = mapped_column(String, index=True)
    corredor: Mapped[Optional[str]] = mapped_column(String(64), index=True)
    zona: Mapped[Optional[str]] = mapped_column(String(64), index=True)
    observacoes: Mapped[Optional[str]] = mapped_column(Text)
    gerada_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    metadata_json: Mapped[Optional[dict]] = mapped_column(JSON)

    romaneio: Mapped["RomaneioSeparacao"] = relationship(back_populates="rotas")
    item: Mapped[Optional["ItemSeparacao"]] = relationship(back_populates="rotas")
    tarefas: Mapped[List["TarefaSeparador"]] = relationship(back_populates="rota")


class TarefaSeparador(Base, TimestampMixin):
    __tablename__ = "tarefas_separador"
    __table_args__ = (
        CheckConstraint(
            f"status in ({_quoted(TAREFA_STATUS_VALUES)})",
            name="ck_tarefas_separador_status_valid",
        ),
        Index("ix_tarefas_separador_usuario_status", "separador_id", "status"),
        Index("ix_tarefas_separador_romaneio_status", "romaneio_id", "status"),
    )

    romaneio_id: Mapped[str] = mapped_column(ForeignKey("romaneio_separacao.id"), index=True)
    item_id: Mapped[Optional[str]] = mapped_column(ForeignKey("itens_separacao.id"), index=True)
    rota_id: Mapped[Optional[str]] = mapped_column(ForeignKey("rotas_separacao.id"), index=True)
    separador_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    atribuida_por_id: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"), index=True)
    concluida_por_id: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"), index=True)
    status: Mapped[str] = mapped_column(String(32), default="pendente", index=True)
    prioridade: Mapped[int] = mapped_column(Integer, default=0)
    titulo: Mapped[str] = mapped_column(String)
    descricao: Mapped[Optional[str]] = mapped_column(Text)
    atribuida_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    iniciada_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    concluida_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    metadata_json: Mapped[Optional[dict]] = mapped_column(JSON)

    romaneio: Mapped["RomaneioSeparacao"] = relationship(back_populates="tarefas")
    item: Mapped[Optional["ItemSeparacao"]] = relationship(back_populates="tarefas")
    rota: Mapped[Optional["RotaSeparacao"]] = relationship(back_populates="tarefas")


class LockSeparador(Base, TimestampMixin):
    __tablename__ = "locks_separador"
    __table_args__ = (
        CheckConstraint(
            f"lock_scope in ({_quoted(LOCK_SCOPE_VALUES)})",
            name="ck_locks_separador_scope_valid",
        ),
        Index("ix_locks_separador_recurso_ativo", "resource_type", "resource_id", "ativo"),
        Index("ix_locks_separador_usuario_ativo", "user_id", "ativo"),
    )

    romaneio_id: Mapped[Optional[str]] = mapped_column(ForeignKey("romaneio_separacao.id"), index=True)
    item_id: Mapped[Optional[str]] = mapped_column(ForeignKey("itens_separacao.id"), index=True)
    tarefa_id: Mapped[Optional[str]] = mapped_column(ForeignKey("tarefas_separador.id"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    liberado_por_id: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"), index=True)
    lock_scope: Mapped[str] = mapped_column(String(32), index=True)
    resource_type: Mapped[str] = mapped_column(String(64), index=True)
    resource_id: Mapped[str] = mapped_column(String(36), index=True)
    motivo: Mapped[Optional[str]] = mapped_column(Text)
    token: Mapped[Optional[str]] = mapped_column(String, unique=True, index=True)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    adquirido_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    expira_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), index=True)
    liberado_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), index=True)
    metadata_json: Mapped[Optional[dict]] = mapped_column(JSON)

    romaneio: Mapped[Optional["RomaneioSeparacao"]] = relationship(back_populates="locks")
    item: Mapped[Optional["ItemSeparacao"]] = relationship(back_populates="locks")


class HistoricoSeparacao(Base, TimestampMixin):
    __tablename__ = "historico_separacao"
    __table_args__ = (
        CheckConstraint(
            f"entity_type in ({_quoted(HISTORICO_ENTITY_TYPE_VALUES)})",
            name="ck_historico_separacao_entity_type_valid",
        ),
        Index("ix_historico_separacao_romaneio_evento", "romaneio_id", "evento_em"),
        Index("ix_historico_separacao_entidade", "entity_type", "entity_id"),
    )

    romaneio_id: Mapped[str] = mapped_column(ForeignKey("romaneio_separacao.id"), index=True)
    item_id: Mapped[Optional[str]] = mapped_column(ForeignKey("itens_separacao.id"), index=True)
    divergencia_id: Mapped[Optional[str]] = mapped_column(ForeignKey("divergencias_separacao.id"), index=True)
    actor_user_id: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"), index=True)
    entity_type: Mapped[str] = mapped_column(String(64), index=True)
    entity_id: Mapped[str] = mapped_column(String(36), index=True)
    acao: Mapped[str] = mapped_column(String(64), index=True)
    status_anterior: Mapped[Optional[str]] = mapped_column(String(64))
    status_novo: Mapped[Optional[str]] = mapped_column(String(64))
    descricao: Mapped[Optional[str]] = mapped_column(Text)
    payload_json: Mapped[Optional[dict]] = mapped_column(JSON)
    evento_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String, index=True)

    romaneio: Mapped["RomaneioSeparacao"] = relationship(back_populates="historicos")
    item: Mapped[Optional["ItemSeparacao"]] = relationship(back_populates="historicos")
    divergencia: Mapped[Optional["DivergenciaSeparacao"]] = relationship(back_populates="historicos")


class DivergenciaSeparacao(Base, TimestampMixin):
    __tablename__ = "divergencias_separacao"
    __table_args__ = (
        CheckConstraint(
            f"status in ({_quoted(DIVERGENCIA_STATUS_VALUES)})",
            name="ck_divergencias_separacao_status_valid",
        ),
        Index("ix_divergencias_separacao_status_created", "status", "created_at"),
        Index("ix_divergencias_separacao_romaneio_status", "romaneio_id", "status"),
    )

    romaneio_id: Mapped[str] = mapped_column(ForeignKey("romaneio_separacao.id"), index=True)
    item_id: Mapped[Optional[str]] = mapped_column(ForeignKey("itens_separacao.id"), index=True)
    product_id: Mapped[Optional[str]] = mapped_column(ForeignKey("products.id"), index=True)
    stock_item_id: Mapped[Optional[str]] = mapped_column(ForeignKey("stock_items.id"), index=True)
    drawer_id: Mapped[Optional[str]] = mapped_column(ForeignKey("drawers.id"), index=True)
    reportado_por_id: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"), index=True)
    resolvido_por_id: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"), index=True)
    status: Mapped[str] = mapped_column(String(32), default="aberta", index=True)
    tipo: Mapped[str] = mapped_column(String(64), index=True)
    severidade: Mapped[Optional[str]] = mapped_column(String(32), index=True)
    descricao: Mapped[str] = mapped_column(Text)
    quantidade_esperada: Mapped[float] = mapped_column(Numeric(12, 3), default=0)
    quantidade_encontrada: Mapped[float] = mapped_column(Numeric(12, 3), default=0)
    aberta_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    resolvida_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), index=True)
    resolucao: Mapped[Optional[str]] = mapped_column(Text)
    metadata_json: Mapped[Optional[dict]] = mapped_column(JSON)

    romaneio: Mapped["RomaneioSeparacao"] = relationship(back_populates="divergencias")
    item: Mapped[Optional["ItemSeparacao"]] = relationship(back_populates="divergencias")
    historicos: Mapped[List["HistoricoSeparacao"]] = relationship(back_populates="divergencia")
