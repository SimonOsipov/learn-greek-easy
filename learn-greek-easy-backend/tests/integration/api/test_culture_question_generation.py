"""Integration tests for culture question generation admin endpoints.

This module tests the admin culture question generation endpoints:
- POST /api/v1/admin/culture/questions/generate - Generate question from article
- GET /api/v1/admin/culture/questions/check-article - Check if article URL is used
- GET /api/v1/admin/culture/questions/pending - List pending review questions

Tests cover:
- Authentication requirements (401 without auth)
- Authorization (403 for non-superusers)
- Success cases with proper response structures
- Error handling (409 conflict, pagination)
"""

from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import CultureQuestion
from tests.factories import CultureDeckFactory

# ============================================================================
# Test Fixtures
# ============================================================================


@pytest.fixture
async def culture_deck(db_session: AsyncSession):
    """Create a culture deck for testing."""
    deck = await CultureDeckFactory.create()
    return deck


@pytest.fixture
async def pending_question(db_session: AsyncSession):
    """Create a pending review question without a deck."""
    # Create a deck first for the question
    deck = await CultureDeckFactory.create()

    # Create the question with pending review status
    question = CultureQuestion(
        deck_id=deck.id,
        question_text={"en": "Test Q?", "el": "Ερώτηση;", "ru": "Вопрос?"},
        option_a={"en": "A", "el": "Α", "ru": "А"},
        option_b={"en": "B", "el": "Β", "ru": "Б"},
        correct_option=1,
        is_pending_review=True,
        source_article_url="https://example.com/test-article",
    )
    db_session.add(question)
    await db_session.commit()
    await db_session.refresh(question)
    return question


@pytest.fixture
async def approved_question(db_session: AsyncSession, culture_deck):
    """Create an approved (non-pending) question."""
    question = CultureQuestion(
        deck_id=culture_deck.id,
        question_text={"en": "Approved Q?", "el": "Εγκεκριμένη;", "ru": "Одобрено?"},
        option_a={"en": "A", "el": "Α", "ru": "А"},
        option_b={"en": "B", "el": "Β", "ru": "Б"},
        correct_option=1,
        is_pending_review=False,
    )
    db_session.add(question)
    await db_session.commit()
    await db_session.refresh(question)
    return question


@pytest.fixture
async def multiple_pending_questions(db_session: AsyncSession, culture_deck):
    """Create multiple pending questions for pagination testing."""
    questions = []
    for i in range(15):
        question = CultureQuestion(
            deck_id=culture_deck.id,
            question_text={"en": f"Question {i}?", "el": f"Ερώτηση {i};", "ru": f"Вопрос {i}?"},
            option_a={"en": "A", "el": "Α", "ru": "А"},
            option_b={"en": "B", "el": "Β", "ru": "Б"},
            correct_option=1,
            is_pending_review=True,
            source_article_url=f"https://example.com/article-{i}",
        )
        db_session.add(question)
        questions.append(question)

    await db_session.commit()
    for q in questions:
        await db_session.refresh(q)
    return questions


# ============================================================================
# Check Article Endpoint Tests
# ============================================================================


