"""exr53_add_word_order_exercise_type

Adds 'word_order' to the exercisetype enum, creates word_order_exercises and
word_order_exercise_items tables (attached to situation_descriptions — same
text-based source as DescriptionExercise), adds word_order_exercise_id FK on
exercises, and updates the ck_exercises_exactly_one_source check constraint to
require exactly one of the four sibling FKs (EXR-53).

Choice rationale: word-order tasks rearrange words from a narrative text, so
description_id is the natural source FK (same as DescriptionExercise). This
keeps picture and dialog sources clean.

Revision ID: exr53
Revises: exr54
Create Date: 2026-05-24 00:00:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "exr53"
down_revision: Union[str, Sequence[str], None] = "exr54"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Extend exercisetype enum
    op.execute("ALTER TYPE exercisetype ADD VALUE IF NOT EXISTS 'word_order'")

    # 2. Extend exercisesourcetype enum (needed for exercises.source_type)
    op.execute("ALTER TYPE exercisesourcetype ADD VALUE IF NOT EXISTS 'word_order'")

    # 3. Create word_order_exercises table
    op.create_table(
        "word_order_exercises",
        sa.Column(
            "id",
            sa.UUID(),
            server_default=sa.text("uuid_generate_v4()"),
            nullable=False,
        ),
        sa.Column(
            "description_id",
            sa.UUID(),
            nullable=False,
            comment="FK to situation_descriptions — word-order derives from narrative text",
        ),
        sa.Column(
            "exercise_type",
            sa.Enum(name="exercisetype", create_type=False),
            nullable=False,
            server_default="word_order",
        ),
        sa.Column(
            "status",
            sa.Enum(name="exercisestatus", create_type=False),
            nullable=False,
            server_default="draft",
        ),
        sa.Column(
            "question_el",
            sa.Text(),
            nullable=True,
            comment="Greek question prompt for this exercise",
        ),
        sa.Column(
            "question_en",
            sa.Text(),
            nullable=True,
            comment="English question prompt for this exercise",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["description_id"],
            ["situation_descriptions.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "description_id", "exercise_type", name="uq_word_order_exercise_desc_type"
        ),
    )
    op.create_index(
        "ix_word_order_exercises_description_id",
        "word_order_exercises",
        ["description_id"],
    )

    # 4. Create word_order_exercise_items table
    op.create_table(
        "word_order_exercise_items",
        sa.Column(
            "id",
            sa.UUID(),
            server_default=sa.text("uuid_generate_v4()"),
            nullable=False,
        ),
        sa.Column(
            "word_order_exercise_id",
            sa.UUID(),
            nullable=False,
        ),
        sa.Column(
            "item_index",
            sa.SmallInteger(),
            nullable=False,
        ),
        sa.Column(
            "payload",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            comment='Shape: {"words": [...], "correct_order": [...], "answer_el": "..."}',
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "item_index >= 0", name="ck_word_order_exercise_item_index_non_negative"
        ),
        sa.ForeignKeyConstraint(
            ["word_order_exercise_id"],
            ["word_order_exercises.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "word_order_exercise_id", "item_index", name="uq_word_order_exercise_item_index"
        ),
    )
    op.create_index(
        "ix_word_order_exercise_items_word_order_exercise_id",
        "word_order_exercise_items",
        ["word_order_exercise_id"],
    )

    # 5. Drop old 3-column check constraint on exercises
    op.drop_constraint("ck_exercises_exactly_one_source", "exercises", type_="check")

    # 6. Add word_order_exercise_id FK column to exercises
    op.add_column(
        "exercises",
        sa.Column(
            "word_order_exercise_id",
            sa.UUID(),
            nullable=True,
        ),
    )
    op.create_foreign_key(
        "fk_exercises_word_order_exercise_id",
        "exercises",
        "word_order_exercises",
        ["word_order_exercise_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index(
        "ix_exercises_word_order_exercise_id",
        "exercises",
        ["word_order_exercise_id"],
    )
    op.create_index(
        "uq_exercises_word_order_exercise_id",
        "exercises",
        ["word_order_exercise_id"],
        unique=True,
        postgresql_where=sa.text("word_order_exercise_id IS NOT NULL"),
    )

    # 7. Create new 4-column check constraint
    op.create_check_constraint(
        "ck_exercises_exactly_one_source",
        "exercises",
        "(description_exercise_id IS NOT NULL)::int"
        " + (dialog_exercise_id IS NOT NULL)::int"
        " + (picture_exercise_id IS NOT NULL)::int"
        " + (word_order_exercise_id IS NOT NULL)::int = 1",
    )


def downgrade() -> None:
    # Drop new 4-column check constraint
    op.drop_constraint("ck_exercises_exactly_one_source", "exercises", type_="check")

    # Drop word_order_exercise_id column and its indexes/FK
    op.drop_index("uq_exercises_word_order_exercise_id", table_name="exercises")
    op.drop_index("ix_exercises_word_order_exercise_id", table_name="exercises")
    op.drop_constraint("fk_exercises_word_order_exercise_id", "exercises", type_="foreignkey")
    op.drop_column("exercises", "word_order_exercise_id")

    # Restore old 3-column check constraint
    op.create_check_constraint(
        "ck_exercises_exactly_one_source",
        "exercises",
        "(description_exercise_id IS NOT NULL)::int"
        " + (dialog_exercise_id IS NOT NULL)::int"
        " + (picture_exercise_id IS NOT NULL)::int = 1",
    )

    # Drop item table then exercise table
    op.drop_index(
        "ix_word_order_exercise_items_word_order_exercise_id",
        table_name="word_order_exercise_items",
    )
    op.drop_table("word_order_exercise_items")
    op.drop_index("ix_word_order_exercises_description_id", table_name="word_order_exercises")
    op.drop_table("word_order_exercises")
    # Note: exercisetype 'word_order' and exercisesourcetype 'word_order' enum values
    # cannot be removed in PostgreSQL — no-op.
