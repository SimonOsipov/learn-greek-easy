"""Tests for audio metadata fields in NewsItemResponse.

This test module verifies that the three audio metadata fields
(audio_generated_at, audio_duration_seconds, audio_file_size_bytes)
are properly exposed through the NewsItemResponse schema.
"""

from datetime import date, datetime, timezone
from unittest.mock import MagicMock

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import NewsItem
from src.services.news_item_service import NewsItemService

# =============================================================================
# Test Audio Metadata Fields
# =============================================================================


class TestAudioMetadataFields:
    """Tests for audio metadata fields in NewsItemResponse."""

    @pytest.mark.asyncio
    async def test_audio_metadata_all_none_when_no_audio(
        self,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
    ):
        """Should return all audio metadata fields as None when no audio exists."""
        # Create news item without audio
        item = NewsItem(
            title_el="Greek Title",
            title_en="English Title",
            title_ru="Russian Title",
            description_el="Greek description",
            description_en="English description",
            description_ru="Russian description",
            publication_date=date.today(),
            original_article_url="https://example.com/article",
            image_s3_key="news-images/test.jpg",
            country="cyprus",
            audio_s3_key=None,
            audio_generated_at=None,
            audio_duration_seconds=None,
            audio_file_size_bytes=None,
        )
        db_session.add(item)
        await db_session.commit()
        await db_session.refresh(item)

        mock_s3_service.generate_presigned_url.side_effect = lambda key: (
            f"https://s3.example.com/{key}" if key else None
        )

        service = NewsItemService(db_session, s3_service=mock_s3_service)
        result = await service.get_by_id(item.id)

        # Verify all audio-related fields are None
        assert result.audio_url is None
        assert result.audio_generated_at is None
        assert result.audio_duration_seconds is None
        assert result.audio_file_size_bytes is None

    @pytest.mark.asyncio
    async def test_audio_metadata_all_present_when_audio_exists(
        self,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
    ):
        """Should return all audio metadata fields when audio exists."""
        # Create news item with complete audio metadata
        expected_timestamp = datetime(2024, 1, 15, 10, 30, 0, tzinfo=timezone.utc)
        expected_duration = 45.5
        expected_size = 1024000

        item = NewsItem(
            title_el="Greek Title",
            title_en="English Title",
            title_ru="Russian Title",
            description_el="Greek description",
            description_en="English description",
            description_ru="Russian description",
            publication_date=date.today(),
            original_article_url="https://example.com/article-with-audio",
            image_s3_key="news-images/test.jpg",
            country="cyprus",
            audio_s3_key="news-audio/test.mp3",
            audio_generated_at=expected_timestamp,
            audio_duration_seconds=expected_duration,
            audio_file_size_bytes=expected_size,
        )
        db_session.add(item)
        await db_session.commit()
        await db_session.refresh(item)

        mock_s3_service.generate_presigned_url.side_effect = lambda key: (
            f"https://s3.example.com/{key}" if key else None
        )

        service = NewsItemService(db_session, s3_service=mock_s3_service)
        result = await service.get_by_id(item.id)

        # Verify all audio-related fields are present
        assert result.audio_url == "https://s3.example.com/news-audio/test.mp3"
        assert result.audio_generated_at == expected_timestamp
        assert result.audio_duration_seconds == expected_duration
        assert result.audio_file_size_bytes == expected_size

    @pytest.mark.asyncio
    async def test_audio_metadata_partial_when_some_fields_missing(
        self,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
    ):
        """Should handle partial audio metadata gracefully.

        This tests the edge case where audio_s3_key exists but metadata
        extraction failed, leaving some fields as None.
        """
        expected_timestamp = datetime(2024, 1, 15, 10, 30, 0, tzinfo=timezone.utc)

        item = NewsItem(
            title_el="Greek Title",
            title_en="English Title",
            title_ru="Russian Title",
            description_el="Greek description",
            description_en="English description",
            description_ru="Russian description",
            publication_date=date.today(),
            original_article_url="https://example.com/article",
            image_s3_key="news-images/test.jpg",
            country="cyprus",
            audio_s3_key="news-audio/test.mp3",
            audio_generated_at=expected_timestamp,
            audio_duration_seconds=None,  # Missing
            audio_file_size_bytes=None,  # Missing
        )
        db_session.add(item)
        await db_session.commit()
        await db_session.refresh(item)

        mock_s3_service.generate_presigned_url.side_effect = lambda key: (
            f"https://s3.example.com/{key}" if key else None
        )

        service = NewsItemService(db_session, s3_service=mock_s3_service)
        result = await service.get_by_id(item.id)

        # Verify partial metadata is handled correctly
        assert result.audio_url == "https://s3.example.com/news-audio/test.mp3"
        assert result.audio_generated_at == expected_timestamp
        assert result.audio_duration_seconds is None
        assert result.audio_file_size_bytes is None

    @pytest.mark.asyncio
    async def test_audio_metadata_in_list_response(
        self,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
    ):
        """Should include audio metadata fields in list responses."""
        # Create two news items: one with audio, one without
        expected_timestamp = datetime(2024, 1, 15, 10, 30, 0, tzinfo=timezone.utc)

        item_with_audio = NewsItem(
            title_el="Greek Title 1",
            title_en="English Title 1",
            title_ru="Russian Title 1",
            description_el="Greek description 1",
            description_en="English description 1",
            description_ru="Russian description 1",
            publication_date=date(2024, 1, 15),
            original_article_url="https://example.com/article1",
            image_s3_key="news-images/test1.jpg",
            country="cyprus",
            audio_s3_key="news-audio/test1.mp3",
            audio_generated_at=expected_timestamp,
            audio_duration_seconds=45.5,
            audio_file_size_bytes=1024000,
        )

        item_without_audio = NewsItem(
            title_el="Greek Title 2",
            title_en="English Title 2",
            title_ru="Russian Title 2",
            description_el="Greek description 2",
            description_en="English description 2",
            description_ru="Russian description 2",
            publication_date=date(2024, 1, 16),
            original_article_url="https://example.com/article2",
            image_s3_key="news-images/test2.jpg",
            country="cyprus",
            audio_s3_key=None,
            audio_generated_at=None,
            audio_duration_seconds=None,
            audio_file_size_bytes=None,
        )

        db_session.add(item_with_audio)
        db_session.add(item_without_audio)
        await db_session.commit()
        await db_session.refresh(item_with_audio)
        await db_session.refresh(item_without_audio)

        mock_s3_service.generate_presigned_url.side_effect = lambda key: (
            f"https://s3.example.com/{key}" if key else None
        )

        service = NewsItemService(db_session, s3_service=mock_s3_service)
        result = await service.get_list(page=1, page_size=10)

        # Verify list contains both items with correct metadata
        assert result.total == 2
        assert len(result.items) == 2

        # Find each item in the results (order might vary)
        audio_item = next(i for i in result.items if i.title_en == "English Title 1")
        no_audio_item = next(i for i in result.items if i.title_en == "English Title 2")

        # Verify item with audio has all metadata
        assert audio_item.audio_url == "https://s3.example.com/news-audio/test1.mp3"
        assert audio_item.audio_generated_at == expected_timestamp
        assert audio_item.audio_duration_seconds == 45.5
        assert audio_item.audio_file_size_bytes == 1024000

        # Verify item without audio has None for all metadata
        assert no_audio_item.audio_url is None
        assert no_audio_item.audio_generated_at is None
        assert no_audio_item.audio_duration_seconds is None
        assert no_audio_item.audio_file_size_bytes is None


