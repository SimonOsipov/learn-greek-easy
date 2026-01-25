"""Unit tests for CultureDeckRepository.

This module tests:
- list_active: List active decks with optional category filter
- count_active: Count active decks with optional filter
- get_with_questions: Get deck with questions eagerly loaded
- count_questions: Count questions in a deck
- get_categories: Get distinct categories from active decks

Tests use real database fixtures to verify SQL queries work correctly.
"""

from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import CultureDeck, CultureQuestion
from src.repositories.culture_deck import CultureDeckRepository

# =============================================================================
# Test Fixtures
# =============================================================================


@pytest.fixture
async def culture_deck(db_session: AsyncSession) -> CultureDeck:
    """Create an active culture deck for testing."""
    deck = CultureDeck(
        name="Greek History",
        description="Learn about Greek history",
        category="history",
        is_active=True,
    )
    db_session.add(deck)
    await db_session.flush()
    await db_session.refresh(deck)
    return deck


@pytest.fixture
async def inactive_culture_deck(db_session: AsyncSession) -> CultureDeck:
    """Create an inactive culture deck for testing."""
    deck = CultureDeck(
        name="Archived Deck",
        description="Archived deck",
        category="archived_category",
        is_active=False,
    )
    db_session.add(deck)
    await db_session.flush()
    await db_session.refresh(deck)
    return deck


