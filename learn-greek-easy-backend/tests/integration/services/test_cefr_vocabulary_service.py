"""RED integration tests for LEXGEN-09-03: CefrVocabularyService.allowed_lemmas().

Tests the closed-vocabulary lemma-set assembly from reference.cefr_lemma:
  - Level arm: include rows where CEFR_ORDER.index(level) <= CEFR_ORDER.index(target)
  - Closed-class arm: always include rows where closed_class == True
  - Target lemma: NOT added by this service; the generator unions it separately
  - Fail-safe: rows with a level NOT in CEFR_ORDER are EXCLUDED (narrower set)

These tests require a real Postgres db_session (function-scoped AsyncSession at :5433).
They seed their own reference rows in the `reference.cefr_lemma` table and rely on
transaction-rollback isolation.

Expected failure mode when run before the implementation exists:
    ModuleNotFoundError: No module named 'src.services.cefr_vocabulary_service'

Each test fails individually (NOT a collection-abort) because the import is deferred
inside the helper functions rather than at module level.

===========================================================================
SEAM CONTRACT — pinned by these RED tests (executor MUST honour):

1.  ``class CefrVocabularyService`` with ``__init__(self, db: AsyncSession)``
    (per-request, mirrors FrequencyService shape).

2.  Module constants (in cefr_vocabulary_service.py OR imported into it):
      TARGET_LEVEL_DEFAULT = "B1"
      CEFR_ORDER = ("A1", "A2", "B1")

3.  ``async def allowed_lemmas(self, target_level: str = TARGET_LEVEL_DEFAULT) -> set[str]``
    returns:
      { row.lemma for row where level in CEFR_ORDER and CEFR_ORDER.index(level) <= CEFR_ORDER.index(target_level) }
      ∪ { row.lemma for row where closed_class is True }
    NOTE: the target lemma itself is NOT added by this method — the caller
    (generator._assemble_allowed_lemmas) unions it in separately.
    A level NOT in CEFR_ORDER is EXCLUDED from both arms (fail-safe narrower).

4.  Integration test seeding pattern:
      row = CefrLemma(lemma="σπίτι", level="A1", source="test", closed_class=False)
      db_session.add(row)
      await db_session.flush()
    The reference schema is present in the :5433 test DB.
    db_session rolls back per test (transaction-rollback isolation).
===========================================================================
"""

from __future__ import annotations

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import CefrLemma

# ---------------------------------------------------------------------------
# Deferred import helper — keeps the file collectable before the service exists.
# Each test that calls _get_service_class() fails with ModuleNotFoundError
# (not a collection abort) — that is the expected RED failure mode.
# ---------------------------------------------------------------------------


def _get_service_class():
    """Import and return CefrVocabularyService.

    Raises ModuleNotFoundError if the module has not been created yet.
    That is the expected RED failure mode for every test in this file.
    """
    from src.services.cefr_vocabulary_service import (  # noqa: PLC0415
        CefrVocabularyService,
    )

    return CefrVocabularyService


def _make_service(db_session: AsyncSession) -> object:
    """Return a CefrVocabularyService bound to the test session.

    Raises ModuleNotFoundError if the service module does not exist yet.
    """
    return _get_service_class()(db_session)


# ---------------------------------------------------------------------------
# Seeding helpers
# ---------------------------------------------------------------------------


async def _seed_cefr_lemma(
    db_session: AsyncSession,
    *,
    lemma: str,
    level: str,
    source: str = "test",
    closed_class: bool = False,
) -> CefrLemma:
    """Insert a single CefrLemma row and flush (not commit — rollback isolation)."""
    row = CefrLemma(lemma=lemma, level=level, source=source, closed_class=closed_class)
    db_session.add(row)
    await db_session.flush()
    return row


