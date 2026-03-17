"""sm2v2_01_add_card_record_sm2_tables

Revision ID: 2b8fa820919d
Revises: 117444743f51
Create Date: 2026-03-17 18:01:35.285103+00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "2b8fa820919d"
down_revision: str | None = "117444743f51"
branch_labels: str | tuple[str, ...] | None = None
depends_on: str | tuple[str, ...] | None = None


def upgrade() -> None:
    """Add card_record_statistics and card_record_reviews tables."""
    # card_record_statistics table
    op.create_table(
        "card_record_statistics",
        sa.Column(
            "id",
            sa.Uuid(),
            server_default=sa.text("uuid_generate_v4()"),
            nullable=False,
        ),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("card_record_id", sa.Uuid(), nullable=False),
        sa.Column("easiness_factor", sa.Float(), nullable=False),
        sa.Column("interval", sa.Integer(), nullable=False),
        sa.Column("repetitions", sa.Integer(), nullable=False),
        sa.Column(
            "next_review_date",
            sa.Date(),
            server_default=sa.text("CURRENT_DATE"),
            nullable=False,
        ),
        sa.Column(
            "status",
            postgresql.ENUM(
                "NEW",
                "LEARNING",
                "REVIEW",
                "MASTERED",
                name="cardstatus",
                create_type=False,
            ),
            nullable=False,
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
        sa.ForeignKeyConstraint(
            ["card_record_id"],
            ["card_records.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "card_record_id", name="uq_user_card_record"),
    )
    op.create_index(
        "ix_crs_user_next_review",
        "card_record_statistics",
        ["user_id", "next_review_date"],
        unique=False,
    )
    op.create_index(
        op.f("ix_card_record_statistics_card_record_id"),
        "card_record_statistics",
        ["card_record_id"],
        unique=False,
    )

    # card_record_reviews table
    op.create_table(
        "card_record_reviews",
        sa.Column(
            "id",
            sa.Uuid(),
            server_default=sa.text("uuid_generate_v4()"),
            nullable=False,
        ),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("card_record_id", sa.Uuid(), nullable=False),
        sa.Column("quality", sa.Integer(), nullable=False),
        sa.Column("time_taken", sa.Integer(), nullable=False),
        sa.Column(
            "reviewed_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
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
        sa.ForeignKeyConstraint(
            ["card_record_id"],
            ["card_records.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint(
            "quality >= 0 AND quality <= 5",
            name="ck_crr_quality_range",
        ),
    )
    op.create_index(
        "ix_crr_user_reviewed_at",
        "card_record_reviews",
        ["user_id", "reviewed_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_card_record_reviews_card_record_id"),
        "card_record_reviews",
        ["card_record_id"],
        unique=False,
    )


def downgrade() -> None:
    """Drop card_record_reviews and card_record_statistics tables."""
    op.drop_index(
        op.f("ix_card_record_reviews_card_record_id"),
        table_name="card_record_reviews",
    )
    op.drop_index(
        "ix_crr_user_reviewed_at",
        table_name="card_record_reviews",
    )
    op.drop_table("card_record_reviews")

    op.drop_index(
        op.f("ix_card_record_statistics_card_record_id"),
        table_name="card_record_statistics",
    )
    op.drop_index(
        "ix_crs_user_next_review",
        table_name="card_record_statistics",
    )
    op.drop_table("card_record_statistics")

    # Do NOT drop cardstatus enum — used by card_statistics and other tables
