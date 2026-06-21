"""Adversarial / edge / negative integration tests for LEXGEN-09-03:
CefrVocabularyService.allowed_lemmas().

These tests supplement the 5 AC tests in test_cefr_vocabulary_service.py.
They target edge cases NOT covered by the AC set:
  - Empty cefr_lemma table → empty set (no crash)
  - Arm overlap: closed_class=True row that is ALSO A1 → appears exactly once (dedup)
  - Explicit lower target (A1) → only A1 + closed-class; A2/B1 excluded
  - Unknown target (C2) → falls back to B1 (A1+A2+B1 returned, no crash)
  - B1 open-class row IS included at the default target (off-by-one guard)
  - Idempotency: calling allowed_lemmas() twice returns the same set (no side effects)

All tests require a real Postgres db_session (function-scoped AsyncSession at :5433).
Transaction-rollback isolation — each test seeds its own rows.
"""

from __future__ import annotations

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import CefrLemma

# ---------------------------------------------------------------------------
# Deferred import helpers (same pattern as the AC test file)
# ---------------------------------------------------------------------------


def _get_service_class():
    from src.services.cefr_vocabulary_service import CefrVocabularyService  # noqa: PLC0415

    return CefrVocabularyService


def _make_service(db_session: AsyncSession) -> object:
    return _get_service_class()(db_session)


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
# Adversarial: empty table
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.integration
@pytest.mark.db
class TestEmptyTable:
    """allowed_lemmas() must not crash when cefr_lemma is empty."""

    async def test_empty_table_returns_empty_set(self, db_session: AsyncSession) -> None:
        """No rows seeded → allowed_lemmas() returns set(), no exception.

        Guards against: query crash, None return, or exception on empty result.
        The generator's _assemble_allowed_lemmas unions the target lemma on top of
        this empty set — that is tested at the unit level, not here.
        """
        # Do NOT seed any rows — table is empty for this test's transaction.
        svc = _make_service(db_session)
        result = await svc.allowed_lemmas()

        assert isinstance(result, set), f"Expected set, got {type(result)}"
        assert len(result) == 0, (
            "Empty cefr_lemma table must yield an empty set from allowed_lemmas(), "
            "not a crash or non-empty result"
        )


# ---------------------------------------------------------------------------
# Adversarial: arm overlap — closed_class row that is ALSO A1
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.integration
@pytest.mark.db
class TestArmOverlap:
    """A closed_class=True A1 row satisfies BOTH arms — must appear exactly once.

    This tests the set dedup: OR arms in SQL can never double-count because DISTINCT
    is implicit in the unique-lemma design, but verifies the result is a set[str]
    with no duplicates and the lemma is present regardless of which arm matched.
    """

    async def test_closed_class_a1_appears_once(self, db_session: AsyncSession) -> None:
        """A row that is both closed_class=True AND level=A1 appears exactly once.

        Level arm matches (A1 ≤ B1 target) AND closed-class arm matches.
        The result set must contain the lemma exactly once — Python set dedup
        prevents double-count, and the SQL IN+OR already collapses duplicates.
        """
        await _seed_cefr_lemma(
            db_session,
            lemma="και",
            level="A1",
            closed_class=True,  # both arms match
        )
        # Seed a non-overlapping A2 row so we can confirm the query still runs.
        await _seed_cefr_lemma(db_session, lemma="σπίτι", level="A2", closed_class=False)

        svc = _make_service(db_session)
        result = await svc.allowed_lemmas()

        assert "και" in result, "Closed-class A1 lemma must be present in the result"
        assert "σπίτι" in result, "A2 lemma must also be present at default B1 target"

        # Convert to list to verify no duplicate entries; set dedup handles this
        # at the Python level — but the count-in-set is always 0 or 1 by definition.
        result_list = list(result)
        count = result_list.count("και")
        assert count == 1, (
            f"'και' must appear exactly once in the result (got {count}); "
            "arm overlap (level arm ∩ closed-class arm) must not cause double-count"
        )

    async def test_closed_class_a1_present_when_target_is_a1(
        self, db_session: AsyncSession
    ) -> None:
        """Overlap row is still present when the target is explicitly A1.

        Confirms the closed-class arm includes it even when the level arm also
        includes it at A1 target (both arms still match — no exclusion).
        """
        await _seed_cefr_lemma(
            db_session,
            lemma="ο",
            level="A1",
            closed_class=True,
        )

        svc = _make_service(db_session)
        result = await svc.allowed_lemmas(target_level="A1")

        assert "ο" in result, "Overlap row (A1 + closed-class) must be present when target=A1"


# ---------------------------------------------------------------------------
# Adversarial: explicit lower target level (A1)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.integration
@pytest.mark.db
class TestLowerTargetLevel:
    """allowed_lemmas(target_level="A1") must exclude A2 and B1 open-class rows.

    Proves the level arm is genuinely parameterized (the generator hardcodes B1
    but the service must filter correctly for any target in CEFR_ORDER).
    """

    async def test_a1_target_excludes_a2_and_b1_open_class(self, db_session: AsyncSession) -> None:
        """target_level="A1": A1 open-class present; A2/B1 open-class absent; closed-class present.

        This is the most important parameterization guard: even though the generator
        hardcodes B1, the service level arm must respect any explicit target_level
        argument so it does not silently widen the set.
        """
        await _seed_cefr_lemma(db_session, lemma="ναι", level="A1", closed_class=False)
        await _seed_cefr_lemma(db_session, lemma="σπίτι", level="A2", closed_class=False)
        await _seed_cefr_lemma(db_session, lemma="πόλη", level="B1", closed_class=False)
        await _seed_cefr_lemma(db_session, lemma="ο", level="C1", closed_class=True)

        svc = _make_service(db_session)
        result = await svc.allowed_lemmas(target_level="A1")

        assert "ναι" in result, "A1 lemma must be included when target=A1"
        assert "ο" in result, "closed_class=True must be included regardless of target level"
        assert "σπίτι" not in result, "A2 lemma must be EXCLUDED when target=A1"
        assert "πόλη" not in result, "B1 lemma must be EXCLUDED when target=A1"


