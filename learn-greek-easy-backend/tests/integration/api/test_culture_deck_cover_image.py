"""Integration tests for culture deck cover image upload endpoint.

Tests for:
- POST /api/v1/culture/decks/{deck_id}/cover-image - Upload cover image

Run with:
    pytest tests/integration/api/test_culture_deck_cover_image.py -v
"""

from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.factories import CultureDeckFactory

# ============================================================================
# Test Fixtures
# ============================================================================


@pytest.fixture
def mock_s3(mocker):
    """Mock S3 service for cover image tests."""
    mock = mocker.MagicMock()
    mock.upload_object.return_value = True
    mock.generate_presigned_url.return_value = "https://s3.example.com/culture-deck-images/test.jpg"
    mock.delete_object.return_value = True
    mocker.patch("src.api.v1.culture.router.get_s3_service", return_value=mock)
    return mock


# ============================================================================
# POST /api/v1/culture/decks/{deck_id}/cover-image Tests
# ============================================================================


class TestUploadCultureDeckCoverImage:
    """Tests for POST /api/v1/culture/decks/{deck_id}/cover-image endpoint."""

    @pytest.mark.asyncio
    async def test_upload_cover_image_success(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
        mock_s3: MagicMock,
    ) -> None:
        """Test successful JPEG cover image upload returns 200 with cover_image_url."""
        deck = await CultureDeckFactory.create(session=db_session)

        response = await client.post(
            f"/api/v1/culture/decks/{deck.id}/cover-image",
            files={"file": ("cover.jpg", b"fake-jpeg-bytes", "image/jpeg")},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["cover_image_url"] == "https://s3.example.com/culture-deck-images/test.jpg"
        mock_s3.upload_object.assert_called_once()

        # Verify s3_key was persisted in DB
        await db_session.refresh(deck)
        assert deck.cover_image_s3_key == f"culture-deck-images/{deck.id}.jpg"

    @pytest.mark.asyncio
    async def test_upload_cover_image_invalid_content_type(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
        mock_s3: MagicMock,
    ) -> None:
        """Test that text/plain content type returns 400."""
        deck = await CultureDeckFactory.create(session=db_session)

        response = await client.post(
            f"/api/v1/culture/decks/{deck.id}/cover-image",
            files={"file": ("cover.txt", b"some text", "text/plain")},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 400
        data = response.json()
        assert "content type" in data["error"]["message"].lower()
        mock_s3.upload_object.assert_not_called()

    @pytest.mark.asyncio
    async def test_upload_cover_image_too_large(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
        mock_s3: MagicMock,
    ) -> None:
        """Test that files larger than 3MB return 400."""
        deck = await CultureDeckFactory.create(session=db_session)
        large_data = b"x" * (3 * 1024 * 1024 + 1)  # 3MB + 1 byte

        response = await client.post(
            f"/api/v1/culture/decks/{deck.id}/cover-image",
            files={"file": ("cover.jpg", large_data, "image/jpeg")},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 400
        data = response.json()
        assert "too large" in data["error"]["message"].lower()
        mock_s3.upload_object.assert_not_called()

    @pytest.mark.asyncio
    async def test_upload_cover_image_deck_not_found(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        mock_s3: MagicMock,
    ) -> None:
        """Test that a random UUID returns 404."""
        random_id = uuid4()

        response = await client.post(
            f"/api/v1/culture/decks/{random_id}/cover-image",
            files={"file": ("cover.jpg", b"fake-jpeg-bytes", "image/jpeg")},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 404
        mock_s3.upload_object.assert_not_called()

    @pytest.mark.asyncio
    async def test_upload_cover_image_not_superuser(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
        mock_s3: MagicMock,
    ) -> None:
        """Test that regular users get 403 Forbidden."""
        deck = await CultureDeckFactory.create(session=db_session)

        response = await client.post(
            f"/api/v1/culture/decks/{deck.id}/cover-image",
            files={"file": ("cover.jpg", b"fake-jpeg-bytes", "image/jpeg")},
            headers=auth_headers,
        )

        assert response.status_code == 403
        mock_s3.upload_object.assert_not_called()

    @pytest.mark.asyncio
    async def test_upload_replaces_existing_image(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
        mock_s3: MagicMock,
    ) -> None:
        """Test that uploading twice with different extension replaces the image."""
        deck = await CultureDeckFactory.create(session=db_session)

        # First upload (JPEG)
        await client.post(
            f"/api/v1/culture/decks/{deck.id}/cover-image",
            files={"file": ("cover.jpg", b"fake-jpeg-bytes", "image/jpeg")},
            headers=superuser_auth_headers,
        )
        await db_session.refresh(deck)
        assert deck.cover_image_s3_key == f"culture-deck-images/{deck.id}.jpg"

        # Second upload (PNG - different extension triggers delete of old key)
        mock_s3.generate_presigned_url.return_value = (
            "https://s3.example.com/culture-deck-images/test.png"
        )
        response = await client.post(
            f"/api/v1/culture/decks/{deck.id}/cover-image",
            files={"file": ("cover.png", b"fake-png-bytes", "image/png")},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        await db_session.refresh(deck)
        assert deck.cover_image_s3_key == f"culture-deck-images/{deck.id}.png"
        mock_s3.delete_object.assert_called_once_with(f"culture-deck-images/{deck.id}.jpg")
