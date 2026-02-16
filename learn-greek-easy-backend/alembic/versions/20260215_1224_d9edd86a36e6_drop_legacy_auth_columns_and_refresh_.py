"""drop_legacy_auth_columns_and_refresh_tokens

Revision ID: d9edd86a36e6
Revises: ddaea4baa033
Create Date: 2026-02-15 12:24:13.066179+00:00

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d9edd86a36e6"
down_revision: Union[str, Sequence[str], None] = "ddaea4baa033"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Drop legacy auth columns and refresh_tokens table."""
    # Drop refresh_tokens table first (has FK to users)
    op.drop_table("refresh_tokens")

    # Drop google_id index first, then column
    op.drop_index("ix_users_google_id", table_name="users")
    op.drop_column("users", "google_id")
    op.drop_column("users", "password_hash")
    op.drop_column("users", "email_verified_at")
    op.drop_column("users", "last_login_at")
    op.drop_column("users", "last_login_ip")


def downgrade() -> None:
    """Recreate legacy auth columns and refresh_tokens table."""
    # Re-add columns to users table
    op.add_column(
        "users",
        sa.Column("password_hash", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("google_id", sa.String(length=255), nullable=True),
    )
    op.create_index("ix_users_google_id", "users", ["google_id"], unique=True)
    op.add_column(
        "users",
        sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column(
            "last_login_at",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Timestamp of last successful login",
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "last_login_ip",
            sa.String(length=45),
            nullable=True,
            comment="IP address of last successful login",
        ),
    )

    # Recreate refresh_tokens table
    op.create_table(
        "refresh_tokens",
        sa.Column(
            "id",
            sa.Uuid(),
            server_default=sa.text("uuid_generate_v4()"),
            nullable=False,
        ),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("token", sa.String(length=500), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_refresh_tokens_expires_at",
        "refresh_tokens",
        ["expires_at"],
        unique=False,
    )
    op.create_index(
        "ix_refresh_tokens_token",
        "refresh_tokens",
        ["token"],
        unique=True,
    )
    op.create_index(
        "ix_refresh_tokens_user_id",
        "refresh_tokens",
        ["user_id"],
        unique=False,
    )
