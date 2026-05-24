"""exr54_add_question_columns_to_exercise_tables

Adds nullable question_el and question_en TEXT columns to description_exercises,
dialog_exercises, and picture_exercises (EXR-54). These fields hold per-exercise
question prompts in Greek and English, separate from the situation scenario text.

Revision ID: exr54
Revises: exr57
Create Date: 2026-05-24 00:00:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "exr54"
down_revision: Union[str, Sequence[str], None] = "exr57"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # description_exercises
    op.add_column(
        "description_exercises",
        sa.Column(
            "question_el",
            sa.Text(),
            nullable=True,
            comment="Greek question prompt for this exercise",
        ),
    )
    op.add_column(
        "description_exercises",
        sa.Column(
            "question_en",
            sa.Text(),
            nullable=True,
            comment="English question prompt for this exercise",
        ),
    )

    # dialog_exercises
    op.add_column(
        "dialog_exercises",
        sa.Column(
            "question_el",
            sa.Text(),
            nullable=True,
            comment="Greek question prompt for this exercise",
        ),
    )
    op.add_column(
        "dialog_exercises",
        sa.Column(
            "question_en",
            sa.Text(),
            nullable=True,
            comment="English question prompt for this exercise",
        ),
    )

    # picture_exercises
    op.add_column(
        "picture_exercises",
        sa.Column(
            "question_el",
            sa.Text(),
            nullable=True,
            comment="Greek question prompt for this exercise",
        ),
    )
    op.add_column(
        "picture_exercises",
        sa.Column(
            "question_en",
            sa.Text(),
            nullable=True,
            comment="English question prompt for this exercise",
        ),
    )


def downgrade() -> None:
    op.drop_column("picture_exercises", "question_en")
    op.drop_column("picture_exercises", "question_el")
    op.drop_column("dialog_exercises", "question_en")
    op.drop_column("dialog_exercises", "question_el")
    op.drop_column("description_exercises", "question_en")
    op.drop_column("description_exercises", "question_el")
