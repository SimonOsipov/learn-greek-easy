"""Integration tests for Culture Question Detail API endpoint.

This module tests:
- GET /api/v1/culture/questions/{question_id}
"""

from datetime import date
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import CardStatus, CultureDeck, CultureQuestion, CultureQuestionStats

# =============================================================================
# Test Fixtures
# =============================================================================


@pytest.fixture
async def culture_deck(db_session: AsyncSession) -> CultureDeck:
    """Create an active culture deck for testing."""
    deck = CultureDeck(
        name_en="Greek History",
        name_el="Ελληνική Ιστορία",
        name_ru="Греческая История",
        description_en="Learn about Greek history",
        description_el="Μάθετε για την ελληνική ιστορία",
        description_ru="Узнайте о греческой истории",
        category="history",
        is_active=True,
    )
    db_session.add(deck)
    await db_session.flush()
    await db_session.refresh(deck)
    return deck


@pytest.fixture
async def inactive_deck(db_session: AsyncSession) -> CultureDeck:
    """Create an inactive culture deck."""
    deck = CultureDeck(
        name_en="Inactive Deck",
        name_el="Ανενεργό",
        name_ru="Неактивная",
        description_en="Inactive",
        description_el="Ανενεργό",
        description_ru="Неактивная",
        category="history",
        is_active=False,
    )
    db_session.add(deck)
    await db_session.flush()
    await db_session.refresh(deck)
    return deck


@pytest.fixture
async def culture_questions(
    db_session: AsyncSession, culture_deck: CultureDeck
) -> list[CultureQuestion]:
    """Create 5 culture questions with varying media configurations."""
    configs = [
        {"image_key": "images/q0.jpg", "audio_s3_key": "audio/q0.mp3"},
        {"image_key": "images/q1.jpg", "audio_s3_key": "audio/q1.mp3"},
        {"image_key": "images/q2.jpg", "audio_s3_key": None},
        {"image_key": None, "audio_s3_key": "audio/q3.mp3"},
        {"image_key": None, "audio_s3_key": None},
    ]
    questions = []
    for i, cfg in enumerate(configs):
        q = CultureQuestion(
            deck_id=culture_deck.id,
            question_text={"en": f"Question {i}?", "el": f"Ερώτηση {i};", "ru": f"Вопрос {i}?"},
            option_a={"en": "Option A", "el": "Επιλογή Α", "ru": "Вариант А"},
            option_b={"en": "Option B", "el": "Επιλογή Β", "ru": "Вариант Б"},
            correct_option=1,
            order_index=i,
            image_key=cfg["image_key"],
            audio_s3_key=cfg["audio_s3_key"],
        )
        db_session.add(q)
        questions.append(q)
    await db_session.flush()
    for q in questions:
        await db_session.refresh(q)
    return questions


@pytest.fixture
async def inactive_deck_question(
    db_session: AsyncSession, inactive_deck: CultureDeck
) -> CultureQuestion:
    """Create a question in an inactive deck."""
    q = CultureQuestion(
        deck_id=inactive_deck.id,
        question_text={"en": "Inactive Q?", "el": "Ανενεργή;", "ru": "Неактивный?"},
        option_a={"en": "A", "el": "Α", "ru": "А"},
        option_b={"en": "B", "el": "Β", "ru": "Б"},
        correct_option=1,
        order_index=0,
    )
    db_session.add(q)
    await db_session.flush()
    await db_session.refresh(q)
    return q


@pytest.fixture
async def second_deck(db_session: AsyncSession) -> CultureDeck:
    """Create a second active culture deck with distinct names."""
    deck = CultureDeck(
        name_en="Greek Geography",
        name_el="Ελληνική Γεωγραφία",
        name_ru="Греческая География",
        description_en="Learn about Greek geography",
        description_el="Μάθετε για τη γεωγραφία",
        description_ru="Узнайте о географии",
        category="geography",
        is_active=True,
    )
    db_session.add(deck)
    await db_session.flush()
    await db_session.refresh(deck)
    return deck


@pytest.fixture
async def shared_question(
    db_session: AsyncSession,
    second_deck: CultureDeck,
    culture_questions: list[CultureQuestion],
) -> CultureQuestion:
    """Create a question in second_deck with the same question_text as culture_questions[0]."""
    q = CultureQuestion(
        deck_id=second_deck.id,
        question_text=culture_questions[0].question_text,  # Same text = cross-deck match
        option_a={"en": "Option A", "el": "Επιλογή Α", "ru": "Вариант А"},
        option_b={"en": "Option B", "el": "Επιλογή Β", "ru": "Вариант Б"},
        correct_option=1,
        order_index=0,
    )
    db_session.add(q)
    await db_session.flush()
    await db_session.refresh(q)
    return q


@pytest.fixture
async def user_stats(
    db_session: AsyncSession,
    test_user,
    culture_questions: list[CultureQuestion],
) -> list[CultureQuestionStats]:
    """Create stats for test_user: q[0]=LEARNING, q[1]=MASTERED, q[2..4] have no stats."""
    stats = []
    for question, status in [
        (culture_questions[0], CardStatus.LEARNING),
        (culture_questions[1], CardStatus.MASTERED),
    ]:
        s = CultureQuestionStats(
            user_id=test_user.id,
            question_id=question.id,
            easiness_factor=2.5,
            interval=1,
            repetitions=0,
            next_review_date=date.today(),
            status=status,
        )
        db_session.add(s)
        stats.append(s)
    await db_session.flush()
    for s in stats:
        await db_session.refresh(s)
    return stats


