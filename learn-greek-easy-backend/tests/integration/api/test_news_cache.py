"""Integration tests for /news Redis cache invalidation via admin CRUD (PERF-17-02).

CI-run only: these tests exercise real admin CRUD endpoints against Postgres
via the `client`/`db_session` fixtures (no local Postgres is available in
this dev environment per project policy -- collection was verified locally
with `pytest --collect-only`, but the assertions themselves run in CI).

Covers Test Specs T02-4, T02-5, T02-7 from Backlog task-1245 / Obsidian
PERF-17 (## Target design SS B, Decisions D6/D8/D11/D15):
- T02-4: cached /news present -> admin POST triggers delete_pattern("news:list:*")
- T02-5: admin PUT (publish) and DELETE each trigger delete_pattern("news:list:*")
- T02-7 (F3, the important one): invalidation is sequenced AFTER an explicit
  db.commit() -- a GET /news after the edit must never observe the stale
  pre-edit state, and a call-order spy independently proves commit() happens
  strictly before delete_pattern().

RED (Stage 2.5, pre-implementation): src/api/v1/admin.py does not import
`get_cache` today (Drift #1, Stage-1 Architecture validation on
task-1245) and never calls delete_pattern for news. These tests patch
`src.api.v1.admin.get_cache` with `create=True` so the module imports
cleanly today; each test fails at its delete_pattern-call assertion, which
is a not-implemented failure, not a collection error.
"""

from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import Situation
from tests.factories.news import NewsItemFactory

VALID_CREATE_PAYLOAD = {
    "scenario_el": "Τίτλος ειδήσεων",
    "scenario_en": "News Title",
    "scenario_ru": "Заголовок новости",
    "text_el": "Κείμενο περιγραφής των ειδήσεων.",
    "country": "cyprus",
    "publication_date": str(date.today()),
    "original_article_url": "https://example.com/unique-article-12345",
    "source_image_url": "https://example.com/image.jpg",
}


def _make_mock_httpx(image_bytes: bytes = b"fake_image"):
    """Return a mock httpx.AsyncClient class for the image-download step."""
    mock_response = MagicMock()
    mock_response.content = image_bytes
    mock_response.headers = {"content-type": "image/jpeg"}
    mock_response.raise_for_status = MagicMock()

    mock_client = AsyncMock()
    mock_client.get.return_value = mock_response

    mock_cls = MagicMock()
    mock_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
    mock_cls.return_value.__aexit__ = AsyncMock(return_value=False)
    return mock_cls


def _make_mock_s3():
    mock = MagicMock()
    mock.upload_object.return_value = True
    mock.delete_object.return_value = True
    mock.generate_presigned_url.return_value = "https://s3.example.com/presigned"
    mock.get_extension_for_content_type = MagicMock(return_value="jpg")
    return mock


# =============================================================================
# T02-4: admin POST /admin/news invalidates the public news:list:* cache
# =============================================================================


@pytest.mark.asyncio
class TestNewsCacheInvalidationOnCreate:
    """T02-4: create triggers delete_pattern('news:list:*')."""

    async def test_create_triggers_delete_pattern(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ) -> None:
        mock_cache = MagicMock()
        mock_cache.delete_pattern = AsyncMock(return_value=0)

        with (
            patch("src.services.news_item_service.httpx.AsyncClient", _make_mock_httpx()),
            patch("src.services.news_item_service.get_s3_service", return_value=_make_mock_s3()),
            patch("src.api.v1.admin.get_cache", return_value=mock_cache, create=True),
        ):
            payload = {
                **VALID_CREATE_PAYLOAD,
                "original_article_url": f"https://example.com/article-{uuid4().hex[:8]}",
            }
            response = await client.post(
                "/api/v1/admin/news",
                json=payload,
                headers=superuser_auth_headers,
            )

        assert response.status_code == 201

        # RED: admin.py never calls get_cache/delete_pattern for news today.
        assert mock_cache.delete_pattern.call_count == 1, (
            "Expected delete_pattern('news:list:*') invoked once after create, "
            f"got {mock_cache.delete_pattern.call_count} call(s)"
        )
        mock_cache.delete_pattern.assert_awaited_once_with("news:list:*")


# =============================================================================
# T02-5: admin PUT (publish) and DELETE each invalidate the cache
# =============================================================================


