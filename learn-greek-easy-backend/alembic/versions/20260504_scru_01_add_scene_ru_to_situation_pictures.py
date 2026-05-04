from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision: str = "scru_01"
down_revision: str = "scene_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Step 1: Add nullable scene_ru column.
    op.add_column("situation_pictures", sa.Column("scene_ru", sa.Text(), nullable=True))

    # Step 2: Backfill from situations.scenario_ru. Idempotent via the IS NULL guard
    # so re-running after a partial apply is safe. The IS NOT NULL guard on
    # scenario_ru is defensive — situations.scenario_ru is currently NOT NULL,
    # but the guard mirrors the spec and keeps the UPDATE robust if that ever
    # changes.
    op.execute(
        """
        UPDATE situation_pictures sp
        SET scene_ru = s.scenario_ru
        FROM situations s
        WHERE sp.situation_id = s.id
          AND sp.scene_ru IS NULL
          AND s.scenario_ru IS NOT NULL
        """
    )


def downgrade() -> None:
    op.drop_column("situation_pictures", "scene_ru")
