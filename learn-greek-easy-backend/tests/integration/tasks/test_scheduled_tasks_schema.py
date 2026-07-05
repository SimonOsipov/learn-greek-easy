"""Real-schema integration tests for the daily scheduler jobs (OPS-01-04).

These tests exercise ``streak_reset_task`` and ``stats_aggregate_task`` against
the REAL test PostgreSQL schema (built from ``src.db.models``), NOT against a
mocked session. The mocked unit tests in
``tests/unit/tasks/test_stats_aggregate.py`` and
``tests/unit/tasks/test_streak_reset.py`` (and the smoke tests in
``tests/unit/tasks/test_scheduler.py``) patch ``session.execute`` with an
``AsyncMock``, so the dead-table SQL passes there — a FALSE GREEN. Only a
real-schema run surfaces the ``asyncpg`` ``UndefinedTableError`` /
``UndefinedColumnError`` these jobs raise every day in prod.

RED (pre-fix) oracle — the current ``src/tasks/scheduled.py`` references
pre-rename tables/columns that DO NOT exist in the model-built schema:

  streak_reset_task (~L67):
      ``FROM reviews``                 -> relation "reviews" does not exist
  stats_aggregate_task review query (~L290-L291):
      ``COUNT(DISTINCT r.card_id)``    -> column r.card_id does not exist
      ``FROM reviews r``               -> relation "reviews" does not exist
  stats_aggregate_task mastery query (~L308):
      ``FROM card_statistics cs``      -> relation "card_statistics" does not exist

The reconciled objects are ``card_record_reviews`` / ``card_record_statistics``
with ``card_record_id`` replacing ``card_id`` (verified 1:1 in prod). The
``status = 'MASTERED'`` literal is unchanged (uppercase enum NAME).

Two-session note
----------------
Both tasks open their OWN session via ``get_session_factory()()``
(``src/db/session.py``), which is UNINITIALISED under test (``_session_factory``
is ``None`` -> ``RuntimeError``). We therefore patch
``src.tasks.scheduled.get_session_factory`` in two distinct ways:

* Smoke tests bind it to a REAL fresh session on the shared test engine
  (``create_test_session_factory(db_engine)``). The jobs are read-only
  (``SELECT`` + an empty ``commit``), so this pollutes nothing and needs no
  seeded rows: PostgreSQL validates every table/column reference at PLAN time,
  so the dead-table SQL raises even against empty tables.

* Row-flow tests route the task onto the test's own ``db_session`` so the
  savepoint-isolated seeded rows are visible in the SAME transaction — this is
  the cross-session FK-visibility caveat the gamification precedent
  (``test_scheduled_gamification_integration.py``) documents: the task's own
  asyncpg connection cannot see data a savepoint-based session has written but
  not committed. Each such test triggers exactly ONE task ``commit`` on
  ``db_session``, within its documented one-commit contract.

The ``caplog_loguru`` fixture formats records as ``{message}`` only, so the
positive assertions target the literal MESSAGE strings the tasks emit — a
message only appears when the reconciled query resolves against the real schema
AND the seeded row flows through the aggregate.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import date, datetime, time, timedelta, timezone
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from src.db.models import (
    CardRecord,
    CardRecordReview,
    CardRecordStatistics,
    CardStatus,
    CardType,
    Deck,
    DeckLevel,
    DeckWordEntry,
    PartOfSpeech,
    WordEntry,
)
from src.tasks.scheduled import stats_aggregate_task, streak_reset_task
from tests.factories.auth import UserFactory
from tests.fixtures.database import create_test_session_factory

_SCHEDULED = "src.tasks.scheduled.get_session_factory"


def _utc_noon(day: date) -> datetime:
    """Noon (UTC) on ``day`` — avoids day-boundary flakiness in DATE() bucketing."""
    return datetime.combine(day, time(12, 0, 0), tzinfo=timezone.utc)


def _patch_real_session(db_engine: AsyncEngine):
    """Route the task onto a REAL fresh session on the test engine.

    ``get_session_factory()()`` -> a live AsyncSession on a NullPool connection
    against the committed test schema. Used by the smoke tests: the jobs are
    read-only so the empty commit pollutes nothing, and the dead-table SQL still
    raises at plan time against empty tables.
    """
    return patch(_SCHEDULED, return_value=create_test_session_factory(db_engine))


def _patch_shared_db_session(db_session: AsyncSession):
    """Route the task onto the test's own db_session (seeded rows are visible).

    Mirrors the mocked unit-test factory shape but yields the REAL db_session and
    does NOT close it on exit, so post-run assertions on the same transaction
    remain valid. The task performs exactly one commit — within db_session's
    one-commit contract.
    """

    @asynccontextmanager
    async def _ctx():
        yield db_session

    factory = MagicMock(return_value=_ctx())
    return patch(_SCHEDULED, return_value=factory)


async def _seed_review(
    db_session: AsyncSession,
    *,
    reviewed_at: datetime,
    mastered_updated_at: datetime | None = None,
):
    """Seed the minimal graph for a card_record_reviews row (+ optional MASTERED stat).

    Graph: User -> Deck -> WordEntry -> DeckWordEntry -> CardRecord -> CardRecordReview.
    All writes go through db_session (flush only, no commit) so they live inside
    the test's savepoint. When ``mastered_updated_at`` is given, a MASTERED
    CardRecordStatistics row is added with that ``updated_at`` to exercise the
    mastery query's ``WHERE status='MASTERED' AND DATE(updated_at)=:target_date``.

    Returns the seeded User.
    """
    user = await UserFactory.create()

    deck = Deck(
        name_en=f"Sched Deck {uuid4().hex[:6]}",
        name_el="Τεστ",
        name_ru="Тест",
        description_en="Test",
        description_el="Τεστ",
        description_ru="Тест",
        level=DeckLevel.A1,
        is_active=True,
    )
    db_session.add(deck)
    await db_session.flush()

    word = WordEntry(
        owner_id=None,
        lemma=f"λέξη_{uuid4().hex[:4]}",
        part_of_speech=PartOfSpeech.NOUN,
        translation_en="word",
        is_active=True,
    )
    db_session.add(word)
    await db_session.flush()

    db_session.add(DeckWordEntry(deck_id=deck.id, word_entry_id=word.id))
    await db_session.flush()

    card = CardRecord(
        word_entry_id=word.id,
        deck_id=deck.id,
        card_type=CardType.MEANING_EL_TO_EN,
        variant_key=f"sched_schema_{uuid4().hex[:8]}",
        front_content={"card_type": "meaning_el_to_en", "prompt": "Translate", "main": "λέξη"},
        back_content={"card_type": "meaning_el_to_en", "answer": "word"},
    )
    db_session.add(card)
    await db_session.flush()

    db_session.add(
        CardRecordReview(
            user_id=user.id,
            card_record_id=card.id,
            quality=4,
            time_taken=3000,
            reviewed_at=reviewed_at,
        )
    )

    if mastered_updated_at is not None:
        db_session.add(
            CardRecordStatistics(
                user_id=user.id,
                card_record_id=card.id,
                easiness_factor=2.5,
                interval=1,
                repetitions=2,
                next_review_date=date.today(),
                status=CardStatus.MASTERED,
                updated_at=mastered_updated_at,
            )
        )

    await db_session.flush()
    return user


# ---------------------------------------------------------------------------
# Smoke tests — the reconciled SQL must execute against the REAL schema without
# raising. RED NOW (by construction): the current dead-table SQL raises
# asyncpg.UndefinedTableError / UndefinedColumnError at plan time.
# ---------------------------------------------------------------------------


@pytest.mark.integration
@pytest.mark.asyncio
@pytest.mark.timeout(60)
class TestSchedulerJobsExecuteAgainstRealSchema:
    async def test_streak_reset_task_runs_without_undefined_table_error(
        self,
        db_engine: AsyncEngine,
        caplog_loguru,
    ) -> None:
        """streak_reset_task must run its SQL against the real schema and complete.

        RED NOW: current SQL says ``FROM reviews`` -> the model-built schema has
        NO ``reviews`` table -> asyncpg.UndefinedTableError propagates out of the
        await (the task re-raises after logging). GREEN after the executor
        rewrites it to ``FROM card_record_reviews``.
        """
        with _patch_real_session(db_engine):
            with caplog_loguru.at_level("INFO"):
                await streak_reset_task()

        # Positive completion signal: on an empty table the task takes the
        # "no broken streaks" branch and logs its completion message. If any
        # table/column reference were wrong the await above would have raised.
        assert "streak reset task complete" in caplog_loguru.text.lower()

    async def test_stats_aggregate_task_runs_without_undefined_table_error(
        self,
        db_engine: AsyncEngine,
        caplog_loguru,
    ) -> None:
        """stats_aggregate_task must run BOTH queries against the real schema.

        RED NOW: the review query hits ``FROM reviews r`` (and
        ``COUNT(DISTINCT r.card_id)``) first, then the mastery query hits
        ``FROM card_statistics cs`` — all three references are undefined in the
        model-built schema. GREEN after the executor reconciles them to
        ``card_record_reviews`` / ``card_record_id`` / ``card_record_statistics``.
        """
        with _patch_real_session(db_engine):
            with caplog_loguru.at_level("INFO"):
                await stats_aggregate_task()

        # Empty tables -> zero active users, but the task still logs its
        # aggregation-complete summary. Reaching this line proves both queries
        # planned (all table/column references resolved).
        assert "stats aggregation complete" in caplog_loguru.text.lower()


# ---------------------------------------------------------------------------
# Row-flow tests — seed known rows and prove the reconciled columns resolve to
# the RIGHT data by observing the per-row message the task only emits when a
# seeded row survives the aggregate. RED NOW: raises before it can log.
# ---------------------------------------------------------------------------


@pytest.mark.integration
@pytest.mark.asyncio
@pytest.mark.timeout(60)
class TestSchedulerJobsProcessSeededRows:
    async def test_streak_reset_flags_user_with_stale_review(
        self,
        db_session: AsyncSession,
        caplog_loguru,
    ) -> None:
        """A user whose only review is 3 days old is flagged as a broken streak.

        Proves the reconciled ``FROM card_record_reviews`` + ``reviewed_at`` /
        ``user_id`` references resolve AND the seeded row flows through
        ``MAX(DATE(reviewed_at)) < :yesterday``. RED NOW: raises
        UndefinedTableError on ``FROM reviews`` before any user is evaluated.
        """
        today = datetime.now(timezone.utc).date()
        await _seed_review(db_session, reviewed_at=_utc_noon(today - timedelta(days=3)))

        with _patch_shared_db_session(db_session):
            with caplog_loguru.at_level("INFO"):
                await streak_reset_task()

        # Positive: the "User streak broken" line is emitted only when the query
        # returns the seeded user — it cannot appear if the row was invisible or
        # the columns failed to resolve. (caplog_loguru formats {message} only,
        # so the extra user_id is not in .text — the message itself is the oracle;
        # on an unseeded/empty table the task logs "no broken streaks" instead.)
        assert "user streak broken" in caplog_loguru.text.lower()

    async def test_stats_aggregate_processes_seeded_review_and_mastery(
        self,
        db_session: AsyncSession,
        caplog_loguru,
    ) -> None:
        """A review + MASTERED stat dated yesterday flow through both aggregates.

        Proves the reconciled review query (``card_record_reviews`` with
        ``AVG(quality)`` / ``SUM(time_taken)`` / ``COUNT(DISTINCT card_record_id)``)
        AND the mastery query (``card_record_statistics`` with ``status`` /
        ``updated_at`` / ``user_id``) all resolve against the real schema and match
        the seeded rows. RED NOW: raises UndefinedTableError/UndefinedColumnError
        on the first query. GREEN after the reconcile.
        """
        yesterday = datetime.now(timezone.utc).date() - timedelta(days=1)
        await _seed_review(
            db_session,
            reviewed_at=_utc_noon(yesterday),
            mastered_updated_at=_utc_noon(yesterday),
        )

        with _patch_shared_db_session(db_session):
            with caplog_loguru.at_level("INFO"):
                await stats_aggregate_task()

        # Positive: the per-user "Daily user stats" line is emitted only for a
        # user returned by the reconciled review aggregate. Its presence proves
        # every column in the review SELECT resolved (else the query would raise)
        # AND the seeded yesterday-dated row matched the WHERE clause. The mastery
        # query is exercised in the same run (it would raise if unresolved).
        # (caplog_loguru formats {message} only; the per-user line is the oracle —
        # an empty aggregate would log only "Stats aggregation complete".)
        assert "daily user stats" in caplog_loguru.text.lower()
