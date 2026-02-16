"""Unit tests for seed API endpoints.

Tests cover:
- verify_seed_access dependency function
- GET /test/seed/status endpoint
- POST /test/seed/all endpoint
- POST /test/seed/truncate endpoint
- POST /test/seed/users endpoint
- POST /test/seed/content endpoint
"""

from unittest.mock import AsyncMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.api.v1.test.seed import router, verify_seed_access
from src.core.exceptions import (
    BaseAPIException,
    SeedDisabledException,
    SeedForbiddenException,
    SeedUnauthorizedException,
)
from src.db.dependencies import get_db

# ============================================================================
# Test Fixtures
# ============================================================================


@pytest.fixture
def mock_db():
    """Create a mock database session."""
    mock = AsyncMock()
    mock.commit = AsyncMock()
    return mock


@pytest.fixture
def app(mock_db) -> FastAPI:
    """Create test FastAPI app with seed router."""
    test_app = FastAPI()
    test_app.include_router(router)

    # Add exception handler for BaseAPIException
    @test_app.exception_handler(BaseAPIException)
    async def base_api_exception_handler(request, exc: BaseAPIException):
        from fastapi.responses import JSONResponse

        return JSONResponse(
            status_code=exc.status_code,
            content={
                "success": False,
                "error": {
                    "code": exc.error_code,
                    "message": exc.detail,
                },
            },
        )

    # Override get_db dependency
    async def override_get_db():
        yield mock_db

    test_app.dependency_overrides[get_db] = override_get_db

    return test_app


@pytest.fixture
def client(app: FastAPI) -> TestClient:
    """Create test client."""
    return TestClient(app)


# ============================================================================
# verify_seed_access Dependency Tests
# ============================================================================


class TestVerifySeedAccess:
    """Tests for seed access verification dependency."""

    @pytest.mark.asyncio
    async def test_raises_forbidden_in_production(self):
        """Should raise SeedForbiddenException in production."""
        with patch("src.api.v1.test.seed.settings") as mock_settings:
            mock_settings.is_production = True

            with pytest.raises(SeedForbiddenException):
                await verify_seed_access()

    @pytest.mark.asyncio
    async def test_raises_disabled_when_not_enabled(self):
        """Should raise SeedDisabledException when disabled."""
        with patch("src.api.v1.test.seed.settings") as mock_settings:
            mock_settings.is_production = False
            mock_settings.test_seed_enabled = False

            with pytest.raises(SeedDisabledException):
                await verify_seed_access()

    @pytest.mark.asyncio
    async def test_raises_unauthorized_with_invalid_secret(self):
        """Should raise SeedUnauthorizedException with bad secret."""
        with patch("src.api.v1.test.seed.settings") as mock_settings:
            mock_settings.is_production = False
            mock_settings.test_seed_enabled = True
            mock_settings.seed_requires_secret = True
            mock_settings.validate_seed_secret.return_value = False

            with pytest.raises(SeedUnauthorizedException):
                await verify_seed_access(x_test_seed_secret="wrong")

    @pytest.mark.asyncio
    async def test_raises_unauthorized_with_missing_secret(self):
        """Should raise SeedUnauthorizedException when secret required but missing."""
        with patch("src.api.v1.test.seed.settings") as mock_settings:
            mock_settings.is_production = False
            mock_settings.test_seed_enabled = True
            mock_settings.seed_requires_secret = True
            mock_settings.validate_seed_secret.return_value = False

            with pytest.raises(SeedUnauthorizedException):
                await verify_seed_access(x_test_seed_secret=None)

    @pytest.mark.asyncio
    async def test_passes_with_valid_secret(self):
        """Should pass with valid secret."""
        with patch("src.api.v1.test.seed.settings") as mock_settings:
            mock_settings.is_production = False
            mock_settings.test_seed_enabled = True
            mock_settings.seed_requires_secret = True
            mock_settings.validate_seed_secret.return_value = True

            # Should not raise
            await verify_seed_access(x_test_seed_secret="valid-secret")

    @pytest.mark.asyncio
    async def test_passes_without_secret_when_not_required(self):
        """Should pass without secret when not configured."""
        with patch("src.api.v1.test.seed.settings") as mock_settings:
            mock_settings.is_production = False
            mock_settings.test_seed_enabled = True
            mock_settings.seed_requires_secret = False

            # Should not raise
            await verify_seed_access()

    @pytest.mark.asyncio
    async def test_passes_without_secret_when_none_configured(self):
        """Should pass when no secret is required and none provided."""
        with patch("src.api.v1.test.seed.settings") as mock_settings:
            mock_settings.is_production = False
            mock_settings.test_seed_enabled = True
            mock_settings.seed_requires_secret = False

            # Should not raise
            await verify_seed_access(x_test_seed_secret=None)


# ============================================================================
# GET /test/seed/status Endpoint Tests
# ============================================================================


