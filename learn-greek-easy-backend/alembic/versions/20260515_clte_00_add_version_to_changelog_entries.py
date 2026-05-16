"""CLTE-00: Add nullable version column to changelog_entries.

Revision ID: clte_00
Revises: pmatch_01
Create Date: 2026-05-15 00:00:00.000000

Adds a nullable VARCHAR(50) `version` column to support the ADMIN2-06
Changelog Timeline & Editor's version pill / version input. No data
backfill — existing rows carry NULL.
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision: str = "clte_00"
down_revision: str = "pmatch_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "changelog_entries",
        sa.Column(
            "version",
            sa.String(length=50),
            nullable=True,
            comment="Optional release version label, e.g. v1.2.0",
        ),
    )


def downgrade() -> None:
    op.drop_column("changelog_entries", "version")
