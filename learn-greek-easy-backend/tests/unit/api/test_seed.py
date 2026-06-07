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
        """Should seed V2 decks and return results."""
        mock_result = {
            "success": True,
            "v2_decks": [{"id": "abc", "name": "Greek Nouns"}],
        }

        with patch("src.api.v1.test.seed.settings") as mock_settings:
            mock_settings.is_production = False
            mock_settings.test_seed_enabled = True
            mock_settings.seed_requires_secret = False

            with patch("src.api.v1.test.seed.SeedService") as mock_service_class:
                mock_service = AsyncMock()
                mock_service._seed_v2_decks.return_value = mock_result
                mock_service_class.return_value = mock_service

                response = client.post("/test/seed/content")

                assert response.status_code == 200
                data = response.json()
                assert data["success"] is True
                assert data["operation"] == "content"


# ============================================================================
# POST /test/seed/situations Endpoint Tests
# ============================================================================


class TestSeedSituationsEndpoint:
    """Tests for POST /test/seed/situations."""

    def test_seeds_situations_successfully(self, client: TestClient):
        """Should seed situations and return results."""
        mock_result = {"success": True, "situations": [], "count": 0}

        with patch("src.api.v1.test.seed.settings") as mock_settings:
            mock_settings.is_production = False
            mock_settings.test_seed_enabled = True
            mock_settings.seed_requires_secret = False

            with patch("src.api.v1.test.seed.SeedService") as mock_service_class:
                mock_service = AsyncMock()
                mock_service.seed_situations.return_value = mock_result
                mock_service_class.return_value = mock_service

                response = client.post("/test/seed/situations")

                assert response.status_code == 200
                data = response.json()
                assert data["success"] is True
                assert data["operation"] == "situations"


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


# ============================================================================
# POST /test/seed/gamification-near-threshold Endpoint Tests
# ============================================================================


class TestGamificationNearThresholdEndpoint:
    """Tests for POST /test/seed/gamification-near-threshold."""

    def test_returns_403_when_disabled(self, client: TestClient):
        """Should return 403 when seeding is disabled."""
        with patch("src.api.v1.test.seed.settings") as mock_settings:
            mock_settings.is_production = False
            mock_settings.test_seed_enabled = False

            response = client.post(
                "/test/seed/gamification-near-threshold",
                json={"email": "e2e_learner@test.com", "achievement_id": "learning_first_word"},
            )

            assert response.status_code == 403

    def test_returns_404_when_user_not_found(self, client: TestClient):
        """Should return 404 when the given email does not exist."""
        with patch("src.api.v1.test.seed.settings") as mock_settings:
            mock_settings.is_production = False
            mock_settings.test_seed_enabled = True
            mock_settings.seed_requires_secret = False

            with patch("src.api.v1.test.seed.UserRepository") as mock_repo_class:
                mock_repo = AsyncMock()
                mock_repo.get_by_email.return_value = None
                mock_repo_class.return_value = mock_repo

                response = client.post(
                    "/test/seed/gamification-near-threshold",
                    json={
                        "email": "nobody@test.com",
                        "achievement_id": "learning_first_word",
                    },
                )

                assert response.status_code == 404

    def test_resets_to_near_threshold_successfully(self, client: TestClient):
        """Should reset user state and return near-threshold response."""
        from unittest.mock import MagicMock

        mock_user = MagicMock()
        mock_user.id = "00000000-0000-0000-0000-000000000001"

        mock_result = {
            "ok": True,
            "achievement_id": "learning_first_word",
            "current_value": 0,
            "threshold": 1,
            "reviews_truncated": 5,
        }

        with patch("src.api.v1.test.seed.settings") as mock_settings:
            mock_settings.is_production = False
            mock_settings.test_seed_enabled = True
            mock_settings.seed_requires_secret = False

            with patch("src.api.v1.test.seed.UserRepository") as mock_repo_class:
                mock_repo = AsyncMock()
                mock_repo.get_by_email.return_value = mock_user
                mock_repo_class.return_value = mock_repo

                with patch("src.api.v1.test.seed.SeedService") as mock_service_class:
                    mock_service = AsyncMock()
                    mock_service.reset_user_to_near_threshold.return_value = mock_result
                    mock_service_class.return_value = mock_service

                    response = client.post(
                        "/test/seed/gamification-near-threshold",
                        json={
                            "email": "e2e_learner@test.com",
                            "achievement_id": "learning_first_word",
                        },
                    )

                    assert response.status_code == 200
                    data = response.json()
                    assert data["ok"] is True
                    assert data["achievement_id"] == "learning_first_word"
                    assert data["current_value"] == 0
                    assert data["threshold"] == 1
                    assert data["reviews_truncated"] == 5
                    mock_service.reset_user_to_near_threshold.assert_called_once()


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


