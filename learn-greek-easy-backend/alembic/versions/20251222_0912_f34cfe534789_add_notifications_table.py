"""add_notifications_table

Revision ID: f34cfe534789
Revises: 56fef805c407
Create Date: 2025-12-22 09:12:25.336001+00:00

"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f34cfe534789"
down_revision: Union[str, Sequence[str], None] = "56fef805c407"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create notificationtype enum type
    notificationtype_enum = postgresql.ENUM(
        "ACHIEVEMENT_UNLOCKED",
        "DAILY_GOAL_COMPLETE",
        "LEVEL_UP",
        "STREAK_AT_RISK",
        "STREAK_LOST",
        "WELCOME",
        name="notificationtype",
        create_type=False,
    )
    notificationtype_enum.create(op.get_bind(), checkfirst=True)

    # Create notifications table
    op.create_table(
        "notifications",
        sa.Column("id", sa.Uuid(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("type", notificationtype_enum, nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("icon", sa.String(length=50), nullable=False),
        sa.Column("action_url", sa.String(length=255), nullable=True),
        sa.Column("extra_data", sa.JSON(), nullable=True),
        sa.Column("read", sa.Boolean(), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
            comment="Timestamp when record was created",
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
            comment="Timestamp when record was last updated",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # Single-column indexes
    op.create_index(op.f("ix_notifications_read"), "notifications", ["read"], unique=False)
    op.create_index(op.f("ix_notifications_type"), "notifications", ["type"], unique=False)
    op.create_index(op.f("ix_notifications_user_id"), "notifications", ["user_id"], unique=False)

    # Composite indexes for efficient queries
    op.create_index(
        "idx_notifications_user_read",
        "notifications",
        ["user_id", "read"],
    )
    op.create_index(
        "idx_notifications_user_created",
        "notifications",
        ["user_id", sa.text("created_at DESC")],
    )
    op.create_index(
        "idx_notifications_created_at",
        "notifications",
        ["created_at"],
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Drop composite indexes first
    op.drop_index("idx_notifications_created_at", table_name="notifications")
    op.drop_index("idx_notifications_user_created", table_name="notifications")
    op.drop_index("idx_notifications_user_read", table_name="notifications")

    # Drop single-column indexes
    op.drop_index(op.f("ix_notifications_user_id"), table_name="notifications")
    op.drop_index(op.f("ix_notifications_type"), table_name="notifications")
    op.drop_index(op.f("ix_notifications_read"), table_name="notifications")

    # Drop table
    op.drop_table("notifications")

    # Drop enum type
    notificationtype_enum = postgresql.ENUM(
        "ACHIEVEMENT_UNLOCKED",
        "DAILY_GOAL_COMPLETE",
        "LEVEL_UP",
        "STREAK_AT_RISK",
        "STREAK_LOST",
        "WELCOME",
        name="notificationtype",
    )
    notificationtype_enum.drop(op.get_bind(), checkfirst=True)
