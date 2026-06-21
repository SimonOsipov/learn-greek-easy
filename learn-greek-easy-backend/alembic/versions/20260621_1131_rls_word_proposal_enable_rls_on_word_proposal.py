"""rls_word_proposal enable rls on word_proposal

Enable Row Level Security (deny-all) on word_proposal. The table was created
by LEXGEN-01 (migration 1536eb298412, merged 2026-06-19) AFTER the 2026-02-25
bulk-RLS migration (7a743b524c32) and was therefore never covered — the same
gap class that perf_09 (revision perf_09) fixed for word_order_exercises.

Policy: deny-all (RLS enabled, NO policy). This matches the existing
RLS-enabled-no-policy tables. The FastAPI backend connects via a privileged
role that bypasses RLS, so app behaviour is unaffected. At time of discovery
(2026-06-21) word_proposal had RLS DISABLED while the anon/authenticated roles
held full DML grants (SELECT/INSERT/UPDATE/DELETE/TRUNCATE) — i.e. the table
was reachable and writable via the public PostgREST endpoint, the single
public table where the deny-all wall was down. The table was empty (0 rows)
at discovery (the LEXGEN request/ingestion flow that populates it is not yet
built), so there was no data exposure, but the open write surface is closed
here before the table starts holding real proposals.

Revision ID: rls_word_proposal
Revises: 6b8e5cdc102f
Create Date: 2026-06-21 11:31:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "rls_word_proposal"
down_revision: Union[str, Sequence[str], None] = "6b8e5cdc102f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Enable RLS (deny-all) on word_proposal.

    No policy is created — anon/authenticated roles (PostgREST) are denied all
    access by default. The postgres owner role (SQLAlchemy backend) bypasses
    RLS automatically.
    """
    op.execute("ALTER TABLE public.word_proposal ENABLE ROW LEVEL SECURITY;")


def downgrade() -> None:
    """Disable RLS on word_proposal."""
    op.execute("ALTER TABLE public.word_proposal DISABLE ROW LEVEL SECURITY;")
