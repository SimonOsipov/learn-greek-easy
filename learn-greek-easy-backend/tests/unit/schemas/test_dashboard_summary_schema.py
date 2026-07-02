"""Acceptance-criteria contract tests for the Dashboard Summary DTO schemas
(PERF-15-01).

Mode A (RED): src/schemas/dashboard.py is a deliberately incomplete stub at
this point — these tests lock the AC contract that the PERF-15-01 executor
must satisfy in Stage 3. Do not weaken these assertions to make them pass;
the executor replaces the stub, not this file.
"""

from uuid import uuid4

import pytest
from pydantic import TypeAdapter, ValidationError

from src.schemas.dashboard import (
    DashboardSummaryResponse,
    DeckFeedItem,
    FeedItem,
    NewsFeedItem,
    SlimNews,
    WeekHeat,
)


@pytest.mark.unit
class TestDashboardSummaryResponse:
    """AC-6: unwired dashboard summary slots default to null."""

    def test_summary_unwired_slots_default_null(self):
        resp = DashboardSummaryResponse()
        assert resp.word_of_day is None
        assert resp.recently_added is None
        assert resp.review_time_estimate_minutes is None
        assert resp.resume_position is None
        assert resp.minutes_goal is None


@pytest.mark.unit
class TestSlimNews:
    """AC-3: SlimNews carries only the slim field set, omitting heavy fields."""

    def test_slim_news_omits_heavy_fields(self):
        field_names = set(SlimNews.model_fields.keys())

        forbidden = {
            "word_timestamps",
            "word_timestamps_a2",
            "description_el",
            "linked_situation",
            "audio_url",
        }
        leaked = field_names & forbidden
        assert not leaked, f"SlimNews must not carry heavy fields, but found: {leaked}"

        carried = {
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
        }
        missing = carried - field_names
        assert not missing, f"SlimNews is missing carried fields: {missing}"


@pytest.mark.unit
class TestFeedItemDiscriminatedUnion:
    """AC-1: FeedItem is a Field(discriminator="type") union over feed variants."""

    def _slim_news_dict(self) -> dict:
        return {
            "id": str(uuid4()),
            "situation_id": str(uuid4()),
            "title_el": "Τίτλος",
            "title_en": "Title",
            "title_ru": "Заголовок",
            "publication_date": "2026-01-01",
            "country": "cyprus",
            "audio_duration_seconds": 30.0,
            "image_url": "https://example.com/a.jpg",
            "image_variants": None,
        }

    def test_feed_item_discriminated_union(self):
        adapter = TypeAdapter(FeedItem)

        news_dict = {
            "type": "news",
            "id": str(uuid4()),
            "news": self._slim_news_dict(),
        }
        parsed_news = adapter.validate_python(news_dict)
        assert isinstance(
            parsed_news, NewsFeedItem
        ), f"Expected NewsFeedItem, got {type(parsed_news).__name__}"

        deck_dict = {"type": "deck", "id": str(uuid4()), "deck_id": str(uuid4())}
        parsed_deck = adapter.validate_python(deck_dict)
        assert isinstance(
            parsed_deck, DeckFeedItem
        ), f"Expected DeckFeedItem, got {type(parsed_deck).__name__}"

        with pytest.raises(ValidationError):
            adapter.validate_python({"type": "bogus", "id": str(uuid4())})


@pytest.mark.unit
class TestWeekHeat:
    """AC-1: WeekHeat.heat is constrained to exactly 7 entries."""

    def test_week_heat_length_enforced(self):
        with pytest.raises(ValidationError):
            WeekHeat(heat=[0] * 6)

        heat = WeekHeat(heat=[0] * 7)
        assert heat.today_idx == 6
