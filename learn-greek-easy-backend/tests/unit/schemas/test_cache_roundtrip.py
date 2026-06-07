"""PERF-05-06 Gap 1 — JSON round-trip equality goldens for cached response models.

Tests that the three response types that flow through the Redis cache survive
model_dump(mode="json") → model_validate() without data loss.  These are the
models actually cached by the PERF-05 caching layer:

  - DashboardStatsResponse   (progress_service.get_dashboard_stats)
  - DeckProgressListResponse (progress_service.get_deck_progress_list)
  - DeckListResponse         (decks.list_decks)

Risk fields: datetime, date, UUID, Literal enum — types that JSON round-trips
can silently corrupt (e.g. datetime → str, UUID → str, enum → str).

TTL-expiry note
---------------
A real TTL-expiry integration test would need fakeredis or time-travel, neither
of which is a project dependency (pyproject.toml has no fakeredis).  The
existing miss tests in test_progress_service.py and test_decks_list_cache.py
already assert that the correct TTL integer is passed to redis.setex() — that
is the only application-owned behaviour to assert.  The actual expiry is Redis
behaviour and is not ours to test.
"""

from datetime import date, datetime, timezone
from uuid import uuid4

import pytest

from src.db.models import DeckLevel
from src.schemas.deck import DeckListResponse, DeckResponse
from src.schemas.progress import (
    DashboardStatsResponse,
    DeckProgressListResponse,
    DeckProgressSummary,
    OverviewStats,
    RecentActivity,
    StreakStats,
    TodayStats,
)

# ---------------------------------------------------------------------------
# Helpers — build realistic populated instances
# ---------------------------------------------------------------------------


def _make_dashboard_stats() -> DashboardStatsResponse:
    """Build a realistic DashboardStatsResponse with non-zero/non-null fields."""
    return DashboardStatsResponse(
        overview=OverviewStats(
            total_cards_studied=123,
            total_cards_mastered=45,
            total_decks_started=7,
            overall_mastery_percentage=36.59,
            accuracy_percentage=78.5,
            culture_questions_mastered=12,
            total_study_time_seconds=7200,
            culture_weekly_study_time_seconds=540,
        ),
        today=TodayStats(
            reviews_completed=20,
            cards_due=5,
            daily_goal=30,
            goal_progress_percentage=66.67,
            study_time_seconds=1800,
        ),
        streak=StreakStats(
            current_streak=14,
            longest_streak=30,
            last_study_date=date(2026, 6, 6),  # date field — round-trip risk
            vocabulary_current_streak=14,
            vocabulary_longest_streak=30,
            culture_current_streak=3,
            culture_longest_streak=5,
            exercise_current_streak=1,
            exercise_longest_streak=7,
        ),
        cards_by_status={"new": 10, "learning": 5, "review": 8, "mastered": 45, "due": 2},
        recent_activity=[
            RecentActivity(
                date=date(2026, 6, 5),  # date field — round-trip risk
                reviews_count=25,
                average_quality=3.8,
            ),
            RecentActivity(
                date=date(2026, 6, 6),
                reviews_count=20,
                average_quality=4.1,
            ),
        ],
    )


def _make_deck_progress_list() -> DeckProgressListResponse:
    """Build a realistic DeckProgressListResponse with non-trivial fields."""
    last_studied = datetime(2026, 6, 6, 10, 30, 0, tzinfo=timezone.utc)  # datetime + tz
    deck_id = uuid4()  # UUID — round-trip risk
    return DeckProgressListResponse(
        total=2,
        page=1,
        page_size=20,
        decks=[
            DeckProgressSummary(
                deck_id=deck_id,  # UUID field
                deck_name="Greek A1 Vocabulary",
                deck_level="A1",
                total_cards=100,
                cards_studied=60,
                cards_mastered=20,
                cards_due=5,
                mastery_percentage=33.33,
                completion_percentage=60.0,
                last_studied_at=last_studied,  # tz-aware datetime — round-trip risk
                average_easiness_factor=2.5,
                estimated_review_time_minutes=10,
                deck_type="vocabulary",  # Literal enum — round-trip risk
            ),
            DeckProgressSummary(
                deck_id=uuid4(),
                deck_name="Greek Culture",
                deck_level="B1",
                total_cards=40,
                cards_studied=0,
                cards_mastered=0,
                cards_due=0,
                mastery_percentage=0.0,
                completion_percentage=0.0,
                last_studied_at=None,  # Optional datetime — None must survive
                average_easiness_factor=None,
                estimated_review_time_minutes=0,
                deck_type="culture",
            ),
        ],
    )


def _make_deck_list_response() -> DeckListResponse:
    """Build a realistic DeckListResponse with non-trivial fields."""
    now = datetime(2026, 6, 7, 8, 0, 0, tzinfo=timezone.utc)  # tz-aware datetime
    deck_id = uuid4()  # UUID
    return DeckListResponse(
        total=1,
        page=1,
        page_size=20,
        decks=[
            DeckResponse(
                id=deck_id,  # UUID field — round-trip risk
                name="Greek A1 Vocabulary",
                description="Basic Greek words",
                name_el="Ελληνικά Α1",
                name_en="Greek A1",
                name_ru="Греческий А1",
                description_el=None,
                description_en=None,
                description_ru=None,
                level=DeckLevel.A1,  # Enum — round-trip risk
                is_active=True,
                is_premium=False,
                card_count=50,
                created_at=now,  # datetime — round-trip risk
                updated_at=now,
                cover_image_url="https://example.com/cover.jpg",
            )
        ],
    )


# ---------------------------------------------------------------------------
# Round-trip tests
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestCacheJsonRoundtrip:
    """PERF-05-06 plan item 1 — model_dump/model_validate round-trip equality.

    Each test confirms that serialising through the Redis cache wire format
    (model_dump mode='json') and deserialising back (model_validate) is
    lossless.  If Pydantic or a custom serialiser drops a field or mutates
    a type, equality fails.
    """

    def test_dashboard_stats_response_json_roundtrip(self):
        """DashboardStatsResponse survives a JSON round-trip losslessly.

        Covers: date (last_study_date, recent_activity[].date), Literal,
        Optional[date], nested models, dict[str, int].
        """
        orig = _make_dashboard_stats()
        serialised = orig.model_dump(mode="json")
        restored = DashboardStatsResponse.model_validate(serialised)

        assert restored == orig, f"Round-trip mismatch.\norig:     {orig!r}\nrestored: {restored!r}"

    def test_deck_progress_list_response_json_roundtrip(self):
        """DeckProgressListResponse survives a JSON round-trip losslessly.

        Covers: UUID (deck_id), tz-aware datetime (last_studied_at),
        Optional[datetime] = None, Literal ('vocabulary'/'culture'),
        Optional[float] = None.
        """
        orig = _make_deck_progress_list()
        serialised = orig.model_dump(mode="json")
        restored = DeckProgressListResponse.model_validate(serialised)

        assert restored == orig, f"Round-trip mismatch.\norig:     {orig!r}\nrestored: {restored!r}"

    def test_deck_list_response_json_roundtrip(self):
        """DeckListResponse survives a JSON round-trip losslessly.

        Covers: UUID (id), DeckLevel enum, tz-aware datetime (created_at,
        updated_at), Optional[str] = None.
        """
        orig = _make_deck_list_response()
        serialised = orig.model_dump(mode="json")
        restored = DeckListResponse.model_validate(serialised)

        assert restored == orig, f"Round-trip mismatch.\norig:     {orig!r}\nrestored: {restored!r}"