# ============================================================================
# POST /test/seed/card-error Tests (CER-56)
# ============================================================================


class TestSeedCardErrorEndpoint:
    """Tests for POST /test/seed/card-error (CER-56)."""

    def _settings_patch(self):
        """Common settings patch for enabled, non-production seed."""
        from unittest.mock import patch

        return patch(
            "src.api.v1.test.seed.settings",
            **{
                "is_production": False,
                "test_seed_enabled": True,
                "seed_requires_secret": False,
            },
        )

    def test_defaults_create_word_pending(self, client: TestClient):
        """POST with empty body should create WORD + PENDING report."""
        from unittest.mock import AsyncMock, MagicMock, patch
        from uuid import uuid4

        learner_id = uuid4()
        mock_learner = MagicMock()
        mock_learner.id = learner_id

        mock_report = MagicMock()
        mock_report.id = uuid4()

        with patch("src.api.v1.test.seed.settings") as mock_settings:
            mock_settings.is_production = False
            mock_settings.test_seed_enabled = True
            mock_settings.seed_requires_secret = False

            with patch("src.api.v1.test.seed.UserRepository") as mock_repo_class:
                mock_repo = AsyncMock()
                mock_repo.get_by_email.return_value = mock_learner
                mock_repo_class.return_value = mock_repo

                # Patch db
                mock_db = AsyncMock()
                mock_db.flush = AsyncMock()
                mock_db.commit = AsyncMock()

                # Simulate report creation by patching CardErrorReport
                with patch("src.api.v1.test.seed.CardErrorReport") as mock_report_class:
                    created_report = MagicMock()
                    created_report.id = uuid4()
                    mock_report_class.return_value = created_report

                    response = client.post("/test/seed/card-error")

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["operation"] == "card-error"

    def test_returns_403_when_disabled(self, client: TestClient):
        """Should return 403 when TEST_SEED_ENABLED is false."""
        with patch("src.api.v1.test.seed.settings") as mock_settings:
            mock_settings.is_production = False
            mock_settings.test_seed_enabled = False

            response = client.post("/test/seed/card-error")
        assert response.status_code == 403

    def test_returns_403_in_production(self, client: TestClient):
        """Should return 403 in production."""
        with patch("src.api.v1.test.seed.settings") as mock_settings:
            mock_settings.is_production = True

            response = client.post("/test/seed/card-error")
        assert response.status_code == 403

    def test_culture_pending_accepted(self, client: TestClient):
        """POST with card_type=CULTURE + status=PENDING should succeed."""
        from unittest.mock import AsyncMock, MagicMock, patch
        from uuid import uuid4

        learner_id = uuid4()
        mock_learner = MagicMock()
        mock_learner.id = learner_id

        with patch("src.api.v1.test.seed.settings") as mock_settings:
            mock_settings.is_production = False
            mock_settings.test_seed_enabled = True
            mock_settings.seed_requires_secret = False

            with patch("src.api.v1.test.seed.UserRepository") as mock_repo_class:
                mock_repo = AsyncMock()
                mock_repo.get_by_email.return_value = mock_learner
                mock_repo_class.return_value = mock_repo

                with patch("src.api.v1.test.seed.CardErrorReport") as mock_report_class:
                    created = MagicMock()
                    created.id = uuid4()
                    mock_report_class.return_value = created

                    response = client.post(
                        "/test/seed/card-error",
                        json={"card_type": "CULTURE", "status": "PENDING"},
                    )

        assert response.status_code == 200
        assert response.json()["success"] is True

    def test_fixed_stamps_resolved_fields(self, client: TestClient):
        """POST status=FIXED should cause resolved_at + resolved_by to be set."""
        from unittest.mock import AsyncMock, MagicMock, patch
        from uuid import uuid4

        learner_id = uuid4()
        admin_id = uuid4()
        mock_learner = MagicMock()
        mock_learner.id = learner_id
        mock_admin = MagicMock()
        mock_admin.id = admin_id

        with patch("src.api.v1.test.seed.settings") as mock_settings:
            mock_settings.is_production = False
            mock_settings.test_seed_enabled = True
            mock_settings.seed_requires_secret = False

            with patch("src.api.v1.test.seed.UserRepository") as mock_repo_class:
                mock_repo = AsyncMock()
                # get_by_email called for learner then admin
                mock_repo.get_by_email.side_effect = [mock_learner, mock_admin]
                mock_repo_class.return_value = mock_repo

                with patch("src.api.v1.test.seed.CardErrorReport") as mock_report_class:
                    created = MagicMock()
                    created.id = uuid4()
                    mock_report_class.return_value = created

                    response = client.post(
                        "/test/seed/card-error",
                        json={"status": "FIXED"},
                    )

        assert response.status_code == 200
        # Verify CardErrorReport was constructed with resolved fields
        call_kwargs = mock_report_class.call_args.kwargs
        assert call_kwargs.get("resolved_at") is not None
        assert call_kwargs.get("resolved_by") == admin_id


