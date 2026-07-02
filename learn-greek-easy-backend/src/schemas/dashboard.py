"""Dashboard Summary DTO schemas (PERF-15-01).

DTOs for the single `/dashboard/summary` endpoint that replaces eight
separate dashboard calls (PERF-15). These schemas compose data already
fetched by existing repositories/services (deck listings, situations,
news, gamification) into one response payload.

Design notes (see the PERF-15 finalized plan for the full rationale):
- `SlimNews` deliberately omits heavy fields (`word_timestamps`,
  `word_timestamps_a2`, `description_el`, `linked_situation`, `audio_url`)
  that the full news DTOs carry — the dashboard feed only needs enough to
  render a card, not the full reader payload.
- `SlimSituation` mirrors `LearnerSituationListItem`
  (src/schemas/learner_situation.py) field-for-field. `status` is typed as
  `str` here (rather than the `SituationStatus` enum used upstream) so the
  schema can be constructed directly from a plain dict in tests; the
  PERF-15-02 mapper passes `.value` when building it from the ORM enum.
- `FeedItem` is an ordered, data-only discriminated union (discriminator
  "type") over the 8 feed variants, following the `FrontContent` union
  precedent in src/schemas/card_record.py.
- `DashboardSummaryResponse` carries 5 nullable "unwired" slots
  (`word_of_day`, `recently_added`, `review_time_estimate_minutes`,
  `resume_position`, `minutes_goal`) that are part of the DTO contract but
  not populated by any endpoint yet (AC-6) — each defaults to `None` and is
  documented below; a later story wires them.
"""

from datetime import date, datetime
from typing import TYPE_CHECKING, Annotated, Literal, Union
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

if TYPE_CHECKING:
    from src.schemas.news_item import NewsItemResponse


class WeekHeat(BaseModel):
    """Last-7-days study-activity heat strip."""

    heat: list[int] = Field(
        ...,
        min_length=7,
        max_length=7,
        description="Bucketed activity intensity per day (0-5), oldest to newest.",
    )
    today_idx: int = 6


class TodaySummary(BaseModel):
    """Today's study progress against the daily goal."""

    reviews_completed: int
    cards_due: int
    daily_goal: int
    goal_progress_percentage: float
    study_time_seconds: int


class StreakSummary(BaseModel):
    """Current and longest study streaks."""

    current_streak: int
    longest_streak: int


class DashboardDeckSlice(BaseModel):
    """Per-deck summary for the dashboard deck strip/list."""

    model_config = ConfigDict(from_attributes=True)

    deck_id: UUID
    name_el: str | None = None
    name_en: str | None = None
    name_ru: str | None = None
    level: str
    is_premium: bool
    category: str = "vocabulary"
    # Word-entry count for the deck. Sourced from
    # DeckRepository.get_batch_card_counts(deck_ids) — NOT a Deck ORM
    # attribute, so this must be assembled by the mapper, not read
    # from_attributes off the Deck model directly.
    card_count: int
    cover_image_url: str | None = None
    cover_image_variants: dict[int, str] | None = None
    status: Literal["not-started", "in-progress", "completed"]
    cards_total: int
    cards_new: int
    cards_learning: int
    cards_review: int
    cards_mastered: int
    due_today: int
    completion_pct: int
    mastery_pct: float
    last_studied_at: datetime | None = None


class SlimNews(BaseModel):
    """Slim news DTO for the dashboard feed — card-rendering fields only.

    Deliberately omits the heavy fields carried by the full news DTOs:
    word_timestamps, word_timestamps_a2, description_el, linked_situation,
    audio_url.
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

    @classmethod
    def from_full(cls, full: "NewsItemResponse") -> "SlimNews":
        """Map a full ``NewsItemResponse`` onto this slim dashboard-feed DTO.

        Carries only the card-rendering fields (id/situation_id/title_*/
        publication_date/country/audio_duration_seconds/image_url/
        image_variants); drops the heavy reader-only fields per the class
        docstring.
        """
        return cls(
            id=full.id,
            situation_id=full.situation_id,
            title_el=full.title_el,
            title_en=full.title_en,
            title_ru=full.title_ru,
            publication_date=full.publication_date,
            country=full.country,
            audio_duration_seconds=full.audio_duration_seconds,
            image_url=full.image_url,
            image_variants=full.image_variants,
        )


class SlimSituation(BaseModel):
    """Slim situation DTO for the dashboard feed.

    Field-for-field mirror of LearnerSituationListItem
    (src/schemas/learner_situation.py:32). `status` is typed `str` here
    (LearnerSituationListItem types it as the `SituationStatus` enum) so
    this schema is constructible from a plain dict in tests; the
    PERF-15-02 mapper passes `.value` when building it from the ORM enum.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    scenario_el: str
    scenario_en: str
    scenario_ru: str
    status: str
    has_audio: bool
    has_dialog: bool
    exercise_total: int
    exercise_completed: int
    source_image_url: str | None = None
    domain: str | None = None
    description_source_type: str | None = None


