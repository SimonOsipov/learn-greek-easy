"""Unit tests for the _deck_cover_variants helper and its population at vocab call sites.

These tests close the coverage gap identified in INFRA-11-03: the 3 pre-authored
schema tests in TestDeckCoverImageVariants prove the field EXISTS on DeckResponse,
but do NOT prove that api/v1/decks.py POPULATES it at the 5 call sites.

This module adds:
1. Direct unit tests of _deck_cover_variants (the helper itself).
2. Endpoint-level population tests at two representative call sites
   (list_decks and get_deck) using the same mocked HTTP stack the existing
   test_decks.py tests use.  These prove that a bug in the wiring
   (e.g. the helper call is removed) would be caught.
"""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from httpx import AsyncClient

from src.db.models import Deck, DeckLevel

# =============================================================================
# 1. Direct tests of _deck_cover_variants helper
# =============================================================================


class TestDeckCoverVariantsHelper:
    """Direct unit tests of the _deck_cover_variants module-level helper.

    These tests import and call the function in isolation, completely
    bypassing the HTTP stack and database.  A bug in the helper body
    (wrong branch, swapped condition, early return) would be caught here.
    """

    @pytest.mark.unit
    def test_helper_returns_dict_when_cover_key_present(self):
        """_deck_cover_variants: deck with cover_image_s3_key returns derivative dict.

        S3 returns {400: "u400", 800: "u800", 1600: "u1600"} →
        helper must return that exact dict unchanged.
        """
        from src.api.v1.decks import _deck_cover_variants

        mock_deck = MagicMock(spec=Deck)
        mock_deck.cover_image_s3_key = "decks/abc/cover.jpg"

        mock_s3 = MagicMock()
        mock_s3.get_derivative_presigned_urls.return_value = {
            400: "u400",
            800: "u800",
            1600: "u1600",
        }

        result = _deck_cover_variants(mock_deck, mock_s3)

        # get_derivative_presigned_urls must have been called with the cover key
        mock_s3.get_derivative_presigned_urls.assert_called_once_with(mock_deck.cover_image_s3_key)
        assert result == {400: "u400", 800: "u800", 1600: "u1600"}

    @pytest.mark.unit
    def test_helper_returns_none_when_no_cover_key(self):
        """_deck_cover_variants: deck with cover_image_s3_key=None returns None.

        S3 must NOT be called when there is no cover key.
        """
        from src.api.v1.decks import _deck_cover_variants

        mock_deck = MagicMock(spec=Deck)
        mock_deck.cover_image_s3_key = None

        mock_s3 = MagicMock()

        result = _deck_cover_variants(mock_deck, mock_s3)

        # S3 should never be touched if there is no cover key
        mock_s3.get_derivative_presigned_urls.assert_not_called()
        assert result is None

    @pytest.mark.unit
    def test_helper_returns_none_when_s3_returns_empty_dict(self):
        """_deck_cover_variants: S3 returns {} (derivatives not yet generated) → None.

        An empty dict means no derivative objects exist yet (PERF-11 backfill pending).
        The helper must normalize {} → None so the schema field is null rather than
        an empty object, which prevents the frontend from rendering a broken srcset.
        """
        from src.api.v1.decks import _deck_cover_variants

        mock_deck = MagicMock(spec=Deck)
        mock_deck.cover_image_s3_key = "decks/abc/cover.jpg"

        mock_s3 = MagicMock()
        mock_s3.get_derivative_presigned_urls.return_value = {}

        result = _deck_cover_variants(mock_deck, mock_s3)

        mock_s3.get_derivative_presigned_urls.assert_called_once()
        assert (
            result is None
        ), "_deck_cover_variants must return None (not {}) when S3 reports no derivatives"


# =============================================================================
# 2. Population tests: endpoint call sites populate cover_image_variants
# =============================================================================


