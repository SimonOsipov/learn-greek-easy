"""perf_09 enable rls word_order_exercises

Enable Row Level Security (deny-all) on word_order_exercises and
word_order_exercise_items. Both tables were created after the 2026-02-25
bulk-RLS migration (7a743b524c32) and were therefore never covered.

Policy: deny-all (RLS enabled, NO policy). This matches the existing 45
RLS-enabled-no-policy tables. The FastAPI backend connects via a privileged
role that bypasses RLS, so app behaviour is unaffected. The anon/publishable
PostgREST endpoint currently returns HTTP 200 for both tables (confirmed
2026-06-01) — active world-readable exposure, tables are empty at time of
discovery but endpoint is fully reachable. Fix is urgent, not just
defense-in-depth.

Revision ID: perf_09
Revises: nadm_25
Create Date: 2026-06-01 00:00:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "perf_09"
down_revision: Union[str, Sequence[str], None] = "nadm_25"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Enable RLS (deny-all) on word_order_exercises and word_order_exercise_items.

    No policies are created — anon/authenticated roles (PostgREST) are denied
    all access by default. The postgres owner role (SQLAlchemy backend) bypasses
    RLS automatically.
    """
    op.execute("ALTER TABLE public.word_order_exercises ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE public.word_order_exercise_items ENABLE ROW LEVEL SECURITY;")


def downgrade() -> None:
    """Disable RLS on word_order_exercise_items and word_order_exercises."""
    op.execute("ALTER TABLE public.word_order_exercise_items DISABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE public.word_order_exercises DISABLE ROW LEVEL SECURITY;")
