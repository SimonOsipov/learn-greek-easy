"""Integration tests for Culture Question Browse API endpoint.

This module tests:
- GET /api/v1/culture/decks/{deck_id}/questions/browse
"""

from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import CardStatus, CultureDeck, CultureQuestion, CultureQuestionStats, User

# =============================================================================
# Test Fixtures
# =============================================================================


@pytest.fixture
async def culture_deck(db_session: AsyncSession) -> CultureDeck:
    """Create an active culture deck for testing."""
    deck = CultureDeck(
        name_en="Greek History",
        name_el="Greek History",
        name_ru="Greek History",
        description_en="Learn about Greek history",
        description_el="Learn about Greek history",
        description_ru="Learn about Greek history",
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
        name_en="Archived",
        name_el="Archived",
        name_ru="Archived",
        description_en="Archived deck",
        description_el="Archived deck",
        description_ru="Archived deck",
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
    """Create multiple culture questions in the deck."""
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
            correct_option=1,
            order_index=i,
        )
        db_session.add(question)
        questions.append(question)

    await db_session.flush()
    for q in questions:
        await db_session.refresh(q)
    return questions


@pytest.fixture
async def mixed_topic_browse_questions(
    db_session: AsyncSession, culture_deck: CultureDeck
) -> list[CultureQuestion]:
    """Create questions split across two topics: 2 history + 3 politics (WEDGE-03-01).

    All questions are non-pending (default `is_pending_review=False`), so
    they are all eligible for `browse_questions`.
    """
    topics = ["history", "history", "politics", "politics", "politics"]
    questions = []
    for i, topic in enumerate(topics):
        question = CultureQuestion(
            deck_id=culture_deck.id,
            question_text={
                "en": f"Q{i + 1} ({topic})?",
                "el": f"Ε{i + 1} ({topic});",
                "ru": f"В{i + 1} ({topic})?",
            },
            option_a={"en": "Option A", "el": "Επιλογή Α", "ru": "Вариант А"},
            option_b={"en": "Option B", "el": "Επιλογή Β", "ru": "Вариант Б"},
            correct_option=1,
            order_index=i,
            topic=topic,
        )
        db_session.add(question)
        questions.append(question)

    await db_session.flush()
    for q in questions:
        await db_session.refresh(q)
    return questions


# =============================================================================
# Test Browse Questions Endpoint
# =============================================================================


