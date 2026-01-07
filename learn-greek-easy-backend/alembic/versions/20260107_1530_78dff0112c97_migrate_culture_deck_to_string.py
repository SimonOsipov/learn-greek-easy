"""migrate culture deck name/description from JSON to string

Revision ID: 78dff0112c97
Revises: a484d1ae5325
Create Date: 2026-01-07 15:30:00.000000+00:00

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "78dff0112c97"
down_revision: Union[str, Sequence[str], None] = "a484d1ae5325"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Migrate culture_decks name and description from JSON to string columns.

    - Preserves English values from the multilingual JSON
    - Adds NOT NULL constraint to name
    - Creates index on name for performance
    """
    # Pre-check for NULL or empty English name values (fail fast)
    op.execute(
        """
        DO $$ BEGIN
            IF EXISTS (
                SELECT 1 FROM culture_decks
                WHERE name->>'en' IS NULL OR TRIM(name->>'en') = ''
            ) THEN
                RAISE EXCEPTION 'Migration blocked: NULL or empty name->>en values found in culture_decks';
            END IF;
        END $$;
        """
    )

    # Step 1: Add temporary columns
    op.add_column(
        "culture_decks",
        sa.Column("name_new", sa.String(255), nullable=True),
    )
    op.add_column(
        "culture_decks",
        sa.Column("description_new", sa.Text(), nullable=True),
    )

    # Step 2: Copy English values with truncation for name
    op.execute(
        """
        UPDATE culture_decks
        SET name_new = LEFT(name->>'en', 255),
            description_new = description->>'en'
        """
    )

    # Step 3: Drop old JSON columns
    op.drop_column("culture_decks", "name")
    op.drop_column("culture_decks", "description")

    # Step 4: Rename temporary columns
    op.alter_column("culture_decks", "name_new", new_column_name="name")
    op.alter_column("culture_decks", "description_new", new_column_name="description")

    # Step 5: Add NOT NULL constraint to name
    op.alter_column(
        "culture_decks",
        "name",
        existing_type=sa.String(255),
        nullable=False,
    )

    # Step 6: Create index on name for performance
    op.create_index("ix_culture_decks_name", "culture_decks", ["name"])

    # Step 7: Add column comments
    op.execute(
        "COMMENT ON COLUMN culture_decks.name IS 'Deck name (English)'"
    )
    op.execute(
        "COMMENT ON COLUMN culture_decks.description IS 'Deck description (English, optional)'"
    )


def downgrade() -> None:
    """Restore JSON columns from string values.

    Note: This cannot recover the original el/ru translations - all languages
    will have the same English value after downgrade.
    """
    # Step 1: Drop the index
    op.drop_index("ix_culture_decks_name", table_name="culture_decks")

    # Step 2: Add temporary JSON columns
    op.add_column(
        "culture_decks",
        sa.Column("name_json", sa.JSON(), nullable=True),
    )
    op.add_column(
        "culture_decks",
        sa.Column("description_json", sa.JSON(), nullable=True),
    )

    # Step 3: Copy values back to JSON format (same value for all languages)
    # Use COALESCE for description since it may be NULL
    op.execute(
        """
        UPDATE culture_decks
        SET name_json = jsonb_build_object('el', name, 'en', name, 'ru', name),
            description_json = jsonb_build_object(
                'el', COALESCE(description, ''),
                'en', COALESCE(description, ''),
                'ru', COALESCE(description, '')
            )
        """
    )

    # Step 4: Drop string columns
    op.drop_column("culture_decks", "name")
    op.drop_column("culture_decks", "description")

    # Step 5: Rename JSON columns
    op.alter_column("culture_decks", "name_json", new_column_name="name")
    op.alter_column("culture_decks", "description_json", new_column_name="description")

    # Step 6: Add NOT NULL constraints (original schema had both NOT NULL)
    op.alter_column(
        "culture_decks",
        "name",
        existing_type=sa.JSON(),
        nullable=False,
    )
    op.alter_column(
        "culture_decks",
        "description",
        existing_type=sa.JSON(),
        nullable=False,
    )

    # Step 7: Restore original column comments
    op.execute(
        "COMMENT ON COLUMN culture_decks.name IS 'Multilingual deck name: {el, en, ru}'"
    )
    op.execute(
        "COMMENT ON COLUMN culture_decks.description IS 'Multilingual deck description: {el, en, ru}'"
    )
