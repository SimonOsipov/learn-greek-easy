"""make_owner_superuser

Revision ID: 9b42371754b7
Revises: b1dee5516e49
Create Date: 2025-12-24 19:40:51.246478+00:00

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "9b42371754b7"
down_revision: Union[str, Sequence[str], None] = "b1dee5516e49"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Production owner email - the account to grant superuser access
OWNER_EMAIL = "osipov.simon@gmail.com"


def upgrade() -> None:
    """Grant superuser access to the production owner account.

    This migration is:
    - Idempotent: Setting is_superuser=true when already true is a no-op
    - Safe: If user doesn't exist, UPDATE affects 0 rows (no error)
    - Auditable: Uses explicit email for traceability
    """
    op.execute(
        f"""
        UPDATE users
        SET is_superuser = true, updated_at = now()
        WHERE email = '{OWNER_EMAIL}'
        """
    )


def downgrade() -> None:
    """Revoke superuser access from the production owner account.

    Note: In practice, this should rarely be run in production.
    Consider whether downgrade makes sense for your use case.
    """
    op.execute(
        f"""
        UPDATE users
        SET is_superuser = false, updated_at = now()
        WHERE email = '{OWNER_EMAIL}'
        """
    )