class TestBrowseQuestionsEndpoint:
    """Test suite for GET /api/v1/culture/decks/{deck_id}/questions/browse endpoint."""

    @pytest.mark.asyncio
    async def test_browse_requires_auth(
        self,
        client: AsyncClient,
        culture_deck: CultureDeck,
    ):
        """Unauthenticated request should return 401."""
        response = await client.get(f"/api/v1/culture/decks/{culture_deck.id}/questions/browse")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_browse_deck_not_found(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Non-existent deck should return 404."""
        non_existent_id = uuid4()
        response = await client.get(
            f"/api/v1/culture/decks/{non_existent_id}/questions/browse",
            headers=auth_headers,
        )
        assert response.status_code == 404
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "NOT_FOUND"

    @pytest.mark.asyncio
    async def test_browse_inactive_deck_returns_404(
        self,
        client: AsyncClient,
        auth_headers: dict,
        inactive_deck: CultureDeck,
    ):
        """Inactive deck should return 404."""
        response = await client.get(
            f"/api/v1/culture/decks/{inactive_deck.id}/questions/browse",
            headers=auth_headers,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_browse_returns_all_questions(
        self,
        client: AsyncClient,
        auth_headers: dict,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
    ):
        """Should return all questions in the deck with correct fields."""
        response = await client.get(
            f"/api/v1/culture/decks/{culture_deck.id}/questions/browse",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        assert data["deck_id"] == str(culture_deck.id)
        assert data["deck_name"] == culture_deck.name_en
        assert data["total"] == len(culture_questions)
        assert data["offset"] == 0
        assert data["limit"] == 100
        assert len(data["questions"]) == len(culture_questions)

        # Verify each question has expected fields
        first_q = data["questions"][0]
        assert "id" in first_q
        assert "question_text" in first_q
        assert "option_count" in first_q
        assert "order_index" in first_q
        assert "status" in first_q

    @pytest.mark.asyncio
    async def test_browse_default_status_is_new(
        self,
        client: AsyncClient,
        auth_headers: dict,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
    ):
        """Questions without stats should have status 'new'."""
        response = await client.get(
            f"/api/v1/culture/decks/{culture_deck.id}/questions/browse",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        for question in data["questions"]:
            assert question["status"] == "new"

    @pytest.mark.asyncio
    async def test_browse_per_user_status_mapping(
        self,
        db_session: AsyncSession,
        client: AsyncClient,
        auth_headers: dict,
        test_user: User,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
    ):
        """Questions with stats should return the correct status."""
        statuses = [CardStatus.LEARNING, CardStatus.REVIEW, CardStatus.MASTERED]
        for i, card_status in enumerate(statuses):
            stats = CultureQuestionStats(
                user_id=test_user.id,
                question_id=culture_questions[i].id,
                easiness_factor=2.5,
                interval=1,
                repetitions=i,
                next_review_date=__import__("datetime").date.today(),
                status=card_status,
            )
            db_session.add(stats)

        await db_session.flush()

        response = await client.get(
            f"/api/v1/culture/decks/{culture_deck.id}/questions/browse",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        status_by_id = {q["id"]: q["status"] for q in data["questions"]}
        assert status_by_id[str(culture_questions[0].id)] == "learning"
        assert status_by_id[str(culture_questions[1].id)] == "review"
        assert status_by_id[str(culture_questions[2].id)] == "mastered"
        assert status_by_id[str(culture_questions[3].id)] == "new"
        assert status_by_id[str(culture_questions[4].id)] == "new"

    @pytest.mark.asyncio
    async def test_browse_pagination_offset_limit(
        self,
        client: AsyncClient,
        auth_headers: dict,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
    ):
        """Pagination via offset/limit should work correctly."""
        response = await client.get(
            f"/api/v1/culture/decks/{culture_deck.id}/questions/browse?offset=2&limit=2",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        assert data["total"] == len(culture_questions)
        assert data["offset"] == 2
        assert data["limit"] == 2
        assert len(data["questions"]) == 2

    @pytest.mark.asyncio
    async def test_browse_response_excludes_answers(
        self,
        client: AsyncClient,
        auth_headers: dict,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
    ):
        """Browse response must NOT include correct_option or options content."""
        response = await client.get(
            f"/api/v1/culture/decks/{culture_deck.id}/questions/browse",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        for question in data["questions"]:
            assert "correct_option" not in question
            assert "options" not in question
            assert "option_a" not in question
            assert "option_b" not in question

    @pytest.mark.asyncio
    async def test_browse_ordered_by_order_index(
        self,
        client: AsyncClient,
        auth_headers: dict,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
    ):
        """Questions should be returned ordered by order_index ascending."""
        response = await client.get(
            f"/api/v1/culture/decks/{culture_deck.id}/questions/browse",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        order_indices = [q["order_index"] for q in data["questions"]]
        assert order_indices == sorted(order_indices)


class TestBrowseQuestionsTopicFilter:
    """[RED] WEDGE-03-01: `topic` query param on the browse endpoint.

    `browse_deck_questions` (router.py:466) -> `CultureQuestionService.browse_questions`
    (culture_question_service.py:469) does not accept/validate a `topic`
    param yet. Today FastAPI silently drops an unrecognized `?topic=...`
    query string (no 422, no filtering), so `test_browse_topic_filters_and_total`
    fails at its assertion once the param is wired -- not at collection time.
    """

    @pytest.mark.asyncio
    async def test_browse_topic_filters_and_total(
        self,
        client: AsyncClient,
        auth_headers: dict,
        culture_deck: CultureDeck,
        mixed_topic_browse_questions: list[CultureQuestion],
    ):
        """?topic=politics should return only the 3 politics questions, total==3.

        RED today: the unrecognized `topic` param is ignored, so total==5
        (all mixed-topic questions) instead of 3.
        """
        politics_ids = {str(q.id) for q in mixed_topic_browse_questions if q.topic == "politics"}
        history_ids = {str(q.id) for q in mixed_topic_browse_questions if q.topic == "history"}

        response = await client.get(
            f"/api/v1/culture/decks/{culture_deck.id}/questions/browse?topic=politics",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        assert data["total"] == 3
        returned_ids = {q["id"] for q in data["questions"]}
        assert returned_ids == politics_ids
        assert not (returned_ids & history_ids)

    @pytest.mark.asyncio
    async def test_browse_without_topic_unchanged(
        self,
        client: AsyncClient,
        auth_headers: dict,
        culture_deck: CultureDeck,
        mixed_topic_browse_questions: list[CultureQuestion],
    ):
        """No topic param should return all 5 questions, unchanged.

        Regression lock: passes both before and after the executor wires the
        `topic` param -- omitting it must be a strict no-op.
        """
        all_ids = {str(q.id) for q in mixed_topic_browse_questions}

        response = await client.get(
            f"/api/v1/culture/decks/{culture_deck.id}/questions/browse",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        assert data["total"] == 5
        returned_ids = {q["id"] for q in data["questions"]}
        assert returned_ids == all_ids
