"""Drop C1 and C2 from decklevel enum.

No C1/C2 content exists in production. This migration removes unused
CEFR levels from the PostgreSQL enum to match the codebase.

Revision ID: drop_c1_c2_from_decklevel
Revises: nmig_news_data_migration
Create Date: 2026-03-24 10:00:00
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "drop_c1_c2_from_decklevel"
down_revision = "nmig_news_data_migration"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Safety check: fail loudly if any C1/C2 rows somehow exist
    conn = op.get_bind()
    for table, col in [
        ("decks", "level"),
        ("listening_dialogs", "cefr_level"),
        ("description_exercises", "audio_level"),
    ]:
        result = conn.execute(
            __import__("sqlalchemy").text(
                f"SELECT COUNT(*) FROM {table} WHERE {col} IN ('C1', 'C2')"
            )
        ).scalar()
        if result and result > 0:
            raise RuntimeError(f"Cannot drop C1/C2: found {result} row(s) in {table}.{col}")

    # Rename old enum out of the way
    op.execute("ALTER TYPE decklevel RENAME TO decklevel_old")

    # Create the new enum without C1/C2
    op.execute("CREATE TYPE decklevel AS ENUM ('A1', 'A2', 'B1', 'B2')")

    # Migrate each column
    for table, col in [
        ("decks", "level"),
        ("listening_dialogs", "cefr_level"),
        ("description_exercises", "audio_level"),
    ]:
        op.execute(
            f"ALTER TABLE {table} "
            f"ALTER COLUMN {col} TYPE decklevel "
            f"USING {col}::text::decklevel"
        )

    # Drop the old enum
    op.execute("DROP TYPE decklevel_old")


def downgrade() -> None:
    # Rename current (A1-B2) enum out of the way
    op.execute("ALTER TYPE decklevel RENAME TO decklevel_old")

    # Recreate the full enum with C1/C2
    op.execute("CREATE TYPE decklevel AS ENUM ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')")

    # Migrate each column back
    for table, col in [
        ("decks", "level"),
        ("listening_dialogs", "cefr_level"),
        ("description_exercises", "audio_level"),
    ]:
        op.execute(
            f"ALTER TABLE {table} "
            f"ALTER COLUMN {col} TYPE decklevel "
            f"USING {col}::text::decklevel"
        )

    # Drop the temporary enum
    op.execute("DROP TYPE decklevel_old")