# ============================================================================
# POST /test/seed/card-errors Tests (CER-56 batch endpoint)
# ============================================================================


class TestSeedCardErrorsBatchEndpoint:
    """Tests for POST /test/seed/card-errors (CER-56)."""

    def test_returns_403_when_disabled(self, client: TestClient):
        """Should return 403 when TEST_SEED_ENABLED is false."""
        with patch("src.api.v1.test.seed.settings") as mock_settings:
            mock_settings.is_production = False
            mock_settings.test_seed_enabled = False

            response = client.post("/test/seed/card-errors")
        assert response.status_code == 403

    def test_returns_403_in_production(self, client: TestClient):
        """Should return 403 in production."""
        with patch("src.api.v1.test.seed.settings") as mock_settings:
            mock_settings.is_production = True

            response = client.post("/test/seed/card-errors")
        assert response.status_code == 403

    def test_creates_four_canonical_rows(self, client: TestClient):
        """Should create 4 canonical rows and return their IDs."""
        from unittest.mock import AsyncMock, MagicMock, patch
        from uuid import uuid4

        mock_learner = MagicMock(id=uuid4())
        mock_admin = MagicMock(id=uuid4())
        report_ids = [uuid4() for _ in range(4)]

        def make_report(**kwargs):
            m = MagicMock()
            m.id = report_ids.pop(0) if report_ids else uuid4()
            return m

        with patch("src.api.v1.test.seed.settings") as mock_settings:
            mock_settings.is_production = False
            mock_settings.test_seed_enabled = True
            mock_settings.seed_requires_secret = False

            with patch("src.api.v1.test.seed.UserRepository") as mock_repo_class:
                mock_repo = AsyncMock()
                mock_repo.get_by_email.side_effect = [mock_learner, mock_admin]
                mock_repo_class.return_value = mock_repo

                with patch("src.api.v1.test.seed.CardErrorReport", side_effect=make_report):
                    response = client.post("/test/seed/card-errors")

        assert response.status_code == 200
        data = response.json()
        assert "ids" in data
        assert len(data["ids"]) == 4


# ============================================================================
# POST /test/seed/reset-onboarding Endpoint Tests (MOB15-01)
# ============================================================================


