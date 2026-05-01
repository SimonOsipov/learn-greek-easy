"""Integration test: reconcile-on-read self-heals stuck achievement state.

Scenario:
- User has one card with status=LEARNING (cards_learned=1 in projection).
- The `learning_first_word` achievement should be unlocked but no UserAchievement
  row exists (simulating a stuck / missed write).
- GET /api/v1/xp/achievements with flags on + percent=100 must:
  1. Return `learning_first_word` with unlocked=True.
  2. Create the UserAchievement row in the DB.
  3. Be idempotent on a second call (no duplicate row).
"""

from __future__ import annotations

from datetime import date

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.db.models import (
    Achievement,
    AchievementCategory,
    CardRecord,
    CardRecordStatistics,
    CardStatus,
    CardType,
    Deck,
    DeckLevel,
    DeckWordEntry,
    PartOfSpeech,
    UserAchievement,
    WordEntry,
)

# ---------------------------------------------------------------------------
# Local fixtures — create a full CardRecord graph for this test only
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def achievement_catalog_learning_first_word(db_session: AsyncSession) -> Achievement:
    """Seed the achievements catalog row for learning_first_word.

    The reconciler uses pg_insert(UserAchievement) which requires the parent
    achievements.id row to exist (FK constraint). Integration tests start with
    an empty DB, so this fixture creates the required catalog entry.
    """
    achievement = Achievement(
        id="learning_first_word",
        name="First Word",
        description="Learn your first card",
        category=AchievementCategory.LEARNING,
        icon="book",
        threshold=1,
        xp_reward=10,
        sort_order=0,
    )
    db_session.add(achievement)
    await db_session.flush()
    return achievement


@pytest_asyncio.fixture
async def v2_deck_for_heal(db_session: AsyncSession) -> Deck:
    """A minimal V2 deck sufficient for the projection to compute cards_learned."""
    deck = Deck(
        name_en="Self-Heal Test Deck",
        name_el="Τεστ Αυτο-Επαναφοράς",
        name_ru="Тест Самовосстановления",
        description_en="Test deck for self-heal integration",
        description_el="Τεστ",
        description_ru="Тест",
        level=DeckLevel.A1,
        is_active=True,
    )
    db_session.add(deck)
    await db_session.flush()
    await db_session.refresh(deck)
    return deck


@pytest_asyncio.fixture
async def word_entry_for_heal(db_session: AsyncSession, v2_deck_for_heal: Deck) -> WordEntry:
    """A minimal WordEntry linked to the test deck."""
    entry = WordEntry(
        owner_id=None,
        lemma="λόγος",
        part_of_speech=PartOfSpeech.NOUN,
        translation_en="word, speech",
        is_active=True,
    )
    db_session.add(entry)
    await db_session.flush()
    db_session.add(DeckWordEntry(deck_id=v2_deck_for_heal.id, word_entry_id=entry.id))
    await db_session.flush()
    await db_session.refresh(entry)
    return entry


@pytest_asyncio.fixture
async def card_record_for_heal(
    db_session: AsyncSession,
    v2_deck_for_heal: Deck,
    word_entry_for_heal: WordEntry,
) -> CardRecord:
    """A CardRecord for the test word entry."""
    record = CardRecord(
        word_entry_id=word_entry_for_heal.id,
        deck_id=v2_deck_for_heal.id,
        card_type=CardType.MEANING_EL_TO_EN,
        variant_key="self_heal_default",
        front_content={"card_type": "meaning_el_to_en", "prompt": "Translate", "main": "λόγος"},
        back_content={"card_type": "meaning_el_to_en", "answer": "word, speech"},
    )
    db_session.add(record)
    await db_session.flush()
    await db_session.refresh(record)
    return record


# ---------------------------------------------------------------------------
# Test: self-heal via GET /xp/achievements
# ---------------------------------------------------------------------------


@pytest.mark.integration
class TestReconcileSelfHeal:
    @pytest.mark.asyncio
    async def test_self_heal_learning_first_word(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_user,
        db_session: AsyncSession,
        monkeypatch: pytest.MonkeyPatch,
        card_record_for_heal: CardRecord,
        achievement_catalog_learning_first_word: Achievement,
    ) -> None:
        """Stuck achievement is created by GET /xp/achievements when flags are on.

        Setup: user has cards_learned=1 (one LEARNING card) but no
        UserAchievement row for learning_first_word (stuck state).

        Expected: endpoint returns learning_first_word with unlocked=True,
        and the DB row is created.
        """
        # Seed: one card with LEARNING status for the test user (cards_learned=1)
        stat = CardRecordStatistics(
            user_id=test_user.id,
            card_record_id=card_record_for_heal.id,
            easiness_factor=2.36,
            interval=1,
            repetitions=2,
            next_review_date=date.today(),
            status=CardStatus.LEARNING,
        )
        db_session.add(stat)
        await db_session.flush()

        # Confirm no UserAchievement row yet for learning_first_word
        result = await db_session.execute(
            select(UserAchievement).where(
                UserAchievement.user_id == test_user.id,
                UserAchievement.achievement_id == "learning_first_word",
            )
        )
        assert (
            result.scalar_one_or_none() is None
        ), "Pre-condition failed: UserAchievement should not exist before test"

        # Enable flags
        monkeypatch.setattr(settings, "gamification_reconcile_on_read", True)
        monkeypatch.setattr(settings, "gamification_reconcile_rollout_percent", 100)

        # Call the endpoint — reconcile should fire and self-heal
        response = await client.get("/api/v1/xp/achievements", headers=auth_headers)
        assert response.status_code == 200

        data = response.json()
        achievements_by_id = {a["id"]: a for a in data["achievements"]}
        assert (
            "learning_first_word" in achievements_by_id
        ), "learning_first_word achievement missing from response"
        assert (
            achievements_by_id["learning_first_word"]["unlocked"] is True
        ), "learning_first_word should be unlocked after self-heal"

        # Verify DB row was created
        db_session.expire_all()
        result = await db_session.execute(
            select(UserAchievement).where(
                UserAchievement.user_id == test_user.id,
                UserAchievement.achievement_id == "learning_first_word",
            )
        )
        ua_row = result.scalar_one_or_none()
        assert ua_row is not None, "UserAchievement row must exist in DB after reconcile"

        # Second call must be idempotent — no duplicate rows
        response2 = await client.get("/api/v1/xp/achievements", headers=auth_headers)
        assert response2.status_code == 200

        db_session.expire_all()
        result2 = await db_session.execute(
            select(UserAchievement).where(
                UserAchievement.user_id == test_user.id,
                UserAchievement.achievement_id == "learning_first_word",
            )
        )
        rows = result2.scalars().all()
        assert (
            len(rows) == 1
        ), f"Idempotency failed: expected 1 UserAchievement row, got {len(rows)}"
