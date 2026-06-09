"""admin2_32_backfill_news_levels

Backfills Situation.levels for news items created AFTER the one-time backfill in
admin2_26_02 (2026-05-26). Those items were created with empty levels ([]) because
the creation path didn't set levels (now fixed in NewsItemService.create). This
repairs the orphaned rows using the same logic as admin2_26_02:
["B1","A2"] when the linked description has A2 text, otherwise ["B1"].

Scoped to news-linked situations with empty/null levels only (surgical).

Revision ID: admin2_32_levels
Revises: sqlcon_01c
Create Date: 2026-06-09 00:00:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union

from sqlalchemy import text

from alembic import op

revision: str = "admin2_32_levels"
down_revision: Union[str, Sequence[str], None] = "sqlcon_01c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # Repair news-linked situations whose levels are still empty/null.
    # Same CASE logic as admin2_26_02: B1+A2 when A2 text exists, else B1.
    conn.execute(
        text(
            """
            UPDATE situations s
            SET levels =
                CASE
                    WHEN sd.text_el_a2 IS NOT NULL AND btrim(sd.text_el_a2) <> '' THEN '["B1","A2"]'::jsonb
                    ELSE '["B1"]'::jsonb
                END
            FROM situation_descriptions sd
            WHERE sd.situation_id = s.id
              AND s.id IN (SELECT situation_id FROM news_items)
              AND (s.levels = '[]'::jsonb OR s.levels IS NULL)
            """
        )
    )

    # Fallback for any news situation with no description row at all.
    conn.execute(
        text(
            """
            UPDATE situations
            SET levels = '["B1"]'::jsonb
            WHERE id IN (SELECT situation_id FROM news_items)
              AND (levels = '[]'::jsonb OR levels IS NULL)
            """
        )
    )


def downgrade() -> None:
    # Data backfill — no schema change to reverse. Intentionally a no-op
    # (we don't re-orphan rows by resetting levels to []).
    pass
