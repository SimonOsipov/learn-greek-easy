"""Acceptance-criteria contract tests for the Dashboard Summary DTO schemas
(PERF-15-01).

Mode A RED tests were authored against a deliberately incomplete stub and
locked the AC contract (AC-1, AC-2 -> then renumbered AC-3, AC-6) that the
PERF-15-01 executor had to satisfy. src/schemas/dashboard.py now implements
that contract; this file (QA Mode B) confirms the AC tests are green and
meaningful, tightens the DashboardSummaryResponse core-field contract (see
TestDashboardSummaryResponse docstring), and adds adversarial/edge coverage
the RED pass didn't include (invalid Literal values, missing required
fields, plain-dict construction, and full discriminated-union round-trips).
"""

from uuid import uuid4

import pytest
from pydantic import TypeAdapter, ValidationError

from src.schemas.dashboard import (
    DashboardDeckSlice,
    DashboardSummaryResponse,
    DeckFeedItem,
    FeedItem,
    MilestoneFeedItem,
    NewsFeedItem,
    QuickFeedItem,
    ResumeFeedItem,
    ReviewFeedItem,
    SituationFeedItem,
    SlimNews,
    SlimSituation,
    StreakSummary,
    TodaySummary,
    WeekHeat,
    WordOfDayFeedItem,
)


def _slim_news_dict() -> dict:
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


def _slim_situation_dict() -> dict:
    return {
        "id": str(uuid4()),
        "scenario_el": "Στον καφέ",
        "scenario_en": "At the coffee shop",
        "scenario_ru": "В кофейне",
        "status": "ready",
        "has_audio": False,
        "has_dialog": False,
        "exercise_total": 3,
        "exercise_completed": 1,
    }


@pytest.mark.unit
class TestDashboardSummaryResponse:
    """AC-6: unwired dashboard summary slots default to null.

    QA (PERF-15-01, Mode B): the executor originally made all 9 "core"
    fields (is_new_user, mastered, today, streak, week_heat, decks, feed,
    whats_new_count, queue_count) optional with zero-value defaults, purely
    so DashboardSummaryResponse() could be constructed with zero args. That
    weakens the response-DTO contract: a buggy PERF-15-02 mapper build that
    forgets to populate e.g. `today` or `streak` would silently serialize a
    zero-value 200 response instead of failing loudly. QA tightened the
    schema so the 9 core fields are required (Field with no default); only
    the 5 unwired slots below (AC-6) default to None. This test now
    constructs DashboardSummaryResponse with a full valid core payload via
    `_valid_kwargs()`, matching the LearnerSituationListItem test pattern
    (tests/unit/schemas/test_learner_situation.py).
    """

    def _valid_kwargs(self, **overrides) -> dict:
        kwargs = dict(
            is_new_user=False,
            mastered=0,
            today=TodaySummary(
                reviews_completed=0,
                cards_due=0,
                daily_goal=10,
                goal_progress_percentage=0.0,
                study_time_seconds=0,
            ),
            streak=StreakSummary(current_streak=0, longest_streak=0),
            week_heat=WeekHeat(heat=[0] * 7),
            decks=[],
            feed=[],
            whats_new_count=0,
            queue_count=0,
        )
        kwargs.update(overrides)
        return kwargs

    def test_summary_unwired_slots_default_null(self):
        resp = DashboardSummaryResponse(**self._valid_kwargs())
        assert resp.word_of_day is None
        assert resp.recently_added is None
        assert resp.review_time_estimate_minutes is None
        assert resp.resume_position is None
        assert resp.minutes_goal is None

    def test_core_fields_required_zero_args_rejected(self):
        """Contract: DashboardSummaryResponse() with no args must fail —
        the 9 core fields are not optional. A mapper that forgets to
        populate one of them must blow up loudly, not ship a zero-value
        200 response."""
        with pytest.raises(ValidationError):
            DashboardSummaryResponse()

    @pytest.mark.parametrize(
        "missing_field",
        [
            "is_new_user",
            "mastered",
            "today",
            "streak",
            "week_heat",
            "decks",
            "feed",
            "whats_new_count",
            "queue_count",
        ],
    )
    def test_core_fields_individually_required(self, missing_field):
        kwargs = self._valid_kwargs()
        del kwargs[missing_field]
        with pytest.raises(ValidationError) as exc_info:
            DashboardSummaryResponse(**kwargs)
        assert missing_field in str(exc_info.value)

    def test_valid_payload_constructs(self):
        resp = DashboardSummaryResponse(**self._valid_kwargs(mastered=42, queue_count=3))
        assert resp.mastered == 42
        assert resp.queue_count == 3
        assert resp.decks == []
        assert resp.feed == []


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

    def test_slim_news_constructs_from_plain_dict(self):
        news = SlimNews(**_slim_news_dict())
        assert news.country == "cyprus"
        assert news.image_variants is None


