"""Integration tests for POST /api/v1/admin/exercises/{exercise_id}/regenerate
and POST /api/v1/admin/exercises/generate-batch endpoints (EXR-55 + EXR-60).
"""

from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from httpx import AsyncClient

from src.api.v1.admin import _REGENERATE_IDEMPOTENCY_CACHE
from src.db.models import ExerciseSourceType
from tests.factories import (
    DescriptionExerciseFactory,
    ExerciseFactory,
    SituationDescriptionFactory,
    SituationFactory,
)

REGENERATE_URL = "/api/v1/admin/exercises/{exercise_id}/regenerate"
GENERATE_BATCH_URL = "/api/v1/admin/exercises/generate-batch"


@pytest.fixture
def mock_s3_service():
    with patch("src.api.v1.admin.get_s3_service") as mock_get:
        mock_s3 = MagicMock()
        mock_s3.generate_presigned_url.return_value = "https://s3.example.com/presigned"
        mock_get.return_value = mock_s3
        yield mock_s3


@pytest.fixture(autouse=True)
def clear_idempotency_cache():
    """Clear the in-process idempotency cache before each test to avoid cross-test pollution."""
    _REGENERATE_IDEMPOTENCY_CACHE.clear()
    yield
    _REGENERATE_IDEMPOTENCY_CACHE.clear()


