"""add_xp_and_achievements_tables

Revision ID: 56fef805c407
Revises: 2c5f04bd7dfd
Create Date: 2025-12-21 10:16:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "56fef805c407"
down_revision: Union[str, Sequence[str], None] = "2c5f04bd7dfd"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add XP and achievements tables."""
    # Create achievementcategory enum type
    # Use postgresql.ENUM with create_type=False to avoid duplication issues
    achievementcategory_enum = postgresql.ENUM(
        "STREAK",
        "LEARNING",
        "SESSION",
        "ACCURACY",
        "CEFR",
        "SPECIAL",
        name="achievementcategory",
        create_type=False,  # We create it manually below
    )
    achievementcategory_enum.create(op.get_bind(), checkfirst=True)

    # Create user_xp table
    op.create_table(
        "user_xp",
        sa.Column("id", sa.Uuid(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("total_xp", sa.Integer(), nullable=False),
        sa.Column("current_level", sa.Integer(), nullable=False),
        sa.Column("last_daily_bonus_date", sa.Date(), nullable=True),
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
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index(op.f("ix_user_xp_user_id"), "user_xp", ["user_id"], unique=True)

    # Create xp_transactions table
    op.create_table(
        "xp_transactions",
        sa.Column("id", sa.Uuid(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("reason", sa.String(length=50), nullable=False),
        sa.Column("source_id", sa.Uuid(), nullable=True),
        sa.Column(
            "earned_at",
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
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_xp_transactions_user_id"), "xp_transactions", ["user_id"], unique=False
    )
    op.create_index(
        op.f("ix_xp_transactions_earned_at"), "xp_transactions", ["earned_at"], unique=False
    )

    # Create achievements table
    op.create_table(
        "achievements",
        sa.Column("id", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("category", achievementcategory_enum, nullable=False),
        sa.Column("icon", sa.String(length=50), nullable=False),
        sa.Column("threshold", sa.Integer(), nullable=False),
        sa.Column("xp_reward", sa.Integer(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
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
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_achievements_category"), "achievements", ["category"], unique=False)

    # Create user_achievements table
    op.create_table(
        "user_achievements",
        sa.Column("id", sa.Uuid(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("achievement_id", sa.String(length=50), nullable=False),
        sa.Column(
            "unlocked_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("notified", sa.Boolean(), nullable=False),
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
        sa.ForeignKeyConstraint(["achievement_id"], ["achievements.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "achievement_id", name="uq_user_achievement"),
    )
    op.create_index(
        op.f("ix_user_achievements_user_id"), "user_achievements", ["user_id"], unique=False
    )
    op.create_index(
        op.f("ix_user_achievements_achievement_id"),
        "user_achievements",
        ["achievement_id"],
        unique=False,
    )


def downgrade() -> None:
    """Remove XP and achievements tables."""
    # Drop tables in reverse order (respect foreign key constraints)
    op.drop_index(op.f("ix_user_achievements_achievement_id"), table_name="user_achievements")
    op.drop_index(op.f("ix_user_achievements_user_id"), table_name="user_achievements")
    op.drop_table("user_achievements")

    op.drop_index(op.f("ix_achievements_category"), table_name="achievements")
    op.drop_table("achievements")

    op.drop_index(op.f("ix_xp_transactions_earned_at"), table_name="xp_transactions")
    op.drop_index(op.f("ix_xp_transactions_user_id"), table_name="xp_transactions")
    op.drop_table("xp_transactions")

    op.drop_index(op.f("ix_user_xp_user_id"), table_name="user_xp")
    op.drop_table("user_xp")

    # Drop enum type
    postgresql.ENUM(name="achievementcategory").drop(op.get_bind(), checkfirst=True)