class TestResetOnboardingEndpoint:
    """Tests for POST /test/seed/reset-onboarding.

    The endpoint is NOT yet implemented; all tests should be RED.
    Guards open = is_production=False, test_seed_enabled=True, seed_requires_secret=False.
    """

    def test_returns_403_when_production(self, client: TestClient):
        """Should return 403 when running in production environment."""
        with patch("src.api.v1.test.seed.settings") as mock_settings:
            mock_settings.is_production = True

            response = client.post("/test/seed/reset-onboarding")

        assert response.status_code == 403

    def test_returns_403_when_disabled(self, client: TestClient):
        """Should return 403 when TEST_SEED_ENABLED is False."""
        with patch("src.api.v1.test.seed.settings") as mock_settings:
            mock_settings.is_production = False
            mock_settings.test_seed_enabled = False

            response = client.post("/test/seed/reset-onboarding")

        assert response.status_code == 403

    def test_returns_404_when_user_absent(self, client: TestClient):
        """Should return 404 when e2e_beginner@test.com does not exist in DB."""
        with patch("src.api.v1.test.seed.settings") as mock_settings:
            mock_settings.is_production = False
            mock_settings.test_seed_enabled = True
            mock_settings.seed_requires_secret = False

            with patch("src.api.v1.test.seed.UserRepository") as mock_repo_class:
                mock_repo = AsyncMock()
                mock_repo.get_by_email.return_value = None
                mock_repo_class.return_value = mock_repo

                response = client.post("/test/seed/reset-onboarding")

        assert response.status_code == 404

    def test_returns_404_when_settings_absent(self, client: TestClient):
        """Should return 404 when the user exists but their UserSettings row is absent."""
        from unittest.mock import MagicMock
        from uuid import uuid4

        mock_user = MagicMock()
        mock_user.id = uuid4()

        with patch("src.api.v1.test.seed.settings") as mock_settings:
            mock_settings.is_production = False
            mock_settings.test_seed_enabled = True
            mock_settings.seed_requires_secret = False

            with patch("src.api.v1.test.seed.UserRepository") as mock_repo_class:
                mock_repo = AsyncMock()
                mock_repo.get_by_email.return_value = mock_user
                mock_repo_class.return_value = mock_repo

                # create=True allows patching the name even before the import exists in
                # the seed module; once the executor adds the import this becomes a
                # real patch. Without create=True the test would error on AttributeError
                # before ever reaching the assertion — the wrong failure mode.
                with patch(
                    "src.api.v1.test.seed.UserSettingsRepository",
                    create=True,
                ) as mock_settings_repo_class:
                    mock_settings_repo = AsyncMock()
                    mock_settings_repo.get_by_user_id.return_value = None
                    mock_settings_repo_class.return_value = mock_settings_repo

                    response = client.post("/test/seed/reset-onboarding")

        assert response.status_code == 404

    def test_nulls_tour_completed_at_on_success(self, client: TestClient, mock_db: AsyncMock):
        """Should null tour_completed_at, commit once, and return success=True."""
        from datetime import datetime, timezone
        from unittest.mock import MagicMock
        from uuid import uuid4

        mock_user = MagicMock()
        mock_user.id = uuid4()

        mock_settings_obj = MagicMock()
        mock_settings_obj.tour_completed_at = datetime(2024, 1, 1, tzinfo=timezone.utc)

        with patch("src.api.v1.test.seed.settings") as mock_settings:
            mock_settings.is_production = False
            mock_settings.test_seed_enabled = True
            mock_settings.seed_requires_secret = False

            with patch("src.api.v1.test.seed.UserRepository") as mock_repo_class:
                mock_repo = AsyncMock()
                mock_repo.get_by_email.return_value = mock_user
                mock_repo_class.return_value = mock_repo

                with patch(
                    "src.api.v1.test.seed.UserSettingsRepository",
                    create=True,
                ) as mock_settings_repo_class:
                    mock_settings_repo = AsyncMock()
                    mock_settings_repo.get_by_user_id.return_value = mock_settings_obj
                    mock_settings_repo_class.return_value = mock_settings_repo

                    response = client.post("/test/seed/reset-onboarding")

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert mock_settings_obj.tour_completed_at is None
        mock_db.commit.assert_awaited_once()

    def test_accepts_no_request_body(self, client: TestClient):
        """POST with no JSON body should succeed (endpoint takes no body)."""
        from unittest.mock import MagicMock
        from uuid import uuid4

        mock_user = MagicMock()
        mock_user.id = uuid4()

        mock_settings_obj = MagicMock()
        mock_settings_obj.tour_completed_at = None

        with patch("src.api.v1.test.seed.settings") as mock_settings:
            mock_settings.is_production = False
            mock_settings.test_seed_enabled = True
            mock_settings.seed_requires_secret = False

            with patch("src.api.v1.test.seed.UserRepository") as mock_repo_class:
                mock_repo = AsyncMock()
                mock_repo.get_by_email.return_value = mock_user
                mock_repo_class.return_value = mock_repo

                with patch(
                    "src.api.v1.test.seed.UserSettingsRepository",
                    create=True,
                ) as mock_settings_repo_class:
                    mock_settings_repo = AsyncMock()
                    mock_settings_repo.get_by_user_id.return_value = mock_settings_obj
                    mock_settings_repo_class.return_value = mock_settings_repo

                    # Explicitly pass no JSON body
                    response = client.post("/test/seed/reset-onboarding")

        assert response.status_code == 200


