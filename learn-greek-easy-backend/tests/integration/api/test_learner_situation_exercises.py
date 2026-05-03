"""Integration tests for the GET /api/v1/situations/{id}/exercises endpoint."""

from datetime import date, timedelta
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import CardStatus
from tests.factories import (
    DescriptionExerciseFactory,
    DescriptionExerciseItemFactory,
    ExerciseFactory,
    ExerciseRecordFactory,
    SituationDescriptionFactory,
    SituationFactory,
)

BASE_URL = "/api/v1/situations"


def _exercises_url(situation_id) -> str:
    return f"{BASE_URL}/{situation_id}/exercises"


@pytest.mark.integration
class TestLearnerSituationExercisesAuth:
    """Tests for authentication requirements."""

    @pytest.mark.asyncio
    async def test_no_auth_returns_401(self, client: AsyncClient) -> None:
        response = await client.get(_exercises_url(uuid4()))
        assert response.status_code == 401


@pytest.mark.integration
class TestLearnerSituationExercisesNotFound:
    """Tests for 404 responses on missing or non-READY situations."""

    @pytest.mark.asyncio
    async def test_nonexistent_situation_returns_404(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ) -> None:
        response = await client.get(_exercises_url(uuid4()), headers=auth_headers)
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_draft_situation_returns_404(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        situation = await SituationFactory.create(session=db_session)
        await db_session.flush()

        response = await client.get(_exercises_url(situation.id), headers=auth_headers)
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_partial_ready_situation_returns_404(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        situation = await SituationFactory.create(session=db_session, partial=True)
        await db_session.flush()

        response = await client.get(_exercises_url(situation.id), headers=auth_headers)
        assert response.status_code == 404


@pytest.mark.integration
class TestLearnerSituationExercisesEmpty:
    """Tests for a READY situation that has no exercises."""

    @pytest.mark.asyncio
    async def test_empty_situation_returns_empty_list(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        situation = await SituationFactory.create(session=db_session, ready=True)
        await db_session.flush()

        response = await client.get(_exercises_url(situation.id), headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["exercises"] == []
        assert data["total_in_queue"] == 0
        assert data["total_new"] == 0
        assert data["total_due"] == 0
        assert data["total_early_practice"] == 0


@pytest.mark.integration
class TestLearnerSituationExercisesMixedState:
    """Tests for correct per-exercise state when records have mixed SM-2 states."""

    @pytest.mark.asyncio
    async def test_mixed_state_exercises_all_appear_with_correct_state(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_user,
        db_session: AsyncSession,
    ) -> None:
        """4 exercises — NEW, LEARNING due today, MASTERED due +7d, LEARNING due -1d."""
        situation = await SituationFactory.create(session=db_session, ready=True)
        description = await SituationDescriptionFactory.create(
            session=db_session,
            situation_id=situation.id,
        )

        # Create 4 description exercises linked to the same description
        de_a = await DescriptionExerciseFactory.create(
            session=db_session, description_id=description.id, approved=True
        )
        ex_a = await ExerciseFactory.create(session=db_session, description_exercise_id=de_a.id)

        de_b = await DescriptionExerciseFactory.create(
            session=db_session, description_id=description.id, approved=True
        )
        ex_b = await ExerciseFactory.create(session=db_session, description_exercise_id=de_b.id)

        de_c = await DescriptionExerciseFactory.create(
            session=db_session, description_id=description.id, approved=True
        )
        ex_c = await ExerciseFactory.create(session=db_session, description_exercise_id=de_c.id)

        de_d = await DescriptionExerciseFactory.create(
            session=db_session, description_id=description.id, approved=True
        )
        ex_d = await ExerciseFactory.create(session=db_session, description_exercise_id=de_d.id)

        today = date.today()

        # Exercise A: no record — NEW
        # Exercise B: LEARNING, due today
        await ExerciseRecordFactory.create(
            session=db_session,
            exercise_id=ex_b.id,
            user_id=test_user.id,
            status=CardStatus.LEARNING,
            next_review_date=today,
        )
        # Exercise C: MASTERED, due in 7 days (not due)
        await ExerciseRecordFactory.create(
            session=db_session,
            exercise_id=ex_c.id,
            user_id=test_user.id,
            status=CardStatus.MASTERED,
            next_review_date=today + timedelta(days=7),
        )
        # Exercise D: LEARNING, due yesterday
        await ExerciseRecordFactory.create(
            session=db_session,
            exercise_id=ex_d.id,
            user_id=test_user.id,
            status=CardStatus.LEARNING,
            next_review_date=today - timedelta(days=1),
        )
        await db_session.flush()

        response = await client.get(_exercises_url(situation.id), headers=auth_headers)
        assert response.status_code == 200
        data = response.json()

        assert data["total_in_queue"] == 4
        assert data["total_new"] == 1
        # due = B (today) + D (yesterday) = 2
        assert data["total_due"] == 2
        assert data["total_early_practice"] == 0
        assert len(data["exercises"]) == 4

        # Build a lookup by exercise_id
        by_id = {ex["exercise_id"]: ex for ex in data["exercises"]}

        # Exercise A — no record: NEW, is_new=True, due_date=None
        a = by_id[str(ex_a.id)]
        assert a["is_new"] is True
        assert a["status"] == CardStatus.NEW.value
        assert a["due_date"] is None

        # Exercise B — LEARNING, due today
        b = by_id[str(ex_b.id)]
        assert b["is_new"] is False
        assert b["status"] == CardStatus.LEARNING.value
        assert b["due_date"] == today.isoformat()

        # Exercise C — MASTERED, not yet due
        c = by_id[str(ex_c.id)]
        assert c["is_new"] is False
        assert c["status"] == CardStatus.MASTERED.value
        assert c["due_date"] == (today + timedelta(days=7)).isoformat()

        # Exercise D — LEARNING, overdue
        d = by_id[str(ex_d.id)]
        assert d["is_new"] is False
        assert d["status"] == CardStatus.LEARNING.value
        assert d["due_date"] == (today - timedelta(days=1)).isoformat()


@pytest.mark.integration
class TestLearnerSituationExercisesUserIsolation:
    """Tests that per-user exercise records do not leak across users."""

    @pytest.mark.asyncio
    async def test_per_user_state_isolation(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_user,
        two_users,
        db_session: AsyncSession,
    ) -> None:
        """ExerciseRecord for a different user must not affect test_user's view."""
        other_user = two_users[1]

        situation = await SituationFactory.create(session=db_session, ready=True)
        description = await SituationDescriptionFactory.create(
            session=db_session, situation_id=situation.id
        )
        de = await DescriptionExerciseFactory.create(
            session=db_session, description_id=description.id, approved=True
        )
        exercise = await ExerciseFactory.create(session=db_session, description_exercise_id=de.id)

        # Seed a record for the OTHER user only
        await ExerciseRecordFactory.create(
            session=db_session,
            exercise_id=exercise.id,
            user_id=other_user.id,
            status=CardStatus.MASTERED,
            next_review_date=date.today() + timedelta(days=30),
        )
        await db_session.flush()

        response = await client.get(_exercises_url(situation.id), headers=auth_headers)
        assert response.status_code == 200
        data = response.json()

        assert len(data["exercises"]) == 1
        ex = data["exercises"][0]
        # test_user has no record → must see it as NEW
        assert ex["is_new"] is True
        assert ex["status"] == CardStatus.NEW.value
        assert ex["due_date"] is None


@pytest.mark.integration
class TestLearnerSituationExercisesEnrichment:
    """Tests that description-source exercises are enriched with content fields."""

    @pytest.mark.asyncio
    async def test_description_enrichment_populated(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        """Verify description_text_el, description_audio_url, scenario_*, and items are present."""
        situation = await SituationFactory.create(
            session=db_session,
            ready=True,
            scenario_en="At the market",
            scenario_el="Στην αγορά",
            scenario_ru="На рынке",
        )
        description = await SituationDescriptionFactory.create(
            session=db_session,
            situation_id=situation.id,
            text_el="Ο Γιάννης πήγε στην αγορά.",
            audio_s3_key="audio/test_situation.mp3",
        )
        de = await DescriptionExerciseFactory.create(
            session=db_session, description_id=description.id, approved=True
        )
        exercise = await ExerciseFactory.create(session=db_session, description_exercise_id=de.id)
        await DescriptionExerciseItemFactory.create(
            session=db_session, description_exercise_id=de.id
        )
        await db_session.flush()

        mock_s3 = MagicMock()
        mock_s3.generate_presigned_url.side_effect = lambda key: f"https://s3.example.com/{key}"

        with patch("src.api.v1.situations.get_s3_service", return_value=mock_s3):
            response = await client.get(_exercises_url(situation.id), headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert len(data["exercises"]) == 1

        ex = data["exercises"][0]
        assert ex["exercise_id"] == str(exercise.id)
        assert ex["description_text_el"] == "Ο Γιάννης πήγε στην αγορά."
        assert ex["description_audio_url"] == "https://s3.example.com/audio/test_situation.mp3"
        assert ex["scenario_el"] == "Στην αγορά"
        assert ex["scenario_en"] == "At the market"
        assert ex["scenario_ru"] == "На рынке"
        assert ex["situation_id"] == str(situation.id)
        assert isinstance(ex["items"], list)
        assert len(ex["items"]) == 1
        assert "payload" in ex["items"][0]