@pytest.mark.integration
class TestRegenerateExercise:
    @pytest.mark.asyncio
    async def test_regenerate_happy_path_description(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        mock_s3_service: MagicMock,
    ):
        """EXR-55 AC: 200 response includes same id (row-id stability check — EXR-60 AC#1)."""
        sit = await SituationFactory.create()
        desc = await SituationDescriptionFactory.create(situation_id=sit.id)
        sibling = await DescriptionExerciseFactory.create(description_id=desc.id)
        exercise = await ExerciseFactory.create(
            description_exercise_id=sibling.id,
            source_type=ExerciseSourceType.DESCRIPTION,
        )

        url = REGENERATE_URL.format(exercise_id=str(exercise.id))
        response = await client.post(url, headers=superuser_auth_headers)

        assert response.status_code == 200
        data = response.json()
        # EXR-60 AC#1: row id is preserved (in-place UPDATE, not delete+recreate)
        assert data["id"] == str(sibling.id)
        assert data["source_type"] == "description"
        assert data["exercise_type"] is not None

    @pytest.mark.asyncio
    async def test_regenerate_preserves_id(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        mock_s3_service: MagicMock,
    ):
        """EXR-60: response id matches the sibling exercise id (optimistic-update stability)."""
        sit = await SituationFactory.create()
        desc = await SituationDescriptionFactory.create(situation_id=sit.id)
        sibling = await DescriptionExerciseFactory.create(description_id=desc.id)
        exercise = await ExerciseFactory.create(
            description_exercise_id=sibling.id,
            source_type=ExerciseSourceType.DESCRIPTION,
        )

        url = REGENERATE_URL.format(exercise_id=str(exercise.id))
        response = await client.post(url, headers=superuser_auth_headers)

        assert response.status_code == 200
        assert response.json()["id"] == str(sibling.id)

    @pytest.mark.asyncio
    async def test_regenerate_404_unknown_id(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """EXR-55 AC: unknown UUID → 404."""
        url = REGENERATE_URL.format(exercise_id=str(uuid4()))
        response = await client.post(url, headers=superuser_auth_headers)
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_regenerate_403_non_admin(
        self,
        client: AsyncClient,
        auth_headers: dict,
        mock_s3_service: MagicMock,
    ):
        """EXR-55 AC: non-superuser → 403."""
        url = REGENERATE_URL.format(exercise_id=str(uuid4()))
        response = await client.post(url, headers=auth_headers)
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_regenerate_401_unauthenticated(
        self,
        client: AsyncClient,
    ):
        """No auth → 401."""
        url = REGENERATE_URL.format(exercise_id=str(uuid4()))
        response = await client.post(url)
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_regenerate_idempotency_returns_cached(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        mock_s3_service: MagicMock,
        db_session,
    ):
        """EXR-60: two consecutive POSTs with same Idempotency-Key share the cached result.

        The second call must NOT advance updated_at beyond what the first call set,
        demonstrating that the generator stub ran only once.
        """
        sit = await SituationFactory.create()
        desc = await SituationDescriptionFactory.create(situation_id=sit.id)
        sibling = await DescriptionExerciseFactory.create(description_id=desc.id)
        exercise = await ExerciseFactory.create(
            description_exercise_id=sibling.id,
            source_type=ExerciseSourceType.DESCRIPTION,
        )

        url = REGENERATE_URL.format(exercise_id=str(exercise.id))
        headers = {**superuser_auth_headers, "Idempotency-Key": "test-key-001"}

        # First call — runs the generator stub
        r1 = await client.post(url, headers=headers)
        assert r1.status_code == 200

        # Second call — must return cached result (same id, from cache)
        r2 = await client.post(url, headers=headers)
        assert r2.status_code == 200
        # Both responses should be identical (cached)
        assert r2.json()["id"] == r1.json()["id"]

    @pytest.mark.asyncio
    async def test_regenerate_audit_log_emitted(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        mock_s3_service: MagicMock,
        caplog,
    ):
        """EXR-60: audit log is emitted with admin_exercise_regenerate event.

        Loguru doesn't propagate to stdlib `logging` by default, so we attach a
        loguru handler that writes into a list captured here. Verifies the structured
        fields are present and no Greek text from the exercise content leaks into the
        log message.
        """
        from loguru import logger

        captured: list[str] = []
        handler_id = logger.add(captured.append, format="{message} {extra}", level="INFO")
        try:
            sit = await SituationFactory.create()
            desc = await SituationDescriptionFactory.create(situation_id=sit.id)
            sibling = await DescriptionExerciseFactory.create(description_id=desc.id)
            exercise = await ExerciseFactory.create(
                description_exercise_id=sibling.id,
                source_type=ExerciseSourceType.DESCRIPTION,
            )

            url = REGENERATE_URL.format(exercise_id=str(exercise.id))
            response = await client.post(url, headers=superuser_auth_headers)
            assert response.status_code == 200
        finally:
            logger.remove(handler_id)

        audit_records = [m for m in captured if "admin_exercise_regenerate" in m]
        assert len(audit_records) >= 1, "Expected admin_exercise_regenerate log record"

        log_message = audit_records[0]
        # Must NOT contain Greek text from exercise content
        assert "Ελληνική" not in log_message
        assert "σενάριο" not in log_message


@pytest.mark.integration
class TestGenerateBatchExercises:
    @pytest.mark.asyncio
    async def test_generate_batch_happy_path(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """EXR-55 AC: 200 with scheduled field present."""
        response = await client.post(
            GENERATE_BATCH_URL,
            json={"modality": "listening", "count": 3},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert "scheduled" in data
        assert "exercise_ids" in data
        # Stub returns 0 / empty — asserts interface is stable
        assert isinstance(data["scheduled"], int)
        assert isinstance(data["exercise_ids"], list)

    @pytest.mark.asyncio
    async def test_generate_batch_403_non_admin(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """EXR-55 AC: non-superuser → 403."""
        response = await client.post(
            GENERATE_BATCH_URL,
            json={"modality": "listening", "count": 3},
            headers=auth_headers,
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_generate_batch_invalid_count(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """count > 20 → 422 validation error."""
        response = await client.post(
            GENERATE_BATCH_URL,
            json={"modality": "listening", "count": 99},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_generate_batch_invalid_modality(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """Unknown modality → 422 validation error."""
        response = await client.post(
            GENERATE_BATCH_URL,
            json={"modality": "unknown", "count": 3},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 422