# ============================================================================
# POST /test/seed/reset-onboarding Adversarial Tests (MOB15-01)
# ============================================================================


class TestResetOnboardingAdversarial:
    """Adversarial / edge / boundary coverage for reset-onboarding.

    These tests verify behaviour the AC tests don't cover:
    - db.commit NOT called on 404 paths (no partial writes)
    - response.operation field is the exact string "reset-onboarding"
    - the hardcoded email constant is exactly e2e_beginner@test.com
    - bad/missing X-Test-Seed-Secret -> 401 when seed_requires_secret=True
    """

    def test_commit_not_called_when_user_absent(self, client: TestClient, mock_db: AsyncMock):
        """db.commit must NOT be called when the user is absent (no partial write)."""
        with patch("src.api.v1.test.seed.settings") as mock_settings:
            mock_settings.is_production = False
            mock_settings.test_seed_enabled = True
            mock_settings.seed_requires_secret = False

            with patch("src.api.v1.test.seed.UserRepository") as mock_repo_class:
                mock_repo = AsyncMock()
                mock_repo.get_by_email.return_value = None
                mock_repo_class.return_value = mock_repo

                response = client.post("/test/seed/reset-onboarding")

        assert response.status_code == 404
        mock_db.commit.assert_not_awaited()

    def test_commit_not_called_when_settings_absent(self, client: TestClient, mock_db: AsyncMock):
        """db.commit must NOT be called when UserSettings row is absent (no partial write)."""
        from unittest.mock import MagicMock
        from uuid import uuid4

        mock_user = MagicMock()
        mock_user.id = uuid4()

        with patch("src.api.v1.test.seed.settings") as mock_settings:
            mock_settings.is_production = False
            mock_settings.test_seed_enabled = True
            mock_settings.seed_requires_secret = False

            with patch("src.api.v1.test.seed.UserRepository") as mock_repo_class:
                mock_repo = AsyncMock()
                mock_repo.get_by_email.return_value = mock_user
                mock_repo_class.return_value = mock_repo

                with patch(
                    "src.api.v1.test.seed.UserSettingsRepository",
                ) as mock_settings_repo_class:
                    mock_settings_repo = AsyncMock()
                    mock_settings_repo.get_by_user_id.return_value = None
                    mock_settings_repo_class.return_value = mock_settings_repo

                    response = client.post("/test/seed/reset-onboarding")

        assert response.status_code == 404
        mock_db.commit.assert_not_awaited()

    def test_operation_field_is_reset_onboarding(self, client: TestClient):
        """The response 'operation' field must equal the literal string 'reset-onboarding'."""
        from unittest.mock import MagicMock
        from uuid import uuid4

        mock_user = MagicMock()
        mock_user.id = uuid4()

        mock_settings_obj = MagicMock()
        mock_settings_obj.tour_completed_at = None

        with patch("src.api.v1.test.seed.settings") as mock_settings:
            mock_settings.is_production = False
            mock_settings.test_seed_enabled = True
            mock_settings.seed_requires_secret = False

            with patch("src.api.v1.test.seed.UserRepository") as mock_repo_class:
                mock_repo = AsyncMock()
                mock_repo.get_by_email.return_value = mock_user
                mock_repo_class.return_value = mock_repo

                with patch(
                    "src.api.v1.test.seed.UserSettingsRepository",
                ) as mock_settings_repo_class:
                    mock_settings_repo = AsyncMock()
                    mock_settings_repo.get_by_user_id.return_value = mock_settings_obj
                    mock_settings_repo_class.return_value = mock_settings_repo

                    response = client.post("/test/seed/reset-onboarding")

        assert response.status_code == 200
        assert response.json()["operation"] == "reset-onboarding"

    def test_hardcoded_email_is_e2e_beginner(self, client: TestClient):
        """Verify the handler looks up 'e2e_beginner@test.com' — not any other address."""
        from unittest.mock import MagicMock
        from uuid import uuid4

        mock_user = MagicMock()
        mock_user.id = uuid4()

        mock_settings_obj = MagicMock()
        mock_settings_obj.tour_completed_at = None

        with patch("src.api.v1.test.seed.settings") as mock_settings:
            mock_settings.is_production = False
            mock_settings.test_seed_enabled = True
            mock_settings.seed_requires_secret = False

            with patch("src.api.v1.test.seed.UserRepository") as mock_repo_class:
                mock_repo = AsyncMock()
                mock_repo.get_by_email.return_value = mock_user
                mock_repo_class.return_value = mock_repo

                with patch(
                    "src.api.v1.test.seed.UserSettingsRepository",
                ) as mock_settings_repo_class:
                    mock_settings_repo = AsyncMock()
                    mock_settings_repo.get_by_user_id.return_value = mock_settings_obj
                    mock_settings_repo_class.return_value = mock_settings_repo

                    response = client.post("/test/seed/reset-onboarding")

        assert response.status_code == 200
        # The handler must have looked up exactly this email
        mock_repo.get_by_email.assert_awaited_once_with("e2e_beginner@test.com")

    def test_returns_401_with_wrong_secret_when_required(self, client: TestClient):
        """Should return 401 when seed_requires_secret=True and a bad secret is sent."""
        with patch("src.api.v1.test.seed.settings") as mock_settings:
            mock_settings.is_production = False
            mock_settings.test_seed_enabled = True
            mock_settings.seed_requires_secret = True
            mock_settings.validate_seed_secret.return_value = False

            response = client.post(
                "/test/seed/reset-onboarding",
                headers={"X-Test-Seed-Secret": "wrong-secret"},
            )

        assert response.status_code == 401
        assert response.json()["error"]["code"] == "SEED_UNAUTHORIZED"

    def test_returns_401_with_missing_secret_when_required(self, client: TestClient):
        """Should return 401 when seed_requires_secret=True but no secret header sent."""
        with patch("src.api.v1.test.seed.settings") as mock_settings:
            mock_settings.is_production = False
            mock_settings.test_seed_enabled = True
            mock_settings.seed_requires_secret = True
            mock_settings.validate_seed_secret.return_value = False

            response = client.post("/test/seed/reset-onboarding")

        assert response.status_code == 401


