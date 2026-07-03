"""RED integration tests for GET /api/v1/dashboard/summary (PERF-15-04).

Pre-implementation: src/api/v1/dashboard.py is a STUB (see its module
docstring) that only wires the route + auth/db dependencies and returns a
hardcoded placeholder dict -- deliberately NOT a DashboardSummaryResponse.
FastAPI's response_model validation then fails on every authed request,
which the app's generic exception handler (src/main.py) converts to a 500.
That is why tests 2 and 3 below are RED at assertion level (status_code
mismatch), not via an import/404 error -- the route itself resolves
correctly (proven by test 1).

Test 4 (AC-4, one-transaction) targets DashboardSummaryService.build()
directly rather than the HTTP endpoint: PERF-15-03 already implemented and
integration-tested build() to compose every sub-service on the single
injected AsyncSession, so this guard is ALREADY GREEN today. PERF-15-04
only adds the endpoint + Redis cache-aside wrapper on top of that (covered
by the unit cache tests in tests/unit/api/test_dashboard_summary_cache.py);
this test exists to catch a future regression (e.g. the executor opening a
second get_db() session inside the cache factory), not to prove new
PERF-15-04 behavior.
"""

from __future__ import annotations

from unittest.mock import patch

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import User
from src.services import dashboard_summary_service as dss_module
from src.services.dashboard_summary_service import DashboardSummaryService
from tests.factories import NewsItemFactory

SUMMARY_URL = "/api/v1/dashboard/summary"


@pytest.mark.integration
class TestDashboardSummaryEndpoint:
    """GET /api/v1/dashboard/summary -- RED pre-implementation."""

    @pytest.mark.asyncio
    async def test_summary_requires_auth(self, client: AsyncClient) -> None:
        """No Authorization header -> 401.

        Expected to be GREEN as soon as the stub route + auth dependency
        exist (auth runs before the stub body runs) -- acceptable per the
        PERF-15-04 RED plan.
        """
        response = await client.get(SUMMARY_URL)
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_summary_returns_full_dto(self, client: AsyncClient, auth_headers: dict) -> None:
        """Authed request -> 200 with the full DashboardSummaryResponse
        contract: the 10 required fields plus the 5 nullable unwired slots
        (AC-6), null for a brand-new user with nothing wiring them yet.

        RED reason: the STUB returns a hardcoded placeholder dict, not a
        DashboardSummaryResponse, so FastAPI's response_model validation
        fails and the generic exception handler converts it to a 500 --
        the status_code assertion below fails cleanly (not import/404).
        """
        response = await client.get(SUMMARY_URL, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()

        for field in (
            "is_new_user",
            "mastered",
            "today",
            "streak",
            "week_heat",
            "decks",
            "feed",
            "whats_new_count",
            "queue_count",
            "all_time_study_time_seconds",
        ):
            assert field in data, f"Missing required field: {field}"

        # AC-6: 5 unwired slots present and null (nothing populates them yet).
        for unwired_field in (
            "word_of_day",
            "recently_added",
            "review_time_estimate_minutes",
            "resume_position",
            "minutes_goal",
        ):
            assert unwired_field in data, f"Missing unwired slot: {unwired_field}"
            assert (
                data[unwired_field] is None
            ), f"Expected {unwired_field} to default to null, got {data[unwired_field]!r}"

    @pytest.mark.asyncio
    async def test_summary_payload_slim(self, client: AsyncClient, auth_headers: dict) -> None:
        """AC-3: the composed payload stays slim -- no heavy reader-only
        fields (word_timestamps, description_el) or the full news
        list-wrapper key ("items") leak into the dashboard feed, and the
        whole body stays well under 30KB.

        RED reason: same as test_summary_returns_full_dto -- the STUB's 500
        response fails the status_code assertion before the size/content
        checks even run.
        """
        response = await client.get(SUMMARY_URL, headers=auth_headers)
        assert response.status_code == 200

        raw = response.content
        assert len(raw) <= 30_000, f"Payload too large: {len(raw)} bytes"

        body_text = raw.decode("utf-8")
        for forbidden in ("word_timestamps", '"items"', "description_el"):
            assert forbidden not in body_text, f"Slim payload leaked: {forbidden!r}"

    @pytest.mark.asyncio
    async def test_news_feed_item_matches_slim_news_field_set(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        """PERF-17-01 T01-6 (AC#6) -- REGRESSION GUARD, not RED.

        Locks the exact SlimNews field set (src/schemas/dashboard.py:98-143)
        exposed on a "news"-type feed item, so PERF-17-01's D2 repoint of
        ``_gather_news`` from ``NewsItemService.get_list`` to the new
        ``get_list_slim`` cannot silently change the dashboard feed's news
        shape. Already GREEN today -- ``SlimNews.from_full`` already maps
        the full ``NewsItemResponse`` down to exactly these 11 fields
        regardless of which service method produced the source item -- and
        must STAY green after the repoint (byte-identical /dashboard/summary
        response, per AC#6 and the story's D2 decision).
        """
        await NewsItemFactory.create(published=True)

        response = await client.get(SUMMARY_URL, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()

        news_items = [item for item in data["feed"] if item["type"] == "news"]
        assert len(news_items) >= 1, "Expected at least one news feed item"

        expected_fields = {
            "id",
            "situation_id",
            "title_el",
            "title_en",
            "title_ru",
            "publication_date",
            "country",
            "audio_duration_seconds",
            "image_url",
            "image_variants",
            "original_article_url",
        }
        assert set(news_items[0]["news"].keys()) == expected_fields


@pytest.mark.integration
class TestDashboardSummaryServiceSingleSession:
    """AC-4: DashboardSummaryService.build() composes every sub-service on
    the ONE AsyncSession injected into the service -- no sub-service opens
    or receives a different session.

    NOTE: this targets the SERVICE, not the HTTP endpoint. PERF-15-03
    already implemented and integration-tested build() itself; PERF-15-04
    only wraps it with the endpoint + cache-aside (covered by the endpoint
    tests above and the unit cache tests). This guard is ALREADY GREEN --
    it locks in the single-session contract so the endpoint wiring can't
    quietly regress it.
    """

    @pytest.mark.asyncio
    async def test_build_uses_single_shared_session(
        self, db_session: AsyncSession, test_user: User
    ) -> None:
        with (
            patch.object(
                dss_module, "DeckRepository", wraps=dss_module.DeckRepository
            ) as deck_repo_cls,
            patch.object(
                dss_module, "ProgressService", wraps=dss_module.ProgressService
            ) as progress_cls,
            patch.object(
                dss_module, "NewsItemService", wraps=dss_module.NewsItemService
            ) as news_cls,
            patch.object(
                dss_module,
                "LearnerSituationService",
                wraps=dss_module.LearnerSituationService,
            ) as situation_cls,
            patch.object(
                dss_module,
                "SituationComprehensionService",
                wraps=dss_module.SituationComprehensionService,
            ) as whats_new_cls,
            patch.object(
                dss_module, "ExerciseSM2Service", wraps=dss_module.ExerciseSM2Service
            ) as queue_cls,
        ):
            result = await DashboardSummaryService(db_session).build(test_user.id)

        assert result is not None
        for cls_mock in (
            deck_repo_cls,
            progress_cls,
            news_cls,
            situation_cls,
            whats_new_cls,
            queue_cls,
        ):
            assert cls_mock.call_count == 1, f"Expected {cls_mock} constructed exactly once"
            called_db = cls_mock.call_args.args[0]
            assert called_db is db_session, (
                f"Expected {cls_mock} constructed with the shared db_session, "
                f"got a different session/object: {called_db!r}"
            )
