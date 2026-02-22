"""Delete legacy cards from Basic Greek Nouns deck

Revision ID: a1b2c3d4e5f6
Revises: 4c9f15d252bd
Create Date: 2026-02-22
"""

from alembic import op

revision = "a1b2c3d4e5f6"
down_revision = "4c9f15d252bd"
branch_labels = None
depends_on = None

DECK_ID = "2a421cc0-a74c-4742-ab90-ff2e903f2552"


def upgrade() -> None:
    op.execute(f"DELETE FROM cards WHERE deck_id = '{DECK_ID}'")


def downgrade() -> None:
    pass
