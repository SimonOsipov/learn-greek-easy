"""exr63_backfill_question_en_from_situation

Backfills question_en on description_exercises, dialog_exercises,
picture_exercises, and word_order_exercises from situations.scenario_en
(EXR-63). The column itself was added by EXR-54; this migration is
data-only.

FK join chains:
  description_exercises → situation_descriptions → situations
  dialog_exercises → listening_dialogs → situations
  picture_exercises → situation_pictures → situations
  word_order_exercises → situation_descriptions → situations

Revision ID: exr63
Revises: exr53
Create Date: 2026-05-24 00:00:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union

from sqlalchemy import text

from alembic import op

revision: str = "exr63"
down_revision: Union[str, Sequence[str], None] = "exr53"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    total_updated = 0

    # description_exercises → situation_descriptions → situations
    result = conn.execute(
        text(
            """
            UPDATE description_exercises de
            SET question_en = s.scenario_en
            FROM situation_descriptions sd
            JOIN situations s ON s.id = sd.situation_id
            WHERE de.description_id = sd.id
              AND de.question_en IS NULL
              AND s.scenario_en IS NOT NULL
            """
        )
    )
    count = result.rowcount
    total_updated += count
    print(f"[exr63] backfilled {count} rows in description_exercises")

    # dialog_exercises → listening_dialogs → situations
    result = conn.execute(
        text(
            """
            UPDATE dialog_exercises dex
            SET question_en = s.scenario_en
            FROM listening_dialogs ld
            JOIN situations s ON s.id = ld.situation_id
            WHERE dex.dialog_id = ld.id
              AND dex.question_en IS NULL
              AND s.scenario_en IS NOT NULL
            """
        )
    )
    count = result.rowcount
    total_updated += count
    print(f"[exr63] backfilled {count} rows in dialog_exercises")

    # picture_exercises → situation_pictures → situations
    result = conn.execute(
        text(
            """
            UPDATE picture_exercises pe
            SET question_en = s.scenario_en
            FROM situation_pictures sp
            JOIN situations s ON s.id = sp.situation_id
            WHERE pe.picture_id = sp.id
              AND pe.question_en IS NULL
              AND s.scenario_en IS NOT NULL
            """
        )
    )
    count = result.rowcount
    total_updated += count
    print(f"[exr63] backfilled {count} rows in picture_exercises")

    # word_order_exercises → situation_descriptions → situations
    result = conn.execute(
        text(
            """
            UPDATE word_order_exercises wo
            SET question_en = s.scenario_en
            FROM situation_descriptions sd
            JOIN situations s ON s.id = sd.situation_id
            WHERE wo.description_id = sd.id
              AND wo.question_en IS NULL
              AND s.scenario_en IS NOT NULL
            """
        )
    )
    count = result.rowcount
    total_updated += count
    print(f"[exr63] backfilled {count} rows in word_order_exercises")

    print(f"[exr63] total backfilled: {total_updated} rows across all exercise tables")


def downgrade() -> None:
    # No-op: data is recoverable from situations.scenario_en if needed.
    # Clearing question_en is not useful for rollback.
    pass
