"""Unit tests for CultureQuestionRepository.

This module tests:
- get_by_deck: Get questions with pagination
- bulk_create: Create multiple questions at once
- count_by_deck: Count questions in a deck

Tests use real database fixtures to verify SQL queries work correctly.
"""

from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import CultureDeck, CultureQuestion
from src.repositories.culture_question import CultureQuestionRepository

# =============================================================================
# Test Fixtures
# =============================================================================


@pytest.fixture
async def culture_deck(db_session: AsyncSession) -> CultureDeck:
    """Create an active culture deck for testing."""
    deck = CultureDeck(
        name={"en": "Greek History", "el": "Ελληνική Ιστορία", "ru": "Греческая история"},
        description={"en": "Learn about Greek history", "el": "Μάθετε"},
        icon="book-open",
        color_accent="#4F46E5",
        category="history",
        is_active=True,
    )
    db_session.add(deck)
    await db_session.flush()
    await db_session.refresh(deck)
    return deck


@pytest.fixture
async def culture_questions(
    db_session: AsyncSession, culture_deck: CultureDeck
) -> list[CultureQuestion]:
    """Create multiple culture questions."""
    questions = []
    for i in range(5):
        question = CultureQuestion(
            deck_id=culture_deck.id,
            question_text={
                "en": f"Question {i + 1}?",
                "el": f"Ερώτηση {i + 1};",
            },
            option_a={"en": "Option A", "el": "Επιλογή Α"},
            option_b={"en": "Option B", "el": "Επιλογή Β"},
            option_c={"en": "Option C", "el": "Επιλογή Γ"},
            option_d={"en": "Option D", "el": "Επιλογή Δ"},
            correct_option=(i % 4) + 1,
            order_index=i,
        )
        db_session.add(question)
        questions.append(question)

    await db_session.flush()
    for q in questions:
        await db_session.refresh(q)
    return questions


# =============================================================================
# Test get_by_deck
# =============================================================================


class TestGetByDeck:
    """Tests for get_by_deck method."""

    @pytest.mark.asyncio
    async def test_returns_questions_for_deck(
        self,
        db_session: AsyncSession,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
    ):
        """Should return all questions for a specific deck."""
        repo = CultureQuestionRepository(db_session)

        result = await repo.get_by_deck(culture_deck.id)

        assert len(result) == len(culture_questions)
        for q in result:
            assert q.deck_id == culture_deck.id

    @pytest.mark.asyncio
    async def test_returns_ordered_by_order_index(
        self,
        db_session: AsyncSession,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
    ):
        """Should return questions ordered by order_index."""
        repo = CultureQuestionRepository(db_session)

        result = await repo.get_by_deck(culture_deck.id)

        for i in range(len(result) - 1):
            assert result[i].order_index <= result[i + 1].order_index

    @pytest.mark.asyncio
    async def test_respects_skip_parameter(
        self,
        db_session: AsyncSession,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
    ):
        """Should skip questions correctly."""
        repo = CultureQuestionRepository(db_session)

        result = await repo.get_by_deck(culture_deck.id, skip=2)

        assert len(result) == len(culture_questions) - 2
        # First result should be question at order_index 2
        assert result[0].order_index == 2

    @pytest.mark.asyncio
    async def test_respects_limit_parameter(
        self,
        db_session: AsyncSession,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
    ):
        """Should limit results correctly."""
        repo = CultureQuestionRepository(db_session)

        result = await repo.get_by_deck(culture_deck.id, limit=2)

        assert len(result) == 2
        # Should get first two by order_index
        assert result[0].order_index == 0
        assert result[1].order_index == 1

    @pytest.mark.asyncio
    async def test_skip_and_limit_combined(
        self,
        db_session: AsyncSession,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
    ):
        """Should handle skip and limit together for pagination."""
        repo = CultureQuestionRepository(db_session)

        result = await repo.get_by_deck(culture_deck.id, skip=1, limit=2)

        assert len(result) == 2
        # Should skip first and get questions at index 1 and 2
        assert result[0].order_index == 1
        assert result[1].order_index == 2

    @pytest.mark.asyncio
    async def test_returns_empty_list_for_empty_deck(
        self,
        db_session: AsyncSession,
        culture_deck: CultureDeck,
    ):
        """Should return empty list for deck with no questions."""
        repo = CultureQuestionRepository(db_session)

        result = await repo.get_by_deck(culture_deck.id)

        assert result == []

    @pytest.mark.asyncio
    async def test_returns_empty_list_for_nonexistent_deck(
        self,
        db_session: AsyncSession,
    ):
        """Should return empty list for non-existent deck."""
        repo = CultureQuestionRepository(db_session)

        result = await repo.get_by_deck(uuid4())

        assert result == []


# =============================================================================
# Test bulk_create
# =============================================================================


