"""sit_27_02_situation_domain

Adds a nullable Text `domain` column to the situations table (SIT-27-02).

`domain` is the human-facing topic label (e.g. news, everyday, travel) that
drives the situations-hub card domain·level kicker. It is a plain Text column
(NOT a PG enum) to match every other descriptive column on Situation
(source_title_*, scenario_el_a2); enums are reserved for state machines
(status).

Backfill of the 4 production rows is a manual post-deploy step keyed on
scenario_en (see scripts/backfill_sit_27_02_situation_domain.py) — NOT done
in this migration, so the migration round-trip stays narrow.

Revision ID: sit_27_02_situation_domain
Revises: lexgen13_review_tables
Create Date: 2026-06-23 12:00:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "sit_27_02_situation_domain"
down_revision: Union[str, Sequence[str], None] = "lexgen13_review_tables"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("situations", sa.Column("domain", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("situations", "domain")
