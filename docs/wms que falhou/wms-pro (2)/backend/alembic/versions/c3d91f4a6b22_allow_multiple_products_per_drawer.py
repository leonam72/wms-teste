"""Allow multiple products per drawer

Revision ID: c3d91f4a6b22
Revises: b7f2c6d9a1e4
Create Date: 2026-03-20 15:42:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "c3d91f4a6b22"
down_revision: Union[str, None] = "b7f2c6d9a1e4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("stock_items") as batch_op:
        batch_op.drop_constraint("uq_stock_items_drawer_id", type_="unique")


def downgrade() -> None:
    with op.batch_alter_table("stock_items") as batch_op:
        batch_op.create_unique_constraint("uq_stock_items_drawer_id", ["drawer_id"])
