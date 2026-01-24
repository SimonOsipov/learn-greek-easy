"""Unit tests for admin question review endpoints.

Tests cover:
- GET /api/v1/admin/culture/questions/{question_id} - Get single pending question
- POST /api/v1/admin/culture/questions/{question_id}/approve - Approve question
- Authentication and authorization requirements
- Error handling (404, 400)
"""

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.factories.culture import CultureDeckFactory, CultureQuestionFactory

# =============================================================================
# TestGetPendingQuestion - Tests for GET /api/v1/admin/culture/questions/{id}
# =============================================================================


class TestGetPendingQuestion:
    """Tests for GET /api/v1/admin/culture/questions/{question_id}."""

    @pytest.mark.asyncio
    async def test_get_pending_question_success(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test successfully fetching a pending question."""
        # Create a pending question (deck_id=None, is_pending_review=True by default for pending)
        deck = await CultureDeckFactory.create(session=db_session, is_active=True)
        # First create with deck_id, then we'll create a pending one without deck
        question = await CultureQuestionFactory.create(
            session=db_session,
            deck_id=deck.id,
        )
        # Make it a pending question
        question.deck_id = None
        question.is_pending_review = True
        await db_session.commit()
        await db_session.refresh(question)

        response = await client.get(
            f"/api/v1/admin/culture/questions/{question.id}",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(question.id)
        assert "question_text" in data
        assert data["correct_option"] == question.correct_option

    @pytest.mark.asyncio
    async def test_get_pending_question_not_found(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """Test 404 for non-existent question."""
        response = await client.get(
            f"/api/v1/admin/culture/questions/{uuid.uuid4()}",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_get_pending_question_not_pending(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test 404 for already approved question."""
        # Create an approved question (is_pending_review=False)
        deck = await CultureDeckFactory.create(session=db_session, is_active=True)
        question = await CultureQuestionFactory.create(
            session=db_session,
            deck_id=deck.id,
        )
        # Ensure it's NOT pending (default from factory is not pending)
        question.is_pending_review = False
        await db_session.commit()

        response = await client.get(
            f"/api/v1/admin/culture/questions/{question.id}",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_get_pending_question_unauthorized(
        self,
        client: AsyncClient,
    ):
        """Test 401 for unauthenticated request."""
        response = await client.get(
            f"/api/v1/admin/culture/questions/{uuid.uuid4()}",
        )

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_get_pending_question_forbidden_for_regular_user(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test 403 for regular user (not superuser)."""
        response = await client.get(
            f"/api/v1/admin/culture/questions/{uuid.uuid4()}",
            headers=auth_headers,
        )

        assert response.status_code == 403


# =============================================================================
# TestApproveQuestion - Tests for POST /api/v1/admin/culture/questions/{id}/approve
# =============================================================================


class TestApproveQuestion:
    """Tests for POST /api/v1/admin/culture/questions/{question_id}/approve."""

    @pytest.mark.asyncio
    async def test_approve_question_success(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test successfully approving a question."""
        # Create active deck
        deck = await CultureDeckFactory.create(session=db_session, is_active=True)

        # Create a pending question
        question = await CultureQuestionFactory.create(
            session=db_session,
            deck_id=deck.id,
        )
        question.deck_id = None
        question.is_pending_review = True
        await db_session.commit()
        await db_session.refresh(question)

        response = await client.post(
            f"/api/v1/admin/culture/questions/{question.id}/approve",
            headers=superuser_auth_headers,
            json={"deck_id": str(deck.id)},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(question.id)
        assert data["deck_id"] == str(deck.id)
        assert data["is_pending_review"] is False
        assert data["message"] == "Question approved successfully"

    @pytest.mark.asyncio
    async def test_approve_question_invalid_deck(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test 400 for non-existent deck."""
        # Create a pending question
        deck = await CultureDeckFactory.create(session=db_session, is_active=True)
        question = await CultureQuestionFactory.create(
            session=db_session,
            deck_id=deck.id,
        )
        question.deck_id = None
        question.is_pending_review = True
        await db_session.commit()

        response = await client.post(
            f"/api/v1/admin/culture/questions/{question.id}/approve",
            headers=superuser_auth_headers,
            json={"deck_id": str(uuid.uuid4())},  # Non-existent deck
        )

        assert response.status_code == 400
        data = response.json()
        assert data["success"] is False
        assert "Invalid deck_id" in data["error"]["message"]

    @pytest.mark.asyncio
    async def test_approve_question_inactive_deck(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test 400 for inactive deck."""
        # Create inactive deck
        inactive_deck = await CultureDeckFactory.create(session=db_session, is_active=False)

        # Create active deck first for the question factory, then make a pending question
        active_deck = await CultureDeckFactory.create(session=db_session, is_active=True)
        question = await CultureQuestionFactory.create(
            session=db_session,
            deck_id=active_deck.id,
        )
        question.deck_id = None
        question.is_pending_review = True
        await db_session.commit()

        response = await client.post(
            f"/api/v1/admin/culture/questions/{question.id}/approve",
            headers=superuser_auth_headers,
            json={"deck_id": str(inactive_deck.id)},
        )

        assert response.status_code == 400
        data = response.json()
        assert data["success"] is False
        assert "not active" in data["error"]["message"]

    @pytest.mark.asyncio
    async def test_approve_question_not_found(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test 404 for non-existent question."""
        deck = await CultureDeckFactory.create(session=db_session, is_active=True)

        response = await client.post(
            f"/api/v1/admin/culture/questions/{uuid.uuid4()}/approve",
            headers=superuser_auth_headers,
            json={"deck_id": str(deck.id)},
        )

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_approve_question_already_approved(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test 404 for already approved question."""
        deck = await CultureDeckFactory.create(session=db_session, is_active=True)
        # Create an already approved question (is_pending_review=False)
        question = await CultureQuestionFactory.create(
            session=db_session,
            deck_id=deck.id,
        )
        question.is_pending_review = False
        await db_session.commit()

        response = await client.post(
            f"/api/v1/admin/culture/questions/{question.id}/approve",
            headers=superuser_auth_headers,
            json={"deck_id": str(deck.id)},
        )

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_approve_question_unauthorized(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """Test 401 for unauthenticated request."""
        deck = await CultureDeckFactory.create(session=db_session, is_active=True)

        response = await client.post(
            f"/api/v1/admin/culture/questions/{uuid.uuid4()}/approve",
            json={"deck_id": str(deck.id)},
        )

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_approve_question_forbidden_for_regular_user(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test 403 for regular user (not superuser)."""
        deck = await CultureDeckFactory.create(session=db_session, is_active=True)

        response = await client.post(
            f"/api/v1/admin/culture/questions/{uuid.uuid4()}/approve",
            headers=auth_headers,
            json={"deck_id": str(deck.id)},
        )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_approve_question_invalid_deck_id_format(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """Test 422 for invalid deck_id format."""
        response = await client.post(
            f"/api/v1/admin/culture/questions/{uuid.uuid4()}/approve",
            headers=superuser_auth_headers,
            json={"deck_id": "not-a-uuid"},
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_approve_question_missing_deck_id(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """Test 422 for missing deck_id in request."""
        response = await client.post(
            f"/api/v1/admin/culture/questions/{uuid.uuid4()}/approve",
            headers=superuser_auth_headers,
            json={},  # Missing deck_id
        )

        assert response.status_code == 422
