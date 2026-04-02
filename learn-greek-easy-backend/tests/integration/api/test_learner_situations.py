"""Integration tests for learner situation list and detail endpoints."""

from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import ExerciseType, Situation, SituationStatus
from tests.factories.exercise import ExerciseFactory, ExerciseRecordFactory
from tests.factories.situation import SituationFactory
from tests.factories.situation_description import (
    DescriptionExerciseFactory,
    SituationDescriptionFactory,
)

LIST_URL = "/api/v1/situations"


def _detail_url(situation_id) -> str:
    return f"/api/v1/situations/{situation_id}"


async def _create_situation_with_exercises(
    db_session: AsyncSession,
    *,
    num_exercises: int = 2,
    user_id=None,
    num_completed: int = 0,
    scenario_en: str = "Test situation",
    audio_s3_key: str | None = None,
) -> tuple[Situation, list]:
    """Create a READY situation with a description, exercises, and optional exercise records."""
    situation = await SituationFactory.create(
        session=db_session,
        ready=True,
        scenario_en=scenario_en,
    )
    description = await SituationDescriptionFactory.create(
        session=db_session,
        situation_id=situation.id,
        audio_s3_key=audio_s3_key,
    )
    _exercise_types = [
        ExerciseType.FILL_GAPS,
        ExerciseType.SELECT_HEARD,
        ExerciseType.TRUE_FALSE,
    ]
    exercises = []
    for i in range(num_exercises):
        de = await DescriptionExerciseFactory.create(
            session=db_session,
            description_id=description.id,
            exercise_type=_exercise_types[i % len(_exercise_types)],
        )
        ex = await ExerciseFactory.create(
            session=db_session,
            description_exercise_id=de.id,
        )
        exercises.append(ex)

    if user_id and num_completed > 0:
        for ex in exercises[:num_completed]:
            await ExerciseRecordFactory.create(
                session=db_session,
                exercise_id=ex.id,
                user_id=user_id,
                learning=True,
            )

    await db_session.flush()
    return situation, exercises


