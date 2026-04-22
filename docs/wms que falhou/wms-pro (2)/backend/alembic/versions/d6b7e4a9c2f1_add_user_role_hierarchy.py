"""add user role hierarchy

Revision ID: d6b7e4a9c2f1
Revises: a4d9c7e2f118
Create Date: 2026-03-20 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "d6b7e4a9c2f1"
down_revision = "a4d9c7e2f118"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.add_column(sa.Column("parent_user_id", sa.String(length=36), nullable=True))
        batch_op.add_column(sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.create_index(batch_op.f("ix_users_parent_user_id"), ["parent_user_id"], unique=False)
        batch_op.create_foreign_key("fk_users_parent_user_id_users", "users", ["parent_user_id"], ["id"])
        batch_op.alter_column(
            "role",
            existing_type=sa.String(length=20),
            type_=sa.String(length=32),
            existing_nullable=False,
        )

    op.execute("UPDATE users SET role='conferente' WHERE lower(role) IN ('operator')")
    op.execute("UPDATE users SET role='qualidade' WHERE lower(role) IN ('auditor')")
    op.execute("UPDATE users SET role='gerente' WHERE lower(role) IN ('manager')")
    op.execute("UPDATE users SET role='admin' WHERE lower(role) IN ('admin')")


def downgrade() -> None:
    op.execute("UPDATE users SET role='operator' WHERE lower(role) IN ('conferente')")
    op.execute("UPDATE users SET role='auditor' WHERE lower(role) IN ('qualidade')")
    op.execute("UPDATE users SET role='manager' WHERE lower(role) IN ('supervisor', 'gerente')")
    op.execute("UPDATE users SET role='admin' WHERE lower(role) IN ('admin', 'master')")

    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.drop_constraint("fk_users_parent_user_id_users", type_="foreignkey")
        batch_op.drop_index(batch_op.f("ix_users_parent_user_id"))
        batch_op.drop_column("last_login_at")
        batch_op.drop_column("parent_user_id")
        batch_op.alter_column(
            "role",
            existing_type=sa.String(length=32),
            type_=sa.String(length=20),
            existing_nullable=False,
        )
