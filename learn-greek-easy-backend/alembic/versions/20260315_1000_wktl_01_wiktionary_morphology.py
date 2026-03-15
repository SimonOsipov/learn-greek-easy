"""wktl_01_wiktionary_morphology

Revision ID: b8c9d0e1f2a3
Revises: a3b4c5d6e7f8
Create Date: 2026-03-15 10:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

revision: str = "b8c9d0e1f2a3"
down_revision: str | None = "a3b4c5d6e7f8"
branch_labels: str | tuple[str, ...] | None = None
depends_on: str | tuple[str, ...] | None = None


def upgrade() -> None:
    op.create_table(
        "wiktionary_morphology",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("lemma", sa.Text, nullable=False),
        sa.Column("gender", sa.Text, nullable=False),
        sa.Column("forms", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("pronunciation", sa.Text, nullable=True),
        sa.Column("glosses_en", sa.Text, nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        schema="reference",
    )
    op.create_index(
        "uq_wiktionary_morphology_lemma_gender",
        "wiktionary_morphology",
        ["lemma", "gender"],
        unique=True,
        schema="reference",
    )
    op.create_index(
        "idx_wiktionary_morphology_forms",
        "wiktionary_morphology",
        ["forms"],
        schema="reference",
        postgresql_using="gin",
    )
    op.create_index(
        "idx_wiktionary_morphology_lemma",
        "wiktionary_morphology",
        ["lemma"],
        schema="reference",
    )


def downgrade() -> None:
    op.drop_index(
        "idx_wiktionary_morphology_lemma", table_name="wiktionary_morphology", schema="reference"
    )
    op.drop_index(
        "idx_wiktionary_morphology_forms", table_name="wiktionary_morphology", schema="reference"
    )
    op.drop_index(
        "uq_wiktionary_morphology_lemma_gender",
        table_name="wiktionary_morphology",
        schema="reference",
    )
    op.drop_table("wiktionary_morphology", schema="reference")
