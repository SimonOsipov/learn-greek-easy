"""Fix level_up notification action_url to point to /achievements

Revision ID: 5208d6f4ad95
Revises: 92fbcfbc75fd
Create Date: 2026-01-28

"""

from alembic import op

revision = "5208d6f4ad95"
down_revision = "92fbcfbc75fd"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE notifications
        SET action_url = '/achievements'
        WHERE type = 'level_up'
        AND (action_url = '/profile' OR action_url IS NULL OR action_url = '/')
        """
    )


def downgrade() -> None:
    pass
