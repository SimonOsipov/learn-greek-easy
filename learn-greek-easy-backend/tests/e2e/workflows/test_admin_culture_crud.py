"""E2E tests for admin culture deck and question CRUD operations.

These tests cover the admin endpoints that have lower coverage:
- POST /api/v1/culture/decks - Create culture deck (superuser only)
- PATCH /api/v1/culture/decks/{deck_id} - Update culture deck (superuser only)
- DELETE /api/v1/culture/decks/{deck_id} - Soft delete deck (superuser only)
- POST /api/v1/culture/questions - Create single question (superuser only)
- POST /api/v1/culture/questions/bulk - Bulk create questions (superuser only)
- PATCH /api/v1/culture/questions/{question_id} - Update question (superuser only)
- DELETE /api/v1/culture/questions/{question_id} - Delete question (superuser only)

Run with:
    pytest tests/e2e/workflows/test_admin_culture_crud.py -v
"""

from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.e2e.conftest import E2ETestCase, UserSession
from tests.factories.culture import CultureDeckFactory, CultureQuestionFactory

# =============================================================================
# Helper data for tests
# =============================================================================


def get_valid_deck_data() -> dict:
    """Get valid deck creation data."""
    return {
        "name_el": "Ελληνική Ιστορία Τεστ",
        "name_en": "Greek History Test",
        "name_ru": "Тест греческой истории",
        "description_el": "Δοκιμαστική περιγραφή για E2E",
        "description_en": "Test description for E2E",
        "description_ru": "Тестовое описание для E2E",
        "category": "history",
    }


def get_valid_question_data(deck_id: str) -> dict:
    """Get valid question creation data."""
    return {
        "deck_id": deck_id,
        "question_text": {
            "el": "Ερώτηση τεστ;",
            "en": "Test question for E2E?",
            "ru": "Тестовый вопрос?",
        },
        "option_a": {"el": "Α", "en": "Option A", "ru": "Вариант А"},
        "option_b": {"el": "Β", "en": "Option B", "ru": "Вариант Б"},
        "option_c": {"el": "Γ", "en": "Option C", "ru": "Вариант В"},
        "option_d": {"el": "Δ", "en": "Option D", "ru": "Вариант Г"},
        "correct_option": 2,
    }


# =============================================================================
# Test Admin Deck CRUD
# =============================================================================


