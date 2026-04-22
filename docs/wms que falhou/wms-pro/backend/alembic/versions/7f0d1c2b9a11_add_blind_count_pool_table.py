"""add blind count pool table

Revision ID: 7f0d1c2b9a11
Revises: 4ac1d9b2ef77
Create Date: 2026-03-20 20:30:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "7f0d1c2b9a11"
down_revision: Union[str, Sequence[str], None] = "4ac1d9b2ef77"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "blind_count_pool_items",
        sa.Column("unload_id", sa.String(), nullable=False),
        sa.Column("item_key", sa.String(), nullable=False),
        sa.Column("payload_json", sa.JSON(), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_blind_count_pool_items_item_key"), "blind_count_pool_items", ["item_key"], unique=True)
    op.create_index(op.f("ix_blind_count_pool_items_unload_id"), "blind_count_pool_items", ["unload_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_blind_count_pool_items_unload_id"), table_name="blind_count_pool_items")
    op.drop_index(op.f("ix_blind_count_pool_items_item_key"), table_name="blind_count_pool_items")
    op.drop_table("blind_count_pool_items")
