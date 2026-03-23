"""sit_drop_cefr_from_situations

Revision ID: sit_drop_cefr_from_situations
Revises: sit_04_drop_created_by
Create Date: 2026-03-22 09:00:00.000000

Drop the cefr_level column from the situations table.
CEFR level tracking for situations has been removed from the product.
"""

import sqlalchemy as sa

from alembic import op

revision: str = "sit_drop_cefr_from_situations"
down_revision: str | None = "sit_04_drop_created_by"
branch_labels: str | tuple[str, ...] | None = None
depends_on: str | tuple[str, ...] | None = None


def upgrade() -> None:
    op.drop_column("situations", "cefr_level")


def downgrade() -> None:
    op.add_column(
        "situations",
        sa.Column(
            "cefr_level",
            sa.Enum("A1", "A2", "B1", "B2", "C1", "C2", name="decklevel", create_type=False),
            nullable=False,
            server_default=sa.text("'B1'"),
        ),
    )
    op.alter_column("situations", "cefr_level", server_default=None)
