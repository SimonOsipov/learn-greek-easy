"""drop_created_by_from_situation_tables

Revision ID: sit_04_drop_created_by
Revises: 66d23c0941f2
Create Date: 2026-03-21 09:00:00.000000

Drop the created_by column from situations, situation_descriptions, and
situation_pictures tables. The column was added in the initial sit migrations
but is not used in the application.
"""

import sqlalchemy as sa

from alembic import op

revision: str = "sit_04_drop_created_by"
down_revision: str | None = "66d23c0941f2"
branch_labels: str | tuple[str, ...] | None = None
depends_on: str | tuple[str, ...] | None = None


def upgrade() -> None:
    """Drop created_by column and associated indexes from situation tables."""
    # situations
    op.drop_index(op.f("ix_situations_created_by"), table_name="situations")
    op.drop_column("situations", "created_by")

    # situation_descriptions
    op.drop_index(
        op.f("ix_situation_descriptions_created_by"),
        table_name="situation_descriptions",
    )
    op.drop_column("situation_descriptions", "created_by")

    # situation_pictures
    op.drop_index(
        op.f("ix_situation_pictures_created_by"),
        table_name="situation_pictures",
    )
    op.drop_column("situation_pictures", "created_by")


def downgrade() -> None:
    """Re-add created_by columns as nullable UUID FK to users.id with SET NULL."""
    # situation_pictures
    op.add_column("situation_pictures", sa.Column("created_by", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        None, "situation_pictures", "users", ["created_by"], ["id"], ondelete="SET NULL"
    )
    op.create_index(
        op.f("ix_situation_pictures_created_by"),
        "situation_pictures",
        ["created_by"],
        unique=False,
    )

    # situation_descriptions
    op.add_column("situation_descriptions", sa.Column("created_by", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        None, "situation_descriptions", "users", ["created_by"], ["id"], ondelete="SET NULL"
    )
    op.create_index(
        op.f("ix_situation_descriptions_created_by"),
        "situation_descriptions",
        ["created_by"],
        unique=False,
    )

    # situations
    op.add_column("situations", sa.Column("created_by", sa.Uuid(), nullable=True))
    op.create_foreign_key(None, "situations", "users", ["created_by"], ["id"], ondelete="SET NULL")
    op.create_index(op.f("ix_situations_created_by"), "situations", ["created_by"], unique=False)