@pytest.fixture
def mock_s3_service():
    """Patch get_s3_service at the culture_question_service module level."""
    with patch("src.services.culture_question_service.get_s3_service") as mock_get:
        mock_s3 = MagicMock()
        mock_s3.generate_presigned_url.return_value = "https://s3.example.com/presigned"
        mock_get.return_value = mock_s3
        yield mock_s3


# =============================================================================
# Test Class
# =============================================================================


class TestCultureQuestionDetailEndpoint:
    """Test suite for GET /api/v1/culture/questions/{question_id} endpoint."""

    @pytest.mark.asyncio
    async def test_get_question_detail_success(
        self,
        client: AsyncClient,
        auth_headers: dict,
        mock_s3_service,
        culture_questions: list[CultureQuestion],
        user_stats,
    ):
        """Successful request returns 200 with expected fields."""
        question = culture_questions[0]
        response = await client.get(
            f"/api/v1/culture/questions/{question.id}",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        assert data["id"] == str(question.id)
        assert "question_text" in data
        assert "option_count" in data
        assert "order_index" in data
        assert "status" in data
        assert "image_url" in data
        assert "audio_url" in data

    @pytest.mark.asyncio
    async def test_get_question_detail_not_found(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Non-existent question_id returns 404."""
        response = await client.get(
            f"/api/v1/culture/questions/{uuid4()}",
            headers=auth_headers,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_get_question_detail_inactive_deck(
        self,
        client: AsyncClient,
        auth_headers: dict,
        inactive_deck_question: CultureQuestion,
    ):
        """Question belonging to an inactive deck returns 404."""
        response = await client.get(
            f"/api/v1/culture/questions/{inactive_deck_question.id}",
            headers=auth_headers,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_get_question_detail_unauthenticated(
        self,
        client: AsyncClient,
        culture_questions: list[CultureQuestion],
    ):
        """Request without auth headers returns 401."""
        question = culture_questions[0]
        response = await client.get(f"/api/v1/culture/questions/{question.id}")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_get_question_detail_includes_status(
        self,
        client: AsyncClient,
        auth_headers: dict,
        mock_s3_service,
        culture_questions: list[CultureQuestion],
        user_stats,
    ):
        """Status field reflects per-user learning progress; no stats defaults to 'new'."""
        # q[0] has LEARNING stats
        response = await client.get(
            f"/api/v1/culture/questions/{culture_questions[0].id}",
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["status"] == "learning"

        # q[1] has MASTERED stats
        response = await client.get(
            f"/api/v1/culture/questions/{culture_questions[1].id}",
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["status"] == "mastered"

        # q[2] has no stats → defaults to "new"
        response = await client.get(
            f"/api/v1/culture/questions/{culture_questions[2].id}",
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["status"] == "new"

    @pytest.mark.asyncio
    async def test_get_question_detail_presigned_urls(
        self,
        client: AsyncClient,
        auth_headers: dict,
        mock_s3_service,
        culture_questions: list[CultureQuestion],
    ):
        """Presigned URLs are generated only when the corresponding S3 key exists."""
        # q[0]: both image_key and audio_s3_key set → both URLs non-null
        response = await client.get(
            f"/api/v1/culture/questions/{culture_questions[0].id}",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["image_url"] is not None
        assert data["audio_url"] is not None

        # q[2]: image_key set, audio_s3_key is None → image non-null, audio null
        response = await client.get(
            f"/api/v1/culture/questions/{culture_questions[2].id}",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["image_url"] is not None
        assert data["audio_url"] is None

        # q[4]: both keys are None → both URLs null
        response = await client.get(
            f"/api/v1/culture/questions/{culture_questions[4].id}",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["image_url"] is None
        assert data["audio_url"] is None

    @pytest.mark.asyncio
    async def test_get_question_detail_also_in_decks(
        self,
        client: AsyncClient,
        auth_headers: dict,
        mock_s3_service,
        culture_questions: list[CultureQuestion],
        shared_question: CultureQuestion,
        second_deck: CultureDeck,
    ):
        """also_in_decks lists other active decks containing the same question text."""
        response = await client.get(
            f"/api/v1/culture/questions/{culture_questions[0].id}",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        also_in_ids = [entry["id"] for entry in data["also_in_decks"]]
        assert str(second_deck.id) in also_in_ids

        also_in_names = [entry["name"] for entry in data["also_in_decks"]]
        assert second_deck.name_en in also_in_names

    @pytest.mark.asyncio
    async def test_get_question_detail_locale(
        self,
        client: AsyncClient,
        auth_headers: dict,
        mock_s3_service,
        culture_questions: list[CultureQuestion],
        shared_question: CultureQuestion,
        second_deck: CultureDeck,
    ):
        """Accept-Language: el returns Greek deck name in also_in_decks."""
        response = await client.get(
            f"/api/v1/culture/questions/{culture_questions[0].id}",
            headers={**auth_headers, "Accept-Language": "el"},
        )
        assert response.status_code == 200
        data = response.json()

        also_in_names = [entry["name"] for entry in data["also_in_decks"]]
        assert second_deck.name_el in also_in_names