class WordOfDay(BaseModel):
    """Unwired — reserved for a future word-of-the-day feature (PERF-15)."""

    lemma: str
    translation: str


class RecentlyAdded(BaseModel):
    """Unwired — reserved for future "what's new" counters (PERF-15)."""

    news_count: int | None = None
    audio_count: int | None = None


# ============================================================================
# Feed item variants — ordered, data-only, discriminated on `type`.
# Precedent: FrontContent discriminated union, src/schemas/card_record.py:167-179.
# ============================================================================


class ResumeFeedItem(BaseModel):
    type: Literal["resume"]
    id: str
    deck_id: UUID
    sibling_deck_ids: list[UUID]


class ReviewFeedItem(BaseModel):
    type: Literal["review"]
    id: str
    cards_due: int
    due_deck_ids: list[UUID]


class SituationFeedItem(BaseModel):
    type: Literal["situation"]
    id: str
    situation: SlimSituation


class WordOfDayFeedItem(BaseModel):
    type: Literal["word_of_day"]
    id: str


class DeckFeedItem(BaseModel):
    type: Literal["deck"]
    id: str
    deck_id: UUID


class MilestoneFeedItem(BaseModel):
    type: Literal["milestone"]
    id: str
    current_streak: int
    longest_streak: int


class NewsFeedItem(BaseModel):
    type: Literal["news"]
    id: str
    news: SlimNews


class QuickFeedItem(BaseModel):
    type: Literal["quick"]
    id: str
    queue_count: int


FeedItem = Annotated[
    Union[
        ResumeFeedItem,
        ReviewFeedItem,
        SituationFeedItem,
        WordOfDayFeedItem,
        DeckFeedItem,
        MilestoneFeedItem,
        NewsFeedItem,
        QuickFeedItem,
    ],
    Field(discriminator="type"),
]


class DashboardSummaryResponse(BaseModel):
    """Composed payload for GET /dashboard/summary — replaces eight
    separate dashboard calls with one session/one Redis entry (TTL 60s).

    The 9 "core" fields below are REQUIRED: the PERF-15-02 mapper must
    always supply real values for them, so a buggy build that omits one
    fails schema validation loudly instead of serializing a silently
    malformed 200 response. Only the 5 unwired slots (AC-6) default to
    `None`.
    """

    model_config = ConfigDict(from_attributes=True)

    is_new_user: bool
    mastered: int
    today: TodaySummary
    streak: StreakSummary
    week_heat: WeekHeat
    decks: list[DashboardDeckSlice]
    feed: list[FeedItem]
    whats_new_count: int
    queue_count: int

    # Unwired nullable slots (AC-6): part of the DTO contract, not
    # populated by any endpoint yet. Each defaults to None; a later story
    # wires the producing logic.
    word_of_day: WordOfDay | None = Field(
        default=None,
        description="reserved — wired later, see PERF-15",
    )
    recently_added: RecentlyAdded | None = Field(
        default=None,
        description="reserved — wired later, see PERF-15",
    )
    review_time_estimate_minutes: int | None = Field(
        default=None,
        description="reserved — wired later, see PERF-15",
    )
    resume_position: int | None = Field(
        default=None,
        description="reserved — wired later, see PERF-15",
    )
    minutes_goal: int | None = Field(
        default=None,
        description="reserved — wired later, see PERF-15",
    )


__all__ = [
    "WeekHeat",
    "TodaySummary",
    "StreakSummary",
    "DashboardDeckSlice",
    "SlimNews",
    "SlimSituation",
    "WordOfDay",
    "RecentlyAdded",
    "ResumeFeedItem",
    "ReviewFeedItem",
    "SituationFeedItem",
    "WordOfDayFeedItem",
    "DeckFeedItem",
    "MilestoneFeedItem",
    "NewsFeedItem",
    "QuickFeedItem",
    "FeedItem",
    "DashboardSummaryResponse",
]
