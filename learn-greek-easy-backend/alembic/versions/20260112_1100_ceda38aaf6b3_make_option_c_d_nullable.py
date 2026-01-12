"""make_option_c_d_nullable

Revision ID: ceda38aaf6b3
Revises: a1b2c3d4e5f6
Create Date: 2026-01-12 11:00:14.234822+00:00

This migration makes option_c and option_d nullable to support variable answer
count questions (2, 3, or 4 options) instead of always requiring exactly 4 options.

Part of the VAC (Variable Answer Count) feature.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "ceda38aaf6b3"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Make option_c and option_d nullable for variable answer count support.

    This allows culture exam questions to have 2, 3, or 4 answer options:
    - 2 options: option_a, option_b (option_c and option_d are NULL)
    - 3 options: option_a, option_b, option_c (option_d is NULL)
    - 4 options: option_a, option_b, option_c, option_d (all filled)
    """
    op.alter_column(
        "culture_questions",
        "option_c",
        existing_type=postgresql.JSON(astext_type=sa.Text()),
        nullable=True,
        comment="Option C: {el, en, ru} - optional for 2-option questions",
        existing_comment="Option C: {el, en, ru}",
    )
    op.alter_column(
        "culture_questions",
        "option_d",
        existing_type=postgresql.JSON(astext_type=sa.Text()),
        nullable=True,
        comment="Option D: {el, en, ru} - optional for 2-3 option questions",
        existing_comment="Option D: {el, en, ru}",
    )


def downgrade() -> None:
    """Revert option_c and option_d to NOT NULL.

    WARNING: This will fail if any questions have NULL values in option_c or option_d.
    Before downgrading, ensure all questions have all 4 options filled, or delete
    questions with fewer than 4 options.
    """
    # Safety check: Prevent downgrade if NULL values exist
    conn = op.get_bind()
    result = conn.execute(
        sa.text(
            "SELECT COUNT(*) FROM culture_questions " "WHERE option_c IS NULL OR option_d IS NULL"
        )
    )
    null_count = result.scalar()

    if null_count > 0:
        raise Exception(
            f"Cannot downgrade: {null_count} question(s) have NULL values in "
            "option_c or option_d. Either update these questions to have all 4 options, "
            "or delete them before downgrading."
        )

    op.alter_column(
        "culture_questions",
        "option_d",
        existing_type=postgresql.JSON(astext_type=sa.Text()),
        nullable=False,
        comment="Option D: {el, en, ru}",
        existing_comment="Option D: {el, en, ru} - optional for 2-3 option questions",
    )
    op.alter_column(
        "culture_questions",
        "option_c",
        existing_type=postgresql.JSON(astext_type=sa.Text()),
        nullable=False,
        comment="Option C: {el, en, ru}",
        existing_comment="Option C: {el, en, ru} - optional for 2-option questions",
    )
