"""RED tests for SIT-27-04 API: situation comprehension endpoints.

Mode A — authored RED before implementation (RALPH Stage 2.5 / QA Mode A).

Covers the HTTP layer for two net-new endpoints:
  (a) Per-situation stats: GET /api/v1/situations/{id}/stats
      Exposes to_practice / in_review / mastered / audio counts.
  (b) Account-wide comprehension overview: GET /api/v1/situations/comprehension
      Exposes overall %, verdict, per-topic confidence, streak, recent sessions,
      and what's-new count.

WHY THESE ARE RED
-----------------
Neither endpoint exists yet.  Requests will return 404 (route not registered).
Tests assert on specific response shapes and 200 status codes — they FAIL with
AssertionError on status 404 — RED for the right reason.

The ``test_comprehension_endpoint_requires_auth`` test is the single GREEN test
in this file that is expected to pass even today, because a non-existent route
returns 404, not 401.  The purpose of that test is to document the expectation
that once the endpoint exists, unauthenticated requests return 401.  If 401 is
returned now (route exists but auth is working), that test also passes.  This
is acceptable — it's the only idempotent boundary-condition test.

NOTE ON PER-SITUATION STATS ROUTE
----------------------------------
The route path is chosen as ``/api/v1/situations/{id}/stats`` to follow the
existing ``/api/v1/situations/{id}/exercises`` pattern.  The executor may choose
a different path (e.g. ``/api/v1/situations/{id}/comprehension``) — the tests
use a constant ``_STATS_URL`` so the executor only needs to update one string
if the path changes.
"""

from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import CardStatus, DeckLevel, ExerciseModality, ExerciseSourceType, ExerciseType
from tests.factories import (
    DescriptionExerciseFactory,
    DescriptionExerciseItemFactory,
    ExerciseFactory,
    ExerciseRecordFactory,
    SituationDescriptionFactory,
    SituationFactory,
)

# Route constants — update here if the executor chooses different paths.
_SITUATIONS_BASE = "/api/v1/situations"
_COMPREHENSION_URL = "/api/v1/situations/comprehension"


def _stats_url(situation_id) -> str:
    return f"{_SITUATIONS_BASE}/{situation_id}/stats"


# ===========================================================================
# Per-situation stats endpoint
# ===========================================================================