# ============================================================================
# RGATE-05 — Per-PR seed-user namespacing: schema + endpoint RED specs
# ============================================================================


class TestSeedRequestSchemaNamespacing:
    """Schema-level tests for pr_number field additions (RGATE-05).

    All tests RED until SeedRequest gains pr_number and ResetOnboardingRequest
    is added to src/schemas/seed.py.
    Each test imports the symbol locally so a missing import causes an
    individual ImportError, not a file-level collection crash.
    """

    @pytest.mark.unit
    def test_seed_request_accepts_optional_pr_number(self):
        """SeedRequest must accept pr_number as an optional field."""
        from src.schemas.seed import SeedRequest  # noqa: PLC0415

        # With pr_number provided
        req = SeedRequest(pr_number="123")
        assert req.pr_number == "123"

        # Without pr_number — defaults to None (back-compat)
        req_no_pr = SeedRequest()
        assert req_no_pr.pr_number is None

    @pytest.mark.unit
    def test_reset_onboarding_request_pr_number_optional(self):
        """ResetOnboardingRequest must exist with optional pr_number."""
        from src.schemas.seed import ResetOnboardingRequest  # noqa: PLC0415

        req_empty = ResetOnboardingRequest()
        assert req_empty.pr_number is None

        req_with_pr = ResetOnboardingRequest(pr_number="7")
        assert req_with_pr.pr_number == "7"


