"""add nfe receiving sessions

Revision ID: c8e1f7b4a912
Revises: 9f3c1a7b2d55
Create Date: 2026-03-21 19:20:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "c8e1f7b4a912"
down_revision = "9f3c1a7b2d55"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "nfe_receiving_sessions",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("chave_acesso", sa.String(length=44), nullable=False),
        sa.Column("numero_nf", sa.String(length=32), nullable=True),
        sa.Column("serie", sa.String(length=16), nullable=True),
        sa.Column("emitente_nome", sa.String(length=255), nullable=True),
        sa.Column("emitente_cnpj", sa.String(length=18), nullable=True),
        sa.Column("placa_veiculo", sa.String(length=16), nullable=True),
        sa.Column("depot_id", sa.String(), nullable=True),
        sa.Column("operador_id", sa.String(), nullable=True),
        sa.Column("operador_username", sa.String(length=255), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("duracao_segundos", sa.Integer(), nullable=True),
        sa.Column("itens_json", sa.Text(), nullable=True),
        sa.Column("observacao_fechamento", sa.Text(), nullable=True),
        sa.Column("motivo_falta", sa.Text(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["depot_id"], ["depots.id"]),
        sa.ForeignKeyConstraint(["operador_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_nfe_receiving_sessions_chave_acesso", "nfe_receiving_sessions", ["chave_acesso"], unique=False)
    op.create_index("ix_nfe_receiving_sessions_chave_status", "nfe_receiving_sessions", ["chave_acesso", "status"], unique=False)
    op.create_index("ix_nfe_receiving_sessions_emitente_cnpj", "nfe_receiving_sessions", ["emitente_cnpj"], unique=False)
    op.create_index("ix_nfe_receiving_sessions_emitente_nome", "nfe_receiving_sessions", ["emitente_nome"], unique=False)
    op.create_index("ix_nfe_receiving_sessions_ended_at", "nfe_receiving_sessions", ["ended_at"], unique=False)
    op.create_index("ix_nfe_receiving_sessions_numero_nf", "nfe_receiving_sessions", ["numero_nf"], unique=False)
    op.create_index("ix_nfe_receiving_sessions_operador_id", "nfe_receiving_sessions", ["operador_id"], unique=False)
    op.create_index("ix_nfe_receiving_sessions_operador_username", "nfe_receiving_sessions", ["operador_username"], unique=False)
    op.create_index("ix_nfe_receiving_sessions_placa_veiculo", "nfe_receiving_sessions", ["placa_veiculo"], unique=False)
    op.create_index("ix_nfe_receiving_sessions_started_at", "nfe_receiving_sessions", ["started_at"], unique=False)
    op.create_index("ix_nfe_receiving_sessions_status", "nfe_receiving_sessions", ["status"], unique=False)
    op.create_index("ix_nfe_receiving_sessions_status_started", "nfe_receiving_sessions", ["status", "started_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_nfe_receiving_sessions_status_started", table_name="nfe_receiving_sessions")
    op.drop_index("ix_nfe_receiving_sessions_status", table_name="nfe_receiving_sessions")
    op.drop_index("ix_nfe_receiving_sessions_started_at", table_name="nfe_receiving_sessions")
    op.drop_index("ix_nfe_receiving_sessions_placa_veiculo", table_name="nfe_receiving_sessions")
    op.drop_index("ix_nfe_receiving_sessions_operador_username", table_name="nfe_receiving_sessions")
    op.drop_index("ix_nfe_receiving_sessions_operador_id", table_name="nfe_receiving_sessions")
    op.drop_index("ix_nfe_receiving_sessions_numero_nf", table_name="nfe_receiving_sessions")
    op.drop_index("ix_nfe_receiving_sessions_ended_at", table_name="nfe_receiving_sessions")
    op.drop_index("ix_nfe_receiving_sessions_emitente_nome", table_name="nfe_receiving_sessions")
    op.drop_index("ix_nfe_receiving_sessions_emitente_cnpj", table_name="nfe_receiving_sessions")
    op.drop_index("ix_nfe_receiving_sessions_chave_status", table_name="nfe_receiving_sessions")
    op.drop_index("ix_nfe_receiving_sessions_chave_acesso", table_name="nfe_receiving_sessions")
    op.drop_table("nfe_receiving_sessions")
