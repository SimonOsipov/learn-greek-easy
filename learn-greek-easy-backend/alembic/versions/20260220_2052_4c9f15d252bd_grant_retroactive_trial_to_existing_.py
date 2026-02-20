"""grant retroactive trial to existing users

Revision ID: 4c9f15d252bd
Revises: cbf1800e4269
Create Date: 2026-02-20 20:52:26.507035+00:00

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "4c9f15d252bd"
down_revision: Union[str, Sequence[str], None] = "cbf1800e4269"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Grant retroactive 14-day trial to all existing users who never had a trial."""
    op.execute(
        sa.text(
            """
            UPDATE users
            SET subscription_status = 'TRIALING',
                trial_start_date = NOW(),
                trial_end_date = NOW() + INTERVAL '14 days',
                updated_at = NOW()
            WHERE subscription_status = 'NONE'
              AND trial_end_date IS NULL
        """
        )
    )


def downgrade() -> None:
    """Reverse retroactive trial grant for app-managed trials only (not Stripe-managed)."""
    op.execute(
        sa.text(
            """
            UPDATE users
            SET subscription_status = 'NONE',
                trial_start_date = NULL,
                trial_end_date = NULL,
                updated_at = NOW()
            WHERE subscription_status = 'TRIALING'
              AND stripe_subscription_id IS NULL
        """
        )
    )