# ---------------------------------------------------------------------------
# Adversarial: unknown target level falls back to B1
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.integration
@pytest.mark.db
class TestUnknownTargetFallback:
    """allowed_lemmas("C2") or any level NOT in CEFR_ORDER falls back to B1 (D12)."""

    async def test_c2_target_falls_back_to_b1(self, db_session: AsyncSession) -> None:
        """target_level="C2" is not in CEFR_ORDER → fail-safe replaces with B1.

        The returned set must contain A1+A2+B1 rows (same as default target=B1)
        and must NOT crash with a ValueError from CEFR_ORDER.index("C2").
        """
        await _seed_cefr_lemma(db_session, lemma="σπίτι", level="A1")
        await _seed_cefr_lemma(db_session, lemma="σχολείο", level="A2")
        await _seed_cefr_lemma(db_session, lemma="πόλη", level="B1")
        # Seed a real C1 row — it must NOT appear (C1 not in CEFR_ORDER level arm)
        await _seed_cefr_lemma(db_session, lemma="υποθετικό", level="C1", closed_class=False)

        svc = _make_service(db_session)

        # Must NOT raise ValueError / KeyError — fail-safe handles it.
        result = await svc.allowed_lemmas(target_level="C2")

        assert "σπίτι" in result, "A1 row must be present after C2 fallback to B1"
        assert "σχολείο" in result, "A2 row must be present after C2 fallback to B1"
        assert "πόλη" in result, "B1 row must be present after C2 fallback to B1"
        assert "υποθετικό" not in result, (
            "C1 open-class row must still be absent (C1 not in CEFR_ORDER level arm, "
            "closed_class=False so closed-class arm also excludes it)"
        )

    async def test_completely_unknown_level_string_no_crash(self, db_session: AsyncSession) -> None:
        """target_level="GARBAGE" (arbitrary string) must not crash.

        Guards the D12 fail-safe against any arbitrary input the caller might pass.
        Result must be the B1 fallback set (or empty if no rows seeded).
        """
        await _seed_cefr_lemma(db_session, lemma="σπίτι", level="A1")

        svc = _make_service(db_session)
        # Must NOT raise.
        result = await svc.allowed_lemmas(target_level="GARBAGE")

        assert isinstance(result, set), f"Expected set, got {type(result)}"
        assert "σπίτι" in result, "A1 row must be present — GARBAGE target falls back to B1"


# ---------------------------------------------------------------------------
# Adversarial: B1 open-class row at default target (off-by-one guard)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.integration
@pytest.mark.db
class TestB1IncludedAtDefaultTarget:
    """B1 open-class rows must be included when target is B1 (the default).

    Guards against an off-by-one error in CEFR_ORDER[:index+1] slicing that
    could drop the target level itself (e.g., using index instead of index+1).
    """

    async def test_b1_row_included_at_default_b1_target(self, db_session: AsyncSession) -> None:
        """A B1 open-class row IS included in the default allowed_lemmas() call.

        If the slicing were CEFR_ORDER[:index] (off-by-one), B1 would be dropped.
        This test fails with that bug.
        """
        await _seed_cefr_lemma(db_session, lemma="πόλη", level="B1", closed_class=False)
        # Also seed A1 to confirm the overall query works.
        await _seed_cefr_lemma(db_session, lemma="σπίτι", level="A1", closed_class=False)

        svc = _make_service(db_session)
        result = await svc.allowed_lemmas()  # default B1

        assert "πόλη" in result, (
            "B1 open-class row must be in the result when target is B1 (the default). "
            "Slicing must use CEFR_ORDER[:index+1], not CEFR_ORDER[:index]."
        )
        assert "σπίτι" in result, "A1 row must also be present"


# ---------------------------------------------------------------------------
# Adversarial: idempotency / no side effects
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.integration
@pytest.mark.db
class TestIdempotency:
    """Calling allowed_lemmas() twice must yield the same set (no mutation)."""

    async def test_allowed_lemmas_idempotent(self, db_session: AsyncSession) -> None:
        """Two consecutive calls to allowed_lemmas() return identical sets.

        Guards against any side effect (e.g., DB mutation, set mutation) that
        would cause divergent results across calls. The service is a pure read.
        """
        await _seed_cefr_lemma(db_session, lemma="σπίτι", level="A1")
        await _seed_cefr_lemma(db_session, lemma="και", level="A1", closed_class=True)
        await _seed_cefr_lemma(db_session, lemma="πόλη", level="B1")

        svc = _make_service(db_session)

        first_result = await svc.allowed_lemmas()
        second_result = await svc.allowed_lemmas()

        assert first_result == second_result, (
            "Two consecutive allowed_lemmas() calls must return identical sets. "
            "The method must be a pure read with no side effects."
        )
