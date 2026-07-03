"""Unit tests for CultureDeckService.

This module tests the culture deck service layer logic including:
- Listing culture decks with pagination and filtering
- Getting deck details with progress tracking
- Category retrieval
"""

from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from src.schemas.culture import (
    CultureDeckDetailResponse,
    CultureDeckListResponse,
    CultureDeckProgress,
)
from src.services.culture_deck_service import CultureDeckService
from src.services.s3_service import S3Service


class TestCultureDeckServiceList:
    """Tests for list_decks method."""

    @pytest.mark.asyncio
    async def test_list_decks_empty(self, mock_db_session: MagicMock):
        """Test listing decks when no decks exist."""
        service = CultureDeckService(mock_db_session)

        # Mock repository methods
        with (
            patch.object(service.deck_repo, "list_active", new_callable=AsyncMock) as mock_list,
            patch.object(service.deck_repo, "count_active", new_callable=AsyncMock) as mock_count,
        ):
            mock_list.return_value = []
            mock_count.return_value = 0

            result = await service.list_decks()

            assert isinstance(result, CultureDeckListResponse)
            assert result.total == 0
            assert result.decks == []
            mock_list.assert_awaited_once_with(skip=0, limit=20, category=None)
            mock_count.assert_awaited_once_with(category=None)

    @pytest.mark.asyncio
    async def test_list_decks_with_data(self, mock_db_session: MagicMock):
        """Test listing decks returns populated response."""
        service = CultureDeckService(mock_db_session)

        # Create mock deck
        mock_deck = MagicMock()
        mock_deck.id = uuid4()
        mock_deck.name_en = "Greek History"
        mock_deck.name_el = "Ελληνική Ιστορία"
        mock_deck.name_ru = "Греческая история"
        mock_deck.description_en = "History deck"
        mock_deck.description_el = "Τράπουλα ιστορίας"
        mock_deck.description_ru = "Колода истории"
        mock_deck.category = "history"
        mock_deck.is_active = True
        mock_deck.is_premium = False

        with (
            patch.object(service.deck_repo, "list_active", new_callable=AsyncMock) as mock_list,
            patch.object(service.deck_repo, "count_active", new_callable=AsyncMock) as mock_count,
            patch.object(
                service.deck_repo, "get_batch_question_counts", new_callable=AsyncMock
            ) as mock_batch_counts,
        ):
            mock_list.return_value = [mock_deck]
            mock_count.return_value = 1
            mock_batch_counts.return_value = {mock_deck.id: 25}

            result = await service.list_decks()

            assert isinstance(result, CultureDeckListResponse)
            assert result.total == 1
            assert len(result.decks) == 1
            assert result.decks[0].id == mock_deck.id
            assert result.decks[0].question_count == 25
            # Verify locale fields are populated
            assert result.decks[0].name_en == "Greek History"
            assert result.decks[0].name_ru == "Греческая история"
            assert result.decks[0].description_en == "History deck"
            assert result.decks[0].description_ru == "Колода истории"

    @pytest.mark.asyncio
    async def test_list_decks_with_pagination(self, mock_db_session: MagicMock):
        """Test pagination parameters are correctly passed."""
        service = CultureDeckService(mock_db_session)

        with (
            patch.object(service.deck_repo, "list_active", new_callable=AsyncMock) as mock_list,
            patch.object(service.deck_repo, "count_active", new_callable=AsyncMock) as mock_count,
        ):
            mock_list.return_value = []
            mock_count.return_value = 0

            await service.list_decks(page=3, page_size=10)

            # skip = (page - 1) * page_size = (3 - 1) * 10 = 20
            mock_list.assert_awaited_once_with(skip=20, limit=10, category=None)

    @pytest.mark.asyncio
    async def test_list_decks_with_category_filter(self, mock_db_session: MagicMock):
        """Test category filter is correctly passed."""
        service = CultureDeckService(mock_db_session)

        with (
            patch.object(service.deck_repo, "list_active", new_callable=AsyncMock) as mock_list,
            patch.object(service.deck_repo, "count_active", new_callable=AsyncMock) as mock_count,
        ):
            mock_list.return_value = []
            mock_count.return_value = 0

            await service.list_decks(category="history")

            mock_list.assert_awaited_once_with(skip=0, limit=20, category="history")
            mock_count.assert_awaited_once_with(category="history")

    @pytest.mark.asyncio
    async def test_list_decks_with_user_includes_progress(self, mock_db_session: MagicMock):
        """Test authenticated user receives progress data."""
        service = CultureDeckService(mock_db_session)
        user_id = uuid4()

        # Create mock deck
        mock_deck = MagicMock()
        mock_deck.id = uuid4()
        mock_deck.name_en = "Test"
        mock_deck.name_el = "Τεστ"
        mock_deck.name_ru = "Тест"
        mock_deck.description_en = "Test desc"
        mock_deck.description_el = "Περιγραφή τεστ"
        mock_deck.description_ru = "Тестовое описание"
        mock_deck.category = "culture"
        mock_deck.is_active = True
        mock_deck.is_premium = False

        with (
            patch.object(service.deck_repo, "list_active", new_callable=AsyncMock) as mock_list,
            patch.object(service.deck_repo, "count_active", new_callable=AsyncMock) as mock_count,
            patch.object(
                service.deck_repo, "get_batch_question_counts", new_callable=AsyncMock
            ) as mock_batch_counts,
            patch.object(
                service.stats_repo, "has_user_started_deck", new_callable=AsyncMock
            ) as mock_started,
            patch.object(
                service.stats_repo, "get_deck_progress", new_callable=AsyncMock
            ) as mock_progress,
            patch.object(
                service.stats_repo, "get_last_practiced_at", new_callable=AsyncMock
            ) as mock_last,
        ):
            mock_list.return_value = [mock_deck]
            mock_count.return_value = 1
            mock_batch_counts.return_value = {mock_deck.id: 30}
            mock_started.return_value = True
            mock_progress.return_value = {
                "questions_total": 30,
                "questions_mastered": 10,
                "questions_learning": 5,
                "questions_new": 15,
            }
            mock_last.return_value = datetime(2024, 1, 15, 10, 30)

            result = await service.list_decks(user_id=user_id)

            assert result.decks[0].progress is not None
            assert result.decks[0].progress.questions_mastered == 10
            assert result.decks[0].progress.last_practiced_at == datetime(2024, 1, 15, 10, 30)

    @pytest.mark.asyncio
    async def test_list_decks_anonymous_no_progress(self, mock_db_session: MagicMock):
        """Test anonymous user receives no progress data."""
        service = CultureDeckService(mock_db_session)

        mock_deck = MagicMock()
        mock_deck.id = uuid4()
        mock_deck.name_en = "Test"
        mock_deck.name_el = "Τεστ"
        mock_deck.name_ru = "Тест"
        mock_deck.description_en = "Test desc"
        mock_deck.description_el = "Περιγραφή τεστ"
        mock_deck.description_ru = "Тестовое описание"
        mock_deck.category = "culture"
        mock_deck.is_active = True
        mock_deck.is_premium = False

        with (
            patch.object(service.deck_repo, "list_active", new_callable=AsyncMock) as mock_list,
            patch.object(service.deck_repo, "count_active", new_callable=AsyncMock) as mock_count,
            patch.object(
                service.deck_repo, "get_batch_question_counts", new_callable=AsyncMock
            ) as mock_batch_counts,
        ):
            mock_list.return_value = [mock_deck]
            mock_count.return_value = 1
            mock_batch_counts.return_value = {mock_deck.id: 30}

            # No user_id provided
            result = await service.list_decks(user_id=None)

            assert result.decks[0].progress is None


