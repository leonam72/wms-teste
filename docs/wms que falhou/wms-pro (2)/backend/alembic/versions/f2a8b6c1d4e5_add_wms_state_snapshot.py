"""Add WMS state snapshot table

Revision ID: f2a8b6c1d4e5
Revises: e1b4d2f9c8a7
Create Date: 2026-03-20 18:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f2a8b6c1d4e5"
down_revision: Union[str, None] = "e1b4d2f9c8a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "wms_state_snapshots",
        sa.Column("snapshot_key", sa.String(), nullable=False),
        sa.Column("revision", sa.String(), nullable=True),
        sa.Column("state_json", sa.JSON(), nullable=False),
        sa.Column("source", sa.String(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_wms_state_snapshots_snapshot_key", "wms_state_snapshots", ["snapshot_key"], unique=True)
    op.create_index("ix_wms_state_snapshots_revision", "wms_state_snapshots", ["revision"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_wms_state_snapshots_revision", table_name="wms_state_snapshots")
    op.drop_index("ix_wms_state_snapshots_snapshot_key", table_name="wms_state_snapshots")
    op.drop_table("wms_state_snapshots")
