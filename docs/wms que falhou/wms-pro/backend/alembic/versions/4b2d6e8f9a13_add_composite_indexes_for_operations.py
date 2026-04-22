"""add composite indexes for operations

Revision ID: 4b2d6e8f9a13
Revises: 0c8b7a6d1e22
Create Date: 2026-03-21 01:30:00.000000
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "4b2d6e8f9a13"
down_revision = "0c8b7a6d1e22"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index("ix_stock_items_drawer_product_lot", "stock_items", ["drawer_id", "product_id", "lot"], unique=False)
    op.create_index("ix_inventory_movements_product_drawer_happened", "inventory_movements", ["product_code", "drawer_key", "happened_at"], unique=False)
    op.create_index("ix_stock_quality_states_depot_expiry_computed", "stock_quality_states", ["depot_id", "expiry_status", "computed_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_stock_quality_states_depot_expiry_computed", table_name="stock_quality_states")
    op.drop_index("ix_inventory_movements_product_drawer_happened", table_name="inventory_movements")
    op.drop_index("ix_stock_items_drawer_product_lot", table_name="stock_items")