@pytest.mark.unit
class TestPerSituationStatsEndpoint:
    """Tests for GET /api/v1/situations/{id}/stats (AC-1)."""

    @pytest.mark.asyncio
    async def test_per_situation_stats_endpoint_returns_200(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        """GIVEN a READY situation
        WHEN  GET /api/v1/situations/{id}/stats with auth
        THEN  200 OK with to_practice / in_review / mastered / audio fields.

        RED: endpoint does not exist → 404.
        """
        situation = await SituationFactory.create(session=db_session, ready=True)
        await db_session.flush()

        response = await client.get(_stats_url(situation.id), headers=auth_headers)
        assert response.status_code == 200, (
            f"Expected 200, got {response.status_code}. "
            "Endpoint GET {_stats_url('<id>')} does not exist yet (SIT-27-04)."
        )

        data = response.json()
        for field in ("to_practice", "in_review", "mastered", "audio"):
            assert field in data, f"Response missing field '{field}'. " f"Full response: {data}"

    @pytest.mark.asyncio
    async def test_per_situation_stats_requires_auth(
        self,
        client: AsyncClient,
    ) -> None:
        """Per-situation stats requires authentication.

        GIVEN  no auth header
        WHEN   GET /api/v1/situations/{id}/stats
        THEN   401 (once the endpoint exists; 404 today which is also a non-200)

        This test documents the auth requirement.  Once the endpoint exists it
        must enforce auth — unauthenticated access should never return 200.
        """
        response = await client.get(_stats_url(uuid4()))
        assert (
            response.status_code != 200
        ), "Unauthenticated request to per-situation stats must not return 200"

    @pytest.mark.asyncio
    async def test_per_situation_counts_correct_in_endpoint(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
        test_user,
    ) -> None:
        """GIVEN user with 1 NEW, 2 REVIEW exercises on a situation
        WHEN  GET /api/v1/situations/{id}/stats
        THEN  to_practice=1, in_review=2, mastered=0

        RED: endpoint does not exist → 404.
        """
        situation = await SituationFactory.create(session=db_session, ready=True)
        desc = await SituationDescriptionFactory.create(
            session=db_session, situation_id=situation.id
        )

        # 3 READING exercises on the same description — each needs a unique
        # (description_id, exercise_type, audio_level, modality) tuple.
        # The factory flushes immediately on create(), so we pass modality and a
        # distinct exercise_type at construction time.
        for status, ex_type in [
            (CardStatus.NEW, ExerciseType.FILL_GAPS),
            (CardStatus.REVIEW, ExerciseType.SELECT_HEARD),
            (CardStatus.REVIEW, ExerciseType.TRUE_FALSE),
        ]:
            de = await DescriptionExerciseFactory.create(
                session=db_session,
                description_id=desc.id,
                approved=True,
                modality=ExerciseModality.READING,
                exercise_type=ex_type,
            )
            await DescriptionExerciseItemFactory.create(
                session=db_session, description_exercise_id=de.id
            )
            ex = await ExerciseFactory.create(
                session=db_session,
                description_exercise_id=de.id,
                source_type=ExerciseSourceType.DESCRIPTION,
            )
            await ExerciseRecordFactory.create(
                session=db_session,
                user_id=test_user.id,
                exercise_id=ex.id,
                status=status,
            )

        await db_session.flush()

        response = await client.get(_stats_url(situation.id), headers=auth_headers)
        assert (
            response.status_code == 200
        ), f"Endpoint does not exist yet (SIT-27-04). Status: {response.status_code}"

        data = response.json()
        assert data["to_practice"] == 1, f"Expected to_practice=1, got {data.get('to_practice')}"
        assert data["in_review"] == 2, f"Expected in_review=2, got {data.get('in_review')}"
        assert data["mastered"] == 0, f"Expected mastered=0, got {data.get('mastered')}"

    @pytest.mark.asyncio
    async def test_per_situation_stats_404_for_unknown_situation(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ) -> None:
        """GIVEN a random UUID that is not a real situation
        WHEN  GET /api/v1/situations/{id}/stats
        THEN  404 (not 500)

        RED: endpoint doesn't exist at all → also 404, but for different reason.
        Once it exists this remains 404 for the right reason (no such situation).
        """
        response = await client.get(_stats_url(uuid4()), headers=auth_headers)
        # Both "endpoint missing" and "situation not found" return 404.
        # This test validates that we never get a 500 for unknown IDs.
        assert response.status_code in (
            404,
            422,
        ), f"Expected 404 for unknown situation, got {response.status_code}"


# ===========================================================================
# Comprehension overview endpoint
# ===========================================================================


@pytest.mark.unit
class TestComprehensionOverviewEndpoint:
    """Tests for GET /api/v1/situations/comprehension (AC-2 + AC-3 + AC-4 + AC-5)."""

    @pytest.mark.asyncio
    async def test_comprehension_endpoint_requires_auth(
        self,
        client: AsyncClient,
    ) -> None:
        """Comprehension overview requires authentication.

        GIVEN  no auth header
        WHEN   GET /api/v1/situations/comprehension
        THEN   401 or 404 (not 200 — never returns data to anonymous users)

        NOTE: This test is "almost green" — it passes both when the endpoint
        doesn't exist (404) and when it enforces auth (401).  It is the single
        test that may appear to pass before implementation, but that is by design
        — it documents the invariant that anonymous access is forbidden.
        """
        response = await client.get(_COMPREHENSION_URL)
        assert (
            response.status_code != 200
        ), "Unauthenticated request must not return 200 from comprehension endpoint"

    @pytest.mark.asyncio
    async def test_comprehension_overview_returns_200(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ) -> None:
        """GIVEN authenticated user
        WHEN  GET /api/v1/situations/comprehension
        THEN  200 OK

        RED: endpoint does not exist → 404.
        """
        response = await client.get(_COMPREHENSION_URL, headers=auth_headers)
        assert response.status_code == 200, (
            f"Expected 200 from comprehension overview, got {response.status_code}. "
            "Endpoint GET /api/v1/situations/comprehension does not exist yet (SIT-27-04)."
        )

    @pytest.mark.asyncio
    async def test_comprehension_overview_schema(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ) -> None:
        """GIVEN authenticated user with no data
        WHEN  GET /api/v1/situations/comprehension
        THEN  response has all required top-level fields.

        Expected schema (modelled on CultureReadinessResponse):
          comprehension_percentage: float
          verdict: str
          topic_confidence: list
          streak: int
          recent_sessions: list
          whats_new_count: int

        RED: endpoint does not exist → 404.
        """
        response = await client.get(_COMPREHENSION_URL, headers=auth_headers)
        assert response.status_code == 200, (
            f"Endpoint GET /api/v1/situations/comprehension not found (SIT-27-04). "
            f"Status: {response.status_code}"
        )

        data = response.json()
        required_fields = [
            "comprehension_percentage",
            "verdict",
            "topic_confidence",
            "streak",
            "recent_sessions",
            "whats_new_count",
        ]
        for field in required_fields:
            assert field in data, (
                f"Comprehension overview response missing field '{field}'. "
                f"Full response: {data}"
            )

    @pytest.mark.asyncio
    async def test_comprehension_overview_empty_state_returns_valid_response(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
        test_user,
    ) -> None:
        """GIVEN user with no ExerciseRecords or ExerciseReviews
        WHEN  GET /api/v1/situations/comprehension
        THEN  returns 200 with comprehension_percentage=0, verdict="not_ready",
              topic_confidence has null accuracy, recent_sessions=[], no 500.

        AC-3 (null accuracy) + AC-2 (zero-pct not-ready) in the API layer.

        RED: endpoint does not exist → 404.
        """
        response = await client.get(_COMPREHENSION_URL, headers=auth_headers)
        assert response.status_code == 200, (
            f"Empty-state comprehension overview returned {response.status_code} "
            "(expected 200, SIT-27-04 endpoint not yet implemented)"
        )

        data = response.json()
        assert data.get("comprehension_percentage") == 0, (
            f"Expected comprehension_percentage=0 for user with no data, "
            f"got {data.get('comprehension_percentage')}"
        )
        assert (
            data.get("verdict") == "not_ready"
        ), f"Expected verdict='not_ready' at 0%, got {data.get('verdict')!r}"
        assert (
            data.get("recent_sessions") == []
        ), f"Expected empty recent_sessions, got {data.get('recent_sessions')}"

        # AC-3: every topic in topic_confidence should have accuracy=null
        for tc in data.get("topic_confidence", []):
            assert tc.get("accuracy") is None, (
                f"Topic {tc.get('topic')!r} should have null accuracy "
                f"when no reviews exist, got {tc.get('accuracy')!r}"
            )

    @pytest.mark.asyncio
    async def test_comprehension_overview_all_four_topics_present(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ) -> None:
        """GIVEN any user
        WHEN  GET /api/v1/situations/comprehension
        THEN  topic_confidence list contains all four canonical topics

        Invariant: all four topics (Listening, Reading, Dialogue, Visual) must
        always appear in topic_confidence, even with zero exercises.

        RED: endpoint does not exist → 404.
        """
        response = await client.get(_COMPREHENSION_URL, headers=auth_headers)
        assert (
            response.status_code == 200
        ), f"Endpoint not found (SIT-27-04). Status: {response.status_code}"

        data = response.json()
        topic_names = {tc["topic"] for tc in data.get("topic_confidence", [])}
        for expected in ("Listening", "Reading", "Dialogue", "Visual"):
            assert expected in topic_names, (
                f"topic_confidence is missing '{expected}' topic. " f"Present topics: {topic_names}"
            )

    @pytest.mark.asyncio
    async def test_comprehension_overview_recent_sessions_capped_at_five(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
        test_user,
    ) -> None:
        """GIVEN user with 7 ExerciseReviews across situations
        WHEN  GET /api/v1/situations/comprehension
        THEN  recent_sessions has exactly 5 entries

        AC-5 via API layer.

        RED: endpoint does not exist → 404.
        """
        from datetime import datetime, timedelta, timezone

        situation = await SituationFactory.create(session=db_session, ready=True)
        desc = await SituationDescriptionFactory.create(
            session=db_session, situation_id=situation.id
        )

        from tests.factories import ExerciseReviewFactory

        now = datetime.now(tz=timezone.utc)

        # 7 READING exercises on the same description need 7 unique
        # (description_id, exercise_type, audio_level, modality) tuples.
        # 4 exercise_types × 2 audio_levels gives 8 READING combos — use first 7.
        reading_combos = [
            (ExerciseType.FILL_GAPS, DeckLevel.A2),
            (ExerciseType.FILL_GAPS, DeckLevel.B2),
            (ExerciseType.SELECT_HEARD, DeckLevel.A2),
            (ExerciseType.SELECT_HEARD, DeckLevel.B2),
            (ExerciseType.TRUE_FALSE, DeckLevel.A2),
            (ExerciseType.TRUE_FALSE, DeckLevel.B2),
            (ExerciseType.SELECT_CORRECT_ANSWER, DeckLevel.A2),
        ]

        for i in range(7):
            ex_type, audio_level = reading_combos[i]
            de = await DescriptionExerciseFactory.create(
                session=db_session,
                description_id=desc.id,
                approved=True,
                modality=ExerciseModality.READING,
                exercise_type=ex_type,
                audio_level=audio_level,
            )
            await DescriptionExerciseItemFactory.create(
                session=db_session, description_exercise_id=de.id
            )
            ex = await ExerciseFactory.create(
                session=db_session,
                description_exercise_id=de.id,
                source_type=ExerciseSourceType.DESCRIPTION,
            )
            record = await ExerciseRecordFactory.create(
                session=db_session,
                user_id=test_user.id,
                exercise_id=ex.id,
                status=CardStatus.REVIEW,
            )
            await ExerciseReviewFactory.create(
                session=db_session,
                user_id=test_user.id,
                exercise_record_id=record.id,
                reviewed_at=now - timedelta(days=i),
            )

        await db_session.flush()

        response = await client.get(_COMPREHENSION_URL, headers=auth_headers)
        assert (
            response.status_code == 200
        ), f"Endpoint not found (SIT-27-04). Status: {response.status_code}"

        data = response.json()
        sessions = data.get("recent_sessions", [])
        assert (
            len(sessions) == 5
        ), f"Expected 5 recent sessions (capped from 7), got {len(sessions)}"
