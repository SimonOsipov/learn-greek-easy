"""lexgen13_review_tables: word_proposal_review_log and proposal_attempt

Create two new tables for LEXGEN-13 (Inbox Review Actions & Structured
Per-Field Logging):

    public.word_proposal_review_log   — per-field reviewer decision log
    public.proposal_attempt           — snapshot of a single pipeline run

Also creates two new PG enum types:

    review_action     — approve | edit | regenerate | reject
    human_decision    — accept | edit | reject

Both tables are append-only audit records:
- word_proposal_review_log: tracks every discrete reviewer action on a field.
- proposal_attempt: snapshots the full JSONB state of a pipeline run.
  attempt_no is 1-based and monotonically increasing per proposal.

Neither table has updated_at (TimestampMixin is intentionally NOT used).

Memory lesson (LEXGEN-05 / LEXGEN-09):
    This migration pins to its own revision id ("lexgen13_review_tables"),
    NOT to "head", so that round-trip tests remain stable after future
    successors land.

Revision ID: lexgen13_review_tables
Revises: lexgen09_generated_content
Create Date: 2026-06-22 12:00:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "lexgen13_review_tables"
down_revision: Union[str, Sequence[str], None] = "lexgen09_generated_content"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create review_action / human_decision enums + both new tables."""
    # ------------------------------------------------------------------ enums
    # Create the PG enum types first (before the tables that reference them).
    # dialog_status / word_proposal_status convention: lowercase values,
    # create_type=True here so Alembic creates them; create_type=False in
    # Column definitions so the type is only created once.
    postgresql.ENUM(
        "approve",
        "edit",
        "regenerate",
        "reject",
        name="review_action",
        create_type=True,
    ).create(op.get_bind(), checkfirst=True)

    postgresql.ENUM(
        "accept",
        "edit",
        "reject",
        name="human_decision",
        create_type=True,
    ).create(op.get_bind(), checkfirst=True)

    # Reference the just-created enum types with create_type=False so they are
    # not re-created inside op.create_table().
    review_action_enum = postgresql.ENUM(
        "approve",
        "edit",
        "regenerate",
        "reject",
        name="review_action",
        create_type=False,
    )
    human_decision_enum = postgresql.ENUM(
        "accept",
        "edit",
        "reject",
        name="human_decision",
        create_type=False,
    )

    # ------------------------------------------ word_proposal_review_log table
    op.create_table(
        "word_proposal_review_log",
        sa.Column(
            "id",
            sa.Uuid(),
            server_default=sa.text("uuid_generate_v4()"),
            nullable=False,
        ),
        sa.Column(
            "proposal_id",
            sa.Uuid(),
            nullable=False,
            comment="The proposal this review log row belongs to",
        ),
        sa.Column(
            "action",
            review_action_enum,
            nullable=False,
            comment="Action the reviewer took on this field: approve | edit | regenerate | reject",
        ),
        sa.Column(
            "field",
            sa.Text(),
            nullable=True,
            comment="Which proposal field this action applies to (NULL for proposal-level actions)",
        ),
        sa.Column(
            "pipeline_value",
            sa.Text(),
            nullable=True,
            comment="The pipeline-generated value at review time (for diff / audit purposes)",
        ),
        sa.Column(
            "edited_value",
            sa.Text(),
            nullable=True,
            comment="The reviewer's edited value (NULL when action != edit)",
        ),
        sa.Column(
            "human_decision",
            human_decision_enum,
            nullable=True,
            comment="Final reviewer verdict on the proposal (nullable for field-level-only rows)",
        ),
        sa.Column(
            "reviewer_id",
            sa.Uuid(),
            nullable=True,
            comment="User who performed the review (SET NULL; NULL after account deletion)",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
            comment="Timestamp when this review log row was created",
        ),
        sa.ForeignKeyConstraint(
            ["proposal_id"],
            ["word_proposal.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["reviewer_id"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_word_proposal_review_log_proposal_id",
        "word_proposal_review_log",
        ["proposal_id"],
        unique=False,
    )

    # -------------------------------------------------- proposal_attempt table
    op.create_table(
        "proposal_attempt",
        sa.Column(
            "id",
            sa.Uuid(),
            server_default=sa.text("uuid_generate_v4()"),
            nullable=False,
        ),
        sa.Column(
            "proposal_id",
            sa.Uuid(),
            nullable=False,
            comment="The proposal this attempt belongs to",
        ),
        sa.Column(
            "attempt_no",
            sa.Integer(),
            nullable=False,
            comment="1-based attempt number (monotonically increasing per proposal)",
        ),
        sa.Column(
            "generated_content",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
            comment="RAG generator output for this attempt (LEXGEN-09 format)",
        ),
        sa.Column(
            "generated_fields",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
            comment="Reconciler-owned fields for this attempt",
        ),
        sa.Column(
            "reconciliation_log",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
            comment="Reconciliation log snapshot for this attempt",
        ),
        sa.Column(
            "judge_scores",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
            comment="Per-field judge scores snapshot (JSONB, NOT a numeric aggregate — LEXGEN-11 D8)",
        ),
        sa.Column(
            "flagged_fields",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
            comment="Fields flagged for reviewer attention in this attempt",
        ),
        sa.Column(
            "retry_attempts",
            sa.Integer(),
            nullable=True,
            comment="Number of generation retries within this attempt",
        ),
        sa.Column(
            "superseded_at",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="When this attempt was superseded by a newer run (NULL = current attempt)",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
            comment="Timestamp when this attempt row was created",
        ),
        sa.ForeignKeyConstraint(
            ["proposal_id"],
            ["word_proposal.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "proposal_id",
            "attempt_no",
            name="uq_proposal_attempt_proposal_id_attempt_no",
        ),
    )
    op.create_index(
        "ix_proposal_attempt_proposal_id",
        "proposal_attempt",
        ["proposal_id"],
        unique=False,
    )


def downgrade() -> None:
    """Drop both tables and their enum types."""
    # Drop indexes + tables first (enums referenced by the tables must go last).
    op.drop_index("ix_proposal_attempt_proposal_id", table_name="proposal_attempt")
    op.drop_table("proposal_attempt")

    op.drop_index(
        "ix_word_proposal_review_log_proposal_id",
        table_name="word_proposal_review_log",
    )
    op.drop_table("word_proposal_review_log")

    # Drop enum types after the tables that referenced them are gone.
    postgresql.ENUM(name="human_decision").drop(op.get_bind(), checkfirst=True)
    postgresql.ENUM(name="review_action").drop(op.get_bind(), checkfirst=True)
