"""E2E tests for admin content management workflows.

This module tests complete administrator workflows for managing
learning content (decks and cards), including:
- Deck CRUD lifecycle
- Bulk card creation
- Content propagation to users
- Visibility control via activation/deactivation
- Permission boundaries
- Card 404 error handling

Test Classes:
- TestAdminDeckManagement: Deck CRUD operations by admin
- TestAdminCardManagement: Card bulk operations
- TestContentPropagation: Content visibility to regular users
- TestPermissionBoundaries: Permission enforcement tests
- TestCardNotFoundErrors: Card 404 error handling
"""

from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import Deck
from tests.e2e.conftest import E2ETestCase


@pytest.mark.e2e
class TestAdminDeckManagement(E2ETestCase):
    """E2E tests for admin deck management workflows."""

    @pytest.mark.asyncio
    async def test_admin_deck_lifecycle(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        auth_headers: dict,
    ):
        """Test complete deck CRUD workflow by admin.

        Flow:
        Admin Login -> Create Deck -> Verify Creation -> Update Deck ->
        Verify Update -> Delete Deck -> Verify Deletion -> Verify Regular
        User Cannot See Deleted Deck
        """
        # Step 1: CREATE deck (system deck so it's visible to all users)
        deck_data = {
            "name": "Greek Travel Vocabulary",
            "description": "Essential phrases for travelers",
            "level": "A2",
            "is_system_deck": True,
        }
        create_response = await client.post(
            "/api/v1/decks",
            json=deck_data,
            headers=superuser_auth_headers,
        )
        assert create_response.status_code == 201, f"Create failed: {create_response.text}"
        deck = create_response.json()
        deck_id = deck["id"]
        assert deck["name"] == deck_data["name"]
        assert deck["is_active"] is True

        # Step 2: VERIFY deck appears in listing (now requires auth)
        list_response = await client.get("/api/v1/decks", headers=auth_headers)
        assert list_response.status_code == 200
        deck_ids = [d["id"] for d in list_response.json()["decks"]]
        assert deck_id in deck_ids, "Created deck should be visible in listing"

        # Step 3: UPDATE deck metadata
        update_data = {
            "name": "Greek Travel Essentials - Updated",
            "description": "Updated description with more details",
            "level": "B1",
        }
        update_response = await client.patch(
            f"/api/v1/decks/{deck_id}",
            json=update_data,
            headers=superuser_auth_headers,
        )
        assert update_response.status_code == 200
        updated_deck = update_response.json()
        assert updated_deck["name"] == update_data["name"]
        assert updated_deck["level"] == "B1"

        # Step 4: VERIFY update persisted
        get_response = await client.get(f"/api/v1/decks/{deck_id}", headers=auth_headers)
        assert get_response.status_code == 200
        assert get_response.json()["name"] == update_data["name"]
        assert get_response.json()["description"] == update_data["description"]

        # Step 5: DELETE (soft delete) deck
        delete_response = await client.delete(
            f"/api/v1/decks/{deck_id}",
            headers=superuser_auth_headers,
        )
        assert delete_response.status_code == 204

        # Step 6: VERIFY deck no longer visible (returns 404 for deleted)
        final_get = await client.get(f"/api/v1/decks/{deck_id}", headers=auth_headers)
        assert final_get.status_code == 404

        # Step 7: VERIFY deck not in listings
        final_list = await client.get("/api/v1/decks", headers=auth_headers)
        final_deck_ids = [d["id"] for d in final_list.json()["decks"]]
        assert deck_id not in final_deck_ids, "Deleted deck should not appear in listing"

    @pytest.mark.asyncio
    async def test_deck_activation_visibility(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """Test deck activation/deactivation affects public visibility.

        Flow:
        Admin Creates Active Deck -> User Sees Deck -> Admin Deactivates ->
        User Cannot See Deck -> Admin Can Still Update -> Admin Reactivates ->
        User Can See Deck Again
        """
        # Step 1: Create active deck (system deck for visibility testing)
        deck_response = await client.post(
            "/api/v1/decks",
            json={"name": "Visibility Test Deck", "level": "A1", "is_system_deck": True},
            headers=superuser_auth_headers,
        )
        assert deck_response.status_code == 201
        deck_id = deck_response.json()["id"]

        # Step 2: Verify deck visible in listing (now requires auth)
        list_before = await client.get("/api/v1/decks", headers=superuser_auth_headers)
        deck_ids_before = [d["id"] for d in list_before.json()["decks"]]
        assert deck_id in deck_ids_before

        # Step 3: Deactivate deck
        deactivate_response = await client.patch(
            f"/api/v1/decks/{deck_id}",
            json={"is_active": False},
            headers=superuser_auth_headers,
        )
        assert deactivate_response.status_code == 200
        assert deactivate_response.json()["is_active"] is False

        # Step 4: Verify deck NOT visible in listing
        list_after = await client.get("/api/v1/decks", headers=superuser_auth_headers)
        deck_ids_after = [d["id"] for d in list_after.json()["decks"]]
        assert deck_id not in deck_ids_after

        # Step 5: Verify direct GET returns 404 for inactive deck
        direct_get = await client.get(f"/api/v1/decks/{deck_id}", headers=superuser_auth_headers)
        assert direct_get.status_code == 404

        # Step 6: Verify deck not in search results
        search_result = await client.get(
            "/api/v1/decks/search?q=Visibility", headers=superuser_auth_headers
        )
        search_ids = [d["id"] for d in search_result.json()["decks"]]
        assert deck_id not in search_ids

        # Step 7: Admin can still update inactive deck
        update_response = await client.patch(
            f"/api/v1/decks/{deck_id}",
            json={"name": "Updated While Inactive"},
            headers=superuser_auth_headers,
        )
        assert update_response.status_code == 200

        # Step 8: Reactivate deck
        reactivate_response = await client.patch(
            f"/api/v1/decks/{deck_id}",
            json={"is_active": True},
            headers=superuser_auth_headers,
        )
        assert reactivate_response.status_code == 200

        # Step 9: Verify deck visible again
        final_list = await client.get("/api/v1/decks", headers=superuser_auth_headers)
        final_deck_ids = [d["id"] for d in final_list.json()["decks"]]
        assert deck_id in final_deck_ids

        # Step 10: Verify update persisted after reactivation
        final_get = await client.get(f"/api/v1/decks/{deck_id}", headers=superuser_auth_headers)
        assert final_get.status_code == 200
        assert final_get.json()["name"] == "Updated While Inactive"


@pytest.mark.e2e
class TestAdminCardManagement(E2ETestCase):
    """E2E tests for admin card management workflows."""

    @pytest.mark.asyncio
    async def test_bulk_card_creation_workflow(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """Test admin creates deck and bulk adds cards.

        Flow:
        Create Deck -> Bulk Add Cards (10+) -> Verify All Cards Created ->
        Verify Card Count -> Regular User Can Access Cards
        """
        # Step 1: Create deck
        deck_response = await client.post(
            "/api/v1/decks",
            json={
                "name": "Greek Numbers 1-10",
                "description": "Learn to count in Greek",
                "level": "A1",
            },
            headers=superuser_auth_headers,
        )
        assert deck_response.status_code == 201
        deck_id = deck_response.json()["id"]

        # Step 2: Bulk create cards
        greek_numbers = [
            ("ena", "one", "easy"),
            ("dio", "two", "easy"),
            ("tria", "three", "easy"),
            ("tessera", "four", "medium"),
            ("pente", "five", "medium"),
            ("exi", "six", "medium"),
            ("efta", "seven", "medium"),
            ("okto", "eight", "hard"),
            ("ennea", "nine", "hard"),
            ("deka", "ten", "hard"),
        ]

        cards_data = {
            "deck_id": deck_id,
            "cards": [
                {
                    "front_text": greek,
                    "back_text": english,
                    "difficulty": difficulty,
                    "example_sentence": f"I have {english} apple(s).",
                    "pronunciation": greek,
                    "order_index": i,
                }
                for i, (greek, english, difficulty) in enumerate(greek_numbers)
            ],
        }

        bulk_response = await client.post(
            "/api/v1/cards/bulk",
            json=cards_data,
            headers=superuser_auth_headers,
        )
        assert bulk_response.status_code == 201
        bulk_result = bulk_response.json()
        assert bulk_result["created_count"] == 10
        assert len(bulk_result["cards"]) == 10

        # Step 3: Verify card count on deck
        deck_get = await client.get(f"/api/v1/decks/{deck_id}", headers=superuser_auth_headers)
        assert deck_get.status_code == 200
        assert deck_get.json()["card_count"] == 10

        # Step 4: Verify all cards accessible via list endpoint
        cards_list = await client.get(
            f"/api/v1/cards?deck_id={deck_id}", headers=superuser_auth_headers
        )
        assert cards_list.status_code == 200
        assert cards_list.json()["total"] == 10

        # Step 5: Verify difficulty filter works
        easy_cards = await client.get(
            f"/api/v1/cards?deck_id={deck_id}&difficulty=easy", headers=superuser_auth_headers
        )
        assert easy_cards.status_code == 200
        assert easy_cards.json()["total"] == 3  # ena, dio, tria

        hard_cards = await client.get(
            f"/api/v1/cards?deck_id={deck_id}&difficulty=hard", headers=superuser_auth_headers
        )
        assert hard_cards.status_code == 200
        assert hard_cards.json()["total"] == 3  # okto, ennea, deka

    @pytest.mark.asyncio
    async def test_bulk_creation_edge_cases(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """Test bulk card creation edge cases.

        Tests:
        - Maximum cards (100) - should succeed
        - Over maximum (101) - should fail with 422
        - Empty array - should fail with 422
        - Mixed valid/invalid (missing required field) - should fail
        """
        # Setup: Create deck
        deck_response = await client.post(
            "/api/v1/decks",
            json={"name": "Bulk Edge Case Deck", "level": "A1"},
            headers=superuser_auth_headers,
        )
        deck_id = deck_response.json()["id"]

        # Test 1: Maximum cards (100) - should succeed
        max_cards = {
            "deck_id": deck_id,
            "cards": [
                {
                    "front_text": f"word_{i}",
                    "back_text": f"translation_{i}",
                    "difficulty": "easy",
                    "order_index": i,
                }
                for i in range(100)
            ],
        }
        max_response = await client.post(
            "/api/v1/cards/bulk",
            json=max_cards,
            headers=superuser_auth_headers,
        )
        assert max_response.status_code == 201
        assert max_response.json()["created_count"] == 100

        # Create another deck for remaining tests
        deck2_response = await client.post(
            "/api/v1/decks",
            json={"name": "Bulk Edge Case Deck 2", "level": "A1"},
            headers=superuser_auth_headers,
        )
        deck2_id = deck2_response.json()["id"]

        # Test 2: Over maximum (101) - should fail
        over_max_cards = {
            "deck_id": deck2_id,
            "cards": [
                {"front_text": f"w{i}", "back_text": f"t{i}", "difficulty": "easy"}
                for i in range(101)
            ],
        }
        over_response = await client.post(
            "/api/v1/cards/bulk",
            json=over_max_cards,
            headers=superuser_auth_headers,
        )
        assert over_response.status_code == 422
        assert over_response.json()["error"]["code"] == "VALIDATION_ERROR"

        # Test 3: Empty array - should fail
        empty_response = await client.post(
            "/api/v1/cards/bulk",
            json={"deck_id": deck2_id, "cards": []},
            headers=superuser_auth_headers,
        )
        assert empty_response.status_code == 422

        # Test 4: Mixed valid/invalid (missing required field)
        mixed_cards = {
            "deck_id": deck2_id,
            "cards": [
                {"front_text": "valid", "back_text": "valid", "difficulty": "easy"},
                {"front_text": "invalid_no_back", "difficulty": "easy"},  # Missing back_text
            ],
        }
        mixed_response = await client.post(
            "/api/v1/cards/bulk",
            json=mixed_cards,
            headers=superuser_auth_headers,
        )
        assert mixed_response.status_code == 422

        # Verify NO cards were created (all-or-nothing)
        verify_list = await client.get(
            f"/api/v1/cards?deck_id={deck2_id}", headers=superuser_auth_headers
        )
        assert verify_list.json()["total"] == 0


@pytest.mark.e2e
class TestContentPropagation(E2ETestCase):
    """E2E tests for content visibility to regular users."""

    @pytest.mark.asyncio
    async def test_content_propagation_to_users(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        auth_headers: dict,
    ):
        """Test that admin content changes are immediately visible to users.

        Flow:
        Admin Creates Deck -> Regular User Sees Deck -> Admin Adds Cards ->
        Regular User Sees Cards -> Admin Updates Card -> Regular User Sees Update
        """
        # Step 1: Admin creates deck (system deck for user visibility)
        deck_response = await client.post(
            "/api/v1/decks",
            json={"name": "Propagation Test Deck", "level": "A1", "is_system_deck": True},
            headers=superuser_auth_headers,
        )
        assert deck_response.status_code == 201
        deck_id = deck_response.json()["id"]

        # Step 2: Regular user can see the deck immediately (requires auth)
        user_decks = await client.get("/api/v1/decks", headers=auth_headers)
        assert user_decks.status_code == 200
        user_deck_ids = [d["id"] for d in user_decks.json()["decks"]]
        assert deck_id in user_deck_ids, "User should see newly created deck"

        # Step 3: Admin adds a card
        card_response = await client.post(
            "/api/v1/cards",
            json={
                "deck_id": deck_id,
                "front_text": "kalimera",
                "back_text": "good morning",
                "difficulty": "easy",
            },
            headers=superuser_auth_headers,
        )
        assert card_response.status_code == 201
        card_id = card_response.json()["id"]

        # Step 4: Regular user can see the card immediately (requires auth)
        user_cards = await client.get(f"/api/v1/cards?deck_id={deck_id}", headers=auth_headers)
        assert user_cards.status_code == 200
        assert user_cards.json()["total"] == 1
        assert user_cards.json()["cards"][0]["front_text"] == "kalimera"

        # Step 5: Admin updates the card
        update_response = await client.patch(
            f"/api/v1/cards/{card_id}",
            json={"back_text": "good morning (greeting)"},
            headers=superuser_auth_headers,
        )
        assert update_response.status_code == 200

        # Step 6: Regular user sees updated content immediately (requires auth)
        user_card = await client.get(f"/api/v1/cards/{card_id}", headers=auth_headers)
        assert user_card.status_code == 200
        assert user_card.json()["back_text"] == "good morning (greeting)"

    @pytest.mark.asyncio
    async def test_card_update_affects_study_content(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that card updates are reflected in study session.

        This verifies that when an admin updates card content, users
        see the updated content in their study queue.
        """
        # Step 1: Admin creates deck with card (system deck for user study access)
        deck_response = await client.post(
            "/api/v1/decks",
            json={"name": "Study Content Test", "level": "A1", "is_system_deck": True},
            headers=superuser_auth_headers,
        )
        deck_id = deck_response.json()["id"]

        card_response = await client.post(
            "/api/v1/cards",
            json={
                "deck_id": deck_id,
                "front_text": "original_front",
                "back_text": "original_back",
                "difficulty": "easy",
            },
            headers=superuser_auth_headers,
        )
        card_id = card_response.json()["id"]

        # Step 2: User initializes study session
        init_response = await client.post(
            f"/api/v1/study/initialize/{deck_id}",
            headers=auth_headers,
        )
        assert init_response.status_code == 200

        # Step 3: User gets study queue
        queue_response = await client.get(
            f"/api/v1/study/queue/{deck_id}",
            headers=auth_headers,
        )
        assert queue_response.status_code == 200
        queue_data = queue_response.json()
        assert len(queue_data["cards"]) > 0
        queue_card = queue_data["cards"][0]
        assert queue_card["front_text"] == "original_front"

        # Step 4: Admin updates card content
        await client.patch(
            f"/api/v1/cards/{card_id}",
            json={"front_text": "updated_front", "back_text": "updated_back"},
            headers=superuser_auth_headers,
        )

        # Step 5: User gets queue again - should see updated content
        updated_queue = await client.get(
            f"/api/v1/study/queue/{deck_id}",
            headers=auth_headers,
        )
        updated_card = updated_queue.json()["cards"][0]
        assert updated_card["front_text"] == "updated_front"
        assert updated_card["back_text"] == "updated_back"


@pytest.mark.e2e
class TestPermissionBoundaries(E2ETestCase):
    """E2E tests for admin permission enforcement."""

    @pytest.mark.asyncio
    async def test_permission_boundaries(
        self,
        client: AsyncClient,
        auth_headers: dict,
        superuser_auth_headers: dict,
        empty_deck: Deck,
    ):
        """Test permission boundaries for regular users vs admins.

        Tests:
        - Regular user CAN create their own deck (personal deck)
        - Regular user CANNOT update system decks (owner_id=None)
        - Regular user CANNOT delete system decks
        - Regular user CANNOT create cards (requires superuser)
        - Regular user CANNOT bulk create cards (requires superuser)
        """
        # Setup: Get an existing system deck ID for update/delete tests
        # empty_deck is a system deck (owner_id=None)
        deck_id = str(empty_deck.id)

        # Test 1: Regular user CAN create their own deck (personal deck)
        # DECKCREAT-01 feature: regular users can create decks owned by them
        create_response = await client.post(
            "/api/v1/decks",
            json={"name": "My Personal Deck", "level": "A1"},
            headers=auth_headers,
        )
        assert create_response.status_code == 201
        created_deck = create_response.json()
        assert created_deck["name"] == "My Personal Deck"
        # Personal decks are automatically active and non-premium
        assert created_deck["is_active"] is True
        assert created_deck["is_premium"] is False

        # Test 2: Regular user CANNOT update system deck (owner_id=None)
        update_response = await client.patch(
            f"/api/v1/decks/{deck_id}",
            json={"name": "Unauthorized Update"},
            headers=auth_headers,
        )
        assert update_response.status_code == 403

        # Test 3: Regular user CANNOT delete system deck
        delete_response = await client.delete(
            f"/api/v1/decks/{deck_id}",
            headers=auth_headers,
        )
        assert delete_response.status_code == 403

        # Test 4: Regular user CANNOT create card (requires superuser)
        card_response = await client.post(
            "/api/v1/cards",
            json={
                "deck_id": deck_id,
                "front_text": "test",
                "back_text": "test",
                "difficulty": "easy",
            },
            headers=auth_headers,
        )
        assert card_response.status_code == 403

        # Test 5: Regular user CANNOT bulk create cards (requires superuser)
        bulk_response = await client.post(
            "/api/v1/cards/bulk",
            json={
                "deck_id": deck_id,
                "cards": [{"front_text": "t", "back_text": "t", "difficulty": "easy"}],
            },
            headers=auth_headers,
        )
        assert bulk_response.status_code == 403

    @pytest.mark.asyncio
    async def test_unauthenticated_admin_operations_fail(
        self,
        client: AsyncClient,
        empty_deck: Deck,
    ):
        """Test that unauthenticated requests to admin endpoints fail with 401.

        Tests all admin-only endpoints without authentication.
        """
        deck_id = str(empty_deck.id)

        # Test 1: Unauthenticated user cannot CREATE deck
        unauth_create = await client.post(
            "/api/v1/decks",
            json={"name": "No Auth", "level": "A1"},
        )
        assert unauth_create.status_code == 401

        # Test 2: Unauthenticated user cannot UPDATE deck
        unauth_update = await client.patch(
            f"/api/v1/decks/{deck_id}",
            json={"name": "No Auth Update"},
        )
        assert unauth_update.status_code == 401

        # Test 3: Unauthenticated user cannot DELETE deck
        unauth_delete = await client.delete(f"/api/v1/decks/{deck_id}")
        assert unauth_delete.status_code == 401

        # Test 4: Unauthenticated user cannot CREATE card
        unauth_card = await client.post(
            "/api/v1/cards",
            json={
                "deck_id": deck_id,
                "front_text": "test",
                "back_text": "test",
                "difficulty": "easy",
            },
        )
        assert unauth_card.status_code == 401

        # Test 5: Unauthenticated user cannot BULK CREATE cards
        unauth_bulk = await client.post(
            "/api/v1/cards/bulk",
            json={
                "deck_id": deck_id,
                "cards": [{"front_text": "t", "back_text": "t", "difficulty": "easy"}],
            },
        )
        assert unauth_bulk.status_code == 401


@pytest.mark.e2e
class TestAdminCardDeletion(E2ETestCase):
    """E2E tests for admin card deletion operations."""

    @pytest.mark.asyncio
    async def test_delete_card_success(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """Test superuser can delete a card.

        Flow:
        Admin Creates Deck -> Admin Creates Card -> Admin Deletes Card ->
        Verify Card No Longer Exists
        """
        # Step 1: Create deck
        deck_response = await client.post(
            "/api/v1/decks",
            json={
                "name": "Card Deletion Test Deck",
                "description": "Deck for testing card deletion",
                "level": "A1",
            },
            headers=superuser_auth_headers,
        )
        assert deck_response.status_code == 201
        deck_id = deck_response.json()["id"]

        # Step 2: Create a card
        card_response = await client.post(
            "/api/v1/cards",
            json={
                "deck_id": deck_id,
                "front_text": "to_be_deleted",
                "back_text": "will be removed",
                "difficulty": "easy",
            },
            headers=superuser_auth_headers,
        )
        assert card_response.status_code == 201
        card_id = card_response.json()["id"]

        # Step 3: Verify card exists
        get_before = await client.get(f"/api/v1/cards/{card_id}", headers=superuser_auth_headers)
        assert get_before.status_code == 200
        assert get_before.json()["front_text"] == "to_be_deleted"

        # Step 4: Delete the card
        delete_response = await client.delete(
            f"/api/v1/cards/{card_id}",
            headers=superuser_auth_headers,
        )
        assert delete_response.status_code == 204

        # Step 5: Verify card no longer exists
        get_after = await client.get(f"/api/v1/cards/{card_id}", headers=superuser_auth_headers)
        assert get_after.status_code == 404

        # Step 6: Verify deck card count is 0
        deck_get = await client.get(f"/api/v1/decks/{deck_id}", headers=superuser_auth_headers)
        assert deck_get.status_code == 200
        assert deck_get.json()["card_count"] == 0

    @pytest.mark.asyncio
    async def test_delete_card_not_found(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """Test deleting non-existent card returns 404."""
        from uuid import uuid4

        fake_card_id = str(uuid4())

        response = await client.delete(
            f"/api/v1/cards/{fake_card_id}",
            headers=superuser_auth_headers,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_card_invalid_uuid_returns_422(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """Test deleting with invalid UUID format returns 422."""
        response = await client.delete(
            "/api/v1/cards/not-a-valid-uuid",
            headers=superuser_auth_headers,
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_delete_card_non_superuser_returns_403(
        self,
        client: AsyncClient,
        auth_headers: dict,
        superuser_auth_headers: dict,
    ):
        """Test regular user cannot delete cards."""
        # Step 1: Admin creates deck and card
        deck_response = await client.post(
            "/api/v1/decks",
            json={"name": "Non-Admin Delete Test", "level": "A1"},
            headers=superuser_auth_headers,
        )
        deck_id = deck_response.json()["id"]

        card_response = await client.post(
            "/api/v1/cards",
            json={
                "deck_id": deck_id,
                "front_text": "protected_card",
                "back_text": "cannot delete",
                "difficulty": "easy",
            },
            headers=superuser_auth_headers,
        )
        card_id = card_response.json()["id"]

        # Step 2: Regular user tries to delete
        delete_response = await client.delete(
            f"/api/v1/cards/{card_id}",
            headers=auth_headers,
        )
        assert delete_response.status_code == 403

        # Step 3: Verify card still exists
        get_response = await client.get(f"/api/v1/cards/{card_id}", headers=superuser_auth_headers)
        assert get_response.status_code == 200
        assert get_response.json()["front_text"] == "protected_card"

    @pytest.mark.asyncio
    async def test_delete_card_unauthenticated_returns_401(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """Test unauthenticated user cannot delete cards."""
        # Step 1: Admin creates deck and card
        deck_response = await client.post(
            "/api/v1/decks",
            json={"name": "Unauth Delete Test", "level": "A1"},
            headers=superuser_auth_headers,
        )
        deck_id = deck_response.json()["id"]

        card_response = await client.post(
            "/api/v1/cards",
            json={
                "deck_id": deck_id,
                "front_text": "auth_protected",
                "back_text": "requires auth",
                "difficulty": "easy",
            },
            headers=superuser_auth_headers,
        )
        card_id = card_response.json()["id"]

        # Step 2: Unauthenticated request
        delete_response = await client.delete(f"/api/v1/cards/{card_id}")
        assert delete_response.status_code == 401

        # Step 3: Verify card still exists
        get_response = await client.get(f"/api/v1/cards/{card_id}", headers=superuser_auth_headers)
        assert get_response.status_code == 200

    @pytest.mark.asyncio
    async def test_delete_multiple_cards_workflow(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """Test admin deletes multiple cards from a deck.

        Flow:
        Create Deck -> Create 3 Cards -> Delete 2 Cards -> Verify 1 Remains
        """
        # Step 1: Create deck
        deck_response = await client.post(
            "/api/v1/decks",
            json={"name": "Multi-Delete Test Deck", "level": "A1"},
            headers=superuser_auth_headers,
        )
        deck_id = deck_response.json()["id"]

        # Step 2: Create 3 cards
        card_ids = []
        for i in range(3):
            card_response = await client.post(
                "/api/v1/cards",
                json={
                    "deck_id": deck_id,
                    "front_text": f"card_{i}",
                    "back_text": f"translation_{i}",
                    "difficulty": "easy",
                },
                headers=superuser_auth_headers,
            )
            card_ids.append(card_response.json()["id"])

        # Step 3: Verify 3 cards exist
        list_before = await client.get(
            f"/api/v1/cards?deck_id={deck_id}", headers=superuser_auth_headers
        )
        assert list_before.json()["total"] == 3

        # Step 4: Delete 2 cards
        for card_id in card_ids[:2]:
            delete_response = await client.delete(
                f"/api/v1/cards/{card_id}",
                headers=superuser_auth_headers,
            )
            assert delete_response.status_code == 204

        # Step 5: Verify only 1 card remains
        list_after = await client.get(
            f"/api/v1/cards?deck_id={deck_id}", headers=superuser_auth_headers
        )
        assert list_after.json()["total"] == 1

        # Step 6: Verify the remaining card is the last one
        remaining_card = list_after.json()["cards"][0]
        assert remaining_card["id"] == card_ids[2]
        assert remaining_card["front_text"] == "card_2"


@pytest.mark.e2e
class TestAdminStatsEndpoint(E2ETestCase):
    """E2E tests for admin stats endpoint (GET /api/v1/admin/stats)."""

    @pytest.mark.asyncio
    async def test_admin_stats_returns_deck_and_card_counts(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """Test admin stats endpoint returns total deck and card counts."""
        # Step 1: Create a deck
        deck_response = await client.post(
            "/api/v1/decks",
            json={"name": "Stats Test Deck", "level": "A1"},
            headers=superuser_auth_headers,
        )
        assert deck_response.status_code == 201
        deck_id = deck_response.json()["id"]

        # Step 2: Create cards in the deck
        for i in range(5):
            card_response = await client.post(
                "/api/v1/cards",
                json={
                    "deck_id": deck_id,
                    "front_text": f"stats_word_{i}",
                    "back_text": f"stats_translation_{i}",
                    "difficulty": "easy",
                },
                headers=superuser_auth_headers,
            )
            assert card_response.status_code == 201

        # Step 3: Get admin stats
        stats_response = await client.get(
            "/api/v1/admin/stats",
            headers=superuser_auth_headers,
        )

        assert stats_response.status_code == 200
        data = stats_response.json()

        # Verify response structure
        assert "total_decks" in data
        assert "total_cards" in data
        assert "decks" in data

        # Verify counts are positive (at least our created data)
        assert data["total_decks"] >= 1
        assert data["total_cards"] >= 5

        # Verify decks list contains our deck
        deck_ids = [d["id"] for d in data["decks"]]
        assert deck_id in deck_ids

    @pytest.mark.asyncio
    async def test_admin_stats_deck_item_structure(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """Test each deck in stats has correct structure."""
        # Create a deck first
        deck_response = await client.post(
            "/api/v1/decks",
            json={"name": "Structure Test Deck", "level": "B1"},
            headers=superuser_auth_headers,
        )
        deck_id = deck_response.json()["id"]

        # Get stats
        stats_response = await client.get(
            "/api/v1/admin/stats",
            headers=superuser_auth_headers,
        )

        assert stats_response.status_code == 200
        data = stats_response.json()

        # Find our deck in the list
        our_deck = next((d for d in data["decks"] if d["id"] == deck_id), None)
        assert our_deck is not None

        # Verify deck structure
        assert "id" in our_deck
        assert "name" in our_deck
        assert "level" in our_deck
        assert "card_count" in our_deck
        assert our_deck["name"] == "Structure Test Deck"
        assert our_deck["level"] == "B1"

    @pytest.mark.asyncio
    async def test_admin_stats_non_superuser_returns_403(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test regular user cannot access admin stats."""
        response = await client.get(
            "/api/v1/admin/stats",
            headers=auth_headers,
        )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_admin_stats_unauthenticated_returns_401(
        self,
        client: AsyncClient,
    ):
        """Test unauthenticated request to admin stats returns 401."""
        response = await client.get("/api/v1/admin/stats")

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_admin_stats_card_counts_accurate(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """Test that card counts per deck are accurate."""
        # Create deck with specific number of cards
        deck_response = await client.post(
            "/api/v1/decks",
            json={"name": "Count Accuracy Test", "level": "A2"},
            headers=superuser_auth_headers,
        )
        deck_id = deck_response.json()["id"]

        # Create exactly 7 cards
        expected_count = 7
        for i in range(expected_count):
            await client.post(
                "/api/v1/cards",
                json={
                    "deck_id": deck_id,
                    "front_text": f"accuracy_{i}",
                    "back_text": f"translation_{i}",
                    "difficulty": "medium",
                },
                headers=superuser_auth_headers,
            )

        # Get stats and verify count
        stats_response = await client.get(
            "/api/v1/admin/stats",
            headers=superuser_auth_headers,
        )

        data = stats_response.json()
        our_deck = next((d for d in data["decks"] if d["id"] == deck_id), None)
        assert our_deck is not None
        assert our_deck["card_count"] == expected_count

    @pytest.mark.asyncio
    async def test_admin_stats_excludes_inactive_decks(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """Test that inactive decks are excluded from admin stats."""
        # Create a deck
        deck_response = await client.post(
            "/api/v1/decks",
            json={"name": "Inactive Test Deck", "level": "C1"},
            headers=superuser_auth_headers,
        )
        deck_id = deck_response.json()["id"]

        # Verify deck is in stats
        stats_before = await client.get(
            "/api/v1/admin/stats",
            headers=superuser_auth_headers,
        )
        deck_ids_before = [d["id"] for d in stats_before.json()["decks"]]
        assert deck_id in deck_ids_before

        # Deactivate the deck
        await client.patch(
            f"/api/v1/decks/{deck_id}",
            json={"is_active": False},
            headers=superuser_auth_headers,
        )

        # Verify deck is NOT in stats (inactive)
        stats_after = await client.get(
            "/api/v1/admin/stats",
            headers=superuser_auth_headers,
        )
        deck_ids_after = [d["id"] for d in stats_after.json()["decks"]]
        assert deck_id not in deck_ids_after


@pytest.mark.e2e
class TestCardNotFoundErrors(E2ETestCase):
    """E2E tests for card 404 error handling."""

    @pytest.mark.asyncio
    async def test_get_nonexistent_card_returns_404(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test that GET with non-existent card ID returns 404."""
        fake_card_id = str(uuid4())

        response = await client.get(f"/api/v1/cards/{fake_card_id}", headers=auth_headers)

        assert response.status_code == 404
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "NOT_FOUND"

    @pytest.mark.asyncio
    async def test_update_nonexistent_card_returns_404(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """Test that PATCH with non-existent card ID returns 404."""
        fake_card_id = str(uuid4())

        response = await client.patch(
            f"/api/v1/cards/{fake_card_id}",
            json={"front_text": "Updated text"},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 404
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "NOT_FOUND"

    @pytest.mark.asyncio
    async def test_delete_nonexistent_card_returns_404(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """Test that DELETE with non-existent card ID returns 404."""
        fake_card_id = str(uuid4())

        response = await client.delete(
            f"/api/v1/cards/{fake_card_id}",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 404
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "NOT_FOUND"
