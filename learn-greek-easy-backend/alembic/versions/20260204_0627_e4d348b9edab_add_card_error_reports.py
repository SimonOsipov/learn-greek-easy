"""add_card_error_reports

Revision ID: e4d348b9edab
Revises: d3269c256843
Create Date: 2026-02-04 06:27:00.000000+00:00

Creates the card_error_reports table for user-submitted error reports
on vocabulary cards and culture questions.
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e4d348b9edab"
down_revision: Union[str, Sequence[str], None] = "d3269c256843"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create card_error_reports table with enums and indexes."""
    # Create table with inline enum definitions (SQLAlchemy auto-creates enums)
    op.create_table(
        "card_error_reports",
        sa.Column("id", sa.Uuid(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("card_id", sa.Uuid(), nullable=False),
        sa.Column(
            "card_type",
            sa.Enum("VOCABULARY", "CULTURE", name="carderrorcardtype"),
            nullable=False,
        ),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column(
            "status",
            sa.Enum("PENDING", "REVIEWED", "FIXED", "DISMISSED", name="carderrorstatus"),
            nullable=False,
            server_default="PENDING",
        ),
        sa.Column("admin_notes", sa.Text(), nullable=True),
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

    # Create indexes
    op.create_index(
        op.f("ix_card_error_reports_user_id"), "card_error_reports", ["user_id"], unique=False
    )
    op.create_index(
        op.f("ix_card_error_reports_card_id"), "card_error_reports", ["card_id"], unique=False
    )
    op.create_index(
        op.f("ix_card_error_reports_status"), "card_error_reports", ["status"], unique=False
    )
    op.create_index(
        op.f("ix_card_error_reports_created_at"), "card_error_reports", ["created_at"], unique=False
    )
    op.create_index(
        "ix_card_error_reports_card_type_status",
        "card_error_reports",
        ["card_type", "status"],
        unique=False,
    )


def downgrade() -> None:
    """Drop card_error_reports table and enums."""
    # Drop indexes first
    op.drop_index("ix_card_error_reports_card_type_status", table_name="card_error_reports")
    op.drop_index(op.f("ix_card_error_reports_created_at"), table_name="card_error_reports")
    op.drop_index(op.f("ix_card_error_reports_status"), table_name="card_error_reports")
    op.drop_index(op.f("ix_card_error_reports_card_id"), table_name="card_error_reports")
    op.drop_index(op.f("ix_card_error_reports_user_id"), table_name="card_error_reports")

    # Drop table
    op.drop_table("card_error_reports")

    # Drop enums
    sa.Enum(name="carderrorstatus").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="carderrorcardtype").drop(op.get_bind(), checkfirst=True)
