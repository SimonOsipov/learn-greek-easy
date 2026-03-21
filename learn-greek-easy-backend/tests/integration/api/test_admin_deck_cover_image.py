"""Integration tests for deck cover image upload and delete endpoints.

Tests for:
- POST /api/v1/admin/decks/{deck_id}/cover-image - Upload cover image
- DELETE /api/v1/admin/decks/{deck_id}/cover-image - Delete cover image

Run with:
    pytest tests/integration/api/test_admin_deck_cover_image.py -v
"""

from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.factories.content import DeckFactory

# ============================================================================
# Test Fixtures
# ============================================================================


@pytest.fixture
def mock_s3(mocker):
    """Mock S3 service for cover image tests."""
    mock = mocker.MagicMock()
    mock.upload_object.return_value = True
    mock.generate_presigned_url.return_value = "https://s3.example.com/deck-images/test.jpg"
    mock.delete_object.return_value = True
    mocker.patch("src.api.v1.admin.get_s3_service", return_value=mock)
    mocker.patch("src.api.v1.decks.get_s3_service", return_value=mock)
    return mock


# ============================================================================
# POST /api/v1/admin/decks/{deck_id}/cover-image Tests
# ============================================================================


class TestUploadDeckCoverImage:
    """Tests for POST /api/v1/admin/decks/{deck_id}/cover-image endpoint."""

    @pytest.mark.asyncio
    async def test_upload_cover_image_success(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
        mock_s3: MagicMock,
    ) -> None:
        """Test successful JPEG cover image upload returns 200 with cover_image_url."""
        deck = await DeckFactory.create(session=db_session)

        response = await client.post(
            f"/api/v1/admin/decks/{deck.id}/cover-image",
            files={"file": ("cover.jpg", b"fake-jpeg-bytes", "image/jpeg")},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["cover_image_url"] == "https://s3.example.com/deck-images/test.jpg"
        mock_s3.upload_object.assert_called_once()

        # Verify s3_key was persisted in DB
        await db_session.refresh(deck)
        assert deck.cover_image_s3_key == f"deck-images/{deck.id}.jpg"

    @pytest.mark.asyncio
    async def test_upload_cover_image_png(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
        mock_s3: MagicMock,
    ) -> None:
        """Test successful PNG cover image upload."""
        deck = await DeckFactory.create(session=db_session)
        mock_s3.generate_presigned_url.return_value = "https://s3.example.com/deck-images/test.png"

        response = await client.post(
            f"/api/v1/admin/decks/{deck.id}/cover-image",
            files={"file": ("cover.png", b"fake-png-bytes", "image/png")},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["cover_image_url"] is not None

        await db_session.refresh(deck)
        assert deck.cover_image_s3_key == f"deck-images/{deck.id}.png"

    @pytest.mark.asyncio
    async def test_upload_cover_image_webp(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
        mock_s3: MagicMock,
    ) -> None:
        """Test successful WebP cover image upload."""
        deck = await DeckFactory.create(session=db_session)
        mock_s3.generate_presigned_url.return_value = "https://s3.example.com/deck-images/test.webp"

        response = await client.post(
            f"/api/v1/admin/decks/{deck.id}/cover-image",
            files={"file": ("cover.webp", b"fake-webp-bytes", "image/webp")},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["cover_image_url"] is not None

        await db_session.refresh(deck)
        assert deck.cover_image_s3_key == f"deck-images/{deck.id}.webp"

    @pytest.mark.asyncio
    async def test_upload_cover_image_invalid_content_type(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
        mock_s3: MagicMock,
    ) -> None:
        """Test that text/plain content type returns 400."""
        deck = await DeckFactory.create(session=db_session)

        response = await client.post(
            f"/api/v1/admin/decks/{deck.id}/cover-image",
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
        deck = await DeckFactory.create(session=db_session)
        large_data = b"x" * (3 * 1024 * 1024 + 1)  # 3MB + 1 byte

        response = await client.post(
            f"/api/v1/admin/decks/{deck.id}/cover-image",
            files={"file": ("cover.jpg", large_data, "image/jpeg")},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 400
        data = response.json()
        assert "too large" in data["error"]["message"].lower()
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
        deck = await DeckFactory.create(session=db_session)

        response = await client.post(
            f"/api/v1/admin/decks/{deck.id}/cover-image",
            files={"file": ("cover.jpg", b"fake-jpeg-bytes", "image/jpeg")},
            headers=auth_headers,
        )

        assert response.status_code == 403
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
            f"/api/v1/admin/decks/{random_id}/cover-image",
            files={"file": ("cover.jpg", b"fake-jpeg-bytes", "image/jpeg")},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 404
        mock_s3.upload_object.assert_not_called()

    @pytest.mark.asyncio
    async def test_upload_replaces_existing_image(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
        mock_s3: MagicMock,
    ) -> None:
        """Test that uploading twice replaces the image and updates s3_key."""
        deck = await DeckFactory.create(session=db_session)

        # First upload (JPEG)
        await client.post(
            f"/api/v1/admin/decks/{deck.id}/cover-image",
            files={"file": ("cover.jpg", b"fake-jpeg-bytes", "image/jpeg")},
            headers=superuser_auth_headers,
        )
        await db_session.refresh(deck)
        assert deck.cover_image_s3_key == f"deck-images/{deck.id}.jpg"

        # Second upload (PNG - different extension triggers delete of old key)
        mock_s3.generate_presigned_url.return_value = "https://s3.example.com/deck-images/test.png"
        response = await client.post(
            f"/api/v1/admin/decks/{deck.id}/cover-image",
            files={"file": ("cover.png", b"fake-png-bytes", "image/png")},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        await db_session.refresh(deck)
        assert deck.cover_image_s3_key == f"deck-images/{deck.id}.png"
        mock_s3.delete_object.assert_called_once_with(f"deck-images/{deck.id}.jpg")

    @pytest.mark.asyncio
    async def test_deck_list_includes_cover_image_url(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
        mock_s3: MagicMock,
    ) -> None:
        """Test that GET /admin/decks returns cover_image_url field in deck items."""
        deck = await DeckFactory.create(session=db_session)

        response = await client.get(
            "/api/v1/admin/decks",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "decks" in data
        deck_items = [d for d in data["decks"] if str(d["id"]) == str(deck.id)]
        assert len(deck_items) == 1
        assert "cover_image_url" in deck_items[0]

    @pytest.mark.asyncio
    async def test_deck_detail_includes_cover_image_url(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
        mock_s3: MagicMock,
    ) -> None:
        """Test that GET /decks/{id} returns cover_image_url field."""
        deck = await DeckFactory.create(session=db_session)

        response = await client.get(
            f"/api/v1/decks/{deck.id}",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "cover_image_url" in data

    @pytest.mark.asyncio
    async def test_deck_list_cover_image_url_null_when_no_image(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
        mock_s3: MagicMock,
    ) -> None:
        """Test that cover_image_url is null when deck has no image."""
        deck = await DeckFactory.create(session=db_session)

        response = await client.get(
            f"/api/v1/decks/{deck.id}",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["cover_image_url"] is None


# ============================================================================
# DELETE /api/v1/admin/decks/{deck_id}/cover-image Tests
# ============================================================================


class TestDeleteDeckCoverImage:
    """Tests for DELETE /api/v1/admin/decks/{deck_id}/cover-image endpoint."""

    @pytest.mark.asyncio
    async def test_delete_cover_image_success(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
        mock_s3: MagicMock,
    ) -> None:
        """Successfully delete a deck cover image."""
        deck = await DeckFactory.create(
            session=db_session, cover_image_s3_key="deck-images/test-id.jpg"
        )

        response = await client.delete(
            f"/api/v1/admin/decks/{deck.id}/cover-image",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["cover_image_url"] is None
        mock_s3.delete_object.assert_called_once_with("deck-images/test-id.jpg")
        await db_session.refresh(deck)
        assert deck.cover_image_s3_key is None

    @pytest.mark.asyncio
    async def test_delete_cover_image_deck_not_found(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        mock_s3: MagicMock,
    ) -> None:
        """Returns 404 when deck does not exist."""
        random_id = uuid4()

        response = await client.delete(
            f"/api/v1/admin/decks/{random_id}/cover-image",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 404
        mock_s3.delete_object.assert_not_called()

    @pytest.mark.asyncio
    async def test_delete_cover_image_no_cover(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
        mock_s3: MagicMock,
    ) -> None:
        """Returns 404 when deck has no cover image."""
        deck = await DeckFactory.create(session=db_session)

        response = await client.delete(
            f"/api/v1/admin/decks/{deck.id}/cover-image",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 404
        mock_s3.delete_object.assert_not_called()

    @pytest.mark.asyncio
    async def test_delete_cover_image_requires_superuser(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
        mock_s3: MagicMock,
    ) -> None:
        """Returns 403 for non-superuser."""
        deck = await DeckFactory.create(
            session=db_session, cover_image_s3_key="deck-images/test-id.jpg"
        )

        response = await client.delete(
            f"/api/v1/admin/decks/{deck.id}/cover-image",
            headers=auth_headers,
        )

        assert response.status_code == 403
        mock_s3.delete_object.assert_not_called()

    @pytest.mark.asyncio
    async def test_delete_cover_image_s3_failure(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
        mock_s3: MagicMock,
    ) -> None:
        """Returns 500 and does not clear DB when S3 deletion fails."""
        deck = await DeckFactory.create(
            session=db_session, cover_image_s3_key="deck-images/test-id.jpg"
        )
        mock_s3.delete_object.return_value = False

        response = await client.delete(
            f"/api/v1/admin/decks/{deck.id}/cover-image",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 500
        await db_session.refresh(deck)
        assert deck.cover_image_s3_key == "deck-images/test-id.jpg"