class TestListDecksPopulatesCoverVariants:
    """GET /api/v1/decks: response deck item carries cover_image_variants when set.

    This test drives the real HTTP path (via AsyncClient with mocked repo + S3)
    and asserts the JSON response includes cover_image_variants.
    A bug where _deck_cover_variants is called but its result is not passed to
    DeckResponse, or the call is silently removed, would cause this test to fail.
    """

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_list_decks_response_includes_cover_variants(
        self, client: AsyncClient, auth_headers: dict
    ):
        """list_decks call site: JSON response includes cover_image_variants dict."""
        mock_deck = MagicMock(spec=Deck)
        mock_deck.id = uuid4()
        mock_deck.name_en = "Cover Deck"
        mock_deck.name_el = "Τράπουλα Εξώφυλλο"
        mock_deck.name_ru = "Колода с обложкой"
        mock_deck.description_en = "Has cover"
        mock_deck.description_el = "Έχει εξώφυλλο"
        mock_deck.description_ru = "Есть обложка"
        mock_deck.level = DeckLevel.A1
        mock_deck.is_active = True
        mock_deck.is_premium = False
        mock_deck.cover_image_s3_key = "decks/xyz/cover.jpg"
        mock_deck.created_at = MagicMock()
        mock_deck.updated_at = MagicMock()

        mock_s3 = MagicMock(spec=["generate_presigned_url", "get_derivative_presigned_urls"])
        mock_s3.generate_presigned_url.return_value = "https://cdn.example.com/cover.jpg"
        mock_s3.get_derivative_presigned_urls.return_value = {
            400: "https://cdn.example.com/cover_400w.webp",
            800: "https://cdn.example.com/cover_800w.webp",
            1600: "https://cdn.example.com/cover_1600w.webp",
        }

        with (
            patch("src.api.v1.decks.DeckRepository") as mock_repo_class,
            patch("src.api.v1.decks.get_s3_service", return_value=mock_s3),
        ):
            mock_repo = AsyncMock()
            mock_repo.list_active.return_value = [mock_deck]
            mock_repo.count_active.return_value = 1
            mock_repo.get_batch_card_counts.return_value = {mock_deck.id: 3}
            mock_repo_class.return_value = mock_repo

            response = await client.get("/api/v1/decks", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert len(data["decks"]) == 1

        deck_json = data["decks"][0]
        assert deck_json.get("cover_image_url") == "https://cdn.example.com/cover.jpg"

        variants = deck_json.get("cover_image_variants", "__MISSING__")
        assert (
            variants != "__MISSING__"
        ), "list_decks call site did not populate cover_image_variants in DeckResponse"
        # JSON serializes int keys to strings
        assert variants == {
            "400": "https://cdn.example.com/cover_400w.webp",
            "800": "https://cdn.example.com/cover_800w.webp",
            "1600": "https://cdn.example.com/cover_1600w.webp",
        }, f"Unexpected cover_image_variants value: {variants!r}"

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_list_decks_no_cover_key_variants_is_null(
        self, client: AsyncClient, auth_headers: dict
    ):
        """list_decks call site: JSON response has cover_image_variants=null when no cover."""
        mock_deck = MagicMock(spec=Deck)
        mock_deck.id = uuid4()
        mock_deck.name_en = "No Cover Deck"
        mock_deck.name_el = "Χωρίς Εξώφυλλο"
        mock_deck.name_ru = "Без обложки"
        mock_deck.description_en = None
        mock_deck.description_el = None
        mock_deck.description_ru = None
        mock_deck.level = DeckLevel.B1
        mock_deck.is_active = True
        mock_deck.is_premium = False
        mock_deck.cover_image_s3_key = None  # no cover
        mock_deck.created_at = MagicMock()
        mock_deck.updated_at = MagicMock()

        mock_s3 = MagicMock(spec=["generate_presigned_url", "get_derivative_presigned_urls"])

        with (
            patch("src.api.v1.decks.DeckRepository") as mock_repo_class,
            patch("src.api.v1.decks.get_s3_service", return_value=mock_s3),
        ):
            mock_repo = AsyncMock()
            mock_repo.list_active.return_value = [mock_deck]
            mock_repo.count_active.return_value = 1
            mock_repo.get_batch_card_counts.return_value = {mock_deck.id: 0}
            mock_repo_class.return_value = mock_repo

            response = await client.get("/api/v1/decks", headers=auth_headers)

        assert response.status_code == 200
        deck_json = response.json()["decks"][0]

        assert deck_json.get("cover_image_url") is None
        # Must be None (not omitted and not {})
        assert (
            "cover_image_variants" in deck_json
        ), "cover_image_variants key must be present in DeckResponse even when null"
        assert deck_json["cover_image_variants"] is None


class TestGetDeckPopulatesCoverVariants:
    """GET /api/v1/decks/{id}: DeckDetailResponse carries cover_image_variants."""

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_get_deck_response_includes_cover_variants(
        self, client: AsyncClient, auth_headers: dict
    ):
        """get_deck call site: JSON detail response includes cover_image_variants dict."""
        deck_id = uuid4()

        mock_deck = MagicMock(spec=Deck)
        mock_deck.id = deck_id
        mock_deck.name_en = "Detail Cover Deck"
        mock_deck.name_el = "Λεπτομέρεια Εξώφυλλο"
        mock_deck.name_ru = "Детальная обложка"
        mock_deck.description_en = "Cover detail"
        mock_deck.description_el = "Λεπτομέρεια"
        mock_deck.description_ru = "Детали"
        mock_deck.level = DeckLevel.B2
        mock_deck.is_active = True
        mock_deck.is_premium = False
        mock_deck.owner_id = None  # system deck, accessible to all
        mock_deck.cover_image_s3_key = "decks/detail/cover.jpg"
        mock_deck.created_at = MagicMock()
        mock_deck.updated_at = MagicMock()

        mock_s3 = MagicMock(spec=["generate_presigned_url", "get_derivative_presigned_urls"])
        mock_s3.generate_presigned_url.return_value = "https://cdn.example.com/detail-cover.jpg"
        mock_s3.get_derivative_presigned_urls.return_value = {
            400: "https://cdn.example.com/detail_400w.webp",
            800: "https://cdn.example.com/detail_800w.webp",
            1600: "https://cdn.example.com/detail_1600w.webp",
        }

        with (
            patch("src.api.v1.decks.DeckRepository") as mock_repo_class,
            patch("src.api.v1.decks.get_s3_service", return_value=mock_s3),
        ):
            mock_repo = AsyncMock()
            mock_repo.get.return_value = mock_deck
            mock_repo.count_cards.return_value = 7
            mock_repo_class.return_value = mock_repo

            response = await client.get(f"/api/v1/decks/{deck_id}", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()

        assert data.get("cover_image_url") == "https://cdn.example.com/detail-cover.jpg"

        variants = data.get("cover_image_variants", "__MISSING__")
        assert (
            variants != "__MISSING__"
        ), "get_deck call site did not populate cover_image_variants in DeckDetailResponse"
        assert variants == {
            "400": "https://cdn.example.com/detail_400w.webp",
            "800": "https://cdn.example.com/detail_800w.webp",
            "1600": "https://cdn.example.com/detail_1600w.webp",
        }, f"Unexpected cover_image_variants on DeckDetailResponse: {variants!r}"
