"""Unit tests for CardRecordStatisticsRepository.get_cefr_completion.

Covers:
- empty user (no stats): all levels return (0, total_active)
- mixed mastery across A1/A2/B1/B2 levels
- inactive deck/card exclusion
"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import (
    CardRecord,
    CardRecordStatistics,
    CardStatus,
    CardType,
    Deck,
    DeckLevel,
    DeckWordEntry,
    PartOfSpeech,
    User,
    WordEntry,
)
from src.repositories.card_record_statistics import CardRecordStatisticsRepository

# =============================================================================
# Helpers
# =============================================================================


async def _make_deck(
    db_session: AsyncSession,
    level: DeckLevel,
    *,
    is_active: bool = True,
) -> Deck:
    deck = Deck(
        name_en=f"CEFR Test Deck {level.value}",
        name_el=f"Δεκ {level.value}",
        name_ru=f"Дек {level.value}",
        description_en="test",
        description_el="test",
        description_ru="test",
        level=level,
        is_active=is_active,
    )
    db_session.add(deck)
    await db_session.flush()
    await db_session.refresh(deck)
    return deck


async def _make_card(
    db_session: AsyncSession,
    deck: Deck,
    *,
    is_active: bool = True,
) -> CardRecord:
    word = WordEntry(
        owner_id=None,
        lemma="test",
        part_of_speech=PartOfSpeech.NOUN,
        translation_en="test",
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
        variant_key=f"v_{deck.id}_{is_active}",
        front_content={"prompt": "test"},
        back_content={"answer": "test"},
        is_active=is_active,
    )
    db_session.add(card)
    await db_session.flush()
    await db_session.refresh(card)
    return card


async def _make_stats(
    db_session: AsyncSession,
    user: User,
    card: CardRecord,
    status: CardStatus,
) -> CardRecordStatistics:
    from datetime import date

    stats = CardRecordStatistics(
        user_id=user.id,
        card_record_id=card.id,
        easiness_factor=2.5,
        interval=0,
        repetitions=0,
        next_review_date=date.today(),
        status=status,
    )
    db_session.add(stats)
    await db_session.flush()
    await db_session.refresh(stats)
    return stats


# =============================================================================
# Tests
# =============================================================================


class TestGetCefrCompletion:
    @pytest.mark.asyncio
    async def test_empty_user_all_levels_zero_mastered(
        self,
        db_session: AsyncSession,
        sample_user: User,
    ) -> None:
        """User with no stats → mastered=0 for all levels; totals reflect active cards."""
        a1_deck = await _make_deck(db_session, DeckLevel.A1)
        await _make_card(db_session, a1_deck)
        await _make_card(db_session, a1_deck)

        repo = CardRecordStatisticsRepository(db_session)
        result = await repo.get_cefr_completion(sample_user.id)

        assert set(result.keys()) == {DeckLevel.A1, DeckLevel.A2, DeckLevel.B1, DeckLevel.B2}
        mastered_a1, total_a1 = result[DeckLevel.A1]
        assert mastered_a1 == 0
        assert total_a1 == 2

    @pytest.mark.asyncio
    async def test_mixed_mastery_across_levels(
        self,
        db_session: AsyncSession,
        sample_user: User,
    ) -> None:
        """User masters 1 of 2 A1 cards and 0 of 1 B1 card."""
        a1_deck = await _make_deck(db_session, DeckLevel.A1)
        b1_deck = await _make_deck(db_session, DeckLevel.B1)

        card_a1_1 = await _make_card(db_session, a1_deck)
        card_a1_2 = await _make_card(db_session, a1_deck)
        card_b1 = await _make_card(db_session, b1_deck)

        await _make_stats(db_session, sample_user, card_a1_1, CardStatus.MASTERED)
        await _make_stats(db_session, sample_user, card_a1_2, CardStatus.LEARNING)
        await _make_stats(db_session, sample_user, card_b1, CardStatus.REVIEW)

        repo = CardRecordStatisticsRepository(db_session)
        result = await repo.get_cefr_completion(sample_user.id)

        mastered_a1, total_a1 = result[DeckLevel.A1]
        mastered_b1, total_b1 = result[DeckLevel.B1]

        assert mastered_a1 == 1
        assert total_a1 == 2
        assert mastered_b1 == 0
        assert total_b1 == 1

    @pytest.mark.asyncio
    async def test_inactive_deck_excluded_from_total(
        self,
        db_session: AsyncSession,
        sample_user: User,
    ) -> None:
        """Cards from inactive decks do not count toward total."""
        active_deck = await _make_deck(db_session, DeckLevel.A2, is_active=True)
        inactive_deck = await _make_deck(db_session, DeckLevel.A2, is_active=False)

        await _make_card(db_session, active_deck)
        await _make_card(db_session, inactive_deck)

        repo = CardRecordStatisticsRepository(db_session)
        result = await repo.get_cefr_completion(sample_user.id)

        _, total_a2 = result[DeckLevel.A2]
        assert total_a2 == 1  # Only the card from active deck counts

    @pytest.mark.asyncio
    async def test_inactive_card_excluded_from_total(
        self,
        db_session: AsyncSession,
        sample_user: User,
    ) -> None:
        """Inactive cards do not count toward total."""
        deck = await _make_deck(db_session, DeckLevel.B2)
        await _make_card(db_session, deck, is_active=True)
        await _make_card(db_session, deck, is_active=False)

        repo = CardRecordStatisticsRepository(db_session)
        result = await repo.get_cefr_completion(sample_user.id)

        _, total_b2 = result[DeckLevel.B2]
        assert total_b2 == 1  # Only active card counts

    @pytest.mark.asyncio
    async def test_all_four_levels_always_present(
        self,
        db_session: AsyncSession,
        sample_user: User,
    ) -> None:
        """All four DeckLevel values are always in the result dict."""
        repo = CardRecordStatisticsRepository(db_session)
        result = await repo.get_cefr_completion(sample_user.id)

        assert DeckLevel.A1 in result
        assert DeckLevel.A2 in result
        assert DeckLevel.B1 in result
        assert DeckLevel.B2 in result