# =============================================================================
# Test Schema Inheritance
# =============================================================================


class TestNewsItemWithCardInfoInheritance:
    """Tests that NewsItemWithCardInfo inherits audio metadata fields."""

    @pytest.mark.asyncio
    async def test_news_item_with_card_info_includes_audio_metadata(
        self,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
    ):
        """NewsItemWithCardInfo should inherit audio metadata fields from NewsItemResponse."""
        from src.schemas.news_item import NewsItemWithCardInfo

        expected_timestamp = datetime(2024, 1, 15, 10, 30, 0, tzinfo=timezone.utc)

        # Create a NewsItemWithCardInfo instance with audio metadata
        item = NewsItemWithCardInfo(
            id="123e4567-e89b-12d3-a456-426614174000",
            title_el="Greek Title",
            title_en="English Title",
            title_ru="Russian Title",
            description_el="Greek description",
            description_en="English description",
            description_ru="Russian description",
            publication_date=date(2024, 1, 15),
            original_article_url="https://example.com/article",
            country="cyprus",
            image_url="https://s3.example.com/image.jpg",
            audio_url="https://s3.example.com/audio.mp3",
            audio_generated_at=expected_timestamp,
            audio_duration_seconds=45.5,
            audio_file_size_bytes=1024000,
            created_at=datetime(2024, 1, 15, 10, 0, 0, tzinfo=timezone.utc),
            updated_at=datetime(2024, 1, 15, 10, 0, 0, tzinfo=timezone.utc),
            card_id=None,
            deck_id=None,
        )

        # Verify all inherited audio metadata fields are present
        assert item.audio_url == "https://s3.example.com/audio.mp3"
        assert item.audio_generated_at == expected_timestamp
        assert item.audio_duration_seconds == 45.5
        assert item.audio_file_size_bytes == 1024000


# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture
def mock_s3_service():
    """Mock S3 service for testing."""
    return MagicMock()
