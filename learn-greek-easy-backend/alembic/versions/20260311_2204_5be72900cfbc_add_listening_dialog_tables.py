"""add listening dialog tables

Revision ID: 5be72900cfbc
Revises: d1e2f3a4b5c6
Create Date: 2026-03-11 22:04:35.280115+00:00

"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "5be72900cfbc"
down_revision: Union[str, Sequence[str], None] = "d1e2f3a4b5c6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add listening_dialogs, dialog_speakers, and dialog_lines tables."""
    # Create dialog_status enum type before tables that use it
    postgresql.ENUM(
        "draft",
        "text_approved",
        "audio_ready",
        "exercises_ready",
        "published",
        name="dialog_status",
        create_type=True,
    ).create(op.get_bind(), checkfirst=True)

    # Reference existing enums (DO NOT create - they already exist)
    decklevel_enum = postgresql.ENUM(
        "A1",
        "A2",
        "B1",
        "B2",
        "C1",
        "C2",
        name="decklevel",
        create_type=False,
    )
    dialog_status_col_enum = postgresql.ENUM(
        "draft",
        "text_approved",
        "audio_ready",
        "exercises_ready",
        "published",
        name="dialog_status",
        create_type=False,
    )

    op.create_table(
        "listening_dialogs",
        sa.Column("id", sa.Uuid(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("scenario_el", sa.Text(), nullable=False),
        sa.Column("scenario_en", sa.Text(), nullable=False),
        sa.Column("scenario_ru", sa.Text(), nullable=False),
        sa.Column("cefr_level", decklevel_enum, nullable=False),
        sa.Column("num_speakers", sa.SmallInteger(), nullable=False),
        sa.Column(
            "status",
            dialog_status_col_enum,
            server_default=sa.text("'draft'"),
            nullable=False,
        ),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column("audio_s3_key", sa.String(length=500), nullable=True),
        sa.Column("audio_generated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("audio_file_size_bytes", sa.Integer(), nullable=True),
        sa.Column("audio_duration_seconds", sa.Float(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
            comment="Timestamp when record was created",
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
            comment="Timestamp when record was last updated",
        ),
        sa.CheckConstraint(
            "num_speakers >= 2 AND num_speakers <= 4", name="ck_listening_dialogs_num_speakers"
        ),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_listening_dialogs_cefr_level", "listening_dialogs", ["cefr_level"], unique=False
    )
    op.create_index(
        op.f("ix_listening_dialogs_created_by"), "listening_dialogs", ["created_by"], unique=False
    )
    op.create_index("ix_listening_dialogs_status", "listening_dialogs", ["status"], unique=False)

    op.create_table(
        "dialog_speakers",
        sa.Column("id", sa.Uuid(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("dialog_id", sa.Uuid(), nullable=False),
        sa.Column("speaker_index", sa.SmallInteger(), nullable=False),
        sa.Column("character_name", sa.String(length=100), nullable=False),
        sa.Column("voice_id", sa.String(length=255), nullable=True),
        sa.Column("voice_name", sa.String(length=255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "speaker_index >= 0 AND speaker_index < 4", name="ck_dialog_speakers_speaker_index"
        ),
        sa.ForeignKeyConstraint(["dialog_id"], ["listening_dialogs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("dialog_id", "speaker_index", name="uq_dialog_speaker_index"),
    )
    op.create_index(
        op.f("ix_dialog_speakers_dialog_id"), "dialog_speakers", ["dialog_id"], unique=False
    )

    op.create_table(
        "dialog_lines",
        sa.Column("id", sa.Uuid(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("dialog_id", sa.Uuid(), nullable=False),
        sa.Column("speaker_id", sa.Uuid(), nullable=False),
        sa.Column("line_index", sa.SmallInteger(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("start_time_ms", sa.Integer(), nullable=True),
        sa.Column("end_time_ms", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["dialog_id"], ["listening_dialogs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["speaker_id"], ["dialog_speakers.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("dialog_id", "line_index", name="uq_dialog_line_index"),
    )
    op.create_index("ix_dialog_lines_dialog_id", "dialog_lines", ["dialog_id"], unique=False)
    op.create_index(
        op.f("ix_dialog_lines_speaker_id"), "dialog_lines", ["speaker_id"], unique=False
    )


def downgrade() -> None:
    """Remove listening_dialogs, dialog_speakers, and dialog_lines tables."""
    op.drop_index(op.f("ix_dialog_lines_speaker_id"), table_name="dialog_lines")
    op.drop_index("ix_dialog_lines_dialog_id", table_name="dialog_lines")
    op.drop_table("dialog_lines")

    op.drop_index(op.f("ix_dialog_speakers_dialog_id"), table_name="dialog_speakers")
    op.drop_table("dialog_speakers")

    op.drop_index("ix_listening_dialogs_status", table_name="listening_dialogs")
    op.drop_index(op.f("ix_listening_dialogs_created_by"), table_name="listening_dialogs")
    op.drop_index("ix_listening_dialogs_cefr_level", table_name="listening_dialogs")
    op.drop_table("listening_dialogs")

    # Drop dialog_status enum after all tables using it are dropped
    postgresql.ENUM(name="dialog_status").drop(op.get_bind(), checkfirst=True)
