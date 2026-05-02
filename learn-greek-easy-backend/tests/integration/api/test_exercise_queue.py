"""Integration tests for exercise queue and review endpoints."""

from datetime import date, timedelta
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.factories.exercise import ExerciseFactory, ExerciseRecordFactory
from tests.factories.situation import SituationFactory
from tests.factories.situation_description import (
    DescriptionExerciseFactory,
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
