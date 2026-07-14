"""rls_lexgen13 enable rls on word_proposal_review_log and proposal_attempt

Enable Row Level Security (deny-all) on the two LEXGEN-13 review tables. Both
were created by lexgen13_review_tables (migration lexgen13_review_tables,
merged 2026-06-22) AFTER the 2026-02-25 bulk-RLS migration (7a743b524c32) and
were therefore never covered — the same gap class that rls_word_proposal
(revision rls_word_proposal) fixed for word_proposal and perf_09 fixed for
word_order_exercises.

Policy: deny-all (RLS enabled, NO policy). This matches the existing
RLS-enabled-no-policy tables. The FastAPI backend connects via a privileged
role that bypasses RLS, so app behaviour is unaffected. At time of discovery
(2026-07-14, via the Supabase security advisor `rls_disabled_in_public`) both
tables had RLS DISABLED and were reachable via the public PostgREST endpoint.
Both were empty (0 rows) on production at discovery — the LEXGEN review flow
that populates them is not yet driving writes — so there was no data exposure,
but the open surface is closed here before the tables start holding real data.

Revision ID: rls_lexgen13_review_tables
Revises: wedge_01_02_culture_topic
Create Date: 2026-07-14 00:00:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "rls_lexgen13_review_tables"
down_revision: Union[str, Sequence[str], None] = "wedge_01_02_culture_topic"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Enable RLS (deny-all) on the two LEXGEN-13 review tables.

    No policy is created — anon/authenticated roles (PostgREST) are denied all
    access by default. The postgres owner role (SQLAlchemy backend) bypasses
    RLS automatically.
    """
    op.execute("ALTER TABLE public.word_proposal_review_log ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE public.proposal_attempt ENABLE ROW LEVEL SECURITY;")


def downgrade() -> None:
    """Disable RLS on the two LEXGEN-13 review tables."""
    op.execute("ALTER TABLE public.proposal_attempt DISABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE public.word_proposal_review_log DISABLE ROW LEVEL SECURITY;")
