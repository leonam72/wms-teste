"""add allow_overcapacity to depots

Revision ID: 4ac1d9b2ef77
Revises: d6b7e4a9c2f1
Create Date: 2026-03-20 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "4ac1d9b2ef77"
down_revision: Union[str, Sequence[str], None] = "d6b7e4a9c2f1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = {column["name"] for column in inspector.get_columns("depots")}
    if "allow_overcapacity" not in existing:
        op.add_column("depots", sa.Column("allow_overcapacity", sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    op.drop_column("depots", "allow_overcapacity")