class TestCultureDeckListBatchCount:
    """Tests asserting N+1 elimination in list_decks (PERF-06)."""

    @pytest.mark.asyncio
    async def test_list_decks_issues_one_batch_count_not_per_deck(self, mock_db_session: MagicMock):
        """list_decks with M decks must call get_batch_question_counts once,
        never count_questions per-deck (AC-1 / AC-4)."""
        service = CultureDeckService(mock_db_session)
        num_decks = 5

        mock_decks = []
        for i in range(num_decks):
            d = MagicMock()
            d.id = __import__("uuid").uuid4()
            d.name_en = f"Deck {i}"
            d.name_el = f"Τράπουλα {i}"
            d.name_ru = f"Колода {i}"
            d.description_en = f"Desc {i}"
            d.description_el = f"Περιγραφή {i}"
            d.description_ru = f"Описание {i}"
            d.category = "history"
            d.is_active = True
            d.is_premium = False
            d.cover_image_s3_key = None
            mock_decks.append(d)

        counts_map = {d.id: 10 + i for i, d in enumerate(mock_decks)}

        with (
            patch.object(service.deck_repo, "list_active", new_callable=AsyncMock) as mock_list,
            patch.object(service.deck_repo, "count_active", new_callable=AsyncMock) as mock_count,
            patch.object(
                service.deck_repo, "get_batch_question_counts", new_callable=AsyncMock
            ) as mock_batch,
            patch.object(
                service.deck_repo, "count_questions", new_callable=AsyncMock
            ) as mock_single_count,
        ):
            mock_list.return_value = mock_decks
            mock_count.return_value = num_decks
            mock_batch.return_value = counts_map

            result = await service.list_decks()

            # Batch helper called exactly once with all deck ids
            mock_batch.assert_awaited_once()
            called_ids = mock_batch.call_args[0][0]
            assert set(called_ids) == {d.id for d in mock_decks}

            # Per-deck count_questions must NOT be called (N+1 eliminated)
            mock_single_count.assert_not_called()

            # Per-deck counts are correct
            assert len(result.decks) == num_decks
            for deck_resp in result.decks:
                expected = counts_map[deck_resp.id]
                assert (
                    deck_resp.question_count == expected
                ), f"deck {deck_resp.id}: expected {expected}, got {deck_resp.question_count}"

    @pytest.mark.asyncio
    async def test_list_decks_empty_no_batch_call(self, mock_db_session: MagicMock):
        """Empty page: get_batch_question_counts is still called (with empty list)
        and returns {} gracefully."""
        service = CultureDeckService(mock_db_session)

        with (
            patch.object(service.deck_repo, "list_active", new_callable=AsyncMock) as mock_list,
            patch.object(service.deck_repo, "count_active", new_callable=AsyncMock) as mock_count,
            patch.object(
                service.deck_repo, "get_batch_question_counts", new_callable=AsyncMock
            ) as mock_batch,
        ):
            mock_list.return_value = []
            mock_count.return_value = 0
            mock_batch.return_value = {}

            result = await service.list_decks()

            assert result.decks == []
            mock_batch.assert_awaited_once_with([])


