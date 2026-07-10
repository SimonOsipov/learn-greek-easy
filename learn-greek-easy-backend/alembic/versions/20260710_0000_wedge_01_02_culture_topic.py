"""wedge_01_02_culture_topic

Adds a nullable, indexed String(50) `topic` column to the culture_questions
table (WEDGE-01-02).

`topic` classifies a culture question into one of the closed CultureTopic
values (WEDGE-01-01: history, geography, politics, culture, practical), but
the closed vocabulary is enforced in Python via the CultureTopic constant —
NOT via a PostgreSQL native enum (Architect decision D1) — so new topics
never require an `ALTER TYPE ... ADD VALUE` migration.

No backfill of existing rows is performed here — this is a purely additive
migration (no server_default, no UPDATE). WEDGE-02 tags existing questions.

Revision ID: wedge_01_02_culture_topic
Revises: sit_27_02_situation_domain
Create Date: 2026-07-10 00:00:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "wedge_01_02_culture_topic"
down_revision: Union[str, Sequence[str], None] = "sit_27_02_situation_domain"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "culture_questions",
        sa.Column(
            "topic",
            sa.String(length=50),
            nullable=True,
            comment=(
                "Thematic subject bucket (see CultureTopic): history, geography, "
                "politics, culture, practical. NULL = untagged (WEDGE-02 tags it)."
            ),
        ),
    )
    op.create_index(
        op.f("ix_culture_questions_topic"), "culture_questions", ["topic"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_culture_questions_topic"), table_name="culture_questions")
    op.drop_column("culture_questions", "topic")