# ---------------------------------------------------------------------------
# Tests: Level arm — basic set membership
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.integration
@pytest.mark.db
class TestAllowedLemmasLevelArm:
    """Tests for the CEFR level arm: include rows at or below the target level."""

    async def test_allowed_lemmas_includes_at_or_below_level(
        self, db_session: AsyncSession
    ) -> None:
        """Given A1/A2/B1 rows, assemble for target=A2: A1+A2 present, B1 absent.

        task-1113 test spec: test_allowed_lemmas_includes_at_or_below_level.
        Level comparison uses CEFR_ORDER.index(); B1 has index > A2's index,
        so it must be EXCLUDED from the set when target=A2.
        """
        await _seed_cefr_lemma(db_session, lemma="σπίτι", level="A1")
        await _seed_cefr_lemma(db_session, lemma="σχολείο", level="A2")
        await _seed_cefr_lemma(db_session, lemma="πόλη", level="B1")

        svc = _make_service(db_session)
        result = await svc.allowed_lemmas(target_level="A2")

        assert "σπίτι" in result, "A1 lemma must be included when target=A2"
        assert "σχολείο" in result, "A2 lemma must be included when target=A2"
        assert "πόλη" not in result, "B1 lemma must be EXCLUDED when target=A2"

    async def test_target_level_is_b1_constant(self, db_session: AsyncSession) -> None:
        """Default call (no explicit target) includes all A1+A2+B1 rows.

        task-1113 test spec: test_target_level_is_b1_constant.
        TARGET_LEVEL_DEFAULT = "B1" so the default call includes every row
        at or below B1. There is NO per-lemma cefr_lemma lookup in v1 (D11, F2).
        """
        await _seed_cefr_lemma(db_session, lemma="σπίτι", level="A1")
        await _seed_cefr_lemma(db_session, lemma="σχολείο", level="A2")
        await _seed_cefr_lemma(db_session, lemma="πόλη", level="B1")

        svc = _make_service(db_session)
        result = await svc.allowed_lemmas()  # default target=B1

        assert "σπίτι" in result, "A1 lemma must be present when default B1 target"
        assert "σχολείο" in result, "A2 lemma must be present when default B1 target"
        assert "πόλη" in result, "B1 lemma must be present when default B1 target"

    async def test_unknown_level_excluded_failsafe(self, db_session: AsyncSession) -> None:
        """A row with level='C1' (not in CEFR_ORDER) is EXCLUDED (fail-safe narrower).

        task-1113 test spec: test_unknown_level_excluded_failsafe.
        D12: a level NOT in CEFR_ORDER is excluded, never silently widened.
        The level arm's CEFR_ORDER.index(level) call would raise ValueError for
        an unknown level — the implementation must guard against this by checking
        membership in CEFR_ORDER first and excluding non-members.
        """
        await _seed_cefr_lemma(db_session, lemma="υποθετικό", level="C1", closed_class=False)
        # Also seed a known-level row to confirm the query still works.
        await _seed_cefr_lemma(db_session, lemma="σπίτι", level="A1")

        svc = _make_service(db_session)
        result = await svc.allowed_lemmas()  # default B1 target

        assert (
            "υποθετικό" not in result
        ), "C1 lemma must be EXCLUDED (fail-safe: unknown level not in CEFR_ORDER)"
        assert "σπίτι" in result, "A1 lemma must still be present"


# ---------------------------------------------------------------------------
# Tests: Closed-class arm
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.integration
@pytest.mark.db
class TestAllowedLemmasClosedClassArm:
    """Tests for the closed-class arm: always include rows where closed_class is True."""

    async def test_allowed_lemmas_includes_closed_class(self, db_session: AsyncSession) -> None:
        """A closed_class=True row at level='C1' (above target) IS present.

        task-1113 test spec: test_allowed_lemmas_includes_closed_class.
        CRITICAL design (D13): the closed-class row is stored at C1 deliberately
        so the level arm CANNOT include it (C1 is not in CEFR_ORDER → excluded
        by the fail-safe). Only the closed_class arm can include it.
        This confirms the closed-class arm is load-bearing, not shadowed by
        the level arm (as it would be if the row were stored at A1/A2/B1).
        """
        # Closed-class row at C1 — level arm excludes it; closed-class arm must include it.
        await _seed_cefr_lemma(
            db_session,
            lemma="ο",  # a Greek article — a canonical closed-class function word
            level="C1",
            closed_class=True,
        )

        svc = _make_service(db_session)
        result = await svc.allowed_lemmas()  # default B1 target

        assert "ο" in result, (
            "closed_class=True row at C1 must be included via the closed-class arm "
            "(level arm would exclude C1 — this proves closed_class arm is load-bearing)"
        )


# ---------------------------------------------------------------------------
# Tests: Target lemma union (handled by generator, NOT by this service)
# ---------------------------------------------------------------------------
# NOTE: test_allowed_lemmas_includes_target_lemma is exercised at the GENERATOR
# level (test_lexgen_generator_service.py) because CefrVocabularyService.allowed_lemmas()
# does NOT add the target lemma itself — that union is done in
# LexgenGeneratorService._assemble_allowed_lemmas(). The integration test below
# confirms this by verifying a lemma absent from cefr_lemma is NOT magically
# in the service's result set (forcing the generator to add it explicitly).
#
# The task-1113 spec for test_allowed_lemmas_includes_target_lemma says:
#   "given target lemma NOT in cefr_lemma, assemble for target → target lemma is in set"
# This is satisfied by the generator's _assemble_allowed_lemmas, tested in
# test_lexgen_generator_service_09_03.py (unit, mocked service).


@pytest.mark.asyncio
@pytest.mark.integration
@pytest.mark.db
class TestAllowedLemmasTargetLemma:
    """The target lemma union is the generator's responsibility (not the service's)."""

    async def test_service_does_not_magically_include_absent_lemma(
        self, db_session: AsyncSession
    ) -> None:
        """A lemma absent from cefr_lemma and not closed_class is NOT in the result.

        This confirms CefrVocabularyService is a pure DB query (no magic union).
        The generator's _assemble_allowed_lemmas unions the target lemma on top.
        """
        # Do NOT seed "αγνωστολεξία" — it is the absent lemma.
        await _seed_cefr_lemma(db_session, lemma="σπίτι", level="A1")

        svc = _make_service(db_session)
        result = await svc.allowed_lemmas()

        assert "αγνωστολεξία" not in result, (
            "Absent lemma must NOT appear in the service result — "
            "the generator adds it via union, not the service"
        )