@pytest.mark.asyncio
class TestNewsCacheInvalidationOnUpdateAndDelete:
    """T02-5: update (publish transition) and delete each trigger delete_pattern."""

    async def test_publish_update_triggers_delete_pattern(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        # Factory default has a publication_date already set, so a draft ->
        # published transition doesn't trip the publish guard (409).
        news_item = await NewsItemFactory.create(session=db_session)
        mock_cache = MagicMock()
        mock_cache.delete_pattern = AsyncMock(return_value=0)

        with (
            patch("src.services.news_item_service.get_s3_service", return_value=_make_mock_s3()),
            patch("src.api.v1.admin.get_cache", return_value=mock_cache, create=True),
        ):
            response = await client.put(
                f"/api/v1/admin/news/{news_item.id}",
                json={"status": "published"},
                headers=superuser_auth_headers,
            )

        assert response.status_code == 200

        assert mock_cache.delete_pattern.call_count == 1, (
            "Expected delete_pattern('news:list:*') invoked once after publish-update, "
            f"got {mock_cache.delete_pattern.call_count} call(s)"
        )
        mock_cache.delete_pattern.assert_awaited_once_with("news:list:*")

    async def test_delete_triggers_delete_pattern(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        news_item = await NewsItemFactory.create(session=db_session, published=True)
        mock_cache = MagicMock()
        mock_cache.delete_pattern = AsyncMock(return_value=0)

        with patch("src.api.v1.admin.get_cache", return_value=mock_cache, create=True):
            response = await client.delete(
                f"/api/v1/admin/news/{news_item.id}",
                headers=superuser_auth_headers,
            )

        assert response.status_code == 204

        assert mock_cache.delete_pattern.call_count == 1, (
            "Expected delete_pattern('news:list:*') invoked once after delete, "
            f"got {mock_cache.delete_pattern.call_count} call(s)"
        )
        mock_cache.delete_pattern.assert_awaited_once_with("news:list:*")


# =============================================================================
# T02-7 (F3): invalidation sequenced AFTER db.commit(); no stale-for-a-TTL window
# =============================================================================


@pytest.mark.asyncio
class TestNewsCacheInvalidationOrdering:
    """T02-7 / F3: commit() must happen strictly before delete_pattern()."""

    async def test_update_invalidates_after_commit_and_fresh_get_reflects_edit(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        """Update/delete currently have NO explicit db.commit() (Drift/F3 finding on
        task-1245): the deferred get_db commit runs AFTER the handler returns in
        production, so a naive "invalidate then commit" ordering would let a
        subsequent request re-cache the pre-write row. The executor must add an
        explicit `await db.commit()` BEFORE `delete_pattern`.

        This test proves ordering two independent ways:
        1. A call-order spy on db.commit() and cache.delete_pattern() -- fails if
           the executor reorders them (or omits the commit) regardless of what a
           single shared test session would otherwise mask.
        2. A fresh GET /news after the edit must show the new title (never the
           stale pre-edit one), and its ETag must differ from the pre-edit ETag
           (AC#7).
        """
        news_item = await NewsItemFactory.create(session=db_session, published=True)
        situation = await db_session.get(Situation, news_item.situation_id)
        original_title = situation.scenario_el

        # Prime the cache with the pre-edit body/ETag (AC#7 baseline).
        pre_edit_response = await client.get("/api/v1/news")
        assert pre_edit_response.status_code == 200
        pre_edit_etag = pre_edit_response.headers.get("etag")

        call_order: list[str] = []
        original_commit = db_session.commit

        async def _recording_commit() -> None:
            call_order.append("commit")
            await original_commit()

        mock_delete_pattern = AsyncMock(
            side_effect=lambda *_a, **_kw: call_order.append("delete_pattern")
        )
        mock_cache = MagicMock()
        mock_cache.delete_pattern = mock_delete_pattern

        with (
            patch("src.services.news_item_service.get_s3_service", return_value=_make_mock_s3()),
            patch("src.api.v1.admin.get_cache", return_value=mock_cache, create=True),
            patch.object(
                db_session, "commit", new_callable=AsyncMock, side_effect=_recording_commit
            ),
        ):
            response = await client.put(
                f"/api/v1/admin/news/{news_item.id}",
                json={"scenario_el": "Ενημερωμένος τίτλος"},
                headers=superuser_auth_headers,
            )

        assert response.status_code == 200

        # RED (call-count): admin.py never calls delete_pattern for news today.
        assert mock_delete_pattern.call_count == 1, (
            "Expected delete_pattern('news:list:*') called once after update, "
            f"got {mock_delete_pattern.call_count} call(s)"
        )
        # RED (ordering, F3): commit must strictly precede delete_pattern.
        assert call_order == [
            "commit",
            "delete_pattern",
        ], f"Expected commit() strictly before delete_pattern() (F3), got order: {call_order}"

        post_edit_response = await client.get("/api/v1/news")
        assert post_edit_response.status_code == 200
        titles = [item["title_el"] for item in post_edit_response.json()["items"]]
        assert "Ενημερωμένος τίτλος" in titles, "Expected the fresh GET to show the edited title"
        assert original_title not in titles, "Fresh GET must never serve the stale pre-edit title"

        post_edit_etag = post_edit_response.headers.get("etag")
        assert (
            post_edit_etag != pre_edit_etag
        ), "AC#7: ETag must change once the underlying published set changes"
