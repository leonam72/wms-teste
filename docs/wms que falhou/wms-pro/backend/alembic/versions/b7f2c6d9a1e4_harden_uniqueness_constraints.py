"""Harden uniqueness and integrity constraints

Revision ID: b7f2c6d9a1e4
Revises: 511b352078e9
Create Date: 2026-03-20 15:20:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "b7f2c6d9a1e4"
down_revision: Union[str, None] = "511b352078e9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("depots") as batch_op:
        batch_op.create_unique_constraint("uq_depots_name", ["name"])

    with op.batch_alter_table("shelves") as batch_op:
        batch_op.create_unique_constraint("uq_shelves_depot_code", ["depot_id", "code"])
        batch_op.create_check_constraint("ck_shelves_floors_positive", "floors > 0")
        batch_op.create_check_constraint("ck_shelves_drawers_positive", "drawers_per_floor > 0")
        batch_op.create_check_constraint("ck_shelves_max_kg_positive", "max_kg_per_drawer > 0")

    with op.batch_alter_table("drawers") as batch_op:
        batch_op.create_unique_constraint("uq_drawers_shelf_position", ["shelf_id", "floor_number", "drawer_number"])
        batch_op.create_check_constraint("ck_drawers_floor_positive", "floor_number > 0")
        batch_op.create_check_constraint("ck_drawers_number_positive", "drawer_number > 0")

    with op.batch_alter_table("stock_items") as batch_op:
        batch_op.create_unique_constraint("uq_stock_items_drawer_id", ["drawer_id"])
        batch_op.create_check_constraint("ck_stock_items_quantity_positive", "quantity > 0")
        batch_op.create_check_constraint("ck_stock_items_kg_non_negative", "kg >= 0")

    with op.batch_alter_table("expiries") as batch_op:
        batch_op.create_unique_constraint("uq_expiries_stock_item_date", ["stock_item_id", "date_value"])

    with op.batch_alter_table("floorplan_shelves") as batch_op:
        batch_op.create_unique_constraint("uq_floorplan_shelves_depot_shelf", ["depot_id", "shelf_id"])


def downgrade() -> None:
    with op.batch_alter_table("floorplan_shelves") as batch_op:
        batch_op.drop_constraint("uq_floorplan_shelves_depot_shelf", type_="unique")

    with op.batch_alter_table("expiries") as batch_op:
        batch_op.drop_constraint("uq_expiries_stock_item_date", type_="unique")

    with op.batch_alter_table("stock_items") as batch_op:
        batch_op.drop_constraint("ck_stock_items_kg_non_negative", type_="check")
        batch_op.drop_constraint("ck_stock_items_quantity_positive", type_="check")
        batch_op.drop_constraint("uq_stock_items_drawer_id", type_="unique")

    with op.batch_alter_table("drawers") as batch_op:
        batch_op.drop_constraint("ck_drawers_number_positive", type_="check")
        batch_op.drop_constraint("ck_drawers_floor_positive", type_="check")
        batch_op.drop_constraint("uq_drawers_shelf_position", type_="unique")

    with op.batch_alter_table("shelves") as batch_op:
        batch_op.drop_constraint("ck_shelves_max_kg_positive", type_="check")
        batch_op.drop_constraint("ck_shelves_drawers_positive", type_="check")
        batch_op.drop_constraint("ck_shelves_floors_positive", type_="check")
        batch_op.drop_constraint("uq_shelves_depot_code", type_="unique")

    with op.batch_alter_table("depots") as batch_op:
        batch_op.drop_constraint("uq_depots_name", type_="unique")
