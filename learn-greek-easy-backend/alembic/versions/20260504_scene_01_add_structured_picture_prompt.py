from __future__ import annotations

import os

import sqlalchemy as sa

from alembic import op

revision: str = "scene_01"
down_revision: str = "sitst_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Step 0: Hard-fail if the house-style default env var is unset.
    # The migration MUST be run with PICTURE_HOUSE_STYLE_DEFAULT set in the
    # environment. There is no fallback: a silent default would corrupt all
    # existing backfilled rows with a blank style fragment.
    house_style = os.environ.get("PICTURE_HOUSE_STYLE_DEFAULT")
    if not house_style or not house_style.strip():
        raise RuntimeError(
            "PICTURE_HOUSE_STYLE_DEFAULT environment variable is required for the "
            "scene_01 migration. Set it in Railway (or your shell) before running "
            "`alembic upgrade head`. Migration aborted; no schema changes applied."
        )

    # Step 1: Add three nullable Text columns to situation_pictures.
    op.add_column("situation_pictures", sa.Column("scene_en", sa.Text(), nullable=True))
    op.add_column("situation_pictures", sa.Column("scene_el", sa.Text(), nullable=True))
    op.add_column("situation_pictures", sa.Column("style_en", sa.Text(), nullable=True))

    # Step 2: Backfill all existing rows from the linked Situation + env var.
    # COALESCE keeps the data step idempotent if re-run after a partial apply.
    conn = op.get_bind()
    conn.execute(
        sa.text(
            """
            UPDATE situation_pictures sp
            SET
                scene_en = COALESCE(sp.scene_en, s.scenario_en),
                scene_el = COALESCE(sp.scene_el, s.scenario_el),
                style_en = COALESCE(sp.style_en, :house_style)
            FROM situations s
            WHERE sp.situation_id = s.id
            """
        ),
        {"house_style": house_style},
    )

    # Note: image_prompt is intentionally NOT mutated. Existing rows keep their
    # current value; future creates will compose image_prompt from scene_en + style_en
    # at write time.


def downgrade() -> None:
    op.drop_column("situation_pictures", "style_en")
    op.drop_column("situation_pictures", "scene_el")
    op.drop_column("situation_pictures", "scene_en")