@pytest.mark.integration
class TestLearnerSituationListEndpoint:
    """Tests for GET /api/v1/situations."""

    @pytest.mark.asyncio
    async def test_list_requires_auth(self, client: AsyncClient) -> None:
        response = await client.get(LIST_URL)
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_empty_list(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ) -> None:
        response = await client.get(LIST_URL, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["items"] == []
        assert data["total"] == 0

    @pytest.mark.asyncio
    async def test_list_returns_ready_situations(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        await SituationFactory.create(session=db_session, ready=True)
        await SituationFactory.create(session=db_session, ready=True)
        await db_session.flush()

        response = await client.get(LIST_URL, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 2

    @pytest.mark.asyncio
    async def test_pagination_page_size(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        for _ in range(3):
            await SituationFactory.create(session=db_session, ready=True)
        await db_session.flush()

        response = await client.get(LIST_URL, params={"page_size": 2}, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 2
        assert data["total"] == 3

    @pytest.mark.asyncio
    async def test_pagination_page_2(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        for _ in range(3):
            await SituationFactory.create(session=db_session, ready=True)
        await db_session.flush()

        response = await client.get(
            LIST_URL, params={"page": 2, "page_size": 2}, headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 1
        assert data["total"] == 3

    @pytest.mark.asyncio
    async def test_search_matches_scenario_en(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        await SituationFactory.create(
            session=db_session, ready=True, scenario_en="At the coffee shop"
        )
        await SituationFactory.create(session=db_session, ready=True, scenario_en="On the bus")
        await db_session.flush()

        response = await client.get(LIST_URL, params={"search": "coffee"}, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["scenario_en"] == "At the coffee shop"

    @pytest.mark.asyncio
    async def test_search_no_match(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        await SituationFactory.create(session=db_session, ready=True)
        await db_session.flush()

        response = await client.get(
            LIST_URL, params={"search": "xyznonexistent"}, headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["items"] == []
        assert data["total"] == 0

    @pytest.mark.asyncio
    async def test_search_case_insensitive(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        await SituationFactory.create(
            session=db_session, ready=True, scenario_en="At the coffee shop"
        )
        await db_session.flush()

        response = await client.get(LIST_URL, params={"search": "COFFEE"}, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1

    @pytest.mark.asyncio
    async def test_has_audio_filter_true(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        # Situation with audio
        sit_audio, _ = await _create_situation_with_exercises(
            db_session,
            num_exercises=0,
            scenario_en="With audio",
            audio_s3_key="audio/test.mp3",
        )
        # Situation without audio
        await _create_situation_with_exercises(
            db_session,
            num_exercises=0,
            scenario_en="Without audio",
        )

        response = await client.get(LIST_URL, params={"has_audio": "true"}, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["scenario_en"] == "With audio"
        assert data["items"][0]["has_audio"] is True

    @pytest.mark.asyncio
    async def test_exercise_total_count(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        await _create_situation_with_exercises(db_session, num_exercises=2)

        response = await client.get(LIST_URL, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["exercise_total"] == 2

    @pytest.mark.asyncio
    async def test_exercise_completed_count(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_user,
        db_session: AsyncSession,
    ) -> None:
        await _create_situation_with_exercises(
            db_session,
            num_exercises=2,
            user_id=test_user.id,
            num_completed=1,
        )

        response = await client.get(LIST_URL, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        item = data["items"][0]
        assert item["exercise_total"] == 2
        assert item["exercise_completed"] == 1

    @pytest.mark.asyncio
    async def test_exercise_completed_per_user(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_user,
        two_users,
        db_session: AsyncSession,
    ) -> None:
        """Other user's records do not count toward test_user's completed count."""
        other_user = two_users[1]
        situation, exercises = await _create_situation_with_exercises(
            db_session,
            num_exercises=2,
        )
        # Create record for the OTHER user only
        await ExerciseRecordFactory.create(
            session=db_session,
            exercise_id=exercises[0].id,
            user_id=other_user.id,
            learning=True,
        )
        await db_session.flush()

        response = await client.get(LIST_URL, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        item = data["items"][0]
        assert item["exercise_total"] == 2
        assert item["exercise_completed"] == 0


@pytest.mark.integration
class TestLearnerSituationDetailEndpoint:
    """Tests for GET /api/v1/situations/{situation_id}."""

    @pytest.mark.asyncio
    async def test_detail_requires_auth(self, client: AsyncClient) -> None:
        response = await client.get(_detail_url(uuid4()))
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_detail_returns_situation(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        situation = await SituationFactory.create(
            session=db_session,
            ready=True,
            scenario_en="At the coffee shop",
        )
        await db_session.flush()

        response = await client.get(_detail_url(situation.id), headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(situation.id)
        assert data["scenario_en"] == "At the coffee shop"
        assert data["status"] == SituationStatus.READY.value

    @pytest.mark.asyncio
    async def test_detail_includes_description(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        situation = await SituationFactory.create(session=db_session, ready=True)
        await SituationDescriptionFactory.create(
            session=db_session,
            situation_id=situation.id,
            text_el="Ο Γιάννης πίνει καφέ.",
        )
        await db_session.flush()

        response = await client.get(_detail_url(situation.id), headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["description"] is not None
        assert data["description"]["text_el"] == "Ο Γιάννης πίνει καφέ."

    @pytest.mark.asyncio
    async def test_detail_exercise_counts(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_user,
        db_session: AsyncSession,
    ) -> None:
        situation, _ = await _create_situation_with_exercises(
            db_session,
            num_exercises=2,
            user_id=test_user.id,
            num_completed=1,
        )

        response = await client.get(_detail_url(situation.id), headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["exercise_total"] == 2
        assert data["exercise_completed"] == 1

    @pytest.mark.asyncio
    async def test_detail_nonexistent_404(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ) -> None:
        response = await client.get(_detail_url(uuid4()), headers=auth_headers)
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_detail_draft_returns_404(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        situation = await SituationFactory.create(
            session=db_session,
            status=SituationStatus.DRAFT,
        )
        await db_session.flush()

        response = await client.get(_detail_url(situation.id), headers=auth_headers)
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_detail_source_fields_null_when_not_set(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        situation = await SituationFactory.create(session=db_session, ready=True)
        await db_session.flush()

        response = await client.get(_detail_url(situation.id), headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["source_url"] is None
        assert data["source_image_url"] is None
        assert data["source_title"] is None

    @pytest.mark.asyncio
    async def test_detail_source_fields_populated(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        situation = await SituationFactory.create(
            session=db_session,
            ready=True,
            source_url="https://example.com/article",
            source_title_en="An interesting article",
        )
        await db_session.flush()

        response = await client.get(_detail_url(situation.id), headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["source_url"] == "https://example.com/article"
        assert data["source_title"] == "An interesting article"
        assert data["source_image_url"] is None
