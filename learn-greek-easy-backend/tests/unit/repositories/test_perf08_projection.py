"""PERF-08: Column projection tests for hot repository methods.

Tests verify:
- CultureQuestion.get_by_deck loads required columns and excludes embedding vector.
- CardRecord.get_by_deck loads required columns and excludes front_content/back_content.

These tests guard against MissingGreenlet regressions: if a projected-out column
is accessed on a returned entity, SQLAlchemy raises MissingGreenlet in async context.
"""

import pytest
from sqlalchemy import inspect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstanceState

from src.db.models import CardRecord, CardType, CultureDeck, CultureQuestion, Deck, DeckLevel
from src.repositories.card_record import _GET_BY_DECK_COLUMNS as CARD_RECORD_PROJECTED
from src.repositories.card_record import CardRecordRepository
from src.repositories.culture_question import _GET_BY_DECK_COLUMNS as CULTURE_Q_PROJECTED
from src.repositories.culture_question import CultureQuestionRepository

# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture
async def culture_deck(db_session: AsyncSession) -> CultureDeck:
    """Active culture deck with minimal multilingual fields."""
    deck = CultureDeck(
        name_en="Greek History",
        name_el="Ελληνική Ιστορία",
        name_ru="Греческая история",
        category="history",
        is_active=True,
    )
    db_session.add(deck)
    await db_session.flush()
    await db_session.refresh(deck)
    return deck


@pytest.fixture
async def culture_question(db_session: AsyncSession, culture_deck: CultureDeck) -> CultureQuestion:
    """A single CultureQuestion without embedding data."""
    q = CultureQuestion(
        deck_id=culture_deck.id,
        question_text={"en": "What is the capital of Greece?", "el": "Ποια είναι η πρωτεύουσα;"},
        option_a={"en": "Athens", "el": "Αθήνα"},
        option_b={"en": "Thessaloniki", "el": "Θεσσαλονίκη"},
        correct_option=1,
        order_index=0,
    )
    db_session.add(q)
    await db_session.flush()
    await db_session.refresh(q)
    return q


@pytest.fixture
async def v2_deck(db_session: AsyncSession) -> Deck:
    """Minimal V2 deck fixture."""
    deck = Deck(
        name_en="V2 Test Deck",
        name_el="V2 Test Deck",
        name_ru="V2 Test Deck",
        level=DeckLevel.A1,
        is_active=True,
    )
    db_session.add(deck)
    await db_session.flush()
    await db_session.refresh(deck)
    return deck


@pytest.fixture
async def word_entry(db_session: AsyncSession, v2_deck: Deck):
    """Minimal WordEntry fixture."""
    from src.db.models import WordEntry

    we = WordEntry(
        deck_id=v2_deck.id,
        greek_word="σπίτι",
        translation_en="house",
        level="A1",
        is_active=True,
    )
    db_session.add(we)
    await db_session.flush()
    await db_session.refresh(we)
    return we


@pytest.fixture
async def card_record(db_session: AsyncSession, v2_deck: Deck, word_entry) -> CardRecord:
    """A single CardRecord with front/back content."""
    cr = CardRecord(
        word_entry_id=word_entry.id,
        deck_id=v2_deck.id,
        card_type=CardType.MEANING_EL_TO_EN,
        variant_key="default",
        front_content={
            "card_type": "meaning_el_to_en",
            "prompt": "Translate",
            "main": "σπίτι",
            "badge": "A1",
        },
        back_content={"card_type": "meaning_el_to_en", "answer": "house"},
        is_active=True,
    )
    db_session.add(cr)
    await db_session.flush()
    await db_session.refresh(cr)
    return cr


# =============================================================================
# CultureQuestion.get_by_deck projection tests
# =============================================================================


