"""add dialog exercise tables

Revision ID: 79294725f353
Revises: 5be72900cfbc
Create Date: 2026-03-12 05:16:54.114179+00:00

"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "79294725f353"
down_revision: Union[str, Sequence[str], None] = "5be72900cfbc"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add dialog_exercises and exercise_items tables."""
    # Create enum types before tables that use them
    postgresql.ENUM(
        "fill_gaps",
        "select_heard",
        "true_false",
        name="exercisetype",
        create_type=True,
    ).create(op.get_bind(), checkfirst=True)

    postgresql.ENUM(
        "draft",
        "approved",
        name="exercisestatus",
        create_type=True,
    ).create(op.get_bind(), checkfirst=True)

    # Reference existing enums (DO NOT create - they already exist)
    exercisetype_col_enum = postgresql.ENUM(
        "fill_gaps",
        "select_heard",
        "true_false",
        name="exercisetype",
        create_type=False,
    )
    exercisestatus_col_enum = postgresql.ENUM(
        "draft",
        "approved",
        name="exercisestatus",
        create_type=False,
    )

    op.create_table(
        "dialog_exercises",
        sa.Column("id", sa.Uuid(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("dialog_id", sa.Uuid(), nullable=False),
        sa.Column("exercise_type", exercisetype_col_enum, nullable=False),
        sa.Column(
            "status", exercisestatus_col_enum, server_default=sa.text("'draft'"), nullable=False
        ),
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
        sa.ForeignKeyConstraint(["dialog_id"], ["listening_dialogs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("dialog_id", "exercise_type", name="uq_dialog_exercise_type"),
    )
    op.create_index(
        op.f("ix_dialog_exercises_dialog_id"), "dialog_exercises", ["dialog_id"], unique=False
    )

    op.create_table(
        "exercise_items",
        sa.Column("id", sa.Uuid(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("exercise_id", sa.Uuid(), nullable=False),
        sa.Column("item_index", sa.SmallInteger(), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("item_index >= 0", name="ck_exercise_items_item_index"),
        sa.ForeignKeyConstraint(["exercise_id"], ["dialog_exercises.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("exercise_id", "item_index", name="uq_exercise_item_index"),
    )
    op.create_index(
        op.f("ix_exercise_items_exercise_id"), "exercise_items", ["exercise_id"], unique=False
    )


def downgrade() -> None:
    """Remove dialog_exercises and exercise_items tables."""
    op.drop_index(op.f("ix_exercise_items_exercise_id"), table_name="exercise_items")
    op.drop_table("exercise_items")

    op.drop_index(op.f("ix_dialog_exercises_dialog_id"), table_name="dialog_exercises")
    op.drop_table("dialog_exercises")

    # Drop enum types after all tables using them are dropped
    postgresql.ENUM(name="exercisestatus").drop(op.get_bind(), checkfirst=True)
    postgresql.ENUM(name="exercisetype").drop(op.get_bind(), checkfirst=True)
