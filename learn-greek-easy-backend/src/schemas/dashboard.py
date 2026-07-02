# STUB — PERF-15-01 executor replaces this
"""Dashboard Summary DTO schemas (PERF-15-01).

This is a DELIBERATELY INCOMPLETE stub, authored in Mode A (RED) so that
tests/unit/schemas/test_dashboard_summary_schema.py imports cleanly and fails
on meaningful assertions rather than a collection/import error.

The PERF-15-01 executor replaces this entire module with the real
implementation per the finalized plan:
- WeekHeat.heat must be constrained to exactly 7 entries.
- SlimNews must omit heavy fields (word_timestamps, word_timestamps_a2,
  description_el, linked_situation, audio_url) while carrying the slim set.
- FeedItem must become a proper Field(discriminator="type") union over all
  8 feed item variants (Resume, Review, Situation, WordOfDay, Deck,
  Milestone, News, Quick).
- DashboardSummaryResponse must carry the 5 nullable unwired slots
  (word_of_day, recently_added, review_time_estimate_minutes,
  resume_position, minutes_goal), all defaulting to None.
"""

from datetime import date
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class WeekHeat(BaseModel):
    """STUB: missing the exactly-7 length constraint on `heat`."""

    heat: list[int]
    today_idx: int = 6


class SlimNews(BaseModel):
    """STUB: still carries a heavy field (`word_timestamps`) that the real
    slim DTO must omit.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    situation_id: UUID
    title_el: str
    title_en: str
    title_ru: str
    publication_date: date
    country: str
    audio_duration_seconds: float | None = None
    image_url: str | None = None
    image_variants: dict[int, str] | None = None

    # Heavy field that the real SlimNews must NOT carry — present here only
    # to make the RED assertion fail for the right reason.
    word_timestamps: list | None = None


class NewsFeedItem(BaseModel):
    type: str = "news"
    id: UUID
    news: SlimNews


class DeckFeedItem(BaseModel):
    type: str = "deck"
    id: UUID
    deck_id: UUID


class _FeedItemStub(BaseModel):
    """STUB: generic passthrough, NOT a discriminated union.

    TypeAdapter(FeedItem) validation against this stub returns instances of
    this generic class regardless of `type`, and does not reject invalid
    `type` values — both are intentional RED failures for
    test_feed_item_discriminated_union.
    """

    model_config = ConfigDict(extra="allow")

    type: str
    id: UUID


# STUB: real implementation is
# Annotated[Union[ResumeFeedItem, ReviewFeedItem, SituationFeedItem,
# WordOfDayFeedItem, DeckFeedItem, MilestoneFeedItem, NewsFeedItem,
# QuickFeedItem], Field(discriminator="type")]
FeedItem = _FeedItemStub


class DashboardSummaryResponse(BaseModel):
    """STUB: missing the 5 nullable unwired slots entirely."""

    model_config = ConfigDict(from_attributes=True)


__all__ = [
    "WeekHeat",
    "SlimNews",
    "NewsFeedItem",
    "DeckFeedItem",
    "FeedItem",
    "DashboardSummaryResponse",
]
