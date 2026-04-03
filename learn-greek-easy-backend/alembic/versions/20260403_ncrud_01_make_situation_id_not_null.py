from __future__ import annotations

from alembic import op

revision: str = "ncrud_01"
down_revision: str = "tnews_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("news_items", "situation_id", nullable=False)
    # Update FK ondelete from SET NULL to CASCADE (SET NULL is invalid for NOT NULL columns)
    op.drop_constraint("news_items_situation_id_fkey", "news_items", type_="foreignkey")
    op.create_foreign_key(
        "news_items_situation_id_fkey",
        "news_items",
        "situations",
        ["situation_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    op.drop_constraint("news_items_situation_id_fkey", "news_items", type_="foreignkey")
    op.create_foreign_key(
        "news_items_situation_id_fkey",
        "news_items",
        "situations",
        ["situation_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.alter_column("news_items", "situation_id", nullable=True)
