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
        mock_deck.name = {"en": "Greek History", "el": "Ελληνική Ιστορία"}
        mock_deck.description = {"en": "History deck", "el": "Ιστορία"}
        mock_deck.icon = "book"
        mock_deck.color_accent = "#4F46E5"
        mock_deck.category = "history"
        mock_deck.is_active = True

        with (
            patch.object(service.deck_repo, "list_active", new_callable=AsyncMock) as mock_list,
            patch.object(service.deck_repo, "count_active", new_callable=AsyncMock) as mock_count,
            patch.object(
                service.deck_repo, "count_questions", new_callable=AsyncMock
            ) as mock_count_q,
        ):
            mock_list.return_value = [mock_deck]
            mock_count.return_value = 1
            mock_count_q.return_value = 25

            result = await service.list_decks()

            assert isinstance(result, CultureDeckListResponse)
            assert result.total == 1
            assert len(result.decks) == 1
            assert result.decks[0].id == mock_deck.id
            assert result.decks[0].question_count == 25

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
        mock_deck.name = {"en": "Test", "el": "Test", "ru": "Test"}
        mock_deck.description = {"en": "Test desc", "el": "Test desc", "ru": "Test desc"}
        mock_deck.icon = "test"
        mock_deck.color_accent = "#000000"
        mock_deck.category = "culture"
        mock_deck.is_active = True

        with (
            patch.object(service.deck_repo, "list_active", new_callable=AsyncMock) as mock_list,
            patch.object(service.deck_repo, "count_active", new_callable=AsyncMock) as mock_count,
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
        ):
            mock_list.return_value = [mock_deck]
            mock_count.return_value = 1
            mock_count_q.return_value = 30
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
        mock_deck.name = {"en": "Test", "el": "Test", "ru": "Test"}
        mock_deck.description = {"en": "Test desc", "el": "Test desc", "ru": "Test desc"}
        mock_deck.icon = "test"
        mock_deck.color_accent = "#000000"
        mock_deck.category = "culture"
        mock_deck.is_active = True

        with (
            patch.object(service.deck_repo, "list_active", new_callable=AsyncMock) as mock_list,
            patch.object(service.deck_repo, "count_active", new_callable=AsyncMock) as mock_count,
            patch.object(
                service.deck_repo, "count_questions", new_callable=AsyncMock
            ) as mock_count_q,
        ):
            mock_list.return_value = [mock_deck]
            mock_count.return_value = 1
            mock_count_q.return_value = 30

            # No user_id provided
            result = await service.list_decks(user_id=None)

            assert result.decks[0].progress is None


class TestCultureDeckServiceGetDeck:
    """Tests for get_deck method."""

    @pytest.mark.asyncio
    async def test_get_deck_success(self, mock_db_session: MagicMock):
        """Test successfully retrieving a deck."""
        service = CultureDeckService(mock_db_session)
        deck_id = uuid4()

        mock_deck = MagicMock()
        mock_deck.id = deck_id
        mock_deck.name = {"en": "Greek History"}
        mock_deck.description = {"en": "Learn about Greek history"}
        mock_deck.icon = "book"
        mock_deck.color_accent = "#4F46E5"
        mock_deck.category = "history"
        mock_deck.is_active = True
        mock_deck.created_at = datetime(2024, 1, 1)
        mock_deck.updated_at = datetime(2024, 1, 15)

        with (
            patch.object(service.deck_repo, "get", new_callable=AsyncMock) as mock_get,
            patch.object(
                service.deck_repo, "count_questions", new_callable=AsyncMock
            ) as mock_count_q,
        ):
            mock_get.return_value = mock_deck
            mock_count_q.return_value = 50

            result = await service.get_deck(deck_id)

            assert isinstance(result, CultureDeckDetailResponse)
            assert result.id == deck_id
            assert result.question_count == 50
            assert result.is_active is True
            mock_get.assert_awaited_once_with(deck_id)

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
        mock_deck.name = {"en": "Test", "el": "Test", "ru": "Test"}
        mock_deck.description = {"en": "Test desc", "el": "Test desc", "ru": "Test desc"}
        mock_deck.icon = "test"
        mock_deck.color_accent = "#000000"
        mock_deck.category = "culture"
        mock_deck.is_active = True
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
