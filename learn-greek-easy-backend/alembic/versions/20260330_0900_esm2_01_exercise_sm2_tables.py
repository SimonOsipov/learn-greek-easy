"""ESM2-01: Add exercise SM-2 tables, drop dialog_exercise_attempts and dialog_progress.

Revision ID: esm2_01
Revises: sit_07_02_word_timestamps
Create Date: 2026-03-30 09:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "esm2_01"
down_revision: str | None = "sit_07_02_word_timestamps"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Step 1 — Create exercisesourcetype enum
    exercisesourcetype = sa.Enum("description", "dialog", "picture", name="exercisesourcetype")
    exercisesourcetype.create(op.get_bind(), checkfirst=True)

    # Step 2 — Create exercises table
    op.create_table(
        "exercises",
        sa.Column("id", sa.Uuid(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column(
            "source_type",
            postgresql.ENUM(
                "description", "dialog", "picture", name="exercisesourcetype", create_type=False
            ),
            nullable=False,
        ),
        sa.Column("description_exercise_id", sa.Uuid(), nullable=True),
        sa.Column("dialog_exercise_id", sa.Uuid(), nullable=True),
        sa.Column("picture_exercise_id", sa.Uuid(), nullable=True),
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
        sa.CheckConstraint(
            "(description_exercise_id IS NOT NULL)::int"
            " + (dialog_exercise_id IS NOT NULL)::int"
            " + (picture_exercise_id IS NOT NULL)::int = 1",
            name="ck_exercises_exactly_one_source",
        ),
        sa.ForeignKeyConstraint(
            ["description_exercise_id"], ["description_exercises.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["dialog_exercise_id"], ["dialog_exercises.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["picture_exercise_id"], ["picture_exercises.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_exercises_source_type"), "exercises", ["source_type"], unique=False)
    op.create_index(
        op.f("ix_exercises_description_exercise_id"),
        "exercises",
        ["description_exercise_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_exercises_dialog_exercise_id"), "exercises", ["dialog_exercise_id"], unique=False
    )
    op.create_index(
        op.f("ix_exercises_picture_exercise_id"), "exercises", ["picture_exercise_id"], unique=False
    )
    # Partial unique indexes via raw SQL (avoid alembic check false positives per NGEN-03 precedent)
    op.execute(
        "CREATE UNIQUE INDEX uq_exercises_description_exercise_id"
        " ON exercises (description_exercise_id) WHERE description_exercise_id IS NOT NULL"
    )
    op.execute(
        "CREATE UNIQUE INDEX uq_exercises_dialog_exercise_id"
        " ON exercises (dialog_exercise_id) WHERE dialog_exercise_id IS NOT NULL"
    )
    op.execute(
        "CREATE UNIQUE INDEX uq_exercises_picture_exercise_id"
        " ON exercises (picture_exercise_id) WHERE picture_exercise_id IS NOT NULL"
    )

    # Step 3 — Create exercise_records table
    op.create_table(
        "exercise_records",
        sa.Column("id", sa.Uuid(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("exercise_id", sa.Uuid(), nullable=False),
        sa.Column("easiness_factor", sa.Float(), nullable=False),
        sa.Column("interval", sa.Integer(), nullable=False),
        sa.Column("repetitions", sa.Integer(), nullable=False),
        sa.Column(
            "next_review_date", sa.Date(), nullable=False, server_default=sa.text("CURRENT_DATE")
        ),
        sa.Column(
            "status",
            postgresql.ENUM(
                "NEW", "LEARNING", "REVIEW", "MASTERED", name="cardstatus", create_type=False
            ),
            nullable=False,
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
        sa.ForeignKeyConstraint(["exercise_id"], ["exercises.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "exercise_id", name="uq_exercise_record_user_exercise"),
    )
    op.create_index(
        "ix_exercise_records_user_next_review",
        "exercise_records",
        ["user_id", "next_review_date"],
        unique=False,
    )
    op.create_index(
        op.f("ix_exercise_records_exercise_id"), "exercise_records", ["exercise_id"], unique=False
    )

    # Step 4 — Create exercise_reviews table
    op.create_table(
        "exercise_reviews",
        sa.Column("id", sa.Uuid(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("exercise_record_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("quality", sa.SmallInteger(), nullable=False),
        sa.Column("score", sa.SmallInteger(), nullable=False),
        sa.Column("max_score", sa.SmallInteger(), nullable=False),
        sa.Column("easiness_factor_before", sa.Float(), nullable=False),
        sa.Column("interval_before", sa.Integer(), nullable=False),
        sa.Column("repetitions_before", sa.Integer(), nullable=False),
        sa.Column("easiness_factor_after", sa.Float(), nullable=False),
        sa.Column("interval_after", sa.Integer(), nullable=False),
        sa.Column("repetitions_after", sa.Integer(), nullable=False),
        sa.Column(
            "reviewed_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["exercise_record_id"], ["exercise_records.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_exercise_reviews_user_reviewed_at",
        "exercise_reviews",
        ["user_id", "reviewed_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_exercise_reviews_exercise_record_id"),
        "exercise_reviews",
        ["exercise_record_id"],
        unique=False,
    )

    # Step 5 — Drop superseded tables (child first)
    op.drop_index(
        "ix_dialog_exercise_attempts_user_exercise", table_name="dialog_exercise_attempts"
    )
    op.drop_index(
        op.f("ix_dialog_exercise_attempts_user_id"), table_name="dialog_exercise_attempts"
    )
    op.drop_index("ix_dialog_exercise_attempts_exercise_id", table_name="dialog_exercise_attempts")
    op.drop_table("dialog_exercise_attempts")

    op.drop_index(op.f("ix_dialog_progress_user_id"), table_name="dialog_progress")
    op.drop_index("ix_dialog_progress_dialog_id", table_name="dialog_progress")
    op.drop_table("dialog_progress")


def downgrade() -> None:
    # Recreate dialog_progress first (no dependencies on dialog_exercise_attempts)
    op.create_table(
        "dialog_progress",
        sa.Column("id", sa.Uuid(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("dialog_id", sa.Uuid(), nullable=False),
        sa.Column(
            "exercises_completed", sa.SmallInteger(), nullable=False, server_default=sa.text("0")
        ),
        sa.Column("all_completed", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("first_completed_at", sa.DateTime(timezone=True), nullable=True),
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
        sa.CheckConstraint(
            "exercises_completed >= 0", name="ck_dialog_progress_exercises_completed_non_negative"
        ),
        sa.ForeignKeyConstraint(["dialog_id"], ["listening_dialogs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "dialog_id", name="uq_dialog_progress_user_dialog"),
    )
    op.create_index(
        op.f("ix_dialog_progress_user_id"), "dialog_progress", ["user_id"], unique=False
    )
    op.create_index("ix_dialog_progress_dialog_id", "dialog_progress", ["dialog_id"], unique=False)

    # Recreate dialog_exercise_attempts
    op.create_table(
        "dialog_exercise_attempts",
        sa.Column("id", sa.Uuid(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("exercise_id", sa.Uuid(), nullable=False),
        sa.Column("score", sa.SmallInteger(), nullable=False),
        sa.Column("max_score", sa.SmallInteger(), nullable=False),
        sa.Column("time_taken_seconds", sa.Integer(), nullable=True),
        sa.Column(
            "completed_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("max_score > 0", name="ck_dialog_exercise_attempts_max_score_positive"),
        sa.CheckConstraint("score >= 0", name="ck_dialog_exercise_attempts_score_non_negative"),
        sa.CheckConstraint("score <= max_score", name="ck_dialog_exercise_attempts_score_lte_max"),
        sa.CheckConstraint(
            "time_taken_seconds IS NULL OR time_taken_seconds >= 0",
            name="ck_dialog_exercise_attempts_time_non_negative",
        ),
        sa.ForeignKeyConstraint(["exercise_id"], ["dialog_exercises.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_dialog_exercise_attempts_user_exercise",
        "dialog_exercise_attempts",
        ["user_id", "exercise_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_dialog_exercise_attempts_user_id"),
        "dialog_exercise_attempts",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        "ix_dialog_exercise_attempts_exercise_id",
        "dialog_exercise_attempts",
        ["exercise_id"],
        unique=False,
    )

    # Drop new tables in reverse dependency order
    op.drop_index(op.f("ix_exercise_reviews_exercise_record_id"), table_name="exercise_reviews")
    op.drop_index("ix_exercise_reviews_user_reviewed_at", table_name="exercise_reviews")
    op.drop_table("exercise_reviews")

    op.drop_index(op.f("ix_exercise_records_exercise_id"), table_name="exercise_records")
    op.drop_index("ix_exercise_records_user_next_review", table_name="exercise_records")
    op.drop_table("exercise_records")

    op.execute("DROP INDEX IF EXISTS uq_exercises_description_exercise_id")
    op.execute("DROP INDEX IF EXISTS uq_exercises_dialog_exercise_id")
    op.execute("DROP INDEX IF EXISTS uq_exercises_picture_exercise_id")
    op.drop_index(op.f("ix_exercises_source_type"), table_name="exercises")
    op.drop_index(op.f("ix_exercises_description_exercise_id"), table_name="exercises")
    op.drop_index(op.f("ix_exercises_dialog_exercise_id"), table_name="exercises")
    op.drop_index(op.f("ix_exercises_picture_exercise_id"), table_name="exercises")
    op.drop_table("exercises")

    # Drop exercisesourcetype enum
    exercisesourcetype = sa.Enum(name="exercisesourcetype")
    exercisesourcetype.drop(op.get_bind(), checkfirst=True)
