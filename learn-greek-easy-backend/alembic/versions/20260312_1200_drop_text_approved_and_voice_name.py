"""drop text_approved status and voice_name column

Revision ID: a1b2c3d4e5f6
Revises: 8b5463ae5571
Create Date: 2026-03-12 12:00:00.000000+00:00

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "8b5463ae5571"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Drop voice_name column from dialog_speakers
    op.drop_column("dialog_speakers", "voice_name")

    # Make voice_id NOT NULL (backfill any NULLs first)
    op.execute("UPDATE dialog_speakers SET voice_id = 'UNASSIGNED' WHERE voice_id IS NULL")
    op.alter_column("dialog_speakers", "voice_id", nullable=False)

    # Remove text_approved from dialog_status enum
    # Update any rows using text_approved to draft
    op.execute("UPDATE listening_dialogs SET status = 'draft' WHERE status = 'text_approved'")
    # Rename old enum
    op.execute("ALTER TYPE dialog_status RENAME TO dialog_status_old")
    # Create new enum without text_approved
    op.execute(
        "CREATE TYPE dialog_status AS ENUM('draft', 'audio_ready', 'exercises_ready', 'published')"
    )
    # Alter column to use new enum
    op.execute(
        "ALTER TABLE listening_dialogs ALTER COLUMN status TYPE dialog_status USING status::text::dialog_status"
    )
    # Drop old enum
    op.execute("DROP TYPE dialog_status_old")


def downgrade() -> None:
    """Downgrade schema."""
    # Reverse enum (re-add text_approved)
    op.execute("ALTER TYPE dialog_status RENAME TO dialog_status_old")
    op.execute(
        "CREATE TYPE dialog_status AS ENUM('draft', 'text_approved', 'audio_ready', 'exercises_ready', 'published')"
    )
    op.execute(
        "ALTER TABLE listening_dialogs ALTER COLUMN status TYPE dialog_status USING status::text::dialog_status"
    )
    op.execute("DROP TYPE dialog_status_old")

    # Make voice_id nullable again
    op.alter_column("dialog_speakers", "voice_id", nullable=True)

    # Re-add voice_name column
    op.add_column("dialog_speakers", sa.Column("voice_name", sa.String(255), nullable=True))
