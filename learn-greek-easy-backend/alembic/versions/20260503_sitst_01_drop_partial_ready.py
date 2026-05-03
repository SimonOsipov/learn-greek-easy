"""SITST-01: Drop partial_ready from situationstatus enum.

Postgres can't `DROP VALUE` from an enum, so we recreate the type
without `partial_ready` and swap the column over. Production has zero
rows in `partial_ready`, but we still convert any stragglers to
`draft` defensively before the swap.

Revision ID: sitst_01
Revises: gamif_05_01
Create Date: 2026-05-03 19:00:00.000000
"""

from collections.abc import Sequence

from alembic import op

revision: str = "sitst_01"
down_revision: str | None = "gamif_05_01"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("UPDATE situations SET status = 'draft' WHERE status = 'partial_ready'")
    op.execute("ALTER TYPE situationstatus RENAME TO situationstatus_old")
    op.execute("CREATE TYPE situationstatus AS ENUM ('draft', 'ready')")
    op.execute(
        "ALTER TABLE situations "
        "ALTER COLUMN status DROP DEFAULT, "
        "ALTER COLUMN status TYPE situationstatus USING status::text::situationstatus, "
        "ALTER COLUMN status SET DEFAULT 'draft'"
    )
    op.execute("DROP TYPE situationstatus_old")


def downgrade() -> None:
    op.execute("ALTER TYPE situationstatus RENAME TO situationstatus_old")
    op.execute("CREATE TYPE situationstatus AS ENUM ('draft', 'partial_ready', 'ready')")
    op.execute(
        "ALTER TABLE situations "
        "ALTER COLUMN status DROP DEFAULT, "
        "ALTER COLUMN status TYPE situationstatus USING status::text::situationstatus, "
        "ALTER COLUMN status SET DEFAULT 'draft'"
    )
    op.execute("DROP TYPE situationstatus_old")