class TestSeedStatusEndpoint:
    """Tests for GET /test/seed/status."""

    def test_returns_status_without_auth(self, client: TestClient):
        """Status endpoint should not require authentication."""
        with patch("src.api.v1.test.seed.settings") as mock_settings:
            mock_settings.can_seed_database.return_value = True
            mock_settings.app_env = "development"
            mock_settings.seed_requires_secret = False
            mock_settings.get_seed_validation_errors.return_value = []

            response = client.get("/test/seed/status")

            assert response.status_code == 200
            data = response.json()
            assert data["enabled"] is True
            assert data["environment"] == "development"
            assert data["requires_secret"] is False
            assert data["validation_errors"] == []

    def test_returns_disabled_status(self, client: TestClient):
        """Should return disabled status when seeding is disabled."""
        with patch("src.api.v1.test.seed.settings") as mock_settings:
            mock_settings.can_seed_database.return_value = False
            mock_settings.app_env = "production"
            mock_settings.seed_requires_secret = False
            mock_settings.get_seed_validation_errors.return_value = [
                "Production environment",
                "TEST_SEED_ENABLED is false",
            ]

            response = client.get("/test/seed/status")

            assert response.status_code == 200
            data = response.json()
            assert data["enabled"] is False
            assert data["environment"] == "production"
            assert len(data["validation_errors"]) == 2

    def test_returns_requires_secret_true(self, client: TestClient):
        """Should indicate when secret is required."""
        with patch("src.api.v1.test.seed.settings") as mock_settings:
            mock_settings.can_seed_database.return_value = True
            mock_settings.app_env = "development"
            mock_settings.seed_requires_secret = True
            mock_settings.get_seed_validation_errors.return_value = []

            response = client.get("/test/seed/status")

            assert response.status_code == 200
            data = response.json()
            assert data["requires_secret"] is True


# ============================================================================
# POST /test/seed/all Endpoint Tests
# ============================================================================


class TestSeedAllEndpoint:
    """Tests for POST /test/seed/all."""

    def test_returns_403_when_production(self, client: TestClient):
        """Should return 403 in production environment."""
        with patch("src.api.v1.test.seed.settings") as mock_settings:
            mock_settings.is_production = True

            response = client.post("/test/seed/all")

            assert response.status_code == 403
            data = response.json()
            assert data["error"]["code"] == "SEED_FORBIDDEN"

    def test_returns_403_when_disabled(self, client: TestClient):
        """Should return 403 when seeding is disabled."""
        with patch("src.api.v1.test.seed.settings") as mock_settings:
            mock_settings.is_production = False
            mock_settings.test_seed_enabled = False

            response = client.post("/test/seed/all")

            assert response.status_code == 403
            data = response.json()
            assert data["error"]["code"] == "SEED_DISABLED"

    def test_returns_401_with_wrong_secret(self, client: TestClient):
        """Should return 401 with invalid secret."""
        with patch("src.api.v1.test.seed.settings") as mock_settings:
            mock_settings.is_production = False
            mock_settings.test_seed_enabled = True
            mock_settings.seed_requires_secret = True
            mock_settings.validate_seed_secret.return_value = False

            response = client.post(
                "/test/seed/all",
                headers={"X-Test-Seed-Secret": "wrong"},
            )

            assert response.status_code == 401
            data = response.json()
            assert data["error"]["code"] == "SEED_UNAUTHORIZED"

    def test_calls_seed_all_successfully(self, client: TestClient):
        """Should call seed_all and return results."""
        mock_result = {
            "success": True,
            "truncate": {"tables_truncated": 8},
            "users": {"users": [{"email": "test@test.com"}]},
            "content": {"decks": [{"name": "A1"}], "cards": []},
            "statistics": {},
            "reviews": {},
        }

        with patch("src.api.v1.test.seed.settings") as mock_settings:
            mock_settings.is_production = False
            mock_settings.test_seed_enabled = True
            mock_settings.seed_requires_secret = False

            with patch("src.api.v1.test.seed.SeedService") as mock_service_class:
                mock_service = AsyncMock()
                mock_service.seed_all.return_value = mock_result
                mock_service_class.return_value = mock_service

                response = client.post("/test/seed/all")

                assert response.status_code == 200
                data = response.json()
                assert data["success"] is True
                assert data["operation"] == "all"
                assert "duration_ms" in data
                assert "timestamp" in data

    def test_seed_all_with_skip_truncate(self, client: TestClient):
        """Should skip truncation when skip_truncate is True."""
        with patch("src.api.v1.test.seed.settings") as mock_settings:
            mock_settings.is_production = False
            mock_settings.test_seed_enabled = True
            mock_settings.seed_requires_secret = False

            with patch("src.api.v1.test.seed.SeedService") as mock_service_class:
                mock_service = AsyncMock()
                mock_service.seed_all.return_value = {
                    "success": True,
                    "truncation": {"success": True},
                    "users": {"users": [{"id": "123", "email": "e2e_learner@test.com"}]},
                    "content": {"decks": [{"id": "456", "name": "A1"}]},
                }
                mock_service_class.return_value = mock_service

                response = client.post(
                    "/test/seed/all",
                    json={"options": {"skip_truncate": True}},
                )

                assert response.status_code == 200
                # Verify seed_all was called
                mock_service.seed_all.assert_called_once()


# ============================================================================
# POST /test/seed/truncate Endpoint Tests
# ============================================================================


