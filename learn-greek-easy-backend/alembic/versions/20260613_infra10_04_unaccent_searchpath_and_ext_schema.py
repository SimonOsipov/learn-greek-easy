"""immutable_unaccent SET search_path='' + guarded fuzzystrmatch schema move

Hardens the public.immutable_unaccent(text) function by adding
SET search_path = '' so that its proconfig carries a search_path= GUC.
This closes the search_path-hijacking vector identified in the INFRA-10
security supply-chain hardening story.

DEFERRED (out of scope per story Constraint):
  - Moving pgvector / pg_trgm / unaccent itself out of public. Those extensions
    are referenced by live indexes (idx_culture_questions_embedding ivfflat,
    reference.idx_translations_trgm gin_trgm_ops) and by the hard-coded
    'public.unaccent' qualifier inside the immutable_unaccent body.
    Relocating them is unsafe / unsupported on managed Supabase and requires
    a separate planned migration with index rebuilds.

Revision ID: infra10_04
Revises: admin2_32_levels
Create Date: 2026-06-13 00:00:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "infra10_04"
down_revision: Union[str, Sequence[str], None] = "admin2_32_levels"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # (a) Re-create immutable_unaccent with SET search_path = '' so that
    # pg_proc.proconfig gains a 'search_path=' entry and the function cannot
    # be hijacked by a future search_path change.  The body remains identical
    # (fully-qualified 'public.unaccent') — purely a security hardening.
    op.execute(
        """
        CREATE OR REPLACE FUNCTION public.immutable_unaccent(text)
        RETURNS text LANGUAGE SQL IMMUTABLE STRICT PARALLEL SAFE
        SET search_path = ''
        AS $$ SELECT public.unaccent('public.unaccent', $1) $$
        """
    )

    # (b) Move fuzzystrmatch out of public into the extensions schema if both
    # schemas and the extension exist.  This is a no-op on the CI image
    # (pgvector/pgvector:pg17) which has no 'extensions' schema.
    op.execute(
        """
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'extensions')
             AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'fuzzystrmatch') THEN
            ALTER EXTENSION fuzzystrmatch SET SCHEMA extensions;
          END IF;
        END $$
        """
    )


def downgrade() -> None:
    # Restore the prior definition without SET search_path (no proconfig entry).
    op.execute(
        """
        CREATE OR REPLACE FUNCTION immutable_unaccent(text)
        RETURNS text LANGUAGE SQL IMMUTABLE STRICT PARALLEL SAFE
        AS $$ SELECT public.unaccent('public.unaccent', $1) $$
        """
    )

    # Mirror-guarded reverse: move fuzzystrmatch back to public if it is
    # currently in the extensions schema.
    op.execute(
        """
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM pg_extension e
                     JOIN pg_namespace n ON n.oid = e.extnamespace
                     WHERE e.extname = 'fuzzystrmatch' AND n.nspname = 'extensions') THEN
            ALTER EXTENSION fuzzystrmatch SET SCHEMA public;
          END IF;
        END $$
        """
    )
