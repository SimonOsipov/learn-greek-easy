"""migrate_el_preferences_to_en

Revision ID: migrate_el_to_en
Revises: 77851dfb44d1
Create Date: 2026-01-30

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "migrate_el_to_en"
down_revision: Union[str, None] = "77851dfb44d1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Migrate users with Greek language preference to English.

    Greek UI translation is being removed. Users who had 'el' as their
    preferred_language will be migrated to 'en' (English).
    """
    op.execute("UPDATE user_settings SET preferred_language = 'en' WHERE preferred_language = 'el'")

    # Also update the column comment to reflect supported languages
    op.alter_column(
        "user_settings", "preferred_language", comment="ISO 639-1 language code (e.g., 'en', 'ru')"
    )


def downgrade() -> None:
    """No automatic downgrade - Greek preference data cannot be restored.

    This is a one-way migration. If Greek UI support is re-added,
    users would need to manually re-select Greek.
    """
    # Restore the original column comment
    op.alter_column(
        "user_settings", "preferred_language", comment="ISO 639-1 language code (e.g., 'en', 'el')"
    )
    # Note: Data migration cannot be reversed - users would need to manually re-select Greek
