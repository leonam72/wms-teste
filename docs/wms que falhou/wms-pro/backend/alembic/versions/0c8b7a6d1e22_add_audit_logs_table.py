"""add audit logs table

Revision ID: 0c8b7a6d1e22
Revises: 7f0d1c2b9a11
Create Date: 2026-03-21 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0c8b7a6d1e22"
down_revision = "7f0d1c2b9a11"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "audit_logs",
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("username", sa.String(), nullable=True),
        sa.Column("action", sa.String(), nullable=False),
        sa.Column("table_name", sa.String(), nullable=False),
        sa.Column("record_id", sa.String(), nullable=True),
        sa.Column("old_value", sa.Text(), nullable=True),
        sa.Column("new_value", sa.Text(), nullable=True),
        sa.Column("ip_address", sa.String(), nullable=True),
        sa.Column("created_at_event", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"], unique=False)
    op.create_index("ix_audit_logs_table_name", "audit_logs", ["table_name"], unique=False)
    op.create_index("ix_audit_logs_record_id", "audit_logs", ["record_id"], unique=False)
    op.create_index("ix_audit_logs_user_id", "audit_logs", ["user_id"], unique=False)
    op.create_index("ix_audit_logs_username", "audit_logs", ["username"], unique=False)
    op.create_index("ix_audit_logs_ip_address", "audit_logs", ["ip_address"], unique=False)
    op.create_index("ix_audit_logs_created_at_event", "audit_logs", ["created_at_event"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_audit_logs_created_at_event", table_name="audit_logs")
    op.drop_index("ix_audit_logs_ip_address", table_name="audit_logs")
    op.drop_index("ix_audit_logs_username", table_name="audit_logs")
    op.drop_index("ix_audit_logs_user_id", table_name="audit_logs")
    op.drop_index("ix_audit_logs_record_id", table_name="audit_logs")
    op.drop_index("ix_audit_logs_table_name", table_name="audit_logs")
    op.drop_index("ix_audit_logs_action", table_name="audit_logs")
    op.drop_table("audit_logs")
