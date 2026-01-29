"""add_examples_jsonb_to_cards

Revision ID: 83d73d26f04d
Revises: c14242885019
Create Date: 2026-01-29 12:29:46.500413+00:00

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "83d73d26f04d"
down_revision: Union[str, Sequence[str], None] = "c14242885019"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema.

    Adds examples JSONB column and migrates existing example_sentence data.
    NOTE: example_sentence column is NOT removed - that will be a separate migration.
    """
    # Step 1: Add the examples column
    op.add_column(
        "cards",
        sa.Column(
            "examples",
            sa.JSON(),
            nullable=True,
            comment="Structured examples: [{greek, english, russian, tense?}, ...]",
        ),
    )

    # Step 2: Migrate existing example_sentence data to examples array
    # Each example_sentence becomes a single-element array with the Greek text
    op.execute(
        """
        UPDATE cards
        SET examples = jsonb_build_array(
            jsonb_build_object(
                'greek', example_sentence,
                'english', '',
                'russian', ''
            )
        )
        WHERE example_sentence IS NOT NULL
          AND example_sentence != ''
    """
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("cards", "examples")