class TestCultureQuestionGetByDeckProjection:
    """Column projection guard for CultureQuestion.get_by_deck."""

    @pytest.mark.asyncio
    async def test_returns_questions_for_deck(
        self,
        db_session: AsyncSession,
        culture_deck: CultureDeck,
        culture_question: CultureQuestion,
    ) -> None:
        """get_by_deck returns questions filtered by deck_id."""
        repo = CultureQuestionRepository(db_session)
        results = await repo.get_by_deck(culture_deck.id)
        assert len(results) == 1
        assert results[0].id == culture_question.id

    @pytest.mark.asyncio
    async def test_projected_columns_are_loaded(
        self,
        db_session: AsyncSession,
        culture_deck: CultureDeck,
        culture_question: CultureQuestion,
    ) -> None:
        """All columns in _GET_BY_DECK_COLUMNS are present after get_by_deck."""
        repo = CultureQuestionRepository(db_session)
        results = await repo.get_by_deck(culture_deck.id)
        assert len(results) == 1
        q = results[0]

        # Access every projected column without error
        _ = q.id
        _ = q.deck_id
        _ = q.question_text
        _ = q.option_a
        _ = q.option_b
        _ = q.option_c
        _ = q.option_d
        _ = q.correct_option
        _ = q.image_key
        _ = q.audio_s3_key
        _ = q.audio_a2_s3_key
        _ = q.order_index
        _ = q.is_pending_review
        _ = q.original_article_url
        _ = q.created_at
        _ = q.updated_at

    @pytest.mark.asyncio
    async def test_embedding_is_not_loaded(
        self,
        db_session: AsyncSession,
        culture_deck: CultureDeck,
        culture_question: CultureQuestion,
    ) -> None:
        """embedding column is NOT loaded (excluded from projection to save egress)."""
        repo = CultureQuestionRepository(db_session)
        results = await repo.get_by_deck(culture_deck.id)
        assert len(results) == 1
        q = results[0]

        # Inspect the instance state to verify the attribute is deferred/expired
        state: InstanceState = inspect(q)
        # 'expired_attributes' or 'unloaded' includes columns not yet fetched
        unloaded = state.unloaded
        assert "embedding" in unloaded, (
            f"Expected 'embedding' to be deferred/unloaded, but it was loaded. "
            f"Unloaded attrs: {unloaded}"
        )

    @pytest.mark.asyncio
    async def test_source_article_url_is_not_loaded(
        self,
        db_session: AsyncSession,
        culture_deck: CultureDeck,
        culture_question: CultureQuestion,
    ) -> None:
        """source_article_url is NOT loaded (excluded from projection)."""
        repo = CultureQuestionRepository(db_session)
        results = await repo.get_by_deck(culture_deck.id)
        q = results[0]

        state: InstanceState = inspect(q)
        unloaded = state.unloaded
        assert (
            "source_article_url" in unloaded
        ), f"Expected 'source_article_url' to be deferred/unloaded. Unloaded: {unloaded}"

    @pytest.mark.asyncio
    async def test_projected_column_set_covers_admin_response_fields(self) -> None:
        """_GET_BY_DECK_COLUMNS covers all fields used by CultureQuestionAdminResponse.

        This is a static guard: if a new field is added to CultureQuestionAdminResponse
        and not added to _GET_BY_DECK_COLUMNS, this test must be updated.
        """
        projected_attr_names = {col.key for col in CULTURE_Q_PROJECTED}

        # All fields required by CultureQuestionAdminResponse (and queue item)
        required_fields = {
            "id",
            "deck_id",
            "question_text",
            "option_a",
            "option_b",
            "option_c",
            "option_d",
            "correct_option",
            "image_key",
            "audio_s3_key",
            "order_index",
            "created_at",
            "updated_at",
        }

        missing = required_fields - projected_attr_names
        assert not missing, f"Required fields missing from _GET_BY_DECK_COLUMNS: {missing}"


# =============================================================================
# CardRecord.get_by_deck projection tests
# =============================================================================


class TestCardRecordGetByDeckProjection:
    """Column projection guard for CardRecord.get_by_deck."""

    @pytest.mark.asyncio
    async def test_returns_records_for_deck(
        self,
        db_session: AsyncSession,
        v2_deck: Deck,
        card_record: CardRecord,
    ) -> None:
        """get_by_deck returns records filtered by deck_id."""
        repo = CardRecordRepository(db_session)
        results = await repo.get_by_deck(v2_deck.id)
        assert len(results) == 1
        assert results[0].id == card_record.id

    @pytest.mark.asyncio
    async def test_projected_columns_are_loaded(
        self,
        db_session: AsyncSession,
        v2_deck: Deck,
        card_record: CardRecord,
    ) -> None:
        """All columns in _GET_BY_DECK_COLUMNS are accessible after get_by_deck."""
        repo = CardRecordRepository(db_session)
        results = await repo.get_by_deck(v2_deck.id)
        cr = results[0]

        _ = cr.id
        _ = cr.word_entry_id
        _ = cr.deck_id
        _ = cr.card_type
        _ = cr.tier
        _ = cr.variant_key
        _ = cr.is_active
        _ = cr.created_at
        _ = cr.updated_at

    @pytest.mark.asyncio
    async def test_front_content_is_not_loaded(
        self,
        db_session: AsyncSession,
        v2_deck: Deck,
        card_record: CardRecord,
    ) -> None:
        """front_content (large JSONB) is NOT loaded via get_by_deck."""
        repo = CardRecordRepository(db_session)
        results = await repo.get_by_deck(v2_deck.id)
        cr = results[0]

        state: InstanceState = inspect(cr)
        unloaded = state.unloaded
        assert (
            "front_content" in unloaded
        ), f"Expected 'front_content' to be deferred/unloaded. Unloaded: {unloaded}"

    @pytest.mark.asyncio
    async def test_back_content_is_not_loaded(
        self,
        db_session: AsyncSession,
        v2_deck: Deck,
        card_record: CardRecord,
    ) -> None:
        """back_content (large JSONB) is NOT loaded via get_by_deck."""
        repo = CardRecordRepository(db_session)
        results = await repo.get_by_deck(v2_deck.id)
        cr = results[0]

        state: InstanceState = inspect(cr)
        unloaded = state.unloaded
        assert (
            "back_content" in unloaded
        ), f"Expected 'back_content' to be deferred/unloaded. Unloaded: {unloaded}"

    @pytest.mark.asyncio
    async def test_projected_column_set_covers_identity_fields(self) -> None:
        """_GET_BY_DECK_COLUMNS covers all non-content identity fields."""
        projected_attr_names = {col.key for col in CARD_RECORD_PROJECTED}

        required_fields = {
            "id",
            "word_entry_id",
            "deck_id",
            "card_type",
            "tier",
            "variant_key",
            "is_active",
            "created_at",
            "updated_at",
        }

        missing = required_fields - projected_attr_names
        assert not missing, f"Required fields missing from _GET_BY_DECK_COLUMNS: {missing}"
