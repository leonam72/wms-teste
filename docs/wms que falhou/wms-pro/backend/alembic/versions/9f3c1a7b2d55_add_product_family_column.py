"""add product family column

Revision ID: 9f3c1a7b2d55
Revises: 8c5d7e1a2b34
Create Date: 2026-03-21 15:20:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "9f3c1a7b2d55"
down_revision = "8c5d7e1a2b34"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("products", schema=None) as batch_op:
        batch_op.add_column(sa.Column("family", sa.String(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("products", schema=None) as batch_op:
        batch_op.drop_column("family")