@pytest.mark.e2e
@pytest.mark.workflow
class TestAdminDeckCreate(E2ETestCase):
    """E2E tests for creating culture decks as admin."""

    @pytest.mark.asyncio
    async def test_create_deck_as_superuser(
        self,
        client: AsyncClient,
        admin_session: UserSession,
    ) -> None:
        """Test that superuser can create a culture deck."""
        deck_data = get_valid_deck_data()

        response = await client.post(
            "/api/v1/culture/decks",
            json=deck_data,
            headers=admin_session.headers,
        )

        assert response.status_code == 201
        data = response.json()

        assert data["name_en"] == "Greek History Test"
        assert data["category"] == "history"
        assert data["is_active"] is True

    @pytest.mark.asyncio
    async def test_create_deck_response_structure(
        self,
        client: AsyncClient,
        admin_session: UserSession,
    ) -> None:
        """Test that deck creation returns correct structure."""
        deck_data = get_valid_deck_data()

        response = await client.post(
            "/api/v1/culture/decks",
            json=deck_data,
            headers=admin_session.headers,
        )

        assert response.status_code == 201
        data = response.json()

        # Required fields
        required_fields = [
            "id",
            "name_el",
            "name_en",
            "name_ru",
            "description_el",
            "description_en",
            "description_ru",
            "category",
            "question_count",
            "is_active",
            "created_at",
            "updated_at",
        ]
        for field in required_fields:
            assert field in data, f"Missing field: {field}"

        # Name and description are now trilingual strings
        assert isinstance(data["name_en"], str)
        assert isinstance(data["description_en"], str)

    @pytest.mark.asyncio
    async def test_create_deck_forbidden_for_regular_user(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
    ) -> None:
        """Test that regular user cannot create a culture deck."""
        deck_data = get_valid_deck_data()

        response = await client.post(
            "/api/v1/culture/decks",
            json=deck_data,
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_create_deck_unauthenticated(
        self,
        client: AsyncClient,
    ) -> None:
        """Test that unauthenticated request is rejected."""
        deck_data = get_valid_deck_data()

        response = await client.post(
            "/api/v1/culture/decks",
            json=deck_data,
        )

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_create_deck_all_categories_accepted(
        self,
        client: AsyncClient,
        admin_session: UserSession,
    ) -> None:
        """Test that valid categories are accepted."""
        valid_categories = ["history", "geography", "politics", "culture", "traditions"]

        for category in valid_categories:
            deck_data = get_valid_deck_data()
            deck_data["category"] = category
            # Make name unique per category
            deck_data["name_el"] = f"Δοκιμή {category} τράπουλα"
            deck_data["name_en"] = f"Test {category} deck"
            deck_data["name_ru"] = f"Тест {category} колода"

            response = await client.post(
                "/api/v1/culture/decks",
                json=deck_data,
                headers=admin_session.headers,
            )

            assert response.status_code == 201, f"Category '{category}' should be accepted"


@pytest.mark.e2e
@pytest.mark.workflow
class TestAdminDeckUpdate(E2ETestCase):
    """E2E tests for updating culture decks as admin."""

    @pytest.mark.asyncio
    async def test_update_deck_as_superuser(
        self,
        client: AsyncClient,
        admin_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test that superuser can update a culture deck."""
        # Create a deck first
        deck = await CultureDeckFactory.create(session=db_session)
        await db_session.commit()

        # Update it
        response = await client.patch(
            f"/api/v1/culture/decks/{deck.id}",
            json={"category": "geography"},
            headers=admin_session.headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["category"] == "geography"

    @pytest.mark.asyncio
    async def test_update_deck_partial_update(
        self,
        client: AsyncClient,
        admin_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test that partial updates work correctly."""
        deck = await CultureDeckFactory.create(session=db_session)
        await db_session.commit()

        original_name_en = deck.name_en

        # Update only category
        response = await client.patch(
            f"/api/v1/culture/decks/{deck.id}",
            json={"category": "geography"},
            headers=admin_session.headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["category"] == "geography"
        # Name should remain unchanged
        assert data["name_en"] == original_name_en

    @pytest.mark.asyncio
    async def test_update_deck_not_found(
        self,
        client: AsyncClient,
        admin_session: UserSession,
    ) -> None:
        """Test that updating non-existent deck returns 404."""
        fake_id = str(uuid4())

        response = await client.patch(
            f"/api/v1/culture/decks/{fake_id}",
            json={"category": "geography"},
            headers=admin_session.headers,
        )

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_update_deck_forbidden_for_regular_user(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test that regular user cannot update a culture deck."""
        deck = await CultureDeckFactory.create(session=db_session)
        await db_session.commit()

        response = await client.patch(
            f"/api/v1/culture/decks/{deck.id}",
            json={"category": "geography"},
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 403


@pytest.mark.e2e
@pytest.mark.workflow
class TestAdminDeckDelete(E2ETestCase):
    """E2E tests for deleting culture decks as admin."""

    @pytest.mark.asyncio
    async def test_delete_deck_as_superuser(
        self,
        client: AsyncClient,
        admin_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test that superuser can soft delete a culture deck."""
        deck = await CultureDeckFactory.create(session=db_session)
        await db_session.commit()

        response = await client.delete(
            f"/api/v1/culture/decks/{deck.id}",
            headers=admin_session.headers,
        )

        assert response.status_code == 204

        # Verify deck is now inactive (not accessible)
        get_response = await client.get(
            f"/api/v1/culture/decks/{deck.id}",
            headers=admin_session.headers,
        )
        assert get_response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_deck_idempotent(
        self,
        client: AsyncClient,
        admin_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test that deleting already-inactive deck is idempotent."""
        deck = await CultureDeckFactory.create(session=db_session, inactive=True)
        await db_session.commit()

        # Should still return 204 (idempotent)
        response = await client.delete(
            f"/api/v1/culture/decks/{deck.id}",
            headers=admin_session.headers,
        )

        # Either 204 or 404 is acceptable for already-deleted
        assert response.status_code in [204, 404]

    @pytest.mark.asyncio
    async def test_delete_deck_not_found(
        self,
        client: AsyncClient,
        admin_session: UserSession,
    ) -> None:
        """Test that deleting non-existent deck returns 404."""
        fake_id = str(uuid4())

        response = await client.delete(
            f"/api/v1/culture/decks/{fake_id}",
            headers=admin_session.headers,
        )

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_deck_forbidden_for_regular_user(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test that regular user cannot delete a culture deck."""
        deck = await CultureDeckFactory.create(session=db_session)
        await db_session.commit()

        response = await client.delete(
            f"/api/v1/culture/decks/{deck.id}",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 403


# =============================================================================
# Test Admin Question CRUD
# =============================================================================


@pytest.mark.e2e
@pytest.mark.workflow
class TestAdminQuestionCreate(E2ETestCase):
    """E2E tests for creating culture questions as admin."""

    @pytest.mark.asyncio
    async def test_create_question_as_superuser(
        self,
        client: AsyncClient,
        admin_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test that superuser can create a culture question."""
        deck = await CultureDeckFactory.create(session=db_session)
        await db_session.commit()

        question_data = get_valid_question_data(str(deck.id))

        response = await client.post(
            "/api/v1/culture/questions",
            json=question_data,
            headers=admin_session.headers,
        )

        assert response.status_code == 201
        data = response.json()

        assert data["correct_option"] == 2
        assert "id" in data
        assert "question_text" in data

    @pytest.mark.asyncio
    async def test_create_question_response_structure(
        self,
        client: AsyncClient,
        admin_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test that question creation returns correct structure."""
        deck = await CultureDeckFactory.create(session=db_session)
        await db_session.commit()

        question_data = get_valid_question_data(str(deck.id))

        response = await client.post(
            "/api/v1/culture/questions",
            json=question_data,
            headers=admin_session.headers,
        )

        assert response.status_code == 201
        data = response.json()

        # Required fields
        required_fields = [
            "id",
            "deck_id",
            "question_text",
            "option_a",
            "option_b",
            "option_c",
            "option_d",
            "correct_option",
        ]
        for field in required_fields:
            assert field in data, f"Missing field: {field}"

    @pytest.mark.asyncio
    async def test_create_question_deck_not_found(
        self,
        client: AsyncClient,
        admin_session: UserSession,
    ) -> None:
        """Test that creating question for non-existent deck returns 404."""
        fake_deck_id = str(uuid4())
        question_data = get_valid_question_data(fake_deck_id)

        response = await client.post(
            "/api/v1/culture/questions",
            json=question_data,
            headers=admin_session.headers,
        )

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_create_question_invalid_option(
        self,
        client: AsyncClient,
        admin_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test that invalid correct_option is rejected."""
        deck = await CultureDeckFactory.create(session=db_session)
        await db_session.commit()

        question_data = get_valid_question_data(str(deck.id))
        question_data["correct_option"] = 5  # Invalid (must be 1-4)

        response = await client.post(
            "/api/v1/culture/questions",
            json=question_data,
            headers=admin_session.headers,
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_question_forbidden_for_regular_user(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test that regular user cannot create a culture question."""
        deck = await CultureDeckFactory.create(session=db_session)
        await db_session.commit()

        question_data = get_valid_question_data(str(deck.id))

        response = await client.post(
            "/api/v1/culture/questions",
            json=question_data,
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 403


@pytest.mark.e2e
@pytest.mark.workflow
class TestAdminQuestionBulkCreate(E2ETestCase):
    """E2E tests for bulk creating culture questions as admin."""

    @pytest.mark.asyncio
    async def test_bulk_create_questions_as_superuser(
        self,
        client: AsyncClient,
        admin_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test that superuser can bulk create culture questions."""
        deck = await CultureDeckFactory.create(session=db_session)
        await db_session.commit()

        questions = []
        for i in range(3):
            q = {
                "question_text": {
                    "el": f"Ερώτηση {i}",
                    "en": f"Question {i}",
                    "ru": f"Вопрос {i}",
                },
                "option_a": {"el": "Α", "en": "A", "ru": "А"},
                "option_b": {"el": "Β", "en": "B", "ru": "Б"},
                "option_c": {"el": "Γ", "en": "C", "ru": "В"},
                "option_d": {"el": "Δ", "en": "D", "ru": "Г"},
                "correct_option": (i % 4) + 1,
            }
            questions.append(q)

        response = await client.post(
            "/api/v1/culture/questions/bulk",
            json={
                "deck_id": str(deck.id),
                "questions": questions,
            },
            headers=admin_session.headers,
        )

        assert response.status_code == 201
        data = response.json()

        assert "questions" in data
        assert len(data["questions"]) == 3

    @pytest.mark.asyncio
    async def test_bulk_create_empty_array_rejected(
        self,
        client: AsyncClient,
        admin_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test that empty questions array is rejected."""
        deck = await CultureDeckFactory.create(session=db_session)
        await db_session.commit()

        response = await client.post(
            "/api/v1/culture/questions/bulk",
            json={
                "deck_id": str(deck.id),
                "questions": [],
            },
            headers=admin_session.headers,
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_bulk_create_deck_not_found(
        self,
        client: AsyncClient,
        admin_session: UserSession,
    ) -> None:
        """Test that bulk creating for non-existent deck returns 404."""
        fake_deck_id = str(uuid4())

        response = await client.post(
            "/api/v1/culture/questions/bulk",
            json={
                "deck_id": fake_deck_id,
                "questions": [
                    {
                        "question_text": {"el": "Q", "en": "Q", "ru": "В"},
                        "option_a": {"el": "A", "en": "A", "ru": "А"},
                        "option_b": {"el": "B", "en": "B", "ru": "Б"},
                        "option_c": {"el": "C", "en": "C", "ru": "В"},
                        "option_d": {"el": "D", "en": "D", "ru": "Г"},
                        "correct_option": 1,
                    }
                ],
            },
            headers=admin_session.headers,
        )

        assert response.status_code == 404


@pytest.mark.e2e
@pytest.mark.workflow
class TestAdminQuestionUpdate(E2ETestCase):
    """E2E tests for updating culture questions as admin."""

    @pytest.mark.asyncio
    async def test_update_question_as_superuser(
        self,
        client: AsyncClient,
        admin_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test that superuser can update a culture question."""
        deck = await CultureDeckFactory.create(session=db_session)
        question = await CultureQuestionFactory.create(
            session=db_session, deck_id=deck.id, correct_option=1
        )
        await db_session.commit()

        response = await client.patch(
            f"/api/v1/culture/questions/{question.id}",
            json={"correct_option": 3},
            headers=admin_session.headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["correct_option"] == 3

    @pytest.mark.asyncio
    async def test_update_question_not_found(
        self,
        client: AsyncClient,
        admin_session: UserSession,
    ) -> None:
        """Test that updating non-existent question returns 404."""
        fake_id = str(uuid4())

        response = await client.patch(
            f"/api/v1/culture/questions/{fake_id}",
            json={"correct_option": 3},
            headers=admin_session.headers,
        )

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_update_question_forbidden_for_regular_user(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test that regular user cannot update a culture question."""
        deck = await CultureDeckFactory.create(session=db_session)
        question = await CultureQuestionFactory.create(session=db_session, deck_id=deck.id)
        await db_session.commit()

        response = await client.patch(
            f"/api/v1/culture/questions/{question.id}",
            json={"correct_option": 3},
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 403


@pytest.mark.e2e
@pytest.mark.workflow
class TestAdminQuestionDelete(E2ETestCase):
    """E2E tests for deleting culture questions as admin."""

    @pytest.mark.asyncio
    async def test_delete_question_as_superuser(
        self,
        client: AsyncClient,
        admin_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test that superuser can hard delete a culture question."""
        deck = await CultureDeckFactory.create(session=db_session)
        question = await CultureQuestionFactory.create(session=db_session, deck_id=deck.id)
        await db_session.commit()

        response = await client.delete(
            f"/api/v1/culture/questions/{question.id}",
            headers=admin_session.headers,
        )

        assert response.status_code == 204

    @pytest.mark.asyncio
    async def test_delete_question_not_found(
        self,
        client: AsyncClient,
        admin_session: UserSession,
    ) -> None:
        """Test that deleting non-existent question returns 404."""
        fake_id = str(uuid4())

        response = await client.delete(
            f"/api/v1/culture/questions/{fake_id}",
            headers=admin_session.headers,
        )

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_question_forbidden_for_regular_user(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test that regular user cannot delete a culture question."""
        deck = await CultureDeckFactory.create(session=db_session)
        question = await CultureQuestionFactory.create(session=db_session, deck_id=deck.id)
        await db_session.commit()

        response = await client.delete(
            f"/api/v1/culture/questions/{question.id}",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 403


# =============================================================================
# Test Complete Admin Workflow
# =============================================================================


@pytest.mark.e2e
@pytest.mark.workflow
class TestAdminCultureWorkflow(E2ETestCase):
    """E2E tests for complete admin culture management workflow."""

    @pytest.mark.asyncio
    async def test_complete_admin_workflow(
        self,
        client: AsyncClient,
        admin_session: UserSession,
        fresh_user_session: UserSession,
    ) -> None:
        """Test complete workflow: create deck -> add questions -> user can use."""
        # 1. Admin creates deck
        deck_data = get_valid_deck_data()
        deck_response = await client.post(
            "/api/v1/culture/decks",
            json=deck_data,
            headers=admin_session.headers,
        )
        assert deck_response.status_code == 201
        deck_id = deck_response.json()["id"]

        # 2. Admin adds questions
        questions = []
        for i in range(3):
            q = {
                "question_text": {"el": f"Q{i}", "en": f"Question {i}", "ru": f"В{i}"},
                "option_a": {"el": "A", "en": "Option A", "ru": "А"},
                "option_b": {"el": "B", "en": "Option B", "ru": "Б"},
                "option_c": {"el": "C", "en": "Option C", "ru": "В"},
                "option_d": {"el": "D", "en": "Option D", "ru": "Г"},
                "correct_option": (i % 4) + 1,
            }
            questions.append(q)

        bulk_response = await client.post(
            "/api/v1/culture/questions/bulk",
            json={
                "deck_id": deck_id,
                "questions": questions,
            },
            headers=admin_session.headers,
        )
        assert bulk_response.status_code == 201
        assert len(bulk_response.json()["questions"]) == 3

        # 3. Regular user can see the deck
        list_response = await client.get(
            "/api/v1/culture/decks",
            headers=fresh_user_session.headers,
        )
        assert list_response.status_code == 200
        decks = list_response.json()["decks"]
        found = any(d["id"] == deck_id for d in decks)
        assert found, "User should see the new deck"

        # 4. Regular user can get question queue
        queue_response = await client.get(
            f"/api/v1/culture/decks/{deck_id}/questions",
            headers=fresh_user_session.headers,
        )
        assert queue_response.status_code == 200
        queue = queue_response.json()
        assert queue["total_in_queue"] >= 1

        # 5. Admin updates a question
        question_id = bulk_response.json()["questions"][0]["id"]
        update_response = await client.patch(
            f"/api/v1/culture/questions/{question_id}",
            json={"correct_option": 4},
            headers=admin_session.headers,
        )
        assert update_response.status_code == 200
        assert update_response.json()["correct_option"] == 4

        # 6. Admin soft-deletes the deck
        delete_response = await client.delete(
            f"/api/v1/culture/decks/{deck_id}",
            headers=admin_session.headers,
        )
        assert delete_response.status_code == 204

        # 7. Verify deck is no longer accessible
        get_response = await client.get(
            f"/api/v1/culture/decks/{deck_id}",
            headers=fresh_user_session.headers,
        )
        assert get_response.status_code == 404
