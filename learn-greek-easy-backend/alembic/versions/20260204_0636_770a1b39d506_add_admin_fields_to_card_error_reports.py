"""add_admin_fields_to_card_error_reports

Revision ID: 770a1b39d506
Revises: e4d348b9edab
Create Date: 2026-02-04 06:36:28.114988+00:00

Adds admin workflow fields and constraints to card_error_reports:
- resolved_by: FK to users table (who resolved the report)
- resolved_at: timestamp when report was resolved
- unique constraint to prevent duplicate reports per user/card
- composite index for admin queries
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "770a1b39d506"
down_revision: Union[str, Sequence[str], None] = "e4d348b9edab"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add admin workflow fields and constraints to card_error_reports."""
    # Add resolved_by column
    op.add_column("card_error_reports", sa.Column("resolved_by", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        "fk_card_error_reports_resolved_by_users",
        "card_error_reports",
        "users",
        ["resolved_by"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        op.f("ix_card_error_reports_resolved_by"),
        "card_error_reports",
        ["resolved_by"],
        unique=False,
    )

    # Add resolved_at column
    op.add_column(
        "card_error_reports",
        sa.Column(
            "resolved_at",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Timestamp when report was resolved",
        ),
    )

    # Add unique constraint to prevent duplicate reports per user/card
    op.create_unique_constraint(
        "uq_user_card_error_report",
        "card_error_reports",
        ["user_id", "card_type", "card_id"],
    )

    # Add composite index for admin queries (status + created_at DESC)
    op.create_index(
        "ix_card_error_reports_status_created_at",
        "card_error_reports",
        ["status", sa.text("created_at DESC")],
        unique=False,
    )


def downgrade() -> None:
    """Remove admin workflow fields and constraints."""
    op.drop_index("ix_card_error_reports_status_created_at", table_name="card_error_reports")
    op.drop_constraint("uq_user_card_error_report", "card_error_reports", type_="unique")
    op.drop_index(op.f("ix_card_error_reports_resolved_by"), table_name="card_error_reports")
    op.drop_constraint(
        "fk_card_error_reports_resolved_by_users", "card_error_reports", type_="foreignkey"
    )
    op.drop_column("card_error_reports", "resolved_at")
    op.drop_column("card_error_reports", "resolved_by")
