"""remove greek changelog columns

Revision ID: d3269c256843
Revises: 500829e2ac0f
Create Date: 2026-02-03 17:11:50.469060+00:00

Removes Greek language columns (title_el, content_el) from changelog_entries table.
The changelog now supports only English and Russian.
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d3269c256843"
down_revision: Union[str, Sequence[str], None] = "500829e2ac0f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Drop Greek language columns from changelog_entries."""
    op.drop_column("changelog_entries", "title_el")
    op.drop_column("changelog_entries", "content_el")


def downgrade() -> None:
    """Recreate Greek language columns for rollback safety."""
    op.add_column(
        "changelog_entries",
        sa.Column(
            "title_el",
            sa.VARCHAR(length=500),
            nullable=False,
            server_default="",  # Required for NOT NULL column on existing table
            comment="Title in Greek",
        ),
    )
    op.add_column(
        "changelog_entries",
        sa.Column(
            "content_el",
            sa.TEXT(),
            nullable=False,
            server_default="",  # Required for NOT NULL column on existing table
            comment="Content in Greek (supports bold/italic markdown)",
        ),
    )