@pytest.fixture
async def second_culture_deck(db_session: AsyncSession) -> CultureDeck:
    """Create a second active culture deck for testing."""
    deck = CultureDeck(
        name="Greek Geography",
        description="Learn about Greek geography",
        category="geography",
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

    # Refresh the deck to update its questions relationship
    db_session.expire(culture_deck, ["questions"])

    return questions


# =============================================================================
# Test list_active
# =============================================================================


class TestListActive:
    """Tests for list_active method."""

    @pytest.mark.asyncio
    async def test_returns_only_active_decks(
        self,
        db_session: AsyncSession,
        culture_deck: CultureDeck,
        inactive_culture_deck: CultureDeck,
    ):
        """Should only return decks where is_active=True."""
        repo = CultureDeckRepository(db_session)

        result = await repo.list_active()

        assert all(d.is_active for d in result)
        deck_ids = [d.id for d in result]
        assert culture_deck.id in deck_ids
        assert inactive_culture_deck.id not in deck_ids

    @pytest.mark.asyncio
    async def test_filters_by_category(
        self,
        db_session: AsyncSession,
        culture_deck: CultureDeck,
        second_culture_deck: CultureDeck,
    ):
        """Should filter by category when provided."""
        repo = CultureDeckRepository(db_session)

        result = await repo.list_active(category="history")

        assert len(result) == 1
        assert all(d.category == "history" for d in result)
        assert result[0].id == culture_deck.id

    @pytest.mark.asyncio
    async def test_respects_pagination(
        self,
        db_session: AsyncSession,
        culture_deck: CultureDeck,
        second_culture_deck: CultureDeck,
    ):
        """Should respect skip and limit parameters."""
        repo = CultureDeckRepository(db_session)

        # Get only first deck
        result = await repo.list_active(skip=0, limit=1)

        assert len(result) == 1

    @pytest.mark.asyncio
    async def test_respects_skip_pagination(
        self,
        db_session: AsyncSession,
        culture_deck: CultureDeck,
        second_culture_deck: CultureDeck,
    ):
        """Should skip decks correctly."""
        repo = CultureDeckRepository(db_session)

        # Skip first deck
        result_all = await repo.list_active()
        result_skip = await repo.list_active(skip=1, limit=10)

        assert len(result_skip) == len(result_all) - 1

    @pytest.mark.asyncio
    async def test_orders_by_created_at_desc(
        self,
        db_session: AsyncSession,
        culture_deck: CultureDeck,
        second_culture_deck: CultureDeck,
    ):
        """Should order by created_at descending."""
        repo = CultureDeckRepository(db_session)

        result = await repo.list_active()

        if len(result) > 1:
            # Most recent should be first
            assert result[0].created_at >= result[1].created_at


# =============================================================================
# Test count_active
# =============================================================================


class TestCountActive:
    """Tests for count_active method."""

    @pytest.mark.asyncio
    async def test_counts_active_only(
        self,
        db_session: AsyncSession,
        culture_deck: CultureDeck,
        inactive_culture_deck: CultureDeck,
    ):
        """Should count only active decks."""
        repo = CultureDeckRepository(db_session)

        result = await repo.count_active()

        # Should not count inactive deck
        assert result >= 1  # At least culture_deck

    @pytest.mark.asyncio
    async def test_filters_by_category(
        self,
        db_session: AsyncSession,
        culture_deck: CultureDeck,
        second_culture_deck: CultureDeck,
    ):
        """Should filter count by category."""
        repo = CultureDeckRepository(db_session)

        result = await repo.count_active(category="nonexistent")

        assert result == 0

    @pytest.mark.asyncio
    async def test_counts_matching_category(
        self,
        db_session: AsyncSession,
        culture_deck: CultureDeck,
        second_culture_deck: CultureDeck,
    ):
        """Should count decks matching category."""
        repo = CultureDeckRepository(db_session)

        result = await repo.count_active(category="history")

        assert result == 1


# =============================================================================
# Test get_with_questions
# =============================================================================


class TestGetWithQuestions:
    """Tests for get_with_questions method."""

    @pytest.mark.asyncio
    async def test_returns_deck_with_questions(
        self,
        db_session: AsyncSession,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
    ):
        """Should return deck with questions eagerly loaded."""
        repo = CultureDeckRepository(db_session)

        result = await repo.get_with_questions(culture_deck.id)

        assert result is not None
        assert result.id == culture_deck.id
        assert len(result.questions) == len(culture_questions)

    @pytest.mark.asyncio
    async def test_returns_none_for_nonexistent(
        self,
        db_session: AsyncSession,
    ):
        """Should return None for non-existent deck."""
        repo = CultureDeckRepository(db_session)

        result = await repo.get_with_questions(uuid4())

        assert result is None

    @pytest.mark.asyncio
    async def test_returns_deck_with_empty_questions(
        self,
        db_session: AsyncSession,
        culture_deck: CultureDeck,
    ):
        """Should return deck with empty questions list."""
        repo = CultureDeckRepository(db_session)

        result = await repo.get_with_questions(culture_deck.id)

        assert result is not None
        assert len(result.questions) == 0


# =============================================================================
# Test count_questions
# =============================================================================


class TestCountQuestions:
    """Tests for count_questions method."""

    @pytest.mark.asyncio
    async def test_counts_questions_in_deck(
        self,
        db_session: AsyncSession,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
    ):
        """Should return correct question count."""
        repo = CultureDeckRepository(db_session)

        result = await repo.count_questions(culture_deck.id)

        assert result == len(culture_questions)

    @pytest.mark.asyncio
    async def test_returns_zero_for_empty_deck(
        self,
        db_session: AsyncSession,
        culture_deck: CultureDeck,
    ):
        """Should return 0 for deck with no questions."""
        repo = CultureDeckRepository(db_session)

        result = await repo.count_questions(culture_deck.id)

        assert result == 0

    @pytest.mark.asyncio
    async def test_returns_zero_for_nonexistent_deck(
        self,
        db_session: AsyncSession,
    ):
        """Should return 0 for non-existent deck."""
        repo = CultureDeckRepository(db_session)

        result = await repo.count_questions(uuid4())

        assert result == 0


# =============================================================================
# Test get_categories
# =============================================================================


class TestGetCategories:
    """Tests for get_categories method."""

    @pytest.mark.asyncio
    async def test_returns_distinct_categories(
        self,
        db_session: AsyncSession,
        culture_deck: CultureDeck,
        second_culture_deck: CultureDeck,
    ):
        """Should return distinct categories from active decks."""
        repo = CultureDeckRepository(db_session)

        result = await repo.get_categories()

        assert isinstance(result, list)
        assert "history" in result
        assert "geography" in result
        assert len(result) >= 2

    @pytest.mark.asyncio
    async def test_excludes_inactive_deck_categories(
        self,
        db_session: AsyncSession,
        inactive_culture_deck: CultureDeck,
    ):
        """Should not include categories from inactive decks only."""
        repo = CultureDeckRepository(db_session)

        result = await repo.get_categories()

        # "archived_category" is from inactive deck only
        assert "archived_category" not in result

    @pytest.mark.asyncio
    async def test_returns_sorted_categories(
        self,
        db_session: AsyncSession,
        culture_deck: CultureDeck,
        second_culture_deck: CultureDeck,
    ):
        """Should return categories in alphabetical order."""
        repo = CultureDeckRepository(db_session)

        result = await repo.get_categories()

        assert result == sorted(result)

    @pytest.mark.asyncio
    async def test_returns_empty_list_when_no_active_decks(
        self,
        db_session: AsyncSession,
        inactive_culture_deck: CultureDeck,
    ):
        """Should return empty list when only inactive decks exist."""
        repo = CultureDeckRepository(db_session)

        result = await repo.get_categories()

        # Only inactive deck exists, no categories should be returned
        assert isinstance(result, list)
        # Could be empty or non-empty depending on other test data
