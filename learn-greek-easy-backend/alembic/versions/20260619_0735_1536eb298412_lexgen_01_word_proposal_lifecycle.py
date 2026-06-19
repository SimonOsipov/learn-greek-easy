"""lexgen-01 word_proposal lifecycle

Revision ID: 1536eb298412
Revises: infra10_04
Create Date: 2026-06-19 07:35:18.992292+00:00

"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "1536eb298412"
down_revision: Union[str, Sequence[str], None] = "infra10_04"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create the word_proposal table + its two lowercase Postgres enum types."""
    # Create enum types before the table that uses them (lowercase values,
    # dialog_status convention — NOT the legacy uppercase partofspeech pattern).
    postgresql.ENUM(
        "pending",
        "generating",
        "scored",
        "auto_approved",
        "needs_review",
        "rejected",
        "shipped",
        name="word_proposal_status",
        create_type=True,
    ).create(op.get_bind(), checkfirst=True)
    postgresql.ENUM(
        "admin",
        "user_request",
        "batch",
        name="word_proposal_origin",
        create_type=True,
    ).create(op.get_bind(), checkfirst=True)

    # Reference the just-created enum types (DO NOT re-create in the table).
    word_proposal_status_enum = postgresql.ENUM(
        "pending",
        "generating",
        "scored",
        "auto_approved",
        "needs_review",
        "rejected",
        "shipped",
        name="word_proposal_status",
        create_type=False,
    )
    word_proposal_origin_enum = postgresql.ENUM(
        "admin",
        "user_request",
        "batch",
        name="word_proposal_origin",
        create_type=False,
    )

    op.create_table(
        "word_proposal",
        sa.Column(
            "id",
            sa.Uuid(),
            server_default=sa.text("uuid_generate_v4()"),
            nullable=False,
        ),
        sa.Column(
            "lemma_input",
            sa.Text(),
            nullable=False,
            comment="Raw lemma the proposal was created for",
        ),
        sa.Column(
            "pos",
            sa.Text(),
            nullable=False,
            comment="Part of speech as free-text (POS-neutral — no enum, no hardcoded 'noun')",
        ),
        sa.Column(
            "origin",
            word_proposal_origin_enum,
            nullable=False,
            comment="Origin channel: admin | user_request | batch (v1 writes admin only)",
        ),
        sa.Column(
            "requested_by",
            sa.Uuid(),
            nullable=True,
            comment="User who requested this proposal (NULL for admin/system or deleted user)",
        ),
        sa.Column(
            "status",
            word_proposal_status_enum,
            server_default=sa.text("'pending'"),
            nullable=False,
            comment="Lifecycle state (state machine + guard live in src/core, LEXGEN-01-02)",
        ),
        sa.Column(
            "evidence_packet",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
            comment="Evidence gathered before generation",
        ),
        sa.Column(
            "generated_fields",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
            comment="LLM-generated fields (gender, when applicable, lives HERE — POS-neutral)",
        ),
        sa.Column(
            "reconciliation_log",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
            comment="Log of reconciliation between generated fields and evidence",
        ),
        sa.Column(
            "judge_scores",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
            comment="Per-field judge scores",
        ),
        sa.Column(
            "flagged_fields",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
            comment="Fields flagged for reviewer attention",
        ),
        sa.Column(
            "trust_score",
            sa.Float(),
            nullable=True,
            comment="INERT in v1 (Decision Record §3): no numeric trust score pre-calibration",
        ),
        sa.Column(
            "shipped_word_entry_id",
            sa.Uuid(),
            nullable=True,
            comment="WordEntry created when this proposal shipped (NULL until shipped / if deleted)",
        ),
        sa.Column(
            "rejection_reason",
            sa.Text(),
            nullable=True,
            comment="Reviewer-supplied reason when the proposal is rejected",
        ),
        sa.Column(
            "retry_attempts",
            sa.Integer(),
            server_default=sa.text("'0'"),
            nullable=False,
            comment="Number of generation retry attempts",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
            comment="Timestamp when record was created",
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
            comment="Timestamp when record was last updated",
        ),
        sa.ForeignKeyConstraint(["requested_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(
            ["shipped_word_entry_id"], ["word_entries.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_word_proposal_lemma_input", "word_proposal", ["lemma_input"], unique=False)
    op.create_index(
        "ix_word_proposal_origin_status",
        "word_proposal",
        ["origin", "status"],
        unique=False,
    )
    op.create_index("ix_word_proposal_status", "word_proposal", ["status"], unique=False)


def downgrade() -> None:
    """Drop the word_proposal table + its two enum types."""
    op.drop_index("ix_word_proposal_status", table_name="word_proposal")
    op.drop_index("ix_word_proposal_origin_status", table_name="word_proposal")
    op.drop_index("ix_word_proposal_lemma_input", table_name="word_proposal")
    op.drop_table("word_proposal")

    # Drop enum types after the table that used them is gone.
    postgresql.ENUM(name="word_proposal_status").drop(op.get_bind(), checkfirst=True)
    postgresql.ENUM(name="word_proposal_origin").drop(op.get_bind(), checkfirst=True)
