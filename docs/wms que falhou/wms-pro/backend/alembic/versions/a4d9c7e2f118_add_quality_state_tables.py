"""add quality state tables

Revision ID: a4d9c7e2f118
Revises: 91c2e7f4ab11
Create Date: 2026-03-20 00:00:01.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a4d9c7e2f118"
down_revision: Union[str, Sequence[str], None] = "91c2e7f4ab11"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "stock_quality_states",
        sa.Column("stock_item_id", sa.String(length=36), nullable=False),
        sa.Column("depot_id", sa.String(length=36), nullable=True),
        sa.Column("shelf_id", sa.String(length=36), nullable=True),
        sa.Column("drawer_id", sa.String(length=36), nullable=True),
        sa.Column("drawer_key", sa.String(), nullable=True),
        sa.Column("product_code", sa.String(), nullable=True),
        sa.Column("shelf_type", sa.String(), nullable=False),
        sa.Column("nearest_expiry", sa.Date(), nullable=True),
        sa.Column("expiry_status", sa.String(), nullable=False),
        sa.Column("days_to_expiry", sa.Integer(), nullable=True),
        sa.Column("days_overdue", sa.Integer(), nullable=True),
        sa.Column("has_expiry", sa.Boolean(), nullable=False),
        sa.Column("is_quarantine", sa.Boolean(), nullable=False),
        sa.Column("is_blocked", sa.Boolean(), nullable=False),
        sa.Column("computed_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["depot_id"], ["depots.id"]),
        sa.ForeignKeyConstraint(["drawer_id"], ["drawers.id"]),
        sa.ForeignKeyConstraint(["shelf_id"], ["shelves.id"]),
        sa.ForeignKeyConstraint(["stock_item_id"], ["stock_items.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("stock_item_id", name="uq_stock_quality_states_stock_item"),
    )
    op.create_index("ix_stock_quality_states_stock_item_id", "stock_quality_states", ["stock_item_id"])
    op.create_index("ix_stock_quality_states_depot_id", "stock_quality_states", ["depot_id"])
    op.create_index("ix_stock_quality_states_shelf_id", "stock_quality_states", ["shelf_id"])
    op.create_index("ix_stock_quality_states_drawer_id", "stock_quality_states", ["drawer_id"])
    op.create_index("ix_stock_quality_states_drawer_key", "stock_quality_states", ["drawer_key"])
    op.create_index("ix_stock_quality_states_product_code", "stock_quality_states", ["product_code"])
    op.create_index("ix_stock_quality_states_shelf_type", "stock_quality_states", ["shelf_type"])
    op.create_index("ix_stock_quality_states_nearest_expiry", "stock_quality_states", ["nearest_expiry"])
    op.create_index("ix_stock_quality_states_expiry_status", "stock_quality_states", ["expiry_status"])
    op.create_index("ix_stock_quality_states_is_quarantine", "stock_quality_states", ["is_quarantine"])
    op.create_index("ix_stock_quality_states_is_blocked", "stock_quality_states", ["is_blocked"])
    op.create_index("ix_stock_quality_states_computed_at", "stock_quality_states", ["computed_at"])

    op.create_table(
        "quality_summaries",
        sa.Column("scope_type", sa.String(), nullable=False),
        sa.Column("scope_id", sa.String(), nullable=True),
        sa.Column("label", sa.String(), nullable=True),
        sa.Column("expired_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("expiring_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("quarantine_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("blocked_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("short_expiry_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("overdue_total_days", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("computed_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("scope_type", "scope_id", name="uq_quality_summaries_scope"),
    )
    op.create_index("ix_quality_summaries_scope_type", "quality_summaries", ["scope_type"])
    op.create_index("ix_quality_summaries_scope_id", "quality_summaries", ["scope_id"])
    op.create_index("ix_quality_summaries_computed_at", "quality_summaries", ["computed_at"])


def downgrade() -> None:
    op.drop_index("ix_quality_summaries_computed_at", table_name="quality_summaries")
    op.drop_index("ix_quality_summaries_scope_id", table_name="quality_summaries")
    op.drop_index("ix_quality_summaries_scope_type", table_name="quality_summaries")
    op.drop_table("quality_summaries")

    op.drop_index("ix_stock_quality_states_computed_at", table_name="stock_quality_states")
    op.drop_index("ix_stock_quality_states_is_blocked", table_name="stock_quality_states")
    op.drop_index("ix_stock_quality_states_is_quarantine", table_name="stock_quality_states")
    op.drop_index("ix_stock_quality_states_expiry_status", table_name="stock_quality_states")
    op.drop_index("ix_stock_quality_states_nearest_expiry", table_name="stock_quality_states")
    op.drop_index("ix_stock_quality_states_shelf_type", table_name="stock_quality_states")
    op.drop_index("ix_stock_quality_states_product_code", table_name="stock_quality_states")
    op.drop_index("ix_stock_quality_states_drawer_key", table_name="stock_quality_states")
    op.drop_index("ix_stock_quality_states_drawer_id", table_name="stock_quality_states")
    op.drop_index("ix_stock_quality_states_shelf_id", table_name="stock_quality_states")
    op.drop_index("ix_stock_quality_states_depot_id", table_name="stock_quality_states")
    op.drop_index("ix_stock_quality_states_stock_item_id", table_name="stock_quality_states")
    op.drop_table("stock_quality_states")
