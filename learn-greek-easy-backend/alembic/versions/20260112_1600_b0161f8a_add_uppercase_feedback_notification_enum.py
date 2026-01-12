"""add_uppercase_feedback_notification_enum

Revision ID: b0161f8a
Revises: ceda38aaf6b3
Create Date: 2026-01-12

Fixes case mismatch in notificationtype enum. SQLAlchemy sends enum names
(UPPERCASE) but previous migration added lowercase values.
"""

from typing import Sequence, Union

from alembic import op

revision: str = "b0161f8a"
down_revision: Union[str, Sequence[str], None] = "ceda38aaf6b3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'FEEDBACK_RESPONSE'")
    op.execute("ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'FEEDBACK_STATUS_CHANGE'")


def downgrade() -> None:
    # PostgreSQL does not support removing enum values
    pass
