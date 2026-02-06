"""add_cardtype_enum

Revision ID: 9d753297038f
Revises: 70e83ade3113
Create Date: 2026-02-06 01:00:00.000000+00:00

Creates the cardtype PostgreSQL enum type for card record types.
"""

from typing import Sequence, Union

from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "9d753297038f"
down_revision: Union[str, Sequence[str], None] = "70e83ade3113"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create cardtype enum type."""
    cardtype_enum = postgresql.ENUM(
        "meaning_el_to_en",
        "meaning_en_to_el",
        "conjugation",
        "declension",
        "cloze",
        "sentence_translation",
        name="cardtype",
        create_type=False,
    )
    cardtype_enum.create(op.get_bind(), checkfirst=True)


def downgrade() -> None:
    """Drop cardtype enum type."""
    cardtype_enum = postgresql.ENUM(
        "meaning_el_to_en",
        "meaning_en_to_el",
        "conjugation",
        "declension",
        "cloze",
        "sentence_translation",
        name="cardtype",
    )
    cardtype_enum.drop(op.get_bind(), checkfirst=True)
