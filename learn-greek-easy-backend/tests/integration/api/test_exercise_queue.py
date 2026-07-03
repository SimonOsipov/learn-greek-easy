"""Integration tests for exercise queue and review endpoints."""

from datetime import date, timedelta
from unittest.mock import patch
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.db.models import ExerciseModality, User
from src.tasks import invalidate_cache_task
from tests.factories.exercise import ExerciseFactory, ExerciseRecordFactory
from tests.factories.situation import SituationFactory
from tests.factories.situation_description import (
    DescriptionExerciseFactory,
    DescriptionExerciseItemFactory,
    SituationDescriptionFactory,
)

QUEUE_URL = "/api/v1/exercises/queue"
REVIEW_URL = "/api/v1/exercises/review"


@pytest.mark.integration
class TestExerciseQueueEndpoint:
    """Tests for GET /api/v1/exercises/queue."""

    @pytest.mark.asyncio
    async def test_queue_requires_auth(self, client: AsyncClient) -> None:
        response = await client.get(QUEUE_URL)
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_empty_queue_returns_zero(self, client: AsyncClient, auth_headers: dict) -> None:
        response = await client.get(QUEUE_URL, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["total_due"] == 0
        assert data["total_new"] == 0
        assert data["total_in_queue"] == 0
        assert data["exercises"] == []

    @pytest.mark.asyncio
    async def test_new_exercises_included(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        """Exercises with no record appear as new."""
        await ExerciseFactory.create(session=db_session)
        await db_session.commit()

        response = await client.get(QUEUE_URL, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["total_new"] >= 1
        assert data["total_in_queue"] >= 1

    @pytest.mark.asyncio
    async def test_due_exercises_returned(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_user,
        db_session: AsyncSession,
    ) -> None:
        """Exercise records past due_date appear in queue."""
        await ExerciseRecordFactory.create(
            session=db_session,
            user_id=test_user.id,
            learning=True,
            next_review_date=date.today() - timedelta(days=1),
        )
        await db_session.commit()

        response = await client.get(QUEUE_URL, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["total_due"] >= 1

    @pytest.mark.asyncio
    async def test_limit_respected(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_user,
        db_session: AsyncSession,
    ) -> None:
        """limit param caps the number of exercises returned."""
        for _ in range(5):
            await ExerciseFactory.create(session=db_session)
        await db_session.commit()

        response = await client.get(QUEUE_URL, params={"limit": 2}, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data["exercises"]) <= 2

    @pytest.mark.asyncio
    async def test_early_practice_included(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_user,
        db_session: AsyncSession,
    ) -> None:
        """Future-due exercises included when include_early_practice=true."""
        await ExerciseRecordFactory.create(
            session=db_session,
            user_id=test_user.id,
            learning=True,
            next_review_date=date.today() + timedelta(days=3),
        )
        await db_session.commit()

        response = await client.get(
            QUEUE_URL,
            params={"include_early_practice": "true", "include_new": "false"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total_early_practice"] >= 1


@pytest.mark.integration
class TestExerciseReviewEndpoint:
    """Tests for POST /api/v1/exercises/review."""

    @pytest.mark.asyncio
    async def test_review_requires_auth(self, client: AsyncClient) -> None:
        body = {"exercise_id": str(uuid4()), "score": 3, "max_score": 5}
        response = await client.post(REVIEW_URL, json=body)
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_review_nonexistent_exercise_returns_404(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        body = {"exercise_id": str(uuid4()), "score": 3, "max_score": 5}
        response = await client.post(REVIEW_URL, json=body, headers=auth_headers)
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_review_success_creates_record(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        """First review creates exercise_record via get_or_create."""
        exercise = await ExerciseFactory.create(session=db_session)
        await db_session.commit()

        body = {"exercise_id": str(exercise.id), "score": 4, "max_score": 5}
        response = await client.post(REVIEW_URL, json=body, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["exercise_id"] == str(exercise.id)
        assert data["score"] == 4
        assert data["max_score"] == 5
        assert "new_status" in data
        assert "next_review_date" in data
        assert "easiness_factor" in data

    @pytest.mark.asyncio
    async def test_review_score_exceeds_max_returns_422(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        body = {"exercise_id": str(uuid4()), "score": 10, "max_score": 5}
        response = await client.post(REVIEW_URL, json=body, headers=auth_headers)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_subsequent_review_updates_sm2(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_user,
        db_session: AsyncSession,
    ) -> None:
        """Second review updates SM-2 state (interval should increase)."""
        exercise = await ExerciseFactory.create(session=db_session)
        await db_session.commit()

        body = {"exercise_id": str(exercise.id), "score": 5, "max_score": 5}
        # First review
        r1 = await client.post(REVIEW_URL, json=body, headers=auth_headers)
        assert r1.status_code == 200
        # Second review
        r2 = await client.post(REVIEW_URL, json=body, headers=auth_headers)
        assert r2.status_code == 200
        # Repetitions should increase
        assert r2.json()["repetitions"] > r1.json()["repetitions"]


@pytest.mark.integration
class TestExerciseQueueSituationFilter:
    """Tests for GET /api/v1/exercises/queue?situation_id=<UUID>."""

    @pytest.mark.asyncio
    async def test_queue_with_situation_id_filter(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        """Only exercises belonging to the given situation are returned."""
        situation = await SituationFactory.create(session=db_session, ready=True)
        description = await SituationDescriptionFactory.create(
            session=db_session, situation_id=situation.id
        )
        description_exercise = await DescriptionExerciseFactory.create(
            session=db_session, description_id=description.id
        )
        exercise = await ExerciseFactory.create(
            session=db_session, description_exercise_id=description_exercise.id
        )

        # Second situation with its own exercise — must be excluded from first situation's filter
        situation2 = await SituationFactory.create(session=db_session, ready=True)
        description2 = await SituationDescriptionFactory.create(
            session=db_session, situation_id=situation2.id
        )
        description_exercise2 = await DescriptionExerciseFactory.create(
            session=db_session, description_id=description2.id
        )
        exercise_other = await ExerciseFactory.create(
            session=db_session, description_exercise_id=description_exercise2.id
        )

        await db_session.commit()

        response = await client.get(
            QUEUE_URL,
            params={"situation_id": str(situation.id), "include_new": "true"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        exercise_ids = [e["exercise_id"] for e in data["exercises"]]
        assert str(exercise.id) in exercise_ids
        assert str(exercise_other.id) not in exercise_ids
        assert data["total_in_queue"] >= 1

    @pytest.mark.asyncio
    async def test_queue_without_situation_id_unchanged(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        """Without situation_id, existing behavior is unchanged (all exercises returned)."""
        await ExerciseFactory.create(session=db_session)
        await ExerciseFactory.create(session=db_session)
        await db_session.commit()

        response = await client.get(QUEUE_URL, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["total_new"] >= 2

    @pytest.mark.asyncio
    async def test_queue_with_nonexistent_situation_id(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        """A random situation_id that matches nothing returns empty queue, no error."""
        response = await client.get(
            QUEUE_URL,
            params={"situation_id": str(uuid4()), "include_new": "true"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total_in_queue"] == 0

    @pytest.mark.asyncio
    async def test_queue_situation_id_combined_with_modality(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        """situation_id and modality filters both apply simultaneously."""
        from src.db.models import ExerciseModality

        situation = await SituationFactory.create(session=db_session, ready=True)
        description = await SituationDescriptionFactory.create(
            session=db_session, situation_id=situation.id
        )
        # Exercise with matching modality
        de_listening = await DescriptionExerciseFactory.create(
            session=db_session,
            description_id=description.id,
            modality=ExerciseModality.LISTENING,
        )
        exercise_listening = await ExerciseFactory.create(
            session=db_session, description_exercise_id=de_listening.id
        )
        # Exercise from same situation but different modality
        de_reading = await DescriptionExerciseFactory.create(
            session=db_session,
            description_id=description.id,
            modality=ExerciseModality.READING,
        )
        await ExerciseFactory.create(session=db_session, description_exercise_id=de_reading.id)
        await db_session.commit()

        response = await client.get(
            QUEUE_URL,
            params={
                "situation_id": str(situation.id),
                "modality": "listening",
                "include_new": "true",
            },
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        exercise_ids = [e["exercise_id"] for e in data["exercises"]]
        assert str(exercise_listening.id) in exercise_ids
        assert data["total_in_queue"] >= 1


@pytest.mark.integration
class TestExerciseQueueSummaryMode:
    """Tests for GET /api/v1/exercises/queue?summary=true (PERF-17-03).

    [CI-deferred: requires Postgres via db_session/client fixtures — not
    locally runnable in this sandbox; confirmed collection-clean only
    (`pytest --collect-only`), actual pass/fail must be observed in CI.]

    test_queue_summary_true_returns_slim_items (T03-3) is RED today for the
    right reason: `summary` is not yet a Query param on the endpoint, so
    `?summary=true` is silently ignored (FastAPI does not 422 on unknown
    query params) and the endpoint returns full, unslimmed items -> the
    slim-field assertions fail.

    test_queue_without_summary_keeps_full_item_payload (T03-4) is a
    regression guard, not a RED spec: it asserts pre-existing default-path
    behavior (no summary param at all) that already holds today and must
    keep holding once summary mode is added -- it is expected to PASS now.
    """

    @pytest.mark.asyncio
    async def test_queue_summary_true_returns_slim_items(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        """T03-3: GET /exercises/queue?summary=true -> 200 ExerciseQueue with
        slim items: heavy fields (items, word_timestamps, description_text_el,
        description_audio_url) nulled/empty on every item, while light fields
        (exercise_type, modality, audio_level) stay populated.

        Covers both branches of the modality-driven heavy-field split so all
        four heavy fields get a real (non-incidentally-null) value to null:
        a READING exercise carries description_text_el + items; a LISTENING
        exercise carries description_audio_url + word_timestamps + items.
        """
        # READING exercise: description_text_el + items populated in full mode
        situation_reading = await SituationFactory.create(session=db_session, ready=True)
        desc_reading = await SituationDescriptionFactory.create(
            session=db_session,
            situation_id=situation_reading.id,
            audio_ready=True,
            text_el="Ο Γιάννης πήγε σχολείο.",
        )
        de_reading = await DescriptionExerciseFactory.create(
            session=db_session,
            description_id=desc_reading.id,
            modality=ExerciseModality.READING,
        )
        await DescriptionExerciseItemFactory.create(
            session=db_session, description_exercise_id=de_reading.id
        )
        exercise_reading = await ExerciseFactory.create(
            session=db_session, description_exercise_id=de_reading.id
        )

        # LISTENING exercise: description_audio_url + word_timestamps + items
        # populated in full mode
        situation_listening = await SituationFactory.create(session=db_session, ready=True)
        desc_listening = await SituationDescriptionFactory.create(
            session=db_session,
            situation_id=situation_listening.id,
            audio_ready=True,
            audio_s3_key="b1/audio.mp3",
            word_timestamps=[{"word": "Καλημέρα", "start": 0.0, "end": 0.5}],
        )
        de_listening = await DescriptionExerciseFactory.create(
            session=db_session,
            description_id=desc_listening.id,
            modality=ExerciseModality.LISTENING,
        )
        await DescriptionExerciseItemFactory.create(
            session=db_session, description_exercise_id=de_listening.id
        )
        exercise_listening = await ExerciseFactory.create(
            session=db_session, description_exercise_id=de_listening.id
        )

        await db_session.commit()

        with patch("src.services.exercise_sm2_service.get_s3_service") as mock_s3:
            mock_s3.return_value.generate_presigned_url.side_effect = lambda k, **kwargs: (
                f"https://cdn/{k}" if k else None
            )
            response = await client.get(QUEUE_URL, params={"summary": "true"}, headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        exercises_by_id = {e["exercise_id"]: e for e in data["exercises"]}
        assert str(exercise_reading.id) in exercises_by_id
        assert str(exercise_listening.id) in exercises_by_id

        for item in (
            exercises_by_id[str(exercise_reading.id)],
            exercises_by_id[str(exercise_listening.id)],
        ):
            # Heavy fields: nulled/empty
            assert item["items"] == []
            assert item["word_timestamps"] is None
            assert item["description_text_el"] is None
            assert item["description_audio_url"] is None
            # Light fields: still populated
            assert item["exercise_type"] is not None
            assert item["modality"] is not None
            assert item["source_type"] == "description"

    @pytest.mark.asyncio
    async def test_queue_without_summary_keeps_full_item_payload(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        """T03-4: GET /exercises/queue (no summary param) is byte-for-byte
        unchanged -- a description item still carries its full items payload
        and audio url. Practice-session regression guard: the default path
        must not be affected by adding the opt-in summary mode.
        """
        situation = await SituationFactory.create(session=db_session, ready=True)
        description = await SituationDescriptionFactory.create(
            session=db_session,
            situation_id=situation.id,
            audio_ready=True,
            audio_s3_key="b1/audio.mp3",
        )
        description_exercise = await DescriptionExerciseFactory.create(
            session=db_session,
            description_id=description.id,
            modality=ExerciseModality.LISTENING,
        )
        await DescriptionExerciseItemFactory.create(
            session=db_session, description_exercise_id=description_exercise.id
        )
        exercise = await ExerciseFactory.create(
            session=db_session, description_exercise_id=description_exercise.id
        )
        await db_session.commit()

        with patch("src.services.exercise_sm2_service.get_s3_service") as mock_s3:
            mock_s3.return_value.generate_presigned_url.side_effect = lambda k, **kwargs: (
                f"https://cdn/{k}" if k else None
            )
            response = await client.get(QUEUE_URL, headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        item = next(e for e in data["exercises"] if e["exercise_id"] == str(exercise.id))
        assert item["items"] != []
        assert item["description_audio_url"] is not None
        assert "b1/audio.mp3" in item["description_audio_url"]


# =============================================================================
# RED tests for PERF-05-04: cache-invalidation wiring
# =============================================================================


@pytest.mark.integration
class TestExerciseReviewCacheInvalidation:
    """[RED] Tests verifying that exercise review schedules
    invalidate_cache_task. Fails until PERF-05-04 wires the hook.
    """

    @pytest.mark.asyncio
    async def test_exercise_review_schedules_progress_invalidation(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_user: User,
        db_session: AsyncSession,
    ):
        """[RED] POST /api/v1/exercises/review must schedule
        invalidate_cache_task(cache_type='progress', user_id=<auth user>, entity_id=None)
        when background tasks are enabled.
        Fails until the hook is wired in the exercise review endpoint.
        """
        # Seed an exercise so the endpoint can succeed (returns 404 otherwise)
        exercise = await ExerciseFactory.create(session=db_session)
        await db_session.commit()

        body = {"exercise_id": str(exercise.id), "score": 4, "max_score": 5}

        # Patch BackgroundTasks.add_task at the Starlette class level so all
        # instances are instrumented. feature_background_tasks must be True so
        # the gated branch in exercises.py fires.
        with (
            patch.object(settings, "feature_background_tasks", True),
            patch("starlette.background.BackgroundTasks.add_task") as mock_add_task,
        ):
            response = await client.post(REVIEW_URL, json=body, headers=auth_headers)

        assert response.status_code == 200, (
            f"Endpoint returned {response.status_code}: {response.text}. "
            "Fix setup so endpoint succeeds before asserting on invalidation."
        )

        # Filter for invalidate_cache_task calls only
        invalidation_calls = [
            c for c in mock_add_task.call_args_list if c.args and c.args[0] is invalidate_cache_task
        ]
        assert (
            len(invalidation_calls) == 1
        ), f"Expected exactly 1 invalidate_cache_task call, found {len(invalidation_calls)}"
        call_kwargs = invalidation_calls[0].kwargs
        assert call_kwargs.get("cache_type") == "progress"
        assert call_kwargs.get("user_id") == test_user.id
        assert call_kwargs.get("entity_id") is None