@pytest.mark.unit
class TestSlimSituation:
    """QA adversarial: SlimSituation must construct from a plain dict so
    the PERF-15-02 mapper (which passes `.value` off the ORM
    SituationStatus enum, per the module docstring) works without a
    from_attributes/ORM object round-trip."""

    def test_slim_situation_constructs_from_plain_dict(self):
        situation = SlimSituation(**_slim_situation_dict())
        assert situation.status == "ready"
        assert situation.has_audio is False
        assert situation.domain is None
        assert situation.description_source_type is None

    def test_slim_situation_status_is_plain_str_not_enum(self):
        """Guards the deliberate str (not SituationStatus enum) typing
        documented in the module docstring — the mapper passes `.value`."""
        situation = SlimSituation(**_slim_situation_dict())
        assert isinstance(situation.status, str)
        assert not hasattr(situation.status, "value")


@pytest.mark.unit
class TestFeedItemDiscriminatedUnion:
    """AC-1: FeedItem is a Field(discriminator="type") union over feed variants."""

    def test_feed_item_discriminated_union(self):
        adapter = TypeAdapter(FeedItem)

        news_dict = {
            "type": "news",
            "id": str(uuid4()),
            "news": _slim_news_dict(),
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

    def test_feed_item_situation_variant_round_trips(self):
        adapter = TypeAdapter(FeedItem)
        situation_dict = {
            "type": "situation",
            "id": str(uuid4()),
            "situation": _slim_situation_dict(),
        }
        parsed = adapter.validate_python(situation_dict)
        assert isinstance(parsed, SituationFeedItem)
        assert isinstance(parsed.situation, SlimSituation)
        assert parsed.situation.status == "ready"

    @pytest.mark.parametrize(
        "type_value,payload_extra,expected_cls",
        [
            (
                "resume",
                {"deck_id": str(uuid4()), "sibling_deck_ids": [str(uuid4())]},
                ResumeFeedItem,
            ),
            (
                "review",
                {"cards_due": 5, "due_deck_ids": [str(uuid4())]},
                ReviewFeedItem,
            ),
            ("word_of_day", {}, WordOfDayFeedItem),
            ("deck", {"deck_id": str(uuid4())}, DeckFeedItem),
            (
                "milestone",
                {"current_streak": 3, "longest_streak": 10},
                MilestoneFeedItem,
            ),
            ("quick", {"queue_count": 2}, QuickFeedItem),
        ],
    )
    def test_feed_item_all_remaining_variants_round_trip(
        self, type_value, payload_extra, expected_cls
    ):
        """Whole-union sweep: every discriminator value in the FeedItem
        Union must resolve to its matching variant class, not just the
        news/deck/situation spot checks above. Catches a future variant
        added to the Union list without a matching "type" Literal wiring
        the discriminator correctly."""
        adapter = TypeAdapter(FeedItem)
        payload = {"type": type_value, "id": str(uuid4()), **payload_extra}
        parsed = adapter.validate_python(payload)
        assert isinstance(parsed, expected_cls)
        assert parsed.type == type_value

    def test_feed_item_missing_type_rejected(self):
        adapter = TypeAdapter(FeedItem)
        with pytest.raises(ValidationError):
            adapter.validate_python({"id": str(uuid4()), "deck_id": str(uuid4())})


@pytest.mark.unit
class TestWeekHeat:
    """AC-1 (renumbered AC-3 in the finalized plan): WeekHeat.heat is
    constrained to exactly 7 entries."""

    def test_week_heat_rejects_six_entries(self):
        with pytest.raises(ValidationError):
            WeekHeat(heat=[0] * 6)

    def test_week_heat_rejects_eight_entries(self):
        with pytest.raises(ValidationError):
            WeekHeat(heat=[0] * 8)

    def test_week_heat_accepts_seven_entries(self):
        heat = WeekHeat(heat=[0] * 7)
        assert heat.today_idx == 6


@pytest.mark.unit
class TestDashboardDeckSlice:
    """QA adversarial: DashboardDeckSlice.status is a closed Literal set —
    a mapper bug that leaks an unexpected status string must fail
    validation, not silently ship a bad value to the frontend."""

    def _valid_kwargs(self, **overrides) -> dict:
        kwargs = dict(
            deck_id=uuid4(),
            level="A1",
            is_premium=False,
            card_count=10,
            status="in-progress",
            cards_total=10,
            cards_new=2,
            cards_learning=3,
            cards_review=4,
            cards_mastered=1,
            due_today=5,
            completion_pct=10,
            mastery_pct=10.0,
        )
        kwargs.update(overrides)
        return kwargs

    def test_status_accepts_known_literal_values(self):
        for status in ("not-started", "in-progress", "completed"):
            slice_ = DashboardDeckSlice(**self._valid_kwargs(status=status))
            assert slice_.status == status

    def test_status_rejects_value_outside_literal_set(self):
        with pytest.raises(ValidationError):
            DashboardDeckSlice(**self._valid_kwargs(status="mastered"))
