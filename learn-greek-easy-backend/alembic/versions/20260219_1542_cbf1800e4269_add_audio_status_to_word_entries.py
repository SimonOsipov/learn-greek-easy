"""add audio status to word entries

Revision ID: cbf1800e4269
Revises: 49e74532bcd3
Create Date: 2026-02-19 15:42:16.724640+00:00

"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "cbf1800e4269"
down_revision: Union[str, Sequence[str], None] = "49e74532bcd3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

audio_status_enum = ENUM(
    "MISSING",
    "GENERATING",
    "READY",
    "FAILED",
    name="audiostatus",
    create_type=False,
)


def upgrade() -> None:
    """Upgrade schema."""
    audio_status_enum.create(op.get_bind(), checkfirst=True)

    op.add_column(
        "word_entries",
        sa.Column(
            "audio_status",
            audio_status_enum,
            nullable=False,
            server_default=sa.text("'MISSING'"),
            comment="Audio generation lifecycle status: missing, generating, ready, failed",
        ),
    )
    op.add_column(
        "word_entries",
        sa.Column(
            "audio_generating_since",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Timestamp when current audio generation started (for stale detection)",
        ),
    )
    op.execute(
        sa.text(
            """
            UPDATE word_entries
            SET audio_status = 'READY'
            WHERE audio_key IS NOT NULL
        """
        )
    )
    op.create_index(
        "ix_word_entries_audio_status",
        "word_entries",
        ["audio_status"],
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_word_entries_audio_status", table_name="word_entries")
    op.drop_column("word_entries", "audio_generating_since")
    op.drop_column("word_entries", "audio_status")
    audio_status_enum.drop(op.get_bind(), checkfirst=True)
