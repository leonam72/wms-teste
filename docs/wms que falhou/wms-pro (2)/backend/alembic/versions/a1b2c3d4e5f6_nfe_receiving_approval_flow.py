"""Add approval flow to NFeReceivingSession

Revision ID: a1b2c3d4e5f6
Revises: c8e1f7b4a912
Create Date: 2026-03-21

Changes:
- status now includes 'pending_review', 'approved', 'rejected'
- added: aprovador_id, aprovador_username, aprovado_em, motivo_reprovacao
- added: itens_ok_json, itens_avariados_json, itens_devolvidos_json
  (replaces the old flat itens_json for the new flow; old field kept for migration compat)
- added: reconferencia_de (FK to self — links a re-conference to the rejected original)
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = 'a1b2c3d4e5f6'
down_revision = 'c8e1f7b4a912'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('nfe_receiving_sessions', schema=None) as batch_op:
        batch_op.add_column(sa.Column('aprovador_id', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('aprovador_username', sa.String(255), nullable=True))
        batch_op.add_column(sa.Column('aprovado_em', sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column('motivo_reprovacao', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('reconferencia_de', sa.String(), nullable=True))
        # Split item types for new conference model
        batch_op.add_column(sa.Column('itens_ok_json', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('itens_avariados_json', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('itens_devolvidos_json', sa.Text(), nullable=True))
        # Create indexes
        batch_op.create_index('ix_nfe_receiving_sessions_aprovacao',
                              ['status', 'aprovado_em'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('nfe_receiving_sessions', schema=None) as batch_op:
        batch_op.drop_index('ix_nfe_receiving_sessions_aprovacao')
        batch_op.drop_column('itens_devolvidos_json')
        batch_op.drop_column('itens_avariados_json')
        batch_op.drop_column('itens_ok_json')
        batch_op.drop_column('reconferencia_de')
        batch_op.drop_column('motivo_reprovacao')
        batch_op.drop_column('aprovado_em')
        batch_op.drop_column('aprovador_username')
        batch_op.drop_column('aprovador_id')
