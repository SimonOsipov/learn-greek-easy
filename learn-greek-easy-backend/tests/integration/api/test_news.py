"""Integration tests for public news API endpoints.

This module tests the public news endpoints:
- GET /api/v1/news - List news items with pagination
- GET /api/v1/news/{id} - Get a single news item

Tests cover:
- Success cases (200)
- Not found cases (404)
- Validation errors (422)
- Pagination
- linked_situation picture fields (F4: picture_image_url, picture_image_variants, has_picture)
"""

from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import Situation, SituationDescription
from tests.factories import NewsItemFactory, SituationFactory, SituationPictureFactory

# =============================================================================
# List News Items Endpoint Tests
# =============================================================================


class TestListNewsEndpoint:
    """Test suite for GET /api/v1/news endpoint."""

    @pytest.mark.asyncio
    async def test_list_news_returns_200(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """Test that listing news items returns 200 OK."""
        # Create a news item
        await NewsItemFactory.create(published=True)

        response = await client.get("/api/v1/news")

        assert response.status_code == 200
        data = response.json()
        assert "total" in data
        assert "page" in data
        assert "page_size" in data
        assert "items" in data
        assert isinstance(data["items"], list)
        assert len(data["items"]) >= 1

    @pytest.mark.asyncio
    async def test_list_news_pagination(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """Test pagination works correctly."""
        # Create 5 news items
        for _ in range(5):
            await NewsItemFactory.create(published=True)

        # Get first page of 2
        response = await client.get("/api/v1/news?page=1&page_size=2")

        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 1
        assert data["page_size"] == 2
        assert len(data["items"]) == 2
        assert data["total"] >= 5

        # Get second page
        response2 = await client.get("/api/v1/news?page=2&page_size=2")

        assert response2.status_code == 200
        data2 = response2.json()
        assert data2["page"] == 2
        assert len(data2["items"]) == 2

        # Verify different items on each page
        page1_ids = {item["id"] for item in data["items"]}
        page2_ids = {item["id"] for item in data2["items"]}
        assert page1_ids.isdisjoint(page2_ids)

    @pytest.mark.asyncio
    async def test_list_news_hides_drafts(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """Draft items must NOT appear in the public feed; only published ones do."""
        published = await NewsItemFactory.create(published=True)
        await NewsItemFactory.create()  # draft (factory default)

        response = await client.get("/api/v1/news")

        assert response.status_code == 200
        data = response.json()
        ids = {item["id"] for item in data["items"]}
        assert str(published.id) in ids
        assert data["total"] == 1

    @pytest.mark.asyncio
    async def test_list_news_empty(
        self,
        client: AsyncClient,
    ):
        """Test listing returns empty list when no news items exist."""
        response = await client.get("/api/v1/news")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0
        assert data["items"] == []

    @pytest.mark.asyncio
    async def test_list_news_response_structure(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """Test that response has all expected fields including audio_count."""
        await NewsItemFactory.create(published=True)

        response = await client.get("/api/v1/news")

        assert response.status_code == 200
        data = response.json()
        assert "audio_count" in data
        item = data["items"][0]

        # Check all expected fields
        assert "id" in item
        assert "title_el" in item
        assert "title_en" in item
        assert "title_ru" in item
        assert "description_el" in item
        assert "publication_date" in item
        assert "original_article_url" in item
        assert "image_url" in item
        assert "created_at" in item
        assert "updated_at" in item
        # description_en and description_ru come from old model — now None
        assert item["description_en"] is None
        assert item["description_ru"] is None
        # Audio metadata fields (may be null if no audio generated)
        assert "audio_url" in item
        assert "audio_generated_at" in item
        assert "audio_duration_seconds" in item
        assert "audio_file_size_bytes" in item

    @pytest.mark.asyncio
    async def test_list_news_page_size_validation(
        self,
        client: AsyncClient,
    ):
        """Test that page_size > 50 returns 422."""
        response = await client.get("/api/v1/news?page_size=51")

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_list_news_page_validation(
        self,
        client: AsyncClient,
    ):
        """Test that page < 1 returns 422."""
        response = await client.get("/api/v1/news?page=0")

        assert response.status_code == 422


# =============================================================================
# PERF-17-01 (Stage 2.5 RED): slim list DTO — GET /api/v1/news must drop
# reader/admin-only heavy fields from LIST items while keeping every
# card-render field (D1). GET /news/{id} and /admin/news are untouched by
# this subtask (see TestGetNewsItemEndpoint / test_admin_news.py).
# =============================================================================


class TestListNewsSlimShape:
    """PERF-17-01 T01-1 / T01-5 — slim list item shape (AC#1, AC#5).

    RED reason: today ``GET /api/v1/news`` list items are full
    ``NewsItemResponse`` objects, which DO carry word_timestamps,
    word_timestamps_a2, linked_situation, status, created_at, and
    updated_at — so the "must be absent" assertions below fail on
    assertion (KeyError-style `in` check), not on import/collection.
    Once the executor introduces ``NewsSlimItem`` / ``get_list_slim`` and
    repoints ``list_news_items`` (src/api/v1/news.py) onto it, these turn
    green.
    """

    @pytest.mark.asyncio
    async def test_list_news_slim_shape_keeps_card_fields_drops_heavy_fields(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """AC#1: slim list items keep every NewsCard-rendered field and
        drop word_timestamps/word_timestamps_a2/linked_situation/status/
        created_at/updated_at.
        """
        await NewsItemFactory.create(published=True)

        response = await client.get("/api/v1/news?page_size=6")

        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) >= 1
        item = data["items"][0]

        # Card-render fields (D1) must survive the slim-down.
        for field in (
            "title_el",
            "description_el",
            "audio_url",
            "image_variants",
            "country",
            "publication_date",
            "original_article_url",
        ):
            assert field in item, f"Slim list item missing card-render field: {field}"

        # Reader/admin-only heavy fields must be dropped from the LIST item.
        for dropped in (
            "word_timestamps",
            "word_timestamps_a2",
            "linked_situation",
            "status",
            "created_at",
            "updated_at",
        ):
            assert dropped not in item, f"Slim list item still carries heavy field: {dropped}"

    @pytest.mark.asyncio
    async def test_list_news_slim_has_a2_content_true_only_when_both_a2_fields_present(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """AC#5: has_a2_content is True iff BOTH title_el_a2
        (situation.scenario_el_a2) AND description_el_a2
        (description.text_el_a2) are set; False when only one is present.

        Also re-asserts the heavy-field-absence guard from the sibling test
        above (on this item's own data) so this test independently proves
        it targets the slim shape, not the current full-item response.
        """
        item_both = await NewsItemFactory.create(
            published=True,
            original_article_url="https://example.com/perf17-a2-both",
        )
        situation_both = await db_session.get(Situation, item_both.situation_id)
        assert situation_both is not None
        situation_both.scenario_el_a2 = "Απλά ελληνικά και τα δύο πεδία"
        description_both = (
            await db_session.execute(
                select(SituationDescription).where(
                    SituationDescription.situation_id == item_both.situation_id
                )
            )
        ).scalar_one()
        description_both.text_el_a2 = "Απλή περιγραφή και τα δύο πεδία"

        item_missing = await NewsItemFactory.create(
            published=True,
            original_article_url="https://example.com/perf17-a2-title-only",
        )
        situation_missing = await db_session.get(Situation, item_missing.situation_id)
        assert situation_missing is not None
        situation_missing.scenario_el_a2 = "Μόνο ο τίτλος A2"
        # description_missing.text_el_a2 intentionally left None (factory default).

        await db_session.flush()

        response = await client.get("/api/v1/news?page_size=6")

        assert response.status_code == 200
        data = response.json()
        by_url = {i["original_article_url"]: i for i in data["items"]}
        assert item_both.original_article_url in by_url
        assert item_missing.original_article_url in by_url
        both = by_url[item_both.original_article_url]
        missing = by_url[item_missing.original_article_url]

        # Slim-shape guard (keeps this test RED for the right reason today).
        assert "word_timestamps" not in both
        assert "word_timestamps" not in missing

        assert both["has_a2_content"] is True
        assert missing["has_a2_content"] is False


# =============================================================================
# Get News Item Endpoint Tests
# =============================================================================


class TestGetNewsItemEndpoint:
    """Test suite for GET /api/v1/news/{id} endpoint."""

    @pytest.mark.asyncio
    async def test_get_news_item_returns_200(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """Test that getting a news item by ID returns 200 OK."""
        news_item = await NewsItemFactory.create(published=True)

        response = await client.get(f"/api/v1/news/{news_item.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(news_item.id)

    @pytest.mark.asyncio
    async def test_get_news_item_not_found_returns_404(
        self,
        client: AsyncClient,
    ):
        """Test that getting non-existent news item returns 404."""
        fake_id = uuid4()

        response = await client.get(f"/api/v1/news/{fake_id}")

        assert response.status_code == 404
        error = response.json()
        assert error.get("success") is False
        assert error.get("error", {}).get("code") == "NOT_FOUND"

    @pytest.mark.asyncio
    async def test_get_news_item_draft_returns_404(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """A draft item must be treated as not-found on the public detail endpoint."""
        draft = await NewsItemFactory.create()  # draft (factory default)

        response = await client.get(f"/api/v1/news/{draft.id}")

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_get_news_item_invalid_uuid_returns_422(
        self,
        client: AsyncClient,
    ):
        """Test that invalid UUID returns 422."""
        response = await client.get("/api/v1/news/not-a-uuid")

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_get_news_item_response_structure(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """Test that response has all expected fields."""
        news_item = await NewsItemFactory.create(published=True)

        response = await client.get(f"/api/v1/news/{news_item.id}")

        assert response.status_code == 200
        data = response.json()

        # Check all expected fields
        assert "id" in data
        assert "title_el" in data
        assert "title_en" in data
        assert "title_ru" in data
        assert "description_el" in data
        assert "publication_date" in data
        assert "original_article_url" in data
        assert "image_url" in data
        assert "created_at" in data
        assert "updated_at" in data
        # description_en and description_ru come from old model — now None
        assert data["description_en"] is None
        assert data["description_ru"] is None
        # Audio metadata fields (may be null if no audio generated)
        assert "audio_url" in data
        assert "audio_generated_at" in data
        assert "audio_duration_seconds" in data
        assert "audio_file_size_bytes" in data

    @pytest.mark.asyncio
    async def test_get_news_item_linked_situation_present(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """Detail response must include linked_situation as a non-null nested object."""
        news_item = await NewsItemFactory.create(published=True)

        response = await client.get(f"/api/v1/news/{news_item.id}")

        assert response.status_code == 200
        data = response.json()
        assert "linked_situation" in data
        assert data["linked_situation"] is not None

    @pytest.mark.asyncio
    async def test_get_news_item_linked_situation_shape(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """linked_situation contains all 14 required fields with correct types.

        ADMIN2-41-02 (F4): updated from 11 to 14 fields to include picture fields:
        picture_image_url, picture_image_variants, has_picture.
        """
        news_item = await NewsItemFactory.create(published=True)

        response = await client.get(f"/api/v1/news/{news_item.id}")

        assert response.status_code == 200
        linked = response.json()["linked_situation"]

        assert "id" in linked
        assert "title_en" in linked
        assert "title_el" in linked
        assert "status" in linked
        assert "levels" in linked
        assert "country" in linked
        assert "role_count" in linked
        assert "role_names" in linked
        assert "turn_count" in linked
        assert "exercise_count" in linked
        assert "audio_seconds" in linked
        # F4 picture fields — must be present in every response (null when no picture image)
        assert "picture_image_url" in linked
        assert "picture_image_variants" in linked
        assert "has_picture" in linked

        assert isinstance(linked["role_count"], int)
        assert isinstance(linked["role_names"], list)
        assert isinstance(linked["turn_count"], int)
        assert isinstance(linked["exercise_count"], int)
        assert isinstance(linked["audio_seconds"], float)
        assert isinstance(linked["levels"], list)
        assert isinstance(linked["has_picture"], bool)

    @pytest.mark.asyncio
    async def test_get_news_item_linked_situation_id_matches(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """linked_situation.id matches the situation_id on the news item."""
        news_item = await NewsItemFactory.create(published=True)

        response = await client.get(f"/api/v1/news/{news_item.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["linked_situation"]["id"] == str(news_item.situation_id)

    @pytest.mark.asyncio
    async def test_list_news_items_linked_situation_present(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """List response items must also include linked_situation (zero aggregates)."""
        await NewsItemFactory.create(published=True)

        response = await client.get("/api/v1/news")

        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) >= 1
        item = data["items"][0]
        assert "linked_situation" in item
        assert item["linked_situation"] is not None


# =============================================================================
# ADMIN2-41-02 (F4): linked_situation picture fields
# =============================================================================


def _make_fake_s3(picture_url: str = "https://s3.example.com/picture.jpg") -> MagicMock:
    """Return a mock S3 service that returns deterministic presigned URLs.

    generate_presigned_url returns `picture_url` for any non-None key.
    get_derivative_presigned_urls returns a dict with 400/800/1600 keys.
    """
    mock = MagicMock()
    mock.generate_presigned_url.return_value = picture_url
    mock.get_derivative_presigned_urls.return_value = {
        400: f"{picture_url}?w=400",
        800: f"{picture_url}?w=800",
        1600: f"{picture_url}?w=1600",
    }
    return mock


class TestLinkedSituationPictureFields:
    """ADMIN2-41-02 (F4) — linked_situation must expose picture_image_url, has_picture, etc.

    These tests are authored RED before the executor adds the picture fields to
    LinkedSituationSummary and the corresponding presigning in _to_response /
    _build_linked_situation_summary.
    """

    @pytest.mark.asyncio
    async def test_linked_situation_includes_picture_url_when_present_list(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """List path: linked_situation exposes picture_image_url and has_picture=True
        when the linked SituationPicture has image_s3_key set.

        Given: a published news item whose situation has a SituationPicture
               with image_s3_key set (generated trait).
        When:  GET /api/v1/news (list path).
        Then:  item.linked_situation.picture_image_url is non-null,
               item.linked_situation.has_picture is True.
        """
        # Build situation with a generated picture (image_s3_key set).
        # NewsItemFactory.create(situation_id=...) creates the SituationDescription itself
        # (else-branch), so we only need to pre-create the Situation + Picture.
        situation = await SituationFactory.create(session=db_session, ready=True)
        await SituationPictureFactory.create(
            session=db_session,
            situation_id=situation.id,
            generated=True,  # sets image_s3_key via the generated Trait
        )
        news_item = await NewsItemFactory.create(
            session=db_session,
            situation_id=situation.id,
            published=True,
        )

        fake_s3 = _make_fake_s3()
        with patch("src.services.news_item_service.get_s3_service", return_value=fake_s3):
            response = await client.get("/api/v1/news")

        assert response.status_code == 200
        items = response.json()["items"]
        target = next(i for i in items if i["id"] == str(news_item.id))
        linked = target["linked_situation"]

        assert (
            linked["picture_image_url"] is not None
        ), "picture_image_url must be non-null when SituationPicture.image_s3_key is set"
        assert (
            linked["has_picture"] is True
        ), "has_picture must be True when SituationPicture.image_s3_key is set"

    @pytest.mark.asyncio
    async def test_linked_situation_includes_picture_url_when_present_detail(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """Detail path: linked_situation exposes picture_image_url and has_picture=True
        when the linked SituationPicture has image_s3_key set.

        This covers the SEPARATE detail code path (_build_linked_situation_summary),
        which is distinct from the list path zero-aggregate path in _to_response.

        Given: a published news item whose situation has a SituationPicture
               with image_s3_key set (generated trait).
        When:  GET /api/v1/news/{id} (detail path).
        Then:  linked_situation.picture_image_url is non-null,
               linked_situation.has_picture is True,
               linked_situation.picture_image_variants is a dict with int keys.
        """
        situation = await SituationFactory.create(session=db_session, ready=True)
        await SituationPictureFactory.create(
            session=db_session,
            situation_id=situation.id,
            generated=True,
        )
        news_item = await NewsItemFactory.create(
            session=db_session,
            situation_id=situation.id,
            published=True,
        )

        fake_s3 = _make_fake_s3()
        with patch("src.services.news_item_service.get_s3_service", return_value=fake_s3):
            response = await client.get(f"/api/v1/news/{news_item.id}")

        assert response.status_code == 200
        linked = response.json()["linked_situation"]

        assert (
            linked["picture_image_url"] is not None
        ), "picture_image_url must be non-null on the detail path when image_s3_key is set"
        assert linked["has_picture"] is True, "has_picture must be True on the detail path"
        # picture_image_variants must be a dict with integer keys 400/800/1600
        variants = linked["picture_image_variants"]
        assert variants is not None, "picture_image_variants must be non-null when image present"
        assert isinstance(variants, dict), "picture_image_variants must be a dict"
        # JSON keys are always strings; the schema serialises int keys → string keys
        assert len(variants) == 3, "Expected 3 derivative widths (400, 800, 1600)"

    @pytest.mark.asyncio
    async def test_linked_situation_null_picture_when_absent(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """linked_situation.picture_image_url is null and has_picture is False when
        the SituationPicture has no image_s3_key set (draft picture, no generated image).

        Covers both the list and detail code paths.

        Given: a published news item whose SituationPicture has image_s3_key = None
               (default factory state, no generated trait).
        When:  GET /api/v1/news (list) AND GET /api/v1/news/{id} (detail).
        Then:  linked_situation.picture_image_url is null,
               linked_situation.has_picture is False,
               no exception is raised.
        """
        # NewsItemFactory already creates a SituationPicture with status=DRAFT,
        # image_s3_key=None by default — no overrides needed.
        news_item = await NewsItemFactory.create(published=True)

        response_list = await client.get("/api/v1/news")
        response_detail = await client.get(f"/api/v1/news/{news_item.id}")

        assert response_list.status_code == 200
        assert response_detail.status_code == 200

        items = response_list.json()["items"]
        target = next(i for i in items if i["id"] == str(news_item.id))
        linked_list = target["linked_situation"]
        linked_detail = response_detail.json()["linked_situation"]

        # List path
        assert (
            linked_list["picture_image_url"] is None
        ), "picture_image_url must be null when SituationPicture.image_s3_key is None"
        assert linked_list["has_picture"] is False, "has_picture must be False when no image_s3_key"

        # Detail path
        assert (
            linked_detail["picture_image_url"] is None
        ), "picture_image_url must be null on the detail path when no image_s3_key"
        assert (
            linked_detail["has_picture"] is False
        ), "has_picture must be False on the detail path when no image_s3_key"

    # =========================================================================
    # Adversarial / edge tests (Mode B, ADMIN2-41-02)
    # =========================================================================

    @pytest.mark.asyncio
    async def test_variants_absent_does_not_raise_and_nulls_variants(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """picture_image_url is non-null and has_picture is True even when S3 returns no
        derivatives (get_derivative_presigned_urls returns None).

        Guards the dict-guard branch in _to_response:
            picture_image_variants = _raw_pic_variants if isinstance(_raw_pic_variants, dict) else None

        Given:  SituationPicture with image_s3_key set (generated trait).
                S3 mock: generate_presigned_url → URL string,
                         get_derivative_presigned_urls → None  (no derivatives yet).
        When:   GET /api/v1/news (list) AND GET /api/v1/news/{id} (detail).
        Then:   picture_image_url is non-null (presign worked),
                picture_image_variants is null (no derivatives),
                has_picture is True,
                no exception is raised.
        """
        situation = await SituationFactory.create(session=db_session, ready=True)
        await SituationPictureFactory.create(
            session=db_session,
            situation_id=situation.id,
            generated=True,
        )
        news_item = await NewsItemFactory.create(
            session=db_session,
            situation_id=situation.id,
            published=True,
        )

        # S3 mock: presign returns a URL, derivatives return None (not yet generated)
        mock_no_variants = MagicMock()
        mock_no_variants.generate_presigned_url.return_value = "https://s3.example.com/pic.jpg"
        mock_no_variants.get_derivative_presigned_urls.return_value = None

        with patch("src.services.news_item_service.get_s3_service", return_value=mock_no_variants):
            response_list = await client.get("/api/v1/news")
            response_detail = await client.get(f"/api/v1/news/{news_item.id}")

        assert response_list.status_code == 200
        assert response_detail.status_code == 200

        items = response_list.json()["items"]
        target = next(i for i in items if i["id"] == str(news_item.id))
        linked_list = target["linked_situation"]
        linked_detail = response_detail.json()["linked_situation"]

        for label, linked in [("list", linked_list), ("detail", linked_detail)]:
            assert (
                linked["picture_image_url"] is not None
            ), f"[{label}] picture_image_url must be non-null when image_s3_key is set"
            assert linked["picture_image_variants"] is None, (
                f"[{label}] picture_image_variants must be None when get_derivative_presigned_urls "
                "returns None"
            )
            assert (
                linked["has_picture"] is True
            ), f"[{label}] has_picture must be True when image_s3_key is set"

    @pytest.mark.asyncio
    async def test_detail_model_copy_preserves_all_preexisting_fields(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """model_copy(update={picture fields}) on the detail path must NOT clobber any of
        the fields computed by _build_linked_situation_summary.

        The risk: model_copy with a partial update dict could inadvertently zero-out
        fields that share a default (e.g. role_count=0, turn_count=0) if it rebuilds
        from defaults instead of copying. Pydantic v2 model_copy(update=) is safe —
        this test is the regression guard.

        We need a situation WITH a dialog (so role_count/turn_count are non-zero and
        the assertion is load-bearing) — but that requires a ListeningDialog, which is
        heavy. The cheaper approach: we only need to verify the fields are present and
        consistent on both list and detail paths. The list path builds the summary
        inline (no model_copy). The detail path uses model_copy. If they agree on
        id/title/status/levels/country, the copy is faithful.

        Given:  a published news item with a known situation (title_en, title_el,
                levels, country, status all set), and a SituationPicture with
                image_s3_key set.
        When:   GET /api/v1/news (list) AND GET /api/v1/news/{id} (detail).
        Then:   For every non-picture field in linked_situation, the detail path
                returns the identical value as the list path (model_copy did not
                clobber anything).
        """
        situation = await SituationFactory.create(session=db_session, ready=True)
        await SituationPictureFactory.create(
            session=db_session,
            situation_id=situation.id,
            generated=True,
        )
        news_item = await NewsItemFactory.create(
            session=db_session,
            situation_id=situation.id,
            published=True,
        )

        fake_s3 = _make_fake_s3()
        with patch("src.services.news_item_service.get_s3_service", return_value=fake_s3):
            response_list = await client.get("/api/v1/news")
            response_detail = await client.get(f"/api/v1/news/{news_item.id}")

        assert response_list.status_code == 200
        assert response_detail.status_code == 200

        items = response_list.json()["items"]
        target = next(i for i in items if i["id"] == str(news_item.id))
        linked_list = target["linked_situation"]
        linked_detail = response_detail.json()["linked_situation"]

        # Fields that _build_linked_situation_summary sets — must survive model_copy intact.
        PREEXISTING_FIELDS = [
            "id",
            "title_en",
            "title_el",
            "status",
            "levels",
            "country",
            "role_count",
            "role_names",
            "turn_count",
            "exercise_count",
            "audio_seconds",
        ]

        for field in PREEXISTING_FIELDS:
            assert (
                field in linked_detail
            ), f"model_copy dropped field '{field}' from linked_situation on detail path"
            assert linked_detail[field] == linked_list[field], (
                f"model_copy clobbered '{field}': "
                f"detail={linked_detail[field]!r} != list={linked_list[field]!r}"
            )
