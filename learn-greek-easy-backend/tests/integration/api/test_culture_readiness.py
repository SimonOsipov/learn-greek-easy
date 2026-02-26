"""Integration tests for GET /api/v1/culture/readiness endpoint.

This module tests:
- Authentication requirement
- Correct response schema
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import CultureDeck, CultureQuestion

# =============================================================================
# Test Fixtures
# =============================================================================


@pytest.fixture
async def culture_deck(db_session: AsyncSession) -> CultureDeck:
    """Create an active history deck for testing."""
    deck = CultureDeck(
        name_en="Greek History",
        name_el="Greek History",
        name_ru="Greek History",
        description_en="Learn about Greek history",
        description_el="Learn about Greek history",
        description_ru="Learn about Greek history",
        category="history",
        is_active=True,
        order_index=0,
    )
    db_session.add(deck)
    await db_session.flush()
    await db_session.refresh(deck)
    return deck


@pytest.fixture
async def culture_questions(
    db_session: AsyncSession, culture_deck: CultureDeck
) -> list[CultureQuestion]:
    """Create a few culture questions for the readiness endpoint."""
    questions = []
    for i in range(5):
        question = CultureQuestion(
            deck_id=culture_deck.id,
            question_text={
                "en": f"Question {i + 1}?",
                "el": f"Ερώτηση {i + 1};",
                "ru": f"Вопрос {i + 1}?",
            },
            option_a={"en": "Option A", "el": "Επιλογή Α", "ru": "Вариант А"},
            option_b={"en": "Option B", "el": "Επιλογή Β", "ru": "Вариант Б"},
            option_c={"en": "Option C", "el": "Επιλογή Γ", "ru": "Вариант В"},
            option_d={"en": "Option D", "el": "Επιλογή Δ", "ru": "Вариант Г"},
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
# Test Readiness Endpoint
# =============================================================================


class TestGetReadinessEndpoint:
    """Test suite for GET /api/v1/culture/readiness endpoint."""

    @pytest.mark.asyncio
    async def test_readiness_requires_auth(self, client: AsyncClient):
        """Unauthenticated request should return 401."""
        response = await client.get("/api/v1/culture/readiness")

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_readiness_returns_correct_schema(
        self,
        client: AsyncClient,
        auth_headers: dict,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
    ):
        """Authenticated request returns 200 with correct response schema."""
        response = await client.get("/api/v1/culture/readiness", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()

        assert "readiness_percentage" in data
        assert "verdict" in data
        assert "questions_learned" in data
        assert "accuracy_percentage" in data
        assert "total_answers" in data
        assert isinstance(data["readiness_percentage"], (int, float))
