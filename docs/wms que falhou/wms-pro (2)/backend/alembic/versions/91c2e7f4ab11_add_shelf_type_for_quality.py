"""add shelf type for quality

Revision ID: 91c2e7f4ab11
Revises: f2a8b6c1d4e5
Create Date: 2026-03-20 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "91c2e7f4ab11"
down_revision: Union[str, Sequence[str], None] = "f2a8b6c1d4e5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("shelves")}
    checks = {constraint["name"] for constraint in inspector.get_check_constraints("shelves")}

    with op.batch_alter_table("shelves") as batch_op:
        if "shelf_type" not in columns:
            batch_op.add_column(
                sa.Column("shelf_type", sa.String(), nullable=False, server_default="normal"),
            )
        if "ck_shelves_type_valid" not in checks:
            batch_op.create_check_constraint(
                "ck_shelves_type_valid",
                "shelf_type in ('normal', 'quarantine', 'blocked')",
            )
    op.execute("update shelves set shelf_type = 'normal' where shelf_type is null or shelf_type = ''")
    with op.batch_alter_table("shelves") as batch_op:
        batch_op.alter_column("shelf_type", server_default=None)


def downgrade() -> None:
    with op.batch_alter_table("shelves") as batch_op:
        batch_op.drop_constraint("ck_shelves_type_valid", type_="check")
        batch_op.drop_column("shelf_type")
