"""Integration tests for learner situation list and detail endpoints."""

from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import DescriptionSourceType, ExerciseType, Situation, SituationStatus
from tests.factories.exercise import ExerciseFactory, ExerciseRecordFactory
from tests.factories.situation import SituationFactory
from tests.factories.situation_description import (
    DescriptionExerciseFactory,
    SituationDescriptionFactory,
)
from tests.factories.situation_picture import SituationPictureFactory

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
    async def test_search_matches_scenario_el(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        """QA Mode B adversarial: the search OR spans all 3 scenario langs, not
        just scenario_en (AC-7 extraction must preserve the 3-way ilike OR)."""
        await SituationFactory.create(
            session=db_session, ready=True, scenario_el="Στο καφέ", scenario_en="Unrelated"
        )
        await SituationFactory.create(
            session=db_session,
            ready=True,
            scenario_el="Στο λεωφορείο",
            scenario_en="Also unrelated",
        )
        await db_session.flush()

        response = await client.get(LIST_URL, params={"search": "καφέ"}, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["scenario_el"] == "Στο καφέ"

    @pytest.mark.asyncio
    async def test_search_matches_scenario_ru(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        """QA Mode B adversarial: search also matches scenario_ru."""
        await SituationFactory.create(
            session=db_session, ready=True, scenario_ru="В кафе", scenario_en="Unrelated"
        )
        await SituationFactory.create(
            session=db_session, ready=True, scenario_ru="В автобусе", scenario_en="Also unrelated"
        )
        await db_session.flush()

        response = await client.get(LIST_URL, params={"search": "кафе"}, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["scenario_ru"] == "В кафе"

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
    async def test_has_audio_filter_false(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        """QA Mode B adversarial: has_audio=False must partition the OTHER way —
        both "no description at all" and "description with no audio key" count,
        per the extracted audio_filter's ``~has() OR audio_s3_key IS NULL`` branch.
        """
        # Situation with audio — excluded from has_audio=False.
        await _create_situation_with_exercises(
            db_session,
            num_exercises=0,
            scenario_en="With audio",
            audio_s3_key="audio/test.mp3",
        )
        # Situation with a description but no audio key.
        await _create_situation_with_exercises(
            db_session,
            num_exercises=0,
            scenario_en="Without audio",
        )
        # Situation with no description at all (~Situation.description.has()).
        await SituationFactory.create(session=db_session, ready=True, scenario_en="No description")
        await db_session.flush()

        response = await client.get(LIST_URL, params={"has_audio": "false"}, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 2
        returned_en = {item["scenario_en"] for item in data["items"]}
        assert returned_en == {"Without audio", "No description"}
        for item in data["items"]:
            assert item["has_audio"] is False

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

    @pytest.mark.asyncio
    async def test_list_includes_source_image_url(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        sit_with_image = await SituationFactory.create(
            session=db_session,
            ready=True,
            source_image_s3_key="images/test.jpg",
        )
        sit_without_image = await SituationFactory.create(
            session=db_session,
            ready=True,
            source_image_s3_key=None,
        )
        await db_session.flush()

        mock_s3 = MagicMock()
        mock_s3.generate_presigned_url.side_effect = (
            lambda key, **kwargs: f"https://s3.example.com/{key}"
        )

        # list_situations delegates to LearnerSituationService (PERF-15-02), which
        # calls get_s3_service() from its own module — patch it there, not on the router.
        with patch("src.services.learner_situation_service.get_s3_service", return_value=mock_s3):
            response = await client.get(LIST_URL, headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 2

        items_by_id = {item["id"]: item for item in data["items"]}
        assert (
            items_by_id[str(sit_with_image.id)]["source_image_url"]
            == "https://s3.example.com/images/test.jpg"
        )
        assert items_by_id[str(sit_without_image.id)]["source_image_url"] is None


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


@pytest.mark.integration
class TestLearnerSituationDetailPictureUrl:
    """Tests for picture_url field on GET /api/v1/situations/{situation_id}."""

    @pytest.mark.asyncio
    async def test_get_situation_includes_picture_url_when_generated(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        situation = await SituationFactory.create(session=db_session, ready=True)
        picture = await SituationPictureFactory.create(
            session=db_session, situation_id=situation.id, generated=True
        )
        await db_session.flush()

        mock_s3 = MagicMock()
        mock_s3.generate_presigned_url.side_effect = (
            lambda key, **kwargs: f"https://s3.example.com/{key}"
        )
        with patch("src.api.v1.situations.get_s3_service", return_value=mock_s3):
            response = await client.get(_detail_url(situation.id), headers=auth_headers)

        assert response.status_code == 200
        assert response.json()["picture_url"] == f"https://s3.example.com/{picture.image_s3_key}"

    @pytest.mark.asyncio
    async def test_get_situation_picture_url_null_when_no_picture(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        situation = await SituationFactory.create(session=db_session, ready=True)
        await db_session.flush()

        response = await client.get(_detail_url(situation.id), headers=auth_headers)

        assert response.status_code == 200
        assert response.json()["picture_url"] is None

    @pytest.mark.asyncio
    async def test_get_situation_picture_url_null_when_picture_draft(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        situation = await SituationFactory.create(session=db_session, ready=True)
        await SituationPictureFactory.create(session=db_session, situation_id=situation.id)
        await db_session.flush()

        response = await client.get(_detail_url(situation.id), headers=auth_headers)

        assert response.status_code == 200
        assert response.json()["picture_url"] is None


# =============================================================================
# SIT-27-02: domain + description_source_type fields
# =============================================================================
# Mode A — RED spec.  These tests assert fields that do NOT yet exist on the
# schema / API response.  They will fail with KeyError or AssertionError until
# the executor implements SIT-27-02:
#   - adds Situation.domain column + Alembic migration
#   - exposes domain on LearnerSituationListItem + LearnerSituationDetailResponse
#   - exposes description_source_type on LearnerSituationListItem
#
# DB execution is deferred to CI (ephemeral pgvector DB).
# Local ``pytest --collect-only`` confirms import-clean collection only.
# =============================================================================


@pytest.mark.integration
class TestLearnerSituationDomainField:
    """AC-2: domain field present on list + detail payloads.

    RED because LearnerSituationListItem and LearnerSituationDetailResponse
    do not yet carry a 'domain' field — the column doesn't exist yet.
    """

    @pytest.mark.asyncio
    async def test_learner_list_includes_domain(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        """AC-2: GET /api/v1/situations list returns domain on each item.

        GIVEN  a READY situation with domain="news"
        WHEN   GET /api/v1/situations
        THEN   each item in the response carries a "domain" key
               and its value equals "news"

        RED because: Situation model has no domain column, so
        SituationFactory kwargs domain="news" will be ignored or error,
        and the response schema has no domain field.
        """
        await SituationFactory.create(
            session=db_session,
            ready=True,
            domain="news",
        )
        await db_session.flush()

        response = await client.get(LIST_URL, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        item = data["items"][0]
        # This key will be absent until SIT-27-02 is implemented
        assert "domain" in item, "list item must carry 'domain' field (SIT-27-02)"
        assert item["domain"] == "news"

    @pytest.mark.asyncio
    async def test_learner_detail_includes_domain(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        """AC-2: GET /api/v1/situations/{id} detail returns domain.

        GIVEN  a READY situation with domain="travel"
        WHEN   GET /api/v1/situations/{id}
        THEN   the response carries "domain" == "travel"

        RED because: LearnerSituationDetailResponse does not yet have
        a domain field.
        """
        situation = await SituationFactory.create(
            session=db_session,
            ready=True,
            domain="travel",
        )
        await db_session.flush()

        response = await client.get(_detail_url(situation.id), headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        # This key will be absent until SIT-27-02 is implemented
        assert "domain" in data, "detail response must carry 'domain' field (SIT-27-02)"
        assert data["domain"] == "travel"

    @pytest.mark.asyncio
    async def test_domain_nullable_serialises_null(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        """AC-2: domain=NULL serialises as null in both list and detail, no 500.

        GIVEN  a READY situation with no domain set (domain=NULL)
        WHEN   GET /api/v1/situations  AND  GET /api/v1/situations/{id}
        THEN   both return HTTP 200 with domain == null (not omitted, not 500)

        RED because: the domain column does not exist yet; once added it will
        be nullable and must serialise as JSON null, not raise a 500.
        """
        situation = await SituationFactory.create(
            session=db_session,
            ready=True,
            # domain not set -> NULL in DB once column exists
        )
        await db_session.flush()

        # List endpoint
        list_response = await client.get(LIST_URL, headers=auth_headers)
        assert list_response.status_code == 200
        items = list_response.json()["items"]
        assert len(items) == 1
        item = items[0]
        assert "domain" in item, "list item must carry 'domain' field even when NULL (SIT-27-02)"
        assert item["domain"] is None

        # Detail endpoint
        detail_response = await client.get(_detail_url(situation.id), headers=auth_headers)
        assert detail_response.status_code == 200
        data = detail_response.json()
        assert (
            "domain" in data
        ), "detail response must carry 'domain' field even when NULL (SIT-27-02)"
        assert data["domain"] is None


@pytest.mark.integration
class TestLearnerSituationDescriptionSourceTypeField:
    """AC-3: description_source_type field present on list payload.

    description_source_type is sourced from SituationDescription.source_type
    (DescriptionSourceType enum: "news" | "original").  It is nullable on the
    list item — null when the situation has no description.

    RED because LearnerSituationListItem does not yet carry a
    'description_source_type' field.
    """

    @pytest.mark.asyncio
    async def test_learner_list_includes_description_source_type_news(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        """AC-3: list item carries description_source_type from linked description.

        GIVEN  a READY situation with a SituationDescription whose
               source_type = DescriptionSourceType.NEWS ("news")
        WHEN   GET /api/v1/situations
        THEN   the item carries description_source_type == "news"

        RED because: LearnerSituationListItem has no description_source_type
        field and the endpoint does not populate it.
        """
        situation = await SituationFactory.create(session=db_session, ready=True)
        await SituationDescriptionFactory.create(
            session=db_session,
            situation_id=situation.id,
            source_type=DescriptionSourceType.NEWS,
        )
        await db_session.flush()

        response = await client.get(LIST_URL, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        item = data["items"][0]
        # This key will be absent until SIT-27-02 is implemented
        assert (
            "description_source_type" in item
        ), "list item must carry 'description_source_type' field (SIT-27-02)"
        assert item["description_source_type"] == DescriptionSourceType.NEWS.value

    @pytest.mark.asyncio
    async def test_learner_list_description_source_type_null_when_no_description(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        """AC-3: description_source_type is null when situation has no description.

        GIVEN  a READY situation with no SituationDescription
        WHEN   GET /api/v1/situations
        THEN   description_source_type == null (not omitted, not 500)

        RED because: LearnerSituationListItem has no description_source_type
        field and the endpoint does not populate it.
        """
        await SituationFactory.create(session=db_session, ready=True)
        await db_session.flush()

        response = await client.get(LIST_URL, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        item = data["items"][0]
        assert (
            "description_source_type" in item
        ), "list item must carry 'description_source_type' even when null (SIT-27-02)"
        assert item["description_source_type"] is None

    @pytest.mark.asyncio
    async def test_learner_list_description_source_type_original(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        """AC-3: description_source_type == "original" for non-news descriptions.

        GIVEN  a READY situation with a SituationDescription whose
               source_type = DescriptionSourceType.ORIGINAL ("original")
        WHEN   GET /api/v1/situations
        THEN   description_source_type == "original"

        Ensures both enum values round-trip correctly; news-vs-everyday hub
        split depends on this discriminator.
        """
        situation = await SituationFactory.create(session=db_session, ready=True)
        await SituationDescriptionFactory.create(
            session=db_session,
            situation_id=situation.id,
            source_type=DescriptionSourceType.ORIGINAL,
        )
        await db_session.flush()

        response = await client.get(LIST_URL, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        item = data["items"][0]
        assert (
            "description_source_type" in item
        ), "list item must carry 'description_source_type' field (SIT-27-02)"
        assert item["description_source_type"] == DescriptionSourceType.ORIGINAL.value