class TestSeedTruncateEndpoint:
    """Tests for POST /test/seed/truncate."""

    def test_returns_403_when_disabled(self, client: TestClient):
        """Should return 403 when seeding is disabled."""
        with patch("src.api.v1.test.seed.settings") as mock_settings:
            mock_settings.is_production = False
            mock_settings.test_seed_enabled = False

            response = client.post("/test/seed/truncate")

            assert response.status_code == 403

    def test_truncates_tables_successfully(self, client: TestClient):
        """Should truncate tables and return results."""
        mock_result = {
            "success": True,
            "tables_truncated": 8,
            "truncated_tables": ["users", "decks"],
        }

        with patch("src.api.v1.test.seed.settings") as mock_settings:
            mock_settings.is_production = False
            mock_settings.test_seed_enabled = True
            mock_settings.seed_requires_secret = False

            with patch("src.api.v1.test.seed.SeedService") as mock_service_class:
                mock_service = AsyncMock()
                mock_service.truncate_tables.return_value = mock_result
                mock_service_class.return_value = mock_service

                response = client.post("/test/seed/truncate")

                assert response.status_code == 200
                data = response.json()
                assert data["success"] is True
                assert data["operation"] == "truncate"


# ============================================================================
# POST /test/seed/content Endpoint Tests
# ============================================================================


class TestSeedContentEndpoint:
    """Tests for POST /test/seed/content."""

    def test_returns_403_when_disabled(self, client: TestClient):
        """Should return 403 when seeding is disabled."""
        with patch("src.api.v1.test.seed.settings") as mock_settings:
            mock_settings.is_production = False
            mock_settings.test_seed_enabled = False

            response = client.post("/test/seed/content")

            assert response.status_code == 403

    def test_seeds_content_successfully(self, client: TestClient):
        """Should seed decks and cards and return results."""
        mock_result = {
            "decks": [{"name": "A1"}, {"name": "A2"}],
            "cards": [{"front": "Hello"}],
        }

        with patch("src.api.v1.test.seed.settings") as mock_settings:
            mock_settings.is_production = False
            mock_settings.test_seed_enabled = True
            mock_settings.seed_requires_secret = False

            with patch("src.api.v1.test.seed.SeedService") as mock_service_class:
                mock_service = AsyncMock()
                mock_service.seed_decks_and_cards.return_value = mock_result
                mock_service_class.return_value = mock_service

                response = client.post("/test/seed/content")

                assert response.status_code == 200
                data = response.json()
                assert data["success"] is True
                assert data["operation"] == "content"


# ============================================================================
# Header Validation Tests
# ============================================================================


# ============================================================================
# POST /test/seed/changelog Endpoint Tests
# ============================================================================


class TestSeedChangelogEndpoint:
    """Tests for POST /test/seed/changelog."""

    def test_returns_403_when_disabled(self, client: TestClient):
        """Should return 403 when seeding is disabled."""
        with patch("src.api.v1.test.seed.settings") as mock_settings:
            mock_settings.is_production = False
            mock_settings.test_seed_enabled = False

            response = client.post("/test/seed/changelog")

            assert response.status_code == 403

    def test_seeds_changelog_successfully(self, client: TestClient):
        """Should seed changelog entries and return results."""
        mock_result = {
            "success": True,
            "entries_created": 12,
            "by_tag": {
                "new_feature": 4,
                "bug_fix": 4,
                "announcement": 4,
            },
        }

        with patch("src.api.v1.test.seed.settings") as mock_settings:
            mock_settings.is_production = False
            mock_settings.test_seed_enabled = True
            mock_settings.seed_requires_secret = False

            with patch("src.api.v1.test.seed.SeedService") as mock_service_class:
                mock_service = AsyncMock()
                mock_service.seed_changelog_entries.return_value = mock_result
                mock_service_class.return_value = mock_service

                response = client.post("/test/seed/changelog")

                assert response.status_code == 200
                data = response.json()
                assert data["success"] is True
                assert data["operation"] == "changelog"
                assert data["results"]["entries_created"] == 12
                assert data["results"]["by_tag"]["new_feature"] == 4
                assert data["results"]["by_tag"]["bug_fix"] == 4
                assert data["results"]["by_tag"]["announcement"] == 4


class TestHeaderValidation:
    """Tests for X-Test-Seed-Secret header handling."""

    def test_accepts_header_with_alias(self, client: TestClient):
        """Should accept X-Test-Seed-Secret header."""
        with patch("src.api.v1.test.seed.settings") as mock_settings:
            mock_settings.is_production = False
            mock_settings.test_seed_enabled = True
            mock_settings.seed_requires_secret = True
            mock_settings.validate_seed_secret.return_value = True

            with patch("src.api.v1.test.seed.SeedService") as mock_service_class:
                mock_service = AsyncMock()
                mock_service.truncate_tables.return_value = {"success": True}
                mock_service_class.return_value = mock_service

                client.post(
                    "/test/seed/truncate",
                    headers={"X-Test-Seed-Secret": "my-secret"},
                )

                # Verify the secret was validated
                mock_settings.validate_seed_secret.assert_called_with("my-secret")