class TestResetOnboardingNamespacingEndpoint:
    """Endpoint tests for reset-onboarding pr_number support (RGATE-05).

    Tests are RED until the endpoint accepts ResetOnboardingRequest and resolves
    the lookup email via namespaced_beginner_email.
    """

    # ------------------------------------------------------------------
    # Helper: build settings + UserRepository patch context
    # ------------------------------------------------------------------

    @staticmethod
    def _settings_ctx():
        """Return a patch context for seed settings (guards open)."""
        mock = patch("src.api.v1.test.seed.settings")
        return mock

    @staticmethod
    def _repo_ctx(return_value):
        """Return a patch context for UserRepository.get_by_email."""
        mock = patch("src.api.v1.test.seed.UserRepository")
        return mock, return_value

    # ------------------------------------------------------------------
    # AC tests (RGATE-05)
    # ------------------------------------------------------------------

    @pytest.mark.unit
    def test_reset_onboarding_no_body_resets_default_user(
        self, client: TestClient, mock_db: AsyncMock
    ):
        """POST with NO body must resolve to e2e_beginner@test.com and commit once."""
        from unittest.mock import MagicMock
        from uuid import uuid4

        mock_user = MagicMock()
        mock_user.id = uuid4()
        mock_settings_obj = MagicMock()
        mock_settings_obj.tour_completed_at = None

        with patch("src.api.v1.test.seed.settings") as mock_settings:
            mock_settings.is_production = False
            mock_settings.test_seed_enabled = True
            mock_settings.seed_requires_secret = False

            with patch("src.api.v1.test.seed.UserRepository") as mock_repo_class:
                mock_repo = AsyncMock()
                mock_repo.get_by_email.return_value = mock_user
                mock_repo_class.return_value = mock_repo

                with patch(
                    "src.api.v1.test.seed.UserSettingsRepository",
                    create=True,
                ) as mock_settings_repo_class:
                    mock_settings_repo = AsyncMock()
                    mock_settings_repo.get_by_user_id.return_value = mock_settings_obj
                    mock_settings_repo_class.return_value = mock_settings_repo

                    response = client.post("/test/seed/reset-onboarding")

        assert response.status_code == 200
        # Must look up the default email exactly once
        mock_repo.get_by_email.assert_awaited_once_with("e2e_beginner@test.com")
        mock_db.commit.assert_awaited_once()

    @pytest.mark.unit
    def test_reset_onboarding_explicit_null_pr_number_uses_default(
        self, client: TestClient, mock_db: AsyncMock
    ):
        """Body with pr_number=null must still resolve to the default email."""
        from unittest.mock import MagicMock
        from uuid import uuid4

        mock_user = MagicMock()
        mock_user.id = uuid4()
        mock_settings_obj = MagicMock()
        mock_settings_obj.tour_completed_at = None

        with patch("src.api.v1.test.seed.settings") as mock_settings:
            mock_settings.is_production = False
            mock_settings.test_seed_enabled = True
            mock_settings.seed_requires_secret = False

            with patch("src.api.v1.test.seed.UserRepository") as mock_repo_class:
                mock_repo = AsyncMock()
                mock_repo.get_by_email.return_value = mock_user
                mock_repo_class.return_value = mock_repo

                with patch(
                    "src.api.v1.test.seed.UserSettingsRepository",
                    create=True,
                ) as mock_settings_repo_class:
                    mock_settings_repo = AsyncMock()
                    mock_settings_repo.get_by_user_id.return_value = mock_settings_obj
                    mock_settings_repo_class.return_value = mock_settings_repo

                    response = client.post(
                        "/test/seed/reset-onboarding",
                        json={"pr_number": None},
                    )

        assert response.status_code == 200
        mock_repo.get_by_email.assert_awaited_once_with("e2e_beginner@test.com")

    @pytest.mark.unit
    def test_reset_onboarding_with_pr_number_resets_namespaced_user(
        self, client: TestClient, mock_db: AsyncMock
    ):
        """Body with pr_number='55' must look up e2e_beginner+pr55@test.com."""
        from unittest.mock import MagicMock
        from uuid import uuid4

        mock_user = MagicMock()
        mock_user.id = uuid4()
        mock_settings_obj = MagicMock()
        mock_settings_obj.tour_completed_at = None

        with patch("src.api.v1.test.seed.settings") as mock_settings:
            mock_settings.is_production = False
            mock_settings.test_seed_enabled = True
            mock_settings.seed_requires_secret = False

            with patch("src.api.v1.test.seed.UserRepository") as mock_repo_class:
                mock_repo = AsyncMock()
                mock_repo.get_by_email.return_value = mock_user
                mock_repo_class.return_value = mock_repo

                with patch(
                    "src.api.v1.test.seed.UserSettingsRepository",
                    create=True,
                ) as mock_settings_repo_class:
                    mock_settings_repo = AsyncMock()
                    mock_settings_repo.get_by_user_id.return_value = mock_settings_obj
                    mock_settings_repo_class.return_value = mock_settings_repo

                    response = client.post(
                        "/test/seed/reset-onboarding",
                        json={"pr_number": "55"},
                    )

        assert response.status_code == 200
        mock_repo.get_by_email.assert_awaited_once_with("e2e_beginner+pr55@test.com")

    @pytest.mark.unit
    def test_reset_onboarding_namespaced_does_not_touch_default(self, client: TestClient):
        """When pr_number='55', the default email must never be queried."""
        from unittest.mock import MagicMock
        from uuid import uuid4

        mock_user = MagicMock()
        mock_user.id = uuid4()
        mock_settings_obj = MagicMock()
        mock_settings_obj.tour_completed_at = None

        with patch("src.api.v1.test.seed.settings") as mock_settings:
            mock_settings.is_production = False
            mock_settings.test_seed_enabled = True
            mock_settings.seed_requires_secret = False

            with patch("src.api.v1.test.seed.UserRepository") as mock_repo_class:
                mock_repo = AsyncMock()
                mock_repo.get_by_email.return_value = mock_user
                mock_repo_class.return_value = mock_repo

                with patch(
                    "src.api.v1.test.seed.UserSettingsRepository",
                    create=True,
                ) as mock_settings_repo_class:
                    mock_settings_repo = AsyncMock()
                    mock_settings_repo.get_by_user_id.return_value = mock_settings_obj
                    mock_settings_repo_class.return_value = mock_settings_repo

                    response = client.post(
                        "/test/seed/reset-onboarding",
                        json={"pr_number": "55"},
                    )

        assert response.status_code == 200
        # The default (non-namespaced) email must NOT appear in any call
        all_calls = mock_repo.get_by_email.call_args_list
        default_calls = [c for c in all_calls if c.args and c.args[0] == "e2e_beginner@test.com"]
        assert (
            len(default_calls) == 0
        ), "Default email must not be queried when pr_number is supplied"

    @pytest.mark.unit
    def test_reset_onboarding_namespaced_user_absent_returns_404(
        self, client: TestClient, mock_db: AsyncMock
    ):
        """When get_by_email returns None for the namespaced email, must return 404."""
        with patch("src.api.v1.test.seed.settings") as mock_settings:
            mock_settings.is_production = False
            mock_settings.test_seed_enabled = True
            mock_settings.seed_requires_secret = False

            with patch("src.api.v1.test.seed.UserRepository") as mock_repo_class:
                mock_repo = AsyncMock()
                mock_repo.get_by_email.return_value = None  # namespaced user absent
                mock_repo_class.return_value = mock_repo

                response = client.post(
                    "/test/seed/reset-onboarding",
                    json={"pr_number": "99"},
                )

        assert response.status_code == 404
        # Error detail must mention the namespaced email
        body = response.json()
        detail_str = str(body)
        assert (
            "e2e_beginner+pr99@test.com" in detail_str
        ), f"404 detail must mention the namespaced email; got: {body}"
        # db.commit must NOT have been awaited (no partial write)
        mock_db.commit.assert_not_awaited()
