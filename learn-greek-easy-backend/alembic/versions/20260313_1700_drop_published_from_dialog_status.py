"""drop published from dialog_status

Revision ID: a1b2c3d4e5f6
Revises: f3c2a1e9d7b5
Create Date: 2026-03-13 17:00:00.000000

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f6"
down_revision = "f3c2a1e9d7b5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Remap existing published rows to exercises_ready
    op.execute("UPDATE listening_dialogs SET status = 'exercises_ready' WHERE status = 'published'")
    # Drop server default before enum swap
    op.execute("ALTER TABLE listening_dialogs ALTER COLUMN status DROP DEFAULT")
    # Rename old enum
    op.execute("ALTER TYPE dialog_status RENAME TO dialog_status_old")
    # Create new enum WITHOUT published
    op.execute("CREATE TYPE dialog_status AS ENUM('draft', 'audio_ready', 'exercises_ready')")
    # Swap column type
    op.execute(
        "ALTER TABLE listening_dialogs ALTER COLUMN status TYPE dialog_status "
        "USING status::text::dialog_status"
    )
    # Drop old enum
    op.execute("DROP TYPE dialog_status_old")
    # Re-add server default
    op.execute("ALTER TABLE listening_dialogs ALTER COLUMN status SET DEFAULT 'draft'")


def downgrade() -> None:
    # Drop server default before enum swap
    op.execute("ALTER TABLE listening_dialogs ALTER COLUMN status DROP DEFAULT")
    # Rename current enum
    op.execute("ALTER TYPE dialog_status RENAME TO dialog_status_old")
    # Re-create enum WITH published
    op.execute(
        "CREATE TYPE dialog_status AS ENUM('draft', 'audio_ready', 'exercises_ready', 'published')"
    )
    # Swap column type
    op.execute(
        "ALTER TABLE listening_dialogs ALTER COLUMN status TYPE dialog_status "
        "USING status::text::dialog_status"
    )
    # Drop old enum
    op.execute("DROP TYPE dialog_status_old")
    # Re-add server default
    op.execute("ALTER TABLE listening_dialogs ALTER COLUMN status SET DEFAULT 'draft'")
