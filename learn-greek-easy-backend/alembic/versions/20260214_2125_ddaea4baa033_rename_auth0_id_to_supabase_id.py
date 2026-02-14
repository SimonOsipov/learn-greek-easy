"""rename auth0_id to supabase_id

Revision ID: ddaea4baa033
Revises: c8fdf813e464
Create Date: 2026-02-14 21:25:51.271112+00:00

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "ddaea4baa033"
down_revision: Union[str, Sequence[str], None] = "c8fdf813e464"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Rename auth0_id column to supabase_id on users table."""
    # Rename the column
    op.alter_column(
        "users",
        "auth0_id",
        new_column_name="supabase_id",
        comment="Supabase Auth user identifier (sub claim, UUID format)",
    )
    # Drop old index and create new one with updated name
    op.drop_index("ix_users_auth0_id", table_name="users")
    op.create_index("ix_users_supabase_id", "users", ["supabase_id"], unique=True)


def downgrade() -> None:
    """Reverse: rename supabase_id back to auth0_id."""
    op.drop_index("ix_users_supabase_id", table_name="users")
    op.create_index("ix_users_auth0_id", "users", ["auth0_id"], unique=True)
    op.alter_column(
        "users",
        "supabase_id",
        new_column_name="auth0_id",
        comment="Auth0 user identifier (sub claim)",
    )
