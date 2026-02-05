"""drop_uq_user_card_error_report

Revision ID: 7e1343e75f74
Revises: b433bd53507e
Create Date: 2026-02-05 08:46:29.504917+00:00

Drops the unique constraint on (user_id, card_type, card_id) from card_error_reports
to allow users to submit multiple reports for the same card over time.
Application logic will enforce "one pending report per card per user" instead.
"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "7e1343e75f74"
down_revision: Union[str, Sequence[str], None] = "b433bd53507e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Drop unique constraint to allow multiple reports per user/card."""
    op.drop_constraint("uq_user_card_error_report", "card_error_reports", type_="unique")


def downgrade() -> None:
    """Recreate unique constraint (may fail if duplicate data exists)."""
    op.create_unique_constraint(
        "uq_user_card_error_report", "card_error_reports", ["user_id", "card_type", "card_id"]
    )
