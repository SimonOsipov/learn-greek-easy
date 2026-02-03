"""Integration tests for variable answer options in Culture API endpoints.

This module tests:
- POST /api/v1/culture/questions - Create question with 2/3/4 options
- POST /api/v1/culture/questions/bulk - Bulk create mixed option counts
- GET /api/v1/culture/decks/{id}/questions - Queue returns correct option arrays
- POST /api/v1/culture/questions/{id}/answer - Answer validation per option count
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import CultureDeck, CultureQuestion

# ============================================================================
# Fixtures
# ============================================================================


@pytest.fixture
def valid_2_option_question_data():
    """Valid 2-option (True/False) question data."""
    return {
        "question_text": {
            "el": "Αληθές ή Ψευδές;",
            "en": "True or False?",
            "ru": "Правда или ложь?",
        },
        "option_a": {"el": "Αληθές", "en": "True", "ru": "Правда"},
        "option_b": {"el": "Ψευδές", "en": "False", "ru": "Ложь"},
        "option_c": None,
        "option_d": None,
        "correct_option": 1,
        "order_index": 0,
    }


@pytest.fixture
def valid_3_option_question_data():
    """Valid 3-option question data."""
    return {
        "question_text": {"el": "Ποιο είναι σωστό;", "en": "Which is correct?", "ru": "Что верно?"},
        "option_a": {"el": "Πρώτο", "en": "First", "ru": "Первый"},
        "option_b": {"el": "Δεύτερο", "en": "Second", "ru": "Второй"},
        "option_c": {"el": "Τρίτο", "en": "Third", "ru": "Третий"},
        "option_d": None,
        "correct_option": 2,
        "order_index": 0,
    }


@pytest.fixture
async def culture_deck_for_variable_tests(db_session: AsyncSession) -> CultureDeck:
    """Create a culture deck for variable options testing."""
    deck = CultureDeck(
        name_en="Variable Options Test Deck",
        name_el="Variable Options Test Deck",
        name_ru="Variable Options Test Deck",
        description_en="Testing 2, 3, and 4 option questions",
        description_el="Testing 2, 3, and 4 option questions",
        description_ru="Testing 2, 3, and 4 option questions",
        category="history",
        is_active=True,
        order_index=999,
    )
    db_session.add(deck)
    await db_session.commit()
    await db_session.refresh(deck)
    return deck


@pytest.fixture
async def two_option_question_in_db(
    db_session: AsyncSession, culture_deck_for_variable_tests: CultureDeck
) -> CultureQuestion:
    """Create a 2-option question in database."""
    question = CultureQuestion(
        deck_id=culture_deck_for_variable_tests.id,
        question_text={"el": "Αληθές;", "en": "True?", "ru": "Правда?"},
        option_a={"el": "Ναι", "en": "Yes", "ru": "Да"},
        option_b={"el": "Όχι", "en": "No", "ru": "Нет"},
        option_c=None,
        option_d=None,
        correct_option=1,
        order_index=0,
    )
    db_session.add(question)
    await db_session.commit()
    await db_session.refresh(question)
    return question


@pytest.fixture
async def three_option_question_in_db(
    db_session: AsyncSession, culture_deck_for_variable_tests: CultureDeck
) -> CultureQuestion:
    """Create a 3-option question in database."""
    question = CultureQuestion(
        deck_id=culture_deck_for_variable_tests.id,
        question_text={"el": "Ποιο;", "en": "Which?", "ru": "Какой?"},
        option_a={"el": "Α", "en": "A", "ru": "А"},
        option_b={"el": "Β", "en": "B", "ru": "Б"},
        option_c={"el": "Γ", "en": "C", "ru": "В"},
        option_d=None,
        correct_option=2,
        order_index=1,
    )
    db_session.add(question)
    await db_session.commit()
    await db_session.refresh(question)
    return question


# ============================================================================
# TestCreateQuestionVariableOptions
# ============================================================================


class TestCreateQuestionVariableOptions:
    """Tests for POST /api/v1/culture/questions with variable options."""

    @pytest.mark.asyncio
    async def test_create_2_option_question_success(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        culture_deck_for_variable_tests: CultureDeck,
        valid_2_option_question_data: dict,
    ):
        """Superuser can create a 2-option question."""
        data = {**valid_2_option_question_data, "deck_id": str(culture_deck_for_variable_tests.id)}

        response = await client.post(
            "/api/v1/culture/questions",
            json=data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 201
        result = response.json()
        assert result["option_c"] is None
        assert result["option_d"] is None
        assert result["option_count"] == 2

    @pytest.mark.asyncio
    async def test_create_3_option_question_success(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        culture_deck_for_variable_tests: CultureDeck,
        valid_3_option_question_data: dict,
    ):
        """Superuser can create a 3-option question."""
        data = {**valid_3_option_question_data, "deck_id": str(culture_deck_for_variable_tests.id)}

        response = await client.post(
            "/api/v1/culture/questions",
            json=data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 201
        result = response.json()
        assert result["option_c"] is not None
        assert result["option_d"] is None
        assert result["option_count"] == 3

    @pytest.mark.asyncio
    async def test_create_2_option_correct_option_3_returns_422(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        culture_deck_for_variable_tests: CultureDeck,
        valid_2_option_question_data: dict,
    ):
        """correct_option=3 for 2-option question returns 422."""
        data = {
            **valid_2_option_question_data,
            "deck_id": str(culture_deck_for_variable_tests.id),
            "correct_option": 3,
        }

        response = await client.post(
            "/api/v1/culture/questions",
            json=data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_question_option_d_without_c_returns_422(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        culture_deck_for_variable_tests: CultureDeck,
    ):
        """option_d without option_c (gap) returns 422."""
        data = {
            "deck_id": str(culture_deck_for_variable_tests.id),
            "question_text": {"el": "Ερώτηση", "en": "Question", "ru": "Вопрос"},
            "option_a": {"el": "Α", "en": "A", "ru": "А"},
            "option_b": {"el": "Β", "en": "B", "ru": "Б"},
            "option_c": None,
            "option_d": {"el": "Δ", "en": "D", "ru": "Г"},  # Gap!
            "correct_option": 1,
            "order_index": 0,
        }

        response = await client.post(
            "/api/v1/culture/questions",
            json=data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 422


# ============================================================================
# TestQuestionQueueVariableOptions
# ============================================================================


class TestQuestionQueueVariableOptions:
    """Tests for GET /api/v1/culture/decks/{id}/questions with variable options."""

    @pytest.mark.asyncio
    async def test_queue_2_option_question_returns_2_options(
        self,
        client: AsyncClient,
        auth_headers: dict,
        culture_deck_for_variable_tests: CultureDeck,
        two_option_question_in_db: CultureQuestion,
    ):
        """Queue returns options array with 2 items for 2-option question."""
        response = await client.get(
            f"/api/v1/culture/decks/{culture_deck_for_variable_tests.id}/questions",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        question = next(
            q for q in data["questions"] if q["id"] == str(two_option_question_in_db.id)
        )

        assert len(question["options"]) == 2
        assert question["option_count"] == 2

    @pytest.mark.asyncio
    async def test_queue_3_option_question_returns_3_options(
        self,
        client: AsyncClient,
        auth_headers: dict,
        culture_deck_for_variable_tests: CultureDeck,
        three_option_question_in_db: CultureQuestion,
    ):
        """Queue returns options array with 3 items for 3-option question."""
        response = await client.get(
            f"/api/v1/culture/decks/{culture_deck_for_variable_tests.id}/questions",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        question = next(
            q for q in data["questions"] if q["id"] == str(three_option_question_in_db.id)
        )

        assert len(question["options"]) == 3
        assert question["option_count"] == 3


# ============================================================================
# TestAnswerVariableOptions
# ============================================================================


class TestAnswerVariableOptions:
    """Tests for POST /api/v1/culture/questions/{id}/answer with variable options."""

    @pytest.mark.asyncio
    async def test_answer_2_option_question_valid_option_success(
        self,
        client: AsyncClient,
        auth_headers: dict,
        two_option_question_in_db: CultureQuestion,
    ):
        """Answering with valid option (1 or 2) on 2-option question succeeds."""
        response = await client.post(
            f"/api/v1/culture/questions/{two_option_question_in_db.id}/answer",
            json={"selected_option": 1, "time_taken": 5},
            headers=auth_headers,
        )

        assert response.status_code == 200
        assert response.json()["is_correct"] is True

    @pytest.mark.asyncio
    async def test_answer_2_option_question_option_3_returns_error(
        self,
        client: AsyncClient,
        auth_headers: dict,
        two_option_question_in_db: CultureQuestion,
    ):
        """Answering with option 3 on 2-option question returns error."""
        response = await client.post(
            f"/api/v1/culture/questions/{two_option_question_in_db.id}/answer",
            json={"selected_option": 3, "time_taken": 5},
            headers=auth_headers,
        )

        # Service raises ValueError which becomes 400
        assert response.status_code in [400, 422]

    @pytest.mark.asyncio
    async def test_answer_3_option_question_option_3_success(
        self,
        client: AsyncClient,
        auth_headers: dict,
        three_option_question_in_db: CultureQuestion,
    ):
        """Answering with option 3 on 3-option question succeeds."""
        response = await client.post(
            f"/api/v1/culture/questions/{three_option_question_in_db.id}/answer",
            json={"selected_option": 3, "time_taken": 5},
            headers=auth_headers,
        )

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_answer_3_option_question_option_4_returns_error(
        self,
        client: AsyncClient,
        auth_headers: dict,
        three_option_question_in_db: CultureQuestion,
    ):
        """Answering with option 4 on 3-option question returns error."""
        response = await client.post(
            f"/api/v1/culture/questions/{three_option_question_in_db.id}/answer",
            json={"selected_option": 4, "time_taken": 5},
            headers=auth_headers,
        )

        assert response.status_code in [400, 422]


# ============================================================================
# TestBulkCreateVariableOptions
# ============================================================================


class TestBulkCreateVariableOptions:
    """Tests for POST /api/v1/culture/questions/bulk with variable options."""

    @pytest.mark.asyncio
    async def test_bulk_create_mixed_option_counts_success(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        culture_deck_for_variable_tests: CultureDeck,
    ):
        """Bulk create with mixed 2, 3, and 4 option questions succeeds."""
        questions = [
            {
                "question_text": {"el": "Q1", "en": "Q1", "ru": "Q1"},
                "option_a": {"el": "A", "en": "A", "ru": "A"},
                "option_b": {"el": "B", "en": "B", "ru": "B"},
                "option_c": None,
                "option_d": None,
                "correct_option": 1,
                "order_index": 10,
            },
            {
                "question_text": {"el": "Q2", "en": "Q2", "ru": "Q2"},
                "option_a": {"el": "A", "en": "A", "ru": "A"},
                "option_b": {"el": "B", "en": "B", "ru": "B"},
                "option_c": {"el": "C", "en": "C", "ru": "C"},
                "option_d": None,
                "correct_option": 2,
                "order_index": 11,
            },
            {
                "question_text": {"el": "Q3", "en": "Q3", "ru": "Q3"},
                "option_a": {"el": "A", "en": "A", "ru": "A"},
                "option_b": {"el": "B", "en": "B", "ru": "B"},
                "option_c": {"el": "C", "en": "C", "ru": "C"},
                "option_d": {"el": "D", "en": "D", "ru": "D"},
                "correct_option": 4,
                "order_index": 12,
            },
        ]

        response = await client.post(
            "/api/v1/culture/questions/bulk",
            json={"deck_id": str(culture_deck_for_variable_tests.id), "questions": questions},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 201
        result = response.json()
        assert result["created_count"] == 3

        # Verify option counts
        assert result["questions"][0]["option_count"] == 2
        assert result["questions"][1]["option_count"] == 3
        assert result["questions"][2]["option_count"] == 4
