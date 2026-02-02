"""add_multilang_deck_names

Revision ID: 500829e2ac0f
Revises: migrate_el_to_en
Create Date: 2026-02-02 17:35:50.451515+00:00

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "500829e2ac0f"
down_revision: Union[str, Sequence[str], None] = "migrate_el_to_en"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add localized name/description columns to Deck and CultureDeck.

    Strategy:
    1. Add new columns as nullable
    2. Copy existing data: name -> name_el/name_en/name_ru, description -> description_el/description_en/description_ru
    3. Make name_* columns NOT NULL
    4. Drop old columns and index
    5. Create new index on name_en
    """
    # === DECKS TABLE ===

    # 1. Add new columns (all nullable initially)
    op.add_column(
        "decks",
        sa.Column("name_el", sa.String(255), nullable=True, comment="Deck name in Greek"),
    )
    op.add_column(
        "decks",
        sa.Column("name_en", sa.String(255), nullable=True, comment="Deck name in English"),
    )
    op.add_column(
        "decks",
        sa.Column("name_ru", sa.String(255), nullable=True, comment="Deck name in Russian"),
    )
    op.add_column(
        "decks",
        sa.Column("description_el", sa.Text(), nullable=True, comment="Deck description in Greek"),
    )
    op.add_column(
        "decks",
        sa.Column(
            "description_en", sa.Text(), nullable=True, comment="Deck description in English"
        ),
    )
    op.add_column(
        "decks",
        sa.Column(
            "description_ru", sa.Text(), nullable=True, comment="Deck description in Russian"
        ),
    )

    # 2. Copy existing data (English original copied to all languages)
    op.execute(
        """
        UPDATE decks
        SET name_el = name,
            name_en = name,
            name_ru = name,
            description_el = description,
            description_en = description,
            description_ru = description
    """
    )

    # 3. Make name columns NOT NULL
    op.alter_column("decks", "name_el", nullable=False)
    op.alter_column("decks", "name_en", nullable=False)
    op.alter_column("decks", "name_ru", nullable=False)

    # 4. Drop old index and columns
    op.drop_index("ix_decks_name", table_name="decks")
    op.drop_column("decks", "name")
    op.drop_column("decks", "description")

    # 5. Create new index on name_en
    op.create_index("ix_decks_name_en", "decks", ["name_en"])

    # === CULTURE_DECKS TABLE ===

    # 1. Add new columns (all nullable initially)
    op.add_column(
        "culture_decks",
        sa.Column("name_el", sa.String(255), nullable=True, comment="Deck name in Greek"),
    )
    op.add_column(
        "culture_decks",
        sa.Column("name_en", sa.String(255), nullable=True, comment="Deck name in English"),
    )
    op.add_column(
        "culture_decks",
        sa.Column("name_ru", sa.String(255), nullable=True, comment="Deck name in Russian"),
    )
    op.add_column(
        "culture_decks",
        sa.Column("description_el", sa.Text(), nullable=True, comment="Deck description in Greek"),
    )
    op.add_column(
        "culture_decks",
        sa.Column(
            "description_en", sa.Text(), nullable=True, comment="Deck description in English"
        ),
    )
    op.add_column(
        "culture_decks",
        sa.Column(
            "description_ru", sa.Text(), nullable=True, comment="Deck description in Russian"
        ),
    )

    # 2. Copy existing data
    op.execute(
        """
        UPDATE culture_decks
        SET name_el = name,
            name_en = name,
            name_ru = name,
            description_el = description,
            description_en = description,
            description_ru = description
    """
    )

    # 3. Make name columns NOT NULL
    op.alter_column("culture_decks", "name_el", nullable=False)
    op.alter_column("culture_decks", "name_en", nullable=False)
    op.alter_column("culture_decks", "name_ru", nullable=False)

    # 4. Drop old index and columns
    op.drop_index("ix_culture_decks_name", table_name="culture_decks")
    op.drop_column("culture_decks", "name")
    op.drop_column("culture_decks", "description")

    # 5. Create new index on name_en
    op.create_index("ix_culture_decks_name_en", "culture_decks", ["name_en"])


def downgrade() -> None:
    """Revert to single-language name/description columns.

    WARNING: This will lose Greek and Russian translations.
    """
    # === CULTURE_DECKS TABLE ===

    # 1. Add back old columns
    op.add_column("culture_decks", sa.Column("name", sa.String(255), nullable=True))
    op.add_column("culture_decks", sa.Column("description", sa.Text(), nullable=True))

    # 2. Copy English data back
    op.execute(
        """
        UPDATE culture_decks
        SET name = name_en,
            description = description_en
    """
    )

    # 3. Make name NOT NULL
    op.alter_column("culture_decks", "name", nullable=False)

    # 4. Drop new columns and index
    op.drop_index("ix_culture_decks_name_en", table_name="culture_decks")
    op.drop_column("culture_decks", "name_el")
    op.drop_column("culture_decks", "name_en")
    op.drop_column("culture_decks", "name_ru")
    op.drop_column("culture_decks", "description_el")
    op.drop_column("culture_decks", "description_en")
    op.drop_column("culture_decks", "description_ru")

    # 5. Create old index
    op.create_index("ix_culture_decks_name", "culture_decks", ["name"])

    # === DECKS TABLE ===

    # 1. Add back old columns
    op.add_column("decks", sa.Column("name", sa.String(255), nullable=True))
    op.add_column("decks", sa.Column("description", sa.Text(), nullable=True))

    # 2. Copy English data back
    op.execute(
        """
        UPDATE decks
        SET name = name_en,
            description = description_en
    """
    )

    # 3. Make name NOT NULL
    op.alter_column("decks", "name", nullable=False)

    # 4. Drop new columns and index
    op.drop_index("ix_decks_name_en", table_name="decks")
    op.drop_column("decks", "name_el")
    op.drop_column("decks", "name_en")
    op.drop_column("decks", "name_ru")
    op.drop_column("decks", "description_el")
    op.drop_column("decks", "description_en")
    op.drop_column("decks", "description_ru")

    # 5. Create old index
    op.create_index("ix_decks_name", "decks", ["name"])
