"""admin2_26_02_add_levels_to_situations

Adds levels JSONB column to situations table (ADMIN2-26 / SAR2-26-18).
Backfills existing rows: ["B1","A2"] when the linked description has text_el_a2,
otherwise ["B1"]. Fallback to ["B1"] for situations with no description.

Revision ID: admin2_26_02
Revises: admin2_26_01
Create Date: 2026-05-26 00:02:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy import text
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "admin2_26_02"
down_revision: Union[str, Sequence[str], None] = "admin2_26_01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "situations",
        sa.Column(
            "levels",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=text("'[]'::jsonb"),
        ),
    )

    conn = op.get_bind()

    # Backfill from linked description: B1+A2 when text_el_a2 is present.
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
            """
        )
    )

    # Fallback for situations with no description (or still empty after above).
    conn.execute(
        text(
            """
            UPDATE situations
            SET levels = '["B1"]'::jsonb
            WHERE levels = '[]'::jsonb OR levels IS NULL
            """
        )
    )


def downgrade() -> None:
    op.drop_column("situations", "levels")