class TestCultureDeckServiceGetDeck:
    """Tests for get_deck method."""

    @pytest.mark.asyncio
    async def test_get_deck_success(self, mock_db_session: MagicMock):
        """Test successfully retrieving a deck."""
        service = CultureDeckService(mock_db_session)
        deck_id = uuid4()

        mock_deck = MagicMock()
        mock_deck.id = deck_id
        mock_deck.name_en = "Greek History"
        mock_deck.name_el = "Ελληνική Ιστορία"
        mock_deck.name_ru = "Греческая история"
        mock_deck.description_en = "Learn about Greek history"
        mock_deck.description_el = "Μάθετε για την ελληνική ιστορία"
        mock_deck.description_ru = "Узнайте об истории Греции"
        mock_deck.category = "history"
        mock_deck.is_active = True
        mock_deck.is_premium = False
        mock_deck.created_at = datetime(2024, 1, 1)
        mock_deck.updated_at = datetime(2024, 1, 15)

        with (
            patch.object(service.deck_repo, "get", new_callable=AsyncMock) as mock_get,
            patch.object(
                service.deck_repo, "count_questions", new_callable=AsyncMock
            ) as mock_count_q,
            patch.object(
                service.answer_history_repo,
                "get_study_time_for_deck",
                new_callable=AsyncMock,
            ) as mock_time_on_deck,
        ):
            mock_get.return_value = mock_deck
            mock_count_q.return_value = 50

            result = await service.get_deck(deck_id)

            assert isinstance(result, CultureDeckDetailResponse)
            assert result.id == deck_id
            assert result.question_count == 50
            assert result.is_active is True
            assert result.time_on_deck_seconds == 0
            mock_get.assert_awaited_once_with(deck_id)
            mock_time_on_deck.assert_not_called()

    @pytest.mark.asyncio
    async def test_get_deck_not_found(self, mock_db_session: MagicMock):
        """Test 404 raised for non-existent deck."""
        from src.core.exceptions import CultureDeckNotFoundException

        service = CultureDeckService(mock_db_session)
        deck_id = uuid4()

        with patch.object(service.deck_repo, "get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = None

            with pytest.raises(CultureDeckNotFoundException):
                await service.get_deck(deck_id)

    @pytest.mark.asyncio
    async def test_get_deck_inactive_returns_404(self, mock_db_session: MagicMock):
        """Test 404 raised for inactive deck."""
        from src.core.exceptions import CultureDeckNotFoundException

        service = CultureDeckService(mock_db_session)
        deck_id = uuid4()

        mock_deck = MagicMock()
        mock_deck.id = deck_id
        mock_deck.is_active = False

        with patch.object(service.deck_repo, "get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_deck

            with pytest.raises(CultureDeckNotFoundException):
                await service.get_deck(deck_id)

    @pytest.mark.asyncio
    async def test_get_deck_with_user_progress(self, mock_db_session: MagicMock):
        """Test deck retrieval includes progress for authenticated user."""
        service = CultureDeckService(mock_db_session)
        deck_id = uuid4()
        user_id = uuid4()

        mock_deck = MagicMock()
        mock_deck.id = deck_id
        mock_deck.name_en = "Test"
        mock_deck.name_el = "Τεστ"
        mock_deck.name_ru = "Тест"
        mock_deck.description_en = "Test desc"
        mock_deck.description_el = "Περιγραφή τεστ"
        mock_deck.description_ru = "Тестовое описание"
        mock_deck.category = "culture"
        mock_deck.is_active = True
        mock_deck.is_premium = False
        mock_deck.created_at = datetime(2024, 1, 1)
        mock_deck.updated_at = datetime(2024, 1, 15)

        with (
            patch.object(service.deck_repo, "get", new_callable=AsyncMock) as mock_get,
            patch.object(
                service.deck_repo, "count_questions", new_callable=AsyncMock
            ) as mock_count_q,
            patch.object(
                service.stats_repo, "has_user_started_deck", new_callable=AsyncMock
            ) as mock_started,
            patch.object(
                service.stats_repo, "get_deck_progress", new_callable=AsyncMock
            ) as mock_progress,
            patch.object(
                service.stats_repo, "get_last_practiced_at", new_callable=AsyncMock
            ) as mock_last,
            patch.object(
                service.answer_history_repo,
                "get_study_time_for_deck",
                new_callable=AsyncMock,
                return_value=420,
            ) as mock_time_on_deck,
        ):
            mock_get.return_value = mock_deck
            mock_count_q.return_value = 30
            mock_started.return_value = True
            mock_progress.return_value = {
                "questions_total": 30,
                "questions_mastered": 15,
                "questions_learning": 5,
                "questions_new": 10,
            }
            mock_last.return_value = datetime(2024, 1, 10)

            result = await service.get_deck(deck_id, user_id=user_id)

            assert result.progress is not None
            assert result.progress.questions_mastered == 15
            assert result.time_on_deck_seconds == 420
            mock_time_on_deck.assert_awaited_once_with(user_id, deck_id)


class TestCultureDeckServiceCategories:
    """Tests for get_categories method."""

    @pytest.mark.asyncio
    async def test_get_categories_empty(self, mock_db_session: MagicMock):
        """Test getting categories when none exist."""
        service = CultureDeckService(mock_db_session)

        with patch.object(service.deck_repo, "get_categories", new_callable=AsyncMock) as mock_cats:
            mock_cats.return_value = []

            result = await service.get_categories()

            assert result == []
            mock_cats.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_get_categories_success(self, mock_db_session: MagicMock):
        """Test getting available categories."""
        service = CultureDeckService(mock_db_session)

        with patch.object(service.deck_repo, "get_categories", new_callable=AsyncMock) as mock_cats:
            mock_cats.return_value = ["culture", "geography", "history"]

            result = await service.get_categories()

            assert result == ["culture", "geography", "history"]


class TestCultureDeckServiceProgressHelper:
    """Tests for _get_deck_progress helper method."""

    @pytest.mark.asyncio
    async def test_progress_returns_none_if_not_started(self, mock_db_session: MagicMock):
        """Test progress is None if user hasn't started deck."""
        service = CultureDeckService(mock_db_session)
        user_id = uuid4()
        deck_id = uuid4()

        with patch.object(
            service.stats_repo, "has_user_started_deck", new_callable=AsyncMock
        ) as mock_started:
            mock_started.return_value = False

            result = await service._get_deck_progress(user_id, deck_id)

            assert result is None

    @pytest.mark.asyncio
    async def test_progress_includes_all_fields(self, mock_db_session: MagicMock):
        """Test progress includes all expected fields."""
        service = CultureDeckService(mock_db_session)
        user_id = uuid4()
        deck_id = uuid4()
        last_practiced = datetime(2024, 1, 15, 10, 30)

        with (
            patch.object(
                service.stats_repo, "has_user_started_deck", new_callable=AsyncMock
            ) as mock_started,
            patch.object(
                service.stats_repo, "get_deck_progress", new_callable=AsyncMock
            ) as mock_progress,
            patch.object(
                service.stats_repo, "get_last_practiced_at", new_callable=AsyncMock
            ) as mock_last,
        ):
            mock_started.return_value = True
            mock_progress.return_value = {
                "questions_total": 50,
                "questions_mastered": 25,
                "questions_learning": 10,
                "questions_new": 15,
            }
            mock_last.return_value = last_practiced

            result = await service._get_deck_progress(user_id, deck_id)

            assert isinstance(result, CultureDeckProgress)
            assert result.questions_total == 50
            assert result.questions_mastered == 25
            assert result.questions_learning == 10
            assert result.questions_new == 15
            assert result.last_practiced_at == last_practiced


# =============================================================================
# Test CRUD Methods (Admin Operations)
# =============================================================================


class TestCreateDeck:
    """Tests for create_deck method (lines 300-330)."""

    @pytest.mark.asyncio
    async def test_create_deck_success(self, mock_db_session: MagicMock):
        """Should successfully create a deck."""
        from src.schemas.culture import CultureDeckAdminResponse, CultureDeckCreate

        service = CultureDeckService(mock_db_session)

        deck_data = CultureDeckCreate(
            name_en="New deck",
            name_el="Νέα τράπουλα",
            name_ru="Новая колода",
            description_en="Description",
            description_el="Περιγραφή",
            description_ru="Описание",
            category="history",
            order_index=0,
        )

        mock_deck = MagicMock()
        mock_deck.id = uuid4()
        mock_deck.name_en = "New deck"
        mock_deck.name_el = "Νέα τράπουλα"
        mock_deck.name_ru = "Новая колода"
        mock_deck.description_en = "Description"
        mock_deck.description_el = "Περιγραφή"
        mock_deck.description_ru = "Описание"
        mock_deck.category = "history"
        mock_deck.is_active = True
        mock_deck.is_premium = False
        mock_deck.order_index = 0
        mock_deck.created_at = datetime(2024, 1, 1)
        mock_deck.updated_at = datetime(2024, 1, 1)

        with patch.object(service.deck_repo, "create", new_callable=AsyncMock) as mock_create:
            mock_create.return_value = mock_deck

            result = await service.create_deck(deck_data)

            assert isinstance(result, CultureDeckAdminResponse)
            assert result.id == mock_deck.id
            assert result.name_en == mock_deck.name_en
            assert result.description_en == mock_deck.description_en
            assert result.category == "history"
            assert result.question_count == 0  # New deck has no questions
            assert result.is_active is True

    @pytest.mark.asyncio
    async def test_create_deck_with_custom_order_index(self, mock_db_session: MagicMock):
        """Should create deck with specified order_index."""
        from src.schemas.culture import CultureDeckCreate

        service = CultureDeckService(mock_db_session)

        deck_data = CultureDeckCreate(
            name_en="Test",
            name_el="Τεστ",
            name_ru="Тест",
            description_en="Desc",
            description_el="Περιγραφή",
            description_ru="Описание",
            category="culture",
            order_index=10,
        )

        mock_deck = MagicMock()
        mock_deck.id = uuid4()
        mock_deck.name_en = "Test"
        mock_deck.name_el = "Τεστ"
        mock_deck.name_ru = "Тест"
        mock_deck.description_en = "Desc"
        mock_deck.description_el = "Περιγραφή"
        mock_deck.description_ru = "Описание"
        mock_deck.category = "culture"
        mock_deck.is_active = True
        mock_deck.is_premium = False
        mock_deck.order_index = 10
        mock_deck.created_at = datetime(2024, 1, 1)
        mock_deck.updated_at = datetime(2024, 1, 1)

        with patch.object(service.deck_repo, "create", new_callable=AsyncMock) as mock_create:
            mock_create.return_value = mock_deck

            await service.create_deck(deck_data)

            # Verify create was called with correct order_index
            call_args = mock_create.call_args[0][0]
            assert call_args["order_index"] == 10


class TestUpdateDeck:
    """Tests for update_deck method (lines 372-396)."""

    @pytest.mark.asyncio
    async def test_update_deck_success(self, mock_db_session: MagicMock):
        """Should successfully update a deck."""
        from src.schemas.culture import CultureDeckUpdate

        service = CultureDeckService(mock_db_session)
        deck_id = uuid4()

        update_data = CultureDeckUpdate(
            name_en="Updated name",
        )

        mock_deck = MagicMock()
        mock_deck.id = deck_id
        mock_deck.name_en = "Old"
        mock_deck.name_el = "Παλιό"
        mock_deck.name_ru = "Старое"
        mock_deck.description_en = "Desc"
        mock_deck.description_el = "Περιγραφή"
        mock_deck.description_ru = "Описание"
        mock_deck.is_active = True

        mock_updated_deck = MagicMock()
        mock_updated_deck.id = deck_id
        mock_updated_deck.name_en = "Updated name"
        mock_updated_deck.name_el = "Παλιό"
        mock_updated_deck.name_ru = "Старое"
        mock_updated_deck.description_en = "Desc"
        mock_updated_deck.description_el = "Περιγραφή"
        mock_updated_deck.description_ru = "Описание"
        mock_updated_deck.category = "culture"
        mock_updated_deck.is_active = True
        mock_updated_deck.is_premium = False

        with (
            patch.object(service.deck_repo, "get", new_callable=AsyncMock) as mock_get,
            patch.object(service.deck_repo, "update", new_callable=AsyncMock) as mock_update,
            patch.object(
                service.deck_repo, "count_questions", new_callable=AsyncMock
            ) as mock_count_q,
        ):
            mock_get.return_value = mock_deck
            mock_update.return_value = mock_updated_deck
            mock_count_q.return_value = 10

            result = await service.update_deck(deck_id, update_data)

            assert result.id == deck_id
            assert result.name_en == mock_updated_deck.name_en
            mock_get.assert_awaited_once_with(deck_id)
            mock_update.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_update_deck_partial_update(self, mock_db_session: MagicMock):
        """Should update only specified fields."""
        from src.schemas.culture import CultureDeckUpdate

        service = CultureDeckService(mock_db_session)
        deck_id = uuid4()

        update_data = CultureDeckUpdate(
            category="geography",
        )

        mock_deck = MagicMock()
        mock_deck.id = deck_id
        mock_deck.name_en = "Test"
        mock_deck.name_el = "Τεστ"
        mock_deck.name_ru = "Тест"
        mock_deck.description_en = "Desc"
        mock_deck.description_el = "Περιγραφή"
        mock_deck.description_ru = "Описание"
        mock_deck.category = "culture"
        mock_deck.is_active = True

        mock_updated_deck = MagicMock()
        mock_updated_deck.id = deck_id
        mock_updated_deck.name_en = "Test"
        mock_updated_deck.name_el = "Τεστ"
        mock_updated_deck.name_ru = "Тест"
        mock_updated_deck.description_en = "Desc"
        mock_updated_deck.description_el = "Περιγραφή"
        mock_updated_deck.description_ru = "Описание"
        mock_updated_deck.category = "geography"
        mock_updated_deck.is_active = True
        mock_updated_deck.is_premium = False

        with (
            patch.object(service.deck_repo, "get", new_callable=AsyncMock) as mock_get,
            patch.object(service.deck_repo, "update", new_callable=AsyncMock) as mock_update,
            patch.object(
                service.deck_repo, "count_questions", new_callable=AsyncMock
            ) as mock_count_q,
        ):
            mock_get.return_value = mock_deck
            mock_update.return_value = mock_updated_deck
            mock_count_q.return_value = 10

            await service.update_deck(deck_id, update_data)

            # Verify update was called with only category
            call_args = mock_update.call_args[0][1]
            assert "category" in call_args
            assert call_args["category"] == "geography"

    @pytest.mark.asyncio
    async def test_update_deck_can_update_inactive_deck(self, mock_db_session: MagicMock):
        """Should allow updating inactive decks (admin privilege)."""
        from src.schemas.culture import CultureDeckUpdate

        service = CultureDeckService(mock_db_session)
        deck_id = uuid4()

        update_data = CultureDeckUpdate(
            is_active=True,  # Reactivate deck
        )

        mock_deck = MagicMock()
        mock_deck.id = deck_id
        mock_deck.name_en = "Test"
        mock_deck.name_el = "Τεστ"
        mock_deck.name_ru = "Тест"
        mock_deck.description_en = "Desc"
        mock_deck.description_el = "Περιγραφή"
        mock_deck.description_ru = "Описание"
        mock_deck.category = "culture"
        mock_deck.is_active = False  # Inactive deck

        mock_updated_deck = MagicMock()
        mock_updated_deck.id = deck_id
        mock_updated_deck.name_en = "Test"
        mock_updated_deck.name_el = "Τεστ"
        mock_updated_deck.name_ru = "Тест"
        mock_updated_deck.description_en = "Desc"
        mock_updated_deck.description_el = "Περιγραφή"
        mock_updated_deck.description_ru = "Описание"
        mock_updated_deck.category = "culture"
        mock_updated_deck.is_active = True
        mock_updated_deck.is_premium = False

        with (
            patch.object(service.deck_repo, "get", new_callable=AsyncMock) as mock_get,
            patch.object(service.deck_repo, "update", new_callable=AsyncMock) as mock_update,
            patch.object(
                service.deck_repo, "count_questions", new_callable=AsyncMock
            ) as mock_count_q,
        ):
            mock_get.return_value = mock_deck
            mock_count_q.return_value = 10
            mock_update.return_value = mock_updated_deck

            result = await service.update_deck(deck_id, update_data)

            assert result.is_active is True

    @pytest.mark.asyncio
    async def test_update_deck_not_found(self, mock_db_session: MagicMock):
        """Should raise CultureDeckNotFoundException when deck doesn't exist."""
        from src.core.exceptions import CultureDeckNotFoundException
        from src.schemas.culture import CultureDeckUpdate

        service = CultureDeckService(mock_db_session)
        deck_id = uuid4()

        update_data = CultureDeckUpdate(
            name_en="new-name",
        )

        with patch.object(service.deck_repo, "get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = None

            with pytest.raises(CultureDeckNotFoundException):
                await service.update_deck(deck_id, update_data)


class TestSoftDeleteDeck:
    """Tests for soft_delete_deck method (lines 418-425)."""

    @pytest.mark.asyncio
    async def test_soft_delete_deck_success(self, mock_db_session: MagicMock):
        """Should successfully soft delete a deck."""
        service = CultureDeckService(mock_db_session)
        deck_id = uuid4()

        mock_deck = MagicMock()
        mock_deck.id = deck_id
        mock_deck.is_active = True

        with patch.object(service.deck_repo, "get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_deck

            await service.soft_delete_deck(deck_id)

            # Verify is_active was set to False
            assert mock_deck.is_active is False
            mock_get.assert_awaited_once_with(deck_id)

    @pytest.mark.asyncio
    async def test_soft_delete_deck_idempotent(self, mock_db_session: MagicMock):
        """Should allow deleting already-inactive deck (idempotent)."""
        service = CultureDeckService(mock_db_session)
        deck_id = uuid4()

        mock_deck = MagicMock()
        mock_deck.id = deck_id
        mock_deck.is_active = False  # Already inactive

        with patch.object(service.deck_repo, "get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_deck

            # Should not raise error
            await service.soft_delete_deck(deck_id)

            # Verify is_active remains False
            assert mock_deck.is_active is False

    @pytest.mark.asyncio
    async def test_soft_delete_deck_not_found(self, mock_db_session: MagicMock):
        """Should raise CultureDeckNotFoundException when deck doesn't exist."""
        from src.core.exceptions import CultureDeckNotFoundException

        service = CultureDeckService(mock_db_session)
        deck_id = uuid4()

        with patch.object(service.deck_repo, "get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = None

            with pytest.raises(CultureDeckNotFoundException):
                await service.soft_delete_deck(deck_id)


# =============================================================================
# INFRA-11-03: cover_image_variants field on CultureDeckResponse /
# CultureDeckDetailResponse.
# These tests are RED until the executor adds cover_image_variants to
# CultureDeckResponse and populates it in _build_localized_deck_response /
# _build_localized_detail_response inside culture_deck_service.py.
# =============================================================================


class TestCultureDeckCoverImageVariants:
    """Tests for cover_image_variants field on CultureDeck public responses."""

    @pytest.mark.asyncio
    async def test_culture_deck_response_includes_cover_variants(self, mock_db_session: MagicMock):
        """list_decks builder: CultureDeckResponse gets cover_image_variants when cover key set.

        Expects cover_image_variants == {400: "u400", 800: "u800", 1600: "u1600"}
        and a non-null cover_image_url.
        FAILS RED until cover_image_variants is added to CultureDeckResponse and
        _build_localized_deck_response populates it.
        """
        service = CultureDeckService(mock_db_session)

        mock_deck = MagicMock()
        mock_deck.id = uuid4()
        mock_deck.name_en = "Culture Cover Deck"
        mock_deck.name_el = "Πολιτισμός με Εξώφυλλο"
        mock_deck.name_ru = "Культура с обложкой"
        mock_deck.description_en = "Culture deck with cover"
        mock_deck.description_el = "Πολιτισμική τράπουλα με εξώφυλλο"
        mock_deck.description_ru = "Культурная колода с обложкой"
        mock_deck.category = "culture"
        mock_deck.is_active = True
        mock_deck.is_premium = False
        mock_deck.cover_image_s3_key = "culture/decks/abc/cover.jpg"

        mock_s3 = MagicMock()
        mock_s3.generate_presigned_url.return_value = "cover-url"
        mock_s3.get_derivative_presigned_urls.return_value = {
            400: "u400",
            800: "u800",
            1600: "u1600",
        }

        with (
            patch.object(service.deck_repo, "list_active", new_callable=AsyncMock) as mock_list,
            patch.object(service.deck_repo, "count_active", new_callable=AsyncMock) as mock_count,
            patch.object(
                service.deck_repo, "get_batch_question_counts", new_callable=AsyncMock
            ) as mock_batch,
            patch("src.services.culture_deck_service.get_s3_service", return_value=mock_s3),
        ):
            mock_list.return_value = [mock_deck]
            mock_count.return_value = 1
            mock_batch.return_value = {mock_deck.id: 10}

            result = await service.list_decks()

            assert len(result.decks) == 1
            deck_resp = result.decks[0]

            # cover_image_url must be populated
            assert deck_resp.cover_image_url == "cover-url"

            # RED: cover_image_variants is not on CultureDeckResponse yet
            variants = getattr(deck_resp, "cover_image_variants", "__MISSING__")
            assert variants == {
                400: "u400",
                800: "u800",
                1600: "u1600",
            }, f"Expected cover_image_variants dict on CultureDeckResponse, got: {variants!r}"

    @pytest.mark.asyncio
    async def test_culture_deck_detail_includes_cover_variants(self, mock_db_session: MagicMock):
        """get_deck builder: CultureDeckDetailResponse gets cover_image_variants.

        FAILS RED until cover_image_variants is added to CultureDeckResponse
        (parent) and _build_localized_detail_response populates it.
        """
        from datetime import datetime

        service = CultureDeckService(mock_db_session)
        deck_id = uuid4()

        mock_deck = MagicMock()
        mock_deck.id = deck_id
        mock_deck.name_en = "Culture Detail Cover"
        mock_deck.name_el = "Λεπτομέρεια Πολιτισμού"
        mock_deck.name_ru = "Детальная культура"
        mock_deck.description_en = "Culture detail with cover"
        mock_deck.description_el = "Λεπτομέρεια πολιτιστικής τράπουλας"
        mock_deck.description_ru = "Детальная культурная колода"
        mock_deck.category = "history"
        mock_deck.is_active = True
        mock_deck.is_premium = False
        mock_deck.created_at = datetime(2024, 1, 1)
        mock_deck.updated_at = datetime(2024, 1, 15)
        mock_deck.cover_image_s3_key = "culture/decks/xyz/cover.jpg"

        mock_s3 = MagicMock()
        mock_s3.generate_presigned_url.return_value = "cover-url"
        mock_s3.get_derivative_presigned_urls.return_value = {
            400: "u400",
            800: "u800",
            1600: "u1600",
        }

        with (
            patch.object(service.deck_repo, "get", new_callable=AsyncMock) as mock_get,
            patch.object(
                service.deck_repo, "count_questions", new_callable=AsyncMock
            ) as mock_count_q,
            patch.object(
                service.answer_history_repo,
                "get_study_time_for_deck",
                new_callable=AsyncMock,
                return_value=0,
            ),
            patch("src.services.culture_deck_service.get_s3_service", return_value=mock_s3),
        ):
            mock_get.return_value = mock_deck
            mock_count_q.return_value = 20

            result = await service.get_deck(deck_id)

            # cover_image_url must be populated
            assert result.cover_image_url == "cover-url"

            # RED: cover_image_variants is not on CultureDeckDetailResponse yet
            variants = getattr(result, "cover_image_variants", "__MISSING__")
            assert variants == {
                400: "u400",
                800: "u800",
                1600: "u1600",
            }, f"Expected cover_image_variants dict on CultureDeckDetailResponse, got: {variants!r}"


# =============================================================================
# PERF-18-02 Part B: presign dedup regression lock for the culture LIST path.
#
# D11: the S3Service._url_cache already dedupes presigned URLs by key across a
# request/process lifetime (s3_service.py:225-229), and
# _build_localized_deck_response (culture_deck_service.py:171-177) signs each
# of a cover's 4 keys (1 main + 3 WebP derivatives, DERIVATIVE_WIDTHS=(400,
# 800, 1600)) exactly once per deck per call. This test is a REGRESSION LOCK
# (green today, independent of Part A's progress-batching change — Part A
# does not touch the signing path at all). It guards against a future
# regression (e.g. someone bypassing _url_cache or calling the signer twice
# per key).
# =============================================================================


class TestCultureDeckListPresignDedup:
    """Tests locking in "no S3 key signed more than once per list_decks() call"."""

    @pytest.mark.asyncio
    async def test_culture_list_cover_signed_once_per_request(self, mock_db_session: MagicMock):
        """AC4 — no S3 key is signed more than once across one list_decks() call;
        the 4-URL (1 main + 3 variants) set per cover is preserved.

        Spies on `S3Service.generate_presigned_url` (the terminal signing call
        that both the main cover URL and each WebP derivative funnel through —
        `get_derivative_presigned_urls` calls `self.generate_presigned_url` per
        width, s3_service.py:644-648) using a REAL `S3Service` instance so
        `get_derivative_presigned_urls`'s actual `<base>_<width>w.webp` key
        construction runs unmocked. This observes every raw S3 key that
        crosses the signing boundary during one `list_decks` call across
        multiple decks with distinct covers.
        """
        service = CultureDeckService(mock_db_session)

        cover_keys = [
            "culture/decks/aaa/cover.jpg",
            "culture/decks/bbb/cover.png",
            "culture/decks/ccc/cover.webp",
        ]
        mock_decks = []
        for i, key in enumerate(cover_keys):
            d = MagicMock()
            d.id = uuid4()
            d.name_en = f"Deck {i}"
            d.name_el = f"Τράπουλα {i}"
            d.name_ru = f"Колода {i}"
            d.description_en = f"Desc {i}"
            d.description_el = f"Περιγραφή {i}"
            d.description_ru = f"Описание {i}"
            d.category = "history"
            d.is_active = True
            d.is_premium = False
            d.cover_image_s3_key = key
            mock_decks.append(d)

        counts_map = {d.id: 5 for d in mock_decks}

        # Real S3Service instance (no AWS creds needed — only
        # `generate_presigned_url` is patched, so `_get_client()` is never
        # reached) so `get_derivative_presigned_urls` exercises its actual
        # key-construction logic instead of being stubbed away.
        s3 = S3Service()
        signed_keys: list[str] = []

        def _fake_sign(image_key: str, expiry_seconds: int | None = None) -> str | None:
            if not image_key:
                return None
            signed_keys.append(image_key)
            return f"https://signed.example/{image_key}"

        with (
            patch.object(service.deck_repo, "list_active", new_callable=AsyncMock) as mock_list,
            patch.object(service.deck_repo, "count_active", new_callable=AsyncMock) as mock_count,
            patch.object(
                service.deck_repo, "get_batch_question_counts", new_callable=AsyncMock
            ) as mock_batch,
            patch.object(s3, "generate_presigned_url", side_effect=_fake_sign) as mock_sign,
            patch("src.services.culture_deck_service.get_s3_service", return_value=s3),
        ):
            mock_list.return_value = mock_decks
            mock_count.return_value = len(mock_decks)
            mock_batch.return_value = counts_map

            result = await service.list_decks()

        # No S3 key signed more than once, regardless of deck count.
        assert len(signed_keys) == len(
            set(signed_keys)
        ), f"A cover key was signed more than once: {signed_keys}"

        # Exactly 1 main + 3 derivatives per deck, nothing more/less.
        expected_sign_count = len(mock_decks) * 4
        assert mock_sign.call_count == expected_sign_count, (
            f"Expected {expected_sign_count} sign calls "
            f"({len(mock_decks)} decks x 4 keys), got {mock_sign.call_count}"
        )
        assert len(signed_keys) == expected_sign_count

        # Response shape unchanged: 1 main URL + 3-entry variant dict per cover.
        assert len(result.decks) == len(mock_decks)
        for deck_resp, key in zip(result.decks, cover_keys):
            assert deck_resp.cover_image_url == f"https://signed.example/{key}"
            base_without_ext = key.rsplit(".", 1)[0]
            assert deck_resp.cover_image_variants == {
                400: f"https://signed.example/{base_without_ext}_400w.webp",
                800: f"https://signed.example/{base_without_ext}_800w.webp",
                1600: f"https://signed.example/{base_without_ext}_1600w.webp",
            }
