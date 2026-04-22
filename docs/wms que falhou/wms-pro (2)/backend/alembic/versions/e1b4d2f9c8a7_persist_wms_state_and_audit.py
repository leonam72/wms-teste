"""Persist WMS state and audit metadata

Revision ID: e1b4d2f9c8a7
Revises: c3d91f4a6b22
Create Date: 2026-03-20 17:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e1b4d2f9c8a7"
down_revision: Union[str, None] = "c3d91f4a6b22"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("products") as batch_op:
        batch_op.add_column(sa.Column("brand", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("manufacturer", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("model", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("min_stock", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("max_stock", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("reorder_point", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("length_cm", sa.Float(), nullable=True))
        batch_op.add_column(sa.Column("width_cm", sa.Float(), nullable=True))
        batch_op.add_column(sa.Column("height_cm", sa.Float(), nullable=True))
        batch_op.add_column(sa.Column("serial_control", sa.String(), nullable=True))

    with op.batch_alter_table("stock_items") as batch_op:
        batch_op.add_column(sa.Column("kg_per_unit", sa.Float(), nullable=True))
        batch_op.add_column(sa.Column("notes", sa.Text(), nullable=True))

    op.create_table(
        "inventory_movements",
        sa.Column("action", sa.String(), nullable=False),
        sa.Column("icon", sa.String(), nullable=True),
        sa.Column("detail", sa.Text(), nullable=True),
        sa.Column("happened_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=True),
        sa.Column("username", sa.String(), nullable=True),
        sa.Column("depot_id", sa.String(length=36), nullable=True),
        sa.Column("drawer_key", sa.String(), nullable=True),
        sa.Column("product_code", sa.String(), nullable=True),
        sa.Column("payload_json", sa.Text(), nullable=True),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["depot_id"], ["depots.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_inventory_movements_action", "inventory_movements", ["action"], unique=False)
    op.create_index("ix_inventory_movements_happened_at", "inventory_movements", ["happened_at"], unique=False)
    op.create_index("ix_inventory_movements_username", "inventory_movements", ["username"], unique=False)
    op.create_index("ix_inventory_movements_drawer_key", "inventory_movements", ["drawer_key"], unique=False)
    op.create_index("ix_inventory_movements_product_code", "inventory_movements", ["product_code"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_inventory_movements_product_code", table_name="inventory_movements")
    op.drop_index("ix_inventory_movements_drawer_key", table_name="inventory_movements")
    op.drop_index("ix_inventory_movements_username", table_name="inventory_movements")
    op.drop_index("ix_inventory_movements_happened_at", table_name="inventory_movements")
    op.drop_index("ix_inventory_movements_action", table_name="inventory_movements")
    op.drop_table("inventory_movements")

    with op.batch_alter_table("stock_items") as batch_op:
        batch_op.drop_column("notes")
        batch_op.drop_column("kg_per_unit")

    with op.batch_alter_table("products") as batch_op:
        batch_op.drop_column("serial_control")
        batch_op.drop_column("height_cm")
        batch_op.drop_column("width_cm")
        batch_op.drop_column("length_cm")
        batch_op.drop_column("reorder_point")
        batch_op.drop_column("max_stock")
        batch_op.drop_column("min_stock")
        batch_op.drop_column("model")
        batch_op.drop_column("manufacturer")
        batch_op.drop_column("brand")
