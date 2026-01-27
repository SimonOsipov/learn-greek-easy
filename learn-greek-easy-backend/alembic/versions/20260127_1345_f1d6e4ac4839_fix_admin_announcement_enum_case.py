"""fix_admin_announcement_enum_case

Revision ID: f1d6e4ac4839
Revises: e9377d765b32
Create Date: 2026-01-27 13:45:37.351025+00:00

Fixes case mismatch for admin_announcement enum value.
The previous migration added 'admin_announcement' (lowercase), but SQLAlchemy
expects 'ADMIN_ANNOUNCEMENT' (uppercase) to match the Python enum name.

This migration:
1. Adds the uppercase ADMIN_ANNOUNCEMENT value to the enum
2. Updates existing notifications from lowercase to uppercase
"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f1d6e4ac4839"
down_revision: Union[str, Sequence[str], None] = "e9377d765b32"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add uppercase ADMIN_ANNOUNCEMENT to the enum (IF NOT EXISTS handles idempotency)
    op.execute("ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'ADMIN_ANNOUNCEMENT'")

    # We need to commit the ADD VALUE before we can use the new value in UPDATE
    # This is a PostgreSQL requirement - enum value additions must be committed
    # before they can be used in DML statements
    op.execute("COMMIT")

    # Update existing notifications from lowercase to uppercase
    op.execute(
        """
        UPDATE notifications
        SET type = 'ADMIN_ANNOUNCEMENT'
        WHERE type = 'admin_announcement'
        """
    )

    # Start a new transaction for any subsequent operations
    op.execute("BEGIN")


def downgrade() -> None:
    """Downgrade schema."""
    # PostgreSQL does not support removing enum values, so we can't remove
    # ADMIN_ANNOUNCEMENT. We also don't convert back to lowercase since
    # that would break the application.
    pass
