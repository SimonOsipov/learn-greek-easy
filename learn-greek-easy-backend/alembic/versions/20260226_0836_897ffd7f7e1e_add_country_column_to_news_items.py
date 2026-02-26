"""add country column to news_items

Revision ID: 897ffd7f7e1e
Revises: 7a743b524c32
Create Date: 2026-02-26 08:36:57.155599+00:00

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "897ffd7f7e1e"
down_revision: Union[str, Sequence[str], None] = "7a743b524c32"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1. Create the PostgreSQL enum type
    newscountry_enum = sa.Enum("cyprus", "greece", "world", name="newscountry")
    newscountry_enum.create(op.get_bind(), checkfirst=True)

    # 2. Add column with server_default so existing rows get 'cyprus'
    op.add_column(
        "news_items",
        sa.Column(
            "country",
            sa.Enum("cyprus", "greece", "world", name="newscountry", create_type=False),
            nullable=False,
            server_default="cyprus",
            comment="Country/region this news item belongs to",
        ),
    )

    # 3. Remove the server_default (new inserts must explicitly set country)
    op.alter_column("news_items", "country", server_default=None)

    # 4. Add index
    op.create_index(op.f("ix_news_items_country"), "news_items", ["country"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_news_items_country"), table_name="news_items")
    op.drop_column("news_items", "country")
    sa.Enum(name="newscountry").drop(op.get_bind(), checkfirst=True)