class TestCheckArticleEndpoint:
    """Tests for GET /api/v1/admin/culture/questions/check-article"""

    @pytest.mark.asyncio
    async def test_returns_401_without_auth(self, client: AsyncClient):
        """Test that unauthenticated request returns 401 Unauthorized."""
        response = await client.get(
            "/api/v1/admin/culture/questions/check-article",
            params={"url": "https://example.com/test"},
        )

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_returns_403_for_regular_user(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test that regular users cannot access this endpoint."""
        response = await client.get(
            "/api/v1/admin/culture/questions/check-article",
            params={"url": "https://example.com/test"},
            headers=auth_headers,
        )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_returns_used_false_for_new_url(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """Test that unused article URL returns used=false."""
        response = await client.get(
            "/api/v1/admin/culture/questions/check-article",
            params={"url": "https://example.com/brand-new-article"},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["used"] is False
        assert data["question_id"] is None

    @pytest.mark.asyncio
    async def test_returns_used_true_for_existing_url(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        pending_question,
    ):
        """Test that used article URL returns used=true with question_id."""
        response = await client.get(
            "/api/v1/admin/culture/questions/check-article",
            params={"url": pending_question.source_article_url},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["used"] is True
        assert data["question_id"] == str(pending_question.id)


# ============================================================================
# Pending Questions Endpoint Tests
# ============================================================================


class TestPendingQuestionsEndpoint:
    """Tests for GET /api/v1/admin/culture/questions/pending"""

    @pytest.mark.asyncio
    async def test_returns_401_without_auth(self, client: AsyncClient):
        """Test that unauthenticated request returns 401 Unauthorized."""
        response = await client.get("/api/v1/admin/culture/questions/pending")

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_returns_403_for_regular_user(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test that regular users cannot access this endpoint."""
        response = await client.get(
            "/api/v1/admin/culture/questions/pending",
            headers=auth_headers,
        )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_returns_pending_questions(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        pending_question,
    ):
        """Test that pending questions are returned."""
        response = await client.get(
            "/api/v1/admin/culture/questions/pending",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1
        assert len(data["questions"]) >= 1

        # Find our question in the list
        question_ids = [q["id"] for q in data["questions"]]
        assert str(pending_question.id) in question_ids

    @pytest.mark.asyncio
    async def test_excludes_non_pending_questions(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        approved_question,
    ):
        """Test that approved questions are not returned."""
        response = await client.get(
            "/api/v1/admin/culture/questions/pending",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        question_ids = [q["id"] for q in data["questions"]]
        assert str(approved_question.id) not in question_ids

    @pytest.mark.asyncio
    async def test_pagination(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        multiple_pending_questions,
    ):
        """Test pagination parameters work correctly."""
        response = await client.get(
            "/api/v1/admin/culture/questions/pending",
            params={"page": 1, "page_size": 5},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 1
        assert data["page_size"] == 5
        assert len(data["questions"]) == 5  # Should return exactly 5
        assert data["total"] >= 15  # At least 15 pending questions

    @pytest.mark.asyncio
    async def test_pagination_second_page(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        multiple_pending_questions,
    ):
        """Test that second page returns different questions."""
        # Get first page
        response1 = await client.get(
            "/api/v1/admin/culture/questions/pending",
            params={"page": 1, "page_size": 5},
            headers=superuser_auth_headers,
        )
        page1_ids = [q["id"] for q in response1.json()["questions"]]

        # Get second page
        response2 = await client.get(
            "/api/v1/admin/culture/questions/pending",
            params={"page": 2, "page_size": 5},
            headers=superuser_auth_headers,
        )
        page2_ids = [q["id"] for q in response2.json()["questions"]]

        # Pages should have different questions
        assert set(page1_ids) != set(page2_ids)

    @pytest.mark.asyncio
    async def test_response_structure(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        pending_question,
    ):
        """Test that response has correct structure."""
        response = await client.get(
            "/api/v1/admin/culture/questions/pending",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Check pagination fields
        assert "total" in data
        assert "page" in data
        assert "page_size" in data
        assert "questions" in data

        # Check question structure
        if len(data["questions"]) > 0:
            question = data["questions"][0]
            assert "id" in question
            assert "question_text" in question
            assert "option_a" in question
            assert "option_b" in question
            assert "correct_option" in question
            assert "created_at" in question


# ============================================================================
# Generate Question Endpoint Tests
# ============================================================================


class TestGenerateQuestionEndpoint:
    """Tests for POST /api/v1/admin/culture/questions/generate"""

    @pytest.mark.asyncio
    async def test_returns_401_without_auth(self, client: AsyncClient):
        """Test that unauthenticated request returns 401 Unauthorized."""
        response = await client.post(
            "/api/v1/admin/culture/questions/generate",
            json={
                "article_url": "https://example.com/test",
                "article_title": "Test",
                "fetch_history_id": str(uuid4()),
            },
        )

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_returns_403_for_regular_user(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test that regular users cannot access this endpoint."""
        response = await client.post(
            "/api/v1/admin/culture/questions/generate",
            json={
                "article_url": "https://example.com/test",
                "article_title": "Test",
                "fetch_history_id": str(uuid4()),
            },
            headers=auth_headers,
        )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_409_when_article_already_used(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        pending_question,
    ):
        """Test 409 conflict when article URL is already used."""
        response = await client.post(
            "/api/v1/admin/culture/questions/generate",
            json={
                "article_url": pending_question.source_article_url,
                "article_title": "Duplicate Article",
                "fetch_history_id": str(uuid4()),
            },
            headers=superuser_auth_headers,
        )

        assert response.status_code == 409
        data = response.json()
        # API uses custom error format: {"success": false, "error": {"message": "..."}}
        assert data["success"] is False
        assert "already" in data["error"]["message"].lower()

    @pytest.mark.asyncio
    async def test_validates_request_body(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """Test that request body is validated."""
        # Missing required fields
        response = await client.post(
            "/api/v1/admin/culture/questions/generate",
            json={},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 422  # Validation error

    @pytest.mark.asyncio
    async def test_validates_url_format(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """Test that article URL format is validated."""
        response = await client.post(
            "/api/v1/admin/culture/questions/generate",
            json={
                "article_url": "not-a-valid-url",
                "article_title": "Test",
                "fetch_history_id": str(uuid4()),
            },
            headers=superuser_auth_headers,
        )

        assert response.status_code == 422  # Validation error


# ============================================================================
# Edge Cases
# ============================================================================


class TestEdgeCases:
    """Edge case tests for culture question generation endpoints."""

    @pytest.mark.asyncio
    async def test_check_article_with_url_encoding(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """Test check-article handles URL encoding correctly."""
        # URL with special characters
        response = await client.get(
            "/api/v1/admin/culture/questions/check-article",
            params={"url": "https://example.com/article?id=123&lang=el"},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        assert response.json()["used"] is False

    @pytest.mark.asyncio
    async def test_pending_with_empty_result(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test pending endpoint returns empty list when no pending questions."""
        # Clean up any pending questions first
        from sqlalchemy import update

        await db_session.execute(update(CultureQuestion).values(is_pending_review=False))
        await db_session.commit()

        response = await client.get(
            "/api/v1/admin/culture/questions/pending",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0
        assert data["questions"] == []

    @pytest.mark.asyncio
    async def test_pending_with_large_page_number(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        pending_question,
    ):
        """Test pending endpoint with page number beyond available data."""
        response = await client.get(
            "/api/v1/admin/culture/questions/pending",
            params={"page": 1000, "page_size": 20},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        # Total should be correct but questions empty for that page
        assert data["questions"] == []
