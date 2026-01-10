"""add_admin_feedback_response_fields

Revision ID: a1b2c3d4e5f6
Revises: 1aef63b5f6f5
Create Date: 2026-01-10 22:16:00.000000+00:00

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "1aef63b5f6f5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add new enum values to notificationtype
    # Note: ALTER TYPE ... ADD VALUE cannot be inside a transaction in PostgreSQL
    # We use IF NOT EXISTS to make this idempotent
    op.execute("ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'feedback_response'")
    op.execute("ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'feedback_status_change'")

    # Add admin response columns to feedback table
    op.add_column(
        "feedback",
        sa.Column(
            "admin_response",
            sa.String(500),
            nullable=True,
            comment="Admin's public response to the feedback",
        ),
    )
    op.add_column(
        "feedback",
        sa.Column(
            "admin_response_at",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Timestamp when admin responded",
        ),
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Remove admin response columns
    op.drop_column("feedback", "admin_response_at")
    op.drop_column("feedback", "admin_response")
    # Note: Enum values cannot be removed in PostgreSQL without recreating the type
    # This is a known PostgreSQL limitation