class TestBulkCreate:
    """Tests for bulk_create method."""

    @pytest.mark.asyncio
    async def test_creates_multiple_questions(
        self,
        db_session: AsyncSession,
        culture_deck: CultureDeck,
    ):
        """Should create multiple questions in one transaction."""
        repo = CultureQuestionRepository(db_session)

        questions_data = [
            {
                "deck_id": culture_deck.id,
                "question_text": {"en": f"Bulk Q{i}", "el": f"Μαζική Ε{i}"},
                "option_a": {"en": "A", "el": "Α"},
                "option_b": {"en": "B", "el": "Β"},
                "option_c": {"en": "C", "el": "Γ"},
                "option_d": {"en": "D", "el": "Δ"},
                "correct_option": (i % 4) + 1,
                "order_index": i,
            }
            for i in range(3)
        ]

        result = await repo.bulk_create(questions_data)

        assert len(result) == 3
        for i, q in enumerate(result):
            assert q.id is not None
            assert q.deck_id == culture_deck.id
            assert q.order_index == i

    @pytest.mark.asyncio
    async def test_assigns_ids_to_created_questions(
        self,
        db_session: AsyncSession,
        culture_deck: CultureDeck,
    ):
        """Should assign unique IDs to all created questions."""
        repo = CultureQuestionRepository(db_session)

        questions_data = [
            {
                "deck_id": culture_deck.id,
                "question_text": {"en": f"ID Test Q{i}", "el": f"ID Τεστ Ε{i}"},
                "option_a": {"en": "A", "el": "Α"},
                "option_b": {"en": "B", "el": "Β"},
                "option_c": {"en": "C", "el": "Γ"},
                "option_d": {"en": "D", "el": "Δ"},
                "correct_option": 1,
                "order_index": i,
            }
            for i in range(2)
        ]

        result = await repo.bulk_create(questions_data)

        ids = [q.id for q in result]
        # All IDs should be unique
        assert len(set(ids)) == len(ids)
        # All IDs should be valid UUIDs
        for q in result:
            assert q.id is not None

    @pytest.mark.asyncio
    async def test_bulk_create_single_question(
        self,
        db_session: AsyncSession,
        culture_deck: CultureDeck,
    ):
        """Should handle bulk create with single question."""
        repo = CultureQuestionRepository(db_session)

        questions_data = [
            {
                "deck_id": culture_deck.id,
                "question_text": {"en": "Single Q", "el": "Μοναδική Ε"},
                "option_a": {"en": "A", "el": "Α"},
                "option_b": {"en": "B", "el": "Β"},
                "option_c": {"en": "C", "el": "Γ"},
                "option_d": {"en": "D", "el": "Δ"},
                "correct_option": 2,
                "order_index": 0,
            }
        ]

        result = await repo.bulk_create(questions_data)

        assert len(result) == 1
        assert result[0].question_text["en"] == "Single Q"

    @pytest.mark.asyncio
    async def test_bulk_create_empty_list(
        self,
        db_session: AsyncSession,
    ):
        """Should return empty list for empty input."""
        repo = CultureQuestionRepository(db_session)

        result = await repo.bulk_create([])

        assert result == []


# =============================================================================
# Test count_by_deck
# =============================================================================


class TestCountByDeck:
    """Tests for count_by_deck method."""

    @pytest.mark.asyncio
    async def test_counts_questions_correctly(
        self,
        db_session: AsyncSession,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
    ):
        """Should return correct count of questions in deck."""
        repo = CultureQuestionRepository(db_session)

        result = await repo.count_by_deck(culture_deck.id)

        assert result == len(culture_questions)

    @pytest.mark.asyncio
    async def test_returns_zero_for_empty_deck(
        self,
        db_session: AsyncSession,
        culture_deck: CultureDeck,
    ):
        """Should return 0 for deck with no questions."""
        repo = CultureQuestionRepository(db_session)

        result = await repo.count_by_deck(culture_deck.id)

        assert result == 0

    @pytest.mark.asyncio
    async def test_returns_zero_for_nonexistent_deck(
        self,
        db_session: AsyncSession,
    ):
        """Should return 0 for non-existent deck."""
        repo = CultureQuestionRepository(db_session)

        result = await repo.count_by_deck(uuid4())

        assert result == 0

    @pytest.mark.asyncio
    async def test_counts_only_deck_questions(
        self,
        db_session: AsyncSession,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
    ):
        """Should count only questions belonging to specified deck."""
        repo = CultureQuestionRepository(db_session)

        # Create a second deck with questions
        second_deck = CultureDeck(
            name={"en": "Second Deck", "el": "Δεύτερο"},
            description={"en": "Second deck", "el": "Δεύτερο"},
            icon="star",
            color_accent="#10B981",
            category="test",
            is_active=True,
        )
        db_session.add(second_deck)
        await db_session.flush()

        # Add questions to second deck
        for i in range(3):
            q = CultureQuestion(
                deck_id=second_deck.id,
                question_text={"en": f"Q{i}", "el": f"E{i}"},
                option_a={"en": "A", "el": "Α"},
                option_b={"en": "B", "el": "Β"},
                option_c={"en": "C", "el": "Γ"},
                option_d={"en": "D", "el": "Δ"},
                correct_option=1,
                order_index=i,
            )
            db_session.add(q)
        await db_session.flush()

        # Count first deck should only count its own questions
        result = await repo.count_by_deck(culture_deck.id)

        assert result == len(culture_questions)
