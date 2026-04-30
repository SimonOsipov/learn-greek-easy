"""Property tests locking in the architectural invariants of the gamification rewrite.

These tests serve as the regression net for every subsequent phase (GAMIF-02 through GAMIF-05).
They must remain green throughout the entire rewrite.

Invariants tested:
1. Idempotency: reconcile(reconcile(state)) == reconcile(state) — Hypothesis-driven
2. Exhaustiveness: every AchievementMetric value is present in snapshot.metrics
3. Unlocked equality: projection.unlocked == stored UserAchievement set after reconcile+commit
4. No-silent-zero: MetricValues raises KeyError on missing metric
5. XP-sum: xfail until GAMIF-05 cutover
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from hypothesis import HealthCheck, given, settings
from hypothesis import strategies as st
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import (
    Achievement,
    AchievementCategory,
    CardRecord,
    CardRecordReview,
    CardRecordStatistics,
    CardStatus,
    CardType,
    CultureAnswerHistory,
    CultureDeck,
    CultureQuestion,
    Deck,
    DeckLevel,
    PartOfSpeech,
    User,
    UserAchievement,
    WordEntry,
)
from src.services.achievement_definitions import AchievementMetric
from src.services.gamification.projection import GamificationProjection
from src.services.gamification.reconciler import GamificationReconciler
from src.services.gamification.types import MetricValues, ReconcileMode

# =============================================================================
# Seed helpers (inline — single-use, no factory module needed)
# =============================================================================

_SENTINEL_ACHIEVEMENT_ID = "learning_first_word"


async def _ensure_achievement(db: AsyncSession, ach_id: str, xp_reward: int = 10) -> None:
    """Insert an Achievement row if it does not already exist (required for UserAchievement FK)."""
    existing = await db.execute(select(Achievement).where(Achievement.id == ach_id))
    if existing.scalar_one_or_none() is None:
        ach = Achievement(
            id=ach_id,
            name=ach_id.replace("_", " ").title(),
            description=f"Seeded by test: {ach_id}",
            category=AchievementCategory.LEARNING,
            icon="star",
            threshold=1,
            xp_reward=xp_reward,
            sort_order=0,
        )
        db.add(ach)
        await db.flush()


async def _make_user(db: AsyncSession) -> User:
    user = User(email=f"invariant_test_{uuid4().hex[:8]}@example.com", is_active=True)
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


async def _make_deck(db: AsyncSession) -> Deck:
    deck = Deck(
        name_el="Δοκιμή",
        name_en="Test Deck",
        name_ru="Тест",
        description_el="desc",
        description_en="desc",
        description_ru="desc",
        level=DeckLevel.A1,
        is_active=True,
    )
    db.add(deck)
    await db.flush()
    await db.refresh(deck)
    return deck


async def _make_card(db: AsyncSession, deck_id: object) -> CardRecord:
    word = WordEntry(
        owner_id=None,
        lemma=f"test_{uuid4().hex[:8]}",
        part_of_speech=PartOfSpeech.NOUN,
        translation_en="test",
        is_active=True,
    )
    db.add(word)
    await db.flush()
    card = CardRecord(
        deck_id=deck_id,
        word_entry_id=word.id,
        card_type=CardType.MEANING_EL_TO_EN,
        variant_key="default",
        front_content={"el": "word"},
        back_content={"en": "meaning"},
        is_active=True,
    )
    db.add(card)
    await db.flush()
    await db.refresh(card)
    return card


async def _make_culture_question(db: AsyncSession) -> CultureQuestion:
    deck = CultureDeck(
        name_en="Test Deck",
        name_el="Δεκ",
        name_ru="Дек",
        description_en="test",
        description_el="test",
        description_ru="test",
        category="history",
        is_active=True,
    )
    db.add(deck)
    await db.flush()

    question = CultureQuestion(
        deck_id=deck.id,
        question_text={"en": "Test?", "el": "Τεστ;"},
        option_a={"en": "A", "el": "Α"},
        option_b={"en": "B", "el": "Β"},
        option_c={"en": "C", "el": "Γ"},
        option_d={"en": "D", "el": "Δ"},
        correct_option=1,
    )
    db.add(question)
    await db.flush()
    await db.refresh(question)
    return question


async def seed_minimal_user(db: AsyncSession) -> User:
    """Fresh user with zero activity — used for exhaustiveness test."""
    return await _make_user(db)


async def seed_user_with_activity(db: AsyncSession, activity: dict) -> User:
    """Create a user and seed activity rows per activity dict.

    activity keys:
      review_count: int — total CardRecordReview rows
      mastered_count: int — CardRecordStatistics rows with MASTERED status
      culture_correct: int — correct CultureAnswerHistory rows
      culture_total: int — total CultureAnswerHistory rows (correct + incorrect)
      streak_days: int — consecutive daily reviews ending today
      session_count: int — (unused by current projection; kept for strategy completeness)
    """
    user = await _make_user(db)

    review_count: int = activity["review_count"]
    mastered_count: int = activity["mastered_count"]
    culture_correct: int = activity["culture_correct"]
    culture_total: int = activity["culture_total"]
    streak_days: int = activity["streak_days"]

    # Ensure mastered_count doesn't exceed review_count for coherence
    mastered_count = min(mastered_count, review_count)
    # Ensure correct <= total for culture
    culture_correct = min(culture_correct, culture_total)

    if review_count > 0 or mastered_count > 0:
        deck = await _make_deck(db)
        total_cards = max(review_count, mastered_count)
        cards = [await _make_card(db, deck.id) for _ in range(total_cards)]

        # Seed mastered stats
        for i in range(mastered_count):
            stats = CardRecordStatistics(
                user_id=user.id,
                card_record_id=cards[i].id,
                easiness_factor=2.5,
                interval=1,
                repetitions=1,
                next_review_date=datetime.now(timezone.utc).date(),
                status=CardStatus.MASTERED,
            )
            db.add(stats)

        # Seed reviews (spread across unique cards where possible)
        now = datetime.now(timezone.utc)
        for i in range(review_count):
            card_idx = i % len(cards)
            review = CardRecordReview(
                user_id=user.id,
                card_record_id=cards[card_idx].id,
                quality=4,
                time_taken=10,
                reviewed_at=now - timedelta(hours=i),
            )
            db.add(review)

        await db.flush()

    # Seed streak: consecutive daily reviews on a single card
    if streak_days > 0:
        if review_count == 0:
            # Need a card to attach streak reviews to
            deck = await _make_deck(db)
            streak_card = await _make_card(db, deck.id)
        else:
            # Re-use first card from above (already in DB)
            deck2 = await _make_deck(db)
            streak_card = await _make_card(db, deck2.id)

        today = datetime.now(timezone.utc)
        for day_offset in range(streak_days):
            ts = today - timedelta(days=day_offset)
            review = CardRecordReview(
                user_id=user.id,
                card_record_id=streak_card.id,
                quality=4,
                time_taken=10,
                reviewed_at=ts,
            )
            db.add(review)
        await db.flush()

    # Seed culture answers
    if culture_total > 0:
        question = await _make_culture_question(db)
        now = datetime.now(timezone.utc)
        for i in range(culture_total):
            is_correct = i < culture_correct
            answer = CultureAnswerHistory(
                user_id=user.id,
                question_id=question.id,
                language="en",
                is_correct=is_correct,
                selected_option=1,
                time_taken_seconds=10,
                deck_category="history",
                created_at=now - timedelta(minutes=i),
            )
            db.add(answer)
        await db.flush()

    return user


async def seed_user_with_lots_of_activity(db: AsyncSession) -> User:
    """User that crosses multiple achievement thresholds.

    Specifically:
    - 5 mastered cards (crosses learning_first_word threshold=1)
    - 7-day streak of reviews (crosses streak_first_flame=3, streak_warming_up=7)
    - 25 culture answers (crosses culture_curious=10)
    """
    activity = {
        "review_count": 10,
        "mastered_count": 5,
        "culture_correct": 20,
        "culture_total": 25,
        "streak_days": 7,
        "session_count": 3,
    }
    user = await seed_user_with_activity(db, activity)

    # Seed the Achievement rows that the reconciler will try to insert UserAchievement for.
    # The reconciler reads ACHIEVEMENTS from achievement_definitions and inserts based on
    # what the projection reports as unlocked. We pre-seed commonly hit achievements so
    # the FK constraint is satisfied.
    achievement_ids_to_seed = [
        ("learning_first_word", 10),
        ("streak_first_flame", 25),
        ("streak_warming_up", 50),
        ("culture_curious", 25),
    ]
    for ach_id, xp in achievement_ids_to_seed:
        await _ensure_achievement(db, ach_id, xp)

    return user


async def read_user_achievements(db: AsyncSession, user_id: object) -> set[str]:
    """Return the set of achievement IDs stored for user_id."""
    result = await db.execute(
        select(UserAchievement.achievement_id).where(UserAchievement.user_id == user_id)
    )
    return set(result.scalars().all())


# =============================================================================
# Hypothesis strategy
# =============================================================================

activity_strategy = st.fixed_dictionaries(
    {
        "review_count": st.integers(min_value=0, max_value=200),
        "mastered_count": st.integers(min_value=0, max_value=50),
        "culture_correct": st.integers(min_value=0, max_value=20),
        "culture_total": st.integers(min_value=0, max_value=40),
        "streak_days": st.integers(min_value=0, max_value=30),
        "session_count": st.integers(min_value=0, max_value=10),
    }
)


# =============================================================================
# Tests
# =============================================================================


@pytest.mark.unit
@settings(
    max_examples=20,
    suppress_health_check=[HealthCheck.too_slow, HealthCheck.function_scoped_fixture],
)
@given(activity=activity_strategy)
async def test_idempotency_property(activity: dict, db_session: AsyncSession) -> None:
    """reconcile(reconcile(state)) == reconcile(state).

    Calling reconcile twice with no intervening activity must produce an empty
    diff on the second call. Tested against 20 random activity profiles.
    """
    # NOTE: do not commit between phases. The db_session fixture wraps every
    # test in a savepoint that rolls back on teardown; commit() inside the
    # savepoint releases it and breaks Hypothesis re-entry (concurrent
    # operations on the same connection across examples). flush() is enough
    # for in-transaction visibility, which is what reconcile + projection need.
    user = await seed_user_with_activity(db_session, activity)
    await db_session.flush()

    await GamificationReconciler.reconcile(db_session, user.id, ReconcileMode.QUIET)
    await db_session.flush()

    r2 = await GamificationReconciler.reconcile(db_session, user.id, ReconcileMode.QUIET)

    assert (
        r2.new_unlocks == []
    ), f"Second reconcile should produce no new unlocks, got: {r2.new_unlocks}"
    assert r2.total_xp_before == r2.total_xp_after, "XP should be stable after first reconcile"


@pytest.mark.unit
async def test_exhaustiveness_every_metric_in_snapshot(db_session: AsyncSession) -> None:
    """Every value of AchievementMetric must be a key in snapshot.metrics.

    Adding a new metric to the enum without adding a computation breaks this test,
    protecting against the silent-zero pattern.
    """
    user = await seed_minimal_user(db_session)
    await db_session.flush()

    snap = await GamificationProjection.compute(db_session, user.id)

    for metric in AchievementMetric:
        assert metric in snap.metrics, f"Metric {metric} missing from projection — silent-zero risk"


@pytest.mark.unit
async def test_unlocked_equality_after_reconcile(db_session: AsyncSession) -> None:
    """projection.unlocked == {a.achievement_id for a in UserAchievement} after reconcile+commit."""
    user = await seed_user_with_lots_of_activity(db_session)
    await db_session.flush()

    await GamificationReconciler.reconcile(db_session, user.id, ReconcileMode.QUIET)
    await db_session.flush()

    snap = await GamificationProjection.compute(db_session, user.id)
    stored = await read_user_achievements(db_session, user.id)

    assert snap.unlocked == frozenset(
        stored
    ), f"Projection unlocks {snap.unlocked} != stored {stored}"


@pytest.mark.unit
def test_no_silent_metric_zero() -> None:
    """MetricValues raises KeyError on missing metric (NOT silent zero).

    This is a pure in-memory test — no DB required.
    """
    mv = MetricValues({AchievementMetric.CARDS_LEARNED: 5})
    with pytest.raises(KeyError):
        _ = mv[AchievementMetric.STREAK_DAYS]


@pytest.mark.xfail(
    reason="XPTransaction sum will diverge from UserXP.total_xp until GAMIF-05 cutover"
)
@pytest.mark.unit
async def test_xp_cache_matches_transaction_sum() -> None:
    """projection.total_xp == sum(XPTransaction.amount where user_id=x). Holds after Phase 5."""
    # Implementation deferred to GAMIF-05.
    pass
