"""Integration tests for avatar endpoints.

Tests for:
- POST /api/v1/auth/avatar/upload-url - Get presigned URL for avatar upload
- DELETE /api/v1/auth/avatar - Remove current avatar
- PATCH /api/v1/auth/me with avatar_url - Update profile with avatar

Run with:
    pytest tests/integration/api/test_auth_avatar.py -v
"""

from unittest.mock import MagicMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import User

# ============================================================================
# Test Fixtures
# ============================================================================


@pytest.fixture
def mock_s3_service():
    """Mock S3 service for avatar tests."""
    with patch("src.api.v1.auth.get_s3_service") as mock_get:
        mock_service = MagicMock()
        mock_service.validate_avatar_content_type.return_value = True
        mock_service.validate_avatar_size.return_value = True
        mock_service.get_extension_for_content_type.return_value = "jpg"
        mock_service.generate_presigned_upload_url.return_value = "https://s3.example.com/presigned"
        mock_service.generate_presigned_url.return_value = "https://s3.example.com/presigned-get"
        mock_service.delete_object.return_value = True
        mock_get.return_value = mock_service
        yield mock_service


# ============================================================================
# POST /api/v1/auth/avatar/upload-url Tests
# ============================================================================


@pytest.mark.integration
@pytest.mark.auth
class TestGetAvatarUploadUrl:
    """Tests for POST /api/v1/auth/avatar/upload-url endpoint."""

    @pytest.mark.asyncio
    async def test_success_jpeg(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
        mock_s3_service: MagicMock,
    ) -> None:
        """Test successful upload URL generation for JPEG."""
        response = await client.post(
            "/api/v1/auth/avatar/upload-url",
            json={"content_type": "image/jpeg", "file_size": 1024},
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "upload_url" in data
        assert "avatar_key" in data
        assert "expires_in" in data
        assert data["upload_url"] == "https://s3.example.com/presigned"
        assert data["avatar_key"].startswith("avatars/")
        assert data["avatar_key"].endswith(".jpg")
        assert data["expires_in"] == 600

    @pytest.mark.asyncio
    async def test_success_png(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
        mock_s3_service: MagicMock,
    ) -> None:
        """Test successful upload URL generation for PNG."""
        mock_s3_service.get_extension_for_content_type.return_value = "png"

        response = await client.post(
            "/api/v1/auth/avatar/upload-url",
            json={"content_type": "image/png", "file_size": 2048},
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["avatar_key"].endswith(".png")

    @pytest.mark.asyncio
    async def test_success_webp(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
        mock_s3_service: MagicMock,
    ) -> None:
        """Test successful upload URL generation for WebP."""
        mock_s3_service.get_extension_for_content_type.return_value = "webp"

        response = await client.post(
            "/api/v1/auth/avatar/upload-url",
            json={"content_type": "image/webp", "file_size": 512},
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["avatar_key"].endswith(".webp")

    @pytest.mark.asyncio
    async def test_invalid_content_type(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
        mock_s3_service: MagicMock,
    ) -> None:
        """Test that invalid content type returns 400."""
        mock_s3_service.validate_avatar_content_type.return_value = False

        response = await client.post(
            "/api/v1/auth/avatar/upload-url",
            json={"content_type": "image/gif", "file_size": 1024},
            headers=auth_headers,
        )

        assert response.status_code == 400
        data = response.json()
        # Response format: {"success": False, "error": {"code": "...", "message": "..."}}
        assert data["success"] is False
        assert "content type" in data["error"]["message"].lower()

    @pytest.mark.asyncio
    async def test_file_too_large(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
        mock_s3_service: MagicMock,
    ) -> None:
        """Test that file size over limit returns 422 (validation error)."""
        # Note: The 5MB limit is enforced by Pydantic schema validation,
        # so we get 422 before the mock is even called
        response = await client.post(
            "/api/v1/auth/avatar/upload-url",
            json={"content_type": "image/jpeg", "file_size": 10 * 1024 * 1024},
            headers=auth_headers,
        )

        # Pydantic validation returns 422
        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_file_size_zero(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
    ) -> None:
        """Test that zero file size is rejected by validation."""
        response = await client.post(
            "/api/v1/auth/avatar/upload-url",
            json={"content_type": "image/jpeg", "file_size": 0},
            headers=auth_headers,
        )

        # Pydantic validation should reject file_size <= 0
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_unauthenticated(self, client: AsyncClient) -> None:
        """Test that unauthenticated request returns 401."""
        response = await client.post(
            "/api/v1/auth/avatar/upload-url",
            json={"content_type": "image/jpeg", "file_size": 1024},
        )

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_s3_unavailable(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
        mock_s3_service: MagicMock,
    ) -> None:
        """Test that S3 unavailable returns 503."""
        mock_s3_service.generate_presigned_upload_url.return_value = None

        response = await client.post(
            "/api/v1/auth/avatar/upload-url",
            json={"content_type": "image/jpeg", "file_size": 1024},
            headers=auth_headers,
        )

        assert response.status_code == 503
        data = response.json()
        # Response format: {"success": False, "error": {"code": "...", "message": "..."}}
        assert data["success"] is False
        message = data["error"]["message"].lower()
        assert "s3" in message or "service" in message or "upload" in message

    @pytest.mark.asyncio
    async def test_avatar_key_contains_user_id(
        self,
        client: AsyncClient,
        test_user: User,
        auth_headers: dict[str, str],
        mock_s3_service: MagicMock,
    ) -> None:
        """Test that generated avatar key contains user ID for security."""
        response = await client.post(
            "/api/v1/auth/avatar/upload-url",
            json={"content_type": "image/jpeg", "file_size": 1024},
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        # Avatar key should be: avatars/{user_id}/{uuid}.{ext}
        assert str(test_user.id) in data["avatar_key"]


# ============================================================================
# DELETE /api/v1/auth/avatar Tests
# ============================================================================


@pytest.mark.integration
@pytest.mark.auth
class TestDeleteAvatar:
    """Tests for DELETE /api/v1/auth/avatar endpoint."""

    @pytest.mark.asyncio
    async def test_success_with_existing_avatar(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
        test_user: User,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
    ) -> None:
        """Test successful avatar deletion when user has avatar."""
        # Set avatar on user
        old_avatar = f"avatars/{test_user.id}/old-avatar.jpg"
        test_user.avatar_url = old_avatar
        db_session.add(test_user)
        await db_session.commit()

        response = await client.delete(
            "/api/v1/auth/avatar",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "removed" in data["message"].lower()

        # Verify S3 delete was called
        mock_s3_service.delete_object.assert_called_once_with(old_avatar)

        # Verify user avatar_url is cleared
        await db_session.refresh(test_user)
        assert test_user.avatar_url is None

    @pytest.mark.asyncio
    async def test_success_without_existing_avatar(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
        test_user: User,
        mock_s3_service: MagicMock,
    ) -> None:
        """Test successful response when user has no avatar."""
        # User has no avatar
        assert test_user.avatar_url is None

        response = await client.delete(
            "/api/v1/auth/avatar",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

        # S3 delete not called since no avatar existed
        mock_s3_service.delete_object.assert_not_called()

    @pytest.mark.asyncio
    async def test_unauthenticated(self, client: AsyncClient) -> None:
        """Test that unauthenticated request returns 401."""
        response = await client.delete("/api/v1/auth/avatar")
        assert response.status_code == 401


# ============================================================================
# PATCH /api/v1/auth/me with avatar_url Tests
# ============================================================================


@pytest.mark.integration
@pytest.mark.auth
class TestUpdateMeWithAvatar:
    """Tests for PATCH /api/v1/auth/me with avatar_url field."""

    @pytest.mark.asyncio
    async def test_set_avatar_success(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
        test_user: User,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
    ) -> None:
        """Test setting avatar URL successfully."""
        avatar_key = f"avatars/{test_user.id}/new-avatar.jpg"

        response = await client.patch(
            "/api/v1/auth/me",
            json={"avatar_url": avatar_key},
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        # Response now returns presigned URL, not the raw S3 key
        assert data["avatar_url"] == "https://s3.example.com/presigned-get"
        mock_s3_service.generate_presigned_url.assert_called_with(
            avatar_key, expiry_seconds=2592000
        )

        # Verify DB stores the S3 key (not presigned URL)
        await db_session.refresh(test_user)
        assert test_user.avatar_url == avatar_key

    @pytest.mark.asyncio
    async def test_replace_avatar_deletes_old(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
        test_user: User,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
    ) -> None:
        """Test that replacing avatar deletes old one from S3."""
        # Set existing avatar
        old_avatar = f"avatars/{test_user.id}/old-avatar.jpg"
        test_user.avatar_url = old_avatar
        db_session.add(test_user)
        await db_session.commit()

        new_avatar = f"avatars/{test_user.id}/new-avatar.jpg"

        response = await client.patch(
            "/api/v1/auth/me",
            json={"avatar_url": new_avatar},
            headers=auth_headers,
        )

        assert response.status_code == 200

        # Verify old avatar was deleted from S3
        mock_s3_service.delete_object.assert_called_once_with(old_avatar)

        # Verify new avatar is set
        await db_session.refresh(test_user)
        assert test_user.avatar_url == new_avatar

    @pytest.mark.asyncio
    async def test_invalid_avatar_path_wrong_user(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
        test_user: User,
        mock_s3_service: MagicMock,
    ) -> None:
        """Test that avatar path for different user is rejected."""
        # Try to set avatar with different user's path
        response = await client.patch(
            "/api/v1/auth/me",
            json={"avatar_url": "avatars/different-user-id/avatar.jpg"},
            headers=auth_headers,
        )

        assert response.status_code == 400
        data = response.json()
        # Response format: {"success": False, "error": {"code": "...", "message": "..."}}
        assert data["success"] is False
        assert "avatar" in data["error"]["message"].lower()

    @pytest.mark.asyncio
    async def test_avatar_with_other_fields(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
        test_user: User,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
    ) -> None:
        """Test updating avatar along with other fields."""
        avatar_key = f"avatars/{test_user.id}/avatar.jpg"

        response = await client.patch(
            "/api/v1/auth/me",
            json={
                "avatar_url": avatar_key,
                "full_name": "Updated Name",
            },
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        # Response now returns presigned URL, not the raw S3 key
        assert data["avatar_url"] == "https://s3.example.com/presigned-get"
        assert data["full_name"] == "Updated Name"

    @pytest.mark.asyncio
    async def test_get_me_returns_avatar_url(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
        test_user: User,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
    ) -> None:
        """Test that GET /me returns presigned avatar URL in response."""
        # Set avatar
        avatar_key = f"avatars/{test_user.id}/avatar.jpg"
        test_user.avatar_url = avatar_key
        db_session.add(test_user)
        await db_session.commit()

        response = await client.get(
            "/api/v1/auth/me",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        # Response now returns presigned URL, not the raw S3 key
        assert data["avatar_url"] == "https://s3.example.com/presigned-get"
        mock_s3_service.generate_presigned_url.assert_called_with(
            avatar_key, expiry_seconds=2592000
        )

    @pytest.mark.asyncio
    async def test_unauthenticated(self, client: AsyncClient) -> None:
        """Test that unauthenticated request returns 401."""
        response = await client.patch(
            "/api/v1/auth/me",
            json={"avatar_url": "avatars/user-id/avatar.jpg"},
        )
        assert response.status_code == 401
