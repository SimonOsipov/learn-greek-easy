"""RED tests for SIT-27-04: SituationComprehensionService.

Mode A — authored RED before implementation (RALPH Stage 2.5 / QA Mode A).

These tests cover the aggregation business logic of the net-new
``SituationComprehensionService`` (does not exist yet):
  AC-1  Per-situation counts (to_practice / in_review / mastered / audio)
  AC-2  Overview returns overall comprehension % + verdict (from shared thresholds)
  AC-3  Per-topic confidence bars with null accuracy when no attempts
  AC-4  Overview streak == global compute_exercise_streak value
  AC-5  Recent sessions capped at 5, ordered newest-first

WHY THESE ARE RED
-----------------
``src/services/situation_comprehension_service.py`` does not exist.  The
import below raises ImportError which is re-raised from every test via
``_call_*`` helpers, producing ERROR (not PASS) — RED for the right reason.

If the executor creates a stub module (recommended) the tests will fail with
NotImplementedError instead, which is also the right reason.

REUSE CONTRACT VERIFIED
-----------------------
- ReadinessConstants: WEIGHT_LEARNING=0.25, WEIGHT_REVIEW=0.5, WEIGHT_MASTERED=1.0
  VERDICT_THRESHOLDS: (85,"thoroughly_prepared"), (60,"ready"),
                       (40,"getting_there"), (0,"not_ready")
  Source: src/constants.py:ReadinessConstants (confirmed lines 98-113)
- compute_exercise_streak: src/services/gamification/streak.py:179
  Signature: async def compute_exercise_streak(db, user_id) -> int

WEIGHT MATHS USED IN TESTS
---------------------------
  comprehension% = sum(weight[stage] for each exercise) / total_exercises * 100

  test_per_topic_weighting_uses_stage_weights:
    2 exercises: 1 MASTERED (weight 1.0) + 1 LEARNING (weight 0.25)
    comprehension% = (1.0 + 0.25) / 2 * 100 = 62.5 → rounded to 62 or 63

  test_overview_verdict_from_shared_thresholds:
    comprehension = 62% → 60 ≤ 62 < 85 → verdict = "ready"

  test_per_situation_counts_partition_by_status:
    to_practice = NEW count (status == NEW)
    in_review   = LEARNING + REVIEW counts
    mastered    = MASTERED count
    Seeded: 1 NEW + 1 LEARNING + 1 REVIEW + 1 MASTERED
    → to_practice=1, in_review=2, mastered=1
"""

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.constants import ReadinessConstants
from src.db.models import CardStatus, ExerciseModality, ExerciseSourceType
from tests.factories import (
    DescriptionExerciseFactory,
    DescriptionExerciseItemFactory,
    ExerciseFactory,
    ExerciseRecordFactory,
    ExerciseReviewFactory,
    SituationDescriptionFactory,
    SituationFactory,
)

# ---------------------------------------------------------------------------
# Import guard — re-raise at call time so RED is correct
# ---------------------------------------------------------------------------

try:
    from src.services.situation_comprehension_service import SituationComprehensionService

    _IMPORT_OK = True
except (ImportError, ModuleNotFoundError):
    _IMPORT_OK = False
    SituationComprehensionService = None  # type: ignore[assignment,misc]


def _get_service(db) -> "SituationComprehensionService":  # type: ignore[type-arg]
    if not _IMPORT_OK:
        raise ImportError(
            "src.services.situation_comprehension_service does not exist yet. "
            "Executor must create it as part of SIT-27-04."
        )
    return SituationComprehensionService(db)  # type: ignore[misc]


# Shorthand for ReadinessConstants values — lets tests read the actual
# constants rather than hard-coding them so they stay green after refactoring.
_W_LEARNING = ReadinessConstants.WEIGHT_LEARNING  # 0.25
_W_REVIEW = ReadinessConstants.WEIGHT_REVIEW  # 0.5
_W_MASTERED = ReadinessConstants.WEIGHT_MASTERED  # 1.0


# ===========================================================================
# AC-1: Per-situation counts
# ===========================================================================


@pytest.mark.unit
class TestPerSituationCounts:
    """AC-1 — to_practice / in_review / mastered / audio counts."""

    @pytest.mark.asyncio
    async def test_per_situation_counts_partition_by_status(
        self,
        db_session: AsyncSession,
        test_user,
    ) -> None:
        """GIVEN user with 1 NEW, 1 LEARNING, 1 REVIEW, 1 MASTERED ExerciseRecord
                 on exercises linked to one situation
        WHEN  fetch per-situation stats
        THEN  to_practice=1, in_review=2, mastered=1

        Status partition:
          to_practice = NEW
          in_review   = LEARNING + REVIEW
          mastered    = MASTERED

        RED: SituationComprehensionService does not exist yet.
        """
        situation = await SituationFactory.create(session=db_session, ready=True)
        desc = await SituationDescriptionFactory.create(
            session=db_session, situation_id=situation.id
        )

        # 4 exercises with different statuses
        for status in [
            CardStatus.NEW,
            CardStatus.LEARNING,
            CardStatus.REVIEW,
            CardStatus.MASTERED,
        ]:
            de = await DescriptionExerciseFactory.create(
                session=db_session, description_id=desc.id, approved=True
            )
            de.modality = ExerciseModality.READING
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

        service = _get_service(db_session)
        stats = await service.get_per_situation_stats(
            situation_id=situation.id, user_id=test_user.id
        )

        assert (
            stats.to_practice == 1
        ), f"to_practice should be 1 (NEW count), got {stats.to_practice}"
        assert (
            stats.in_review == 2
        ), f"in_review should be 2 (LEARNING + REVIEW), got {stats.in_review}"
        assert stats.mastered == 1, f"mastered should be 1 (MASTERED count), got {stats.mastered}"

    @pytest.mark.asyncio
    async def test_audio_count_counts_audio_bearing_exercises(
        self,
        db_session: AsyncSession,
        test_user,
    ) -> None:
        """GIVEN a situation with 1 LISTENING + 1 READING exercise
        WHEN  fetch per-situation stats
        THEN  audio == 1 (only the LISTENING/audio-bearing exercise counts)

        Audio-bearing = exercises with modality LISTENING (they have
        description_audio_url in the description).

        RED: SituationComprehensionService does not exist yet.
        """
        situation = await SituationFactory.create(session=db_session, ready=True)
        desc = await SituationDescriptionFactory.create(
            session=db_session, situation_id=situation.id
        )

        # LISTENING exercise (audio-bearing)
        de_audio = await DescriptionExerciseFactory.create(
            session=db_session, description_id=desc.id, approved=True
        )
        de_audio.modality = ExerciseModality.LISTENING
        await DescriptionExerciseItemFactory.create(
            session=db_session, description_exercise_id=de_audio.id
        )
        await ExerciseFactory.create(
            session=db_session,
            description_exercise_id=de_audio.id,
            source_type=ExerciseSourceType.DESCRIPTION,
        )

        # READING exercise (not audio-bearing)
        de_read = await DescriptionExerciseFactory.create(
            session=db_session, description_id=desc.id, approved=True
        )
        de_read.modality = ExerciseModality.READING
        await DescriptionExerciseItemFactory.create(
            session=db_session, description_exercise_id=de_read.id
        )
        await ExerciseFactory.create(
            session=db_session,
            description_exercise_id=de_read.id,
            source_type=ExerciseSourceType.DESCRIPTION,
        )

        await db_session.flush()

        service = _get_service(db_session)
        stats = await service.get_per_situation_stats(
            situation_id=situation.id, user_id=test_user.id
        )

        assert (
            stats.audio == 1
        ), f"audio count should be 1 (only LISTENING exercises), got {stats.audio}"

    @pytest.mark.asyncio
    async def test_per_situation_counts_zero_when_no_records(
        self,
        db_session: AsyncSession,
        test_user,
    ) -> None:
        """GIVEN a situation with exercises but the user has no ExerciseRecords
        WHEN  fetch per-situation stats
        THEN  to_practice == total exercises, in_review == 0, mastered == 0

        All exercises are effectively NEW (no record = not started).

        RED: SituationComprehensionService does not exist yet.
        """
        situation = await SituationFactory.create(session=db_session, ready=True)
        desc = await SituationDescriptionFactory.create(
            session=db_session, situation_id=situation.id
        )
        de = await DescriptionExerciseFactory.create(
            session=db_session, description_id=desc.id, approved=True
        )
        de.modality = ExerciseModality.READING
        await DescriptionExerciseItemFactory.create(
            session=db_session, description_exercise_id=de.id
        )
        await ExerciseFactory.create(
            session=db_session,
            description_exercise_id=de.id,
            source_type=ExerciseSourceType.DESCRIPTION,
        )
        await db_session.flush()

        service = _get_service(db_session)
        stats = await service.get_per_situation_stats(
            situation_id=situation.id, user_id=test_user.id
        )

        assert stats.in_review == 0
        assert stats.mastered == 0
        # All unstarted exercises are "to practice"
        assert stats.to_practice >= 1


# ===========================================================================
# AC-2: Overview comprehension % + verdict
# ===========================================================================


@pytest.mark.unit
class TestOverviewComprehensionAndVerdict:
    """AC-2 — overall comprehension % and verdict from shared VERDICT_THRESHOLDS."""

    @pytest.mark.asyncio
    async def test_overview_verdict_from_shared_thresholds(
        self,
        db_session: AsyncSession,
        test_user,
    ) -> None:
        """GIVEN weighted comprehension computes to 62% (1 MASTERED + 1 LEARNING of 2 exercises)
        WHEN  fetch overview
        THEN  verdict == "ready"  (60 ≤ 62 < 85 per VERDICT_THRESHOLDS)

        Comprehension% = (W_MASTERED + W_LEARNING) / 2 * 100
                       = (1.0 + 0.25) / 2 * 100 = 62.5

        Verdict boundary: 60 ≤ 62.5 < 85 → "ready"

        RED: SituationComprehensionService does not exist yet.
        """
        situation = await SituationFactory.create(session=db_session, ready=True)
        desc = await SituationDescriptionFactory.create(
            session=db_session, situation_id=situation.id
        )

        for status in [CardStatus.MASTERED, CardStatus.LEARNING]:
            de = await DescriptionExerciseFactory.create(
                session=db_session, description_id=desc.id, approved=True
            )
            de.modality = ExerciseModality.READING
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

        service = _get_service(db_session)
        overview = await service.get_overview(user_id=test_user.id)

        # Verify % is in the expected range
        expected_pct = (_W_MASTERED + _W_LEARNING) / 2 * 100  # 62.5
        assert (
            abs(overview.comprehension_percentage - expected_pct) < 1.0
        ), f"Expected comprehension% ~{expected_pct:.1f}, got {overview.comprehension_percentage}"

        assert (
            overview.verdict == "ready"
        ), f"Expected verdict 'ready' for ~62.5% comprehension, got {overview.verdict!r}"

    @pytest.mark.asyncio
    async def test_overview_zero_data_is_not_ready_zero_pct(
        self,
        db_session: AsyncSession,
        test_user,
    ) -> None:
        """GIVEN a user with no ExerciseRecords across all situations
        WHEN  fetch overview
        THEN  comprehension_percentage == 0 AND verdict == "not_ready", no error

        Edge case: empty state must not 500 and must produce the lowest verdict.

        RED: SituationComprehensionService does not exist yet.
        """
        service = _get_service(db_session)
        overview = await service.get_overview(user_id=test_user.id)

        assert (
            overview.comprehension_percentage == 0
        ), f"Expected 0% comprehension with no exercise records, got {overview.comprehension_percentage}"
        assert (
            overview.verdict == "not_ready"
        ), f"Expected verdict 'not_ready' at 0%, got {overview.verdict!r}"

    @pytest.mark.asyncio
    async def test_verdict_thoroughly_prepared_at_85_pct(
        self,
        db_session: AsyncSession,
        test_user,
    ) -> None:
        """GIVEN all exercises are MASTERED
        WHEN  fetch overview
        THEN  comprehension_percentage == 100 AND verdict == "thoroughly_prepared"

        Boundary at 85: ≥85 → "thoroughly_prepared".

        RED: SituationComprehensionService does not exist yet.
        """
        situation = await SituationFactory.create(session=db_session, ready=True)
        desc = await SituationDescriptionFactory.create(
            session=db_session, situation_id=situation.id
        )
        de = await DescriptionExerciseFactory.create(
            session=db_session, description_id=desc.id, approved=True
        )
        de.modality = ExerciseModality.READING
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
            status=CardStatus.MASTERED,
        )
        await db_session.flush()

        service = _get_service(db_session)
        overview = await service.get_overview(user_id=test_user.id)

        assert overview.comprehension_percentage == 100.0
        assert overview.verdict == "thoroughly_prepared"


# ===========================================================================
# AC-3: Per-topic confidence — null accuracy when no attempts
# ===========================================================================


@pytest.mark.unit
class TestPerTopicConfidence:
    """AC-3 — per-topic confidence bars; null accuracy when no attempts."""

    @pytest.mark.asyncio
    async def test_per_topic_confidence_null_accuracy_when_no_attempts(
        self,
        db_session: AsyncSession,
        test_user,
    ) -> None:
        """GIVEN a topic with exercises but zero ExerciseReviews
        WHEN  fetch overview
        THEN  that topic's accuracy is null (None / null in JSON)

        Per SIT-27 architecture: "No attempts yet" displayed when accuracy is null.

        RED: SituationComprehensionService does not exist yet.
        """
        situation = await SituationFactory.create(session=db_session, ready=True)
        desc = await SituationDescriptionFactory.create(
            session=db_session, situation_id=situation.id
        )
        de = await DescriptionExerciseFactory.create(
            session=db_session, description_id=desc.id, approved=True
        )
        de.modality = ExerciseModality.READING
        await DescriptionExerciseItemFactory.create(
            session=db_session, description_exercise_id=de.id
        )
        ex = await ExerciseFactory.create(
            session=db_session,
            description_exercise_id=de.id,
            source_type=ExerciseSourceType.DESCRIPTION,
        )
        # ExerciseRecord exists (started but never reviewed) = no ExerciseReview rows
        await ExerciseRecordFactory.create(
            session=db_session,
            user_id=test_user.id,
            exercise_id=ex.id,
            status=CardStatus.NEW,
        )
        # Deliberately no ExerciseReview created
        await db_session.flush()

        service = _get_service(db_session)
        overview = await service.get_overview(user_id=test_user.id)

        # The Reading topic (description+reading) must have null accuracy
        assert hasattr(
            overview, "topic_confidence"
        ), "Overview must have a 'topic_confidence' attribute with per-topic data"
        reading_confidence = None
        for tc in overview.topic_confidence:
            if tc.topic == "Reading":
                reading_confidence = tc
                break

        assert reading_confidence is not None, "Reading topic must appear in topic_confidence"
        assert reading_confidence.accuracy is None, (
            f"Expected accuracy=None (no reviews yet) for Reading topic, "
            f"got {reading_confidence.accuracy!r}"
        )

    @pytest.mark.asyncio
    async def test_per_topic_weighting_uses_stage_weights(
        self,
        db_session: AsyncSession,
        test_user,
    ) -> None:
        """GIVEN a topic with 1 MASTERED + 1 LEARNING of 2 exercises
        WHEN  fetch overview
        THEN  topic confidence% == round((W_MASTERED + W_LEARNING) / 2 * 100)
              reusing ReadinessConstants weights

        Expected: (1.0 + 0.25) / 2 * 100 = 62.5

        RED: SituationComprehensionService does not exist yet.
        """
        situation = await SituationFactory.create(session=db_session, ready=True)
        desc = await SituationDescriptionFactory.create(
            session=db_session, situation_id=situation.id
        )

        for status in [CardStatus.MASTERED, CardStatus.LEARNING]:
            de = await DescriptionExerciseFactory.create(
                session=db_session, description_id=desc.id, approved=True
            )
            de.modality = ExerciseModality.READING
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

        service = _get_service(db_session)
        overview = await service.get_overview(user_id=test_user.id)

        expected_pct = (_W_MASTERED + _W_LEARNING) / 2 * 100  # 62.5

        reading_confidence = None
        for tc in overview.topic_confidence:
            if tc.topic == "Reading":
                reading_confidence = tc
                break

        assert reading_confidence is not None, "Reading topic must appear in topic_confidence"
        assert abs(reading_confidence.confidence_percentage - expected_pct) < 1.0, (
            f"Reading confidence% should be ~{expected_pct:.1f}, "
            f"got {reading_confidence.confidence_percentage}"
        )

    @pytest.mark.asyncio
    async def test_all_four_topics_present_in_overview(
        self,
        db_session: AsyncSession,
        test_user,
    ) -> None:
        """Overview always includes all four topics in topic_confidence.

        Even topics with zero exercises must be present (confidence=0, accuracy=null).

        RED: SituationComprehensionService does not exist yet.
        """
        service = _get_service(db_session)
        overview = await service.get_overview(user_id=test_user.id)

        assert hasattr(
            overview, "topic_confidence"
        ), "Overview must have 'topic_confidence' attribute"
        topic_names = {tc.topic for tc in overview.topic_confidence}
        for expected_topic in ("Listening", "Reading", "Dialogue", "Visual"):
            assert expected_topic in topic_names, (
                f"'{expected_topic}' must always appear in topic_confidence "
                f"(even with 0 exercises). Got topics: {topic_names}"
            )


# ===========================================================================
# AC-4: Streak reuses compute_exercise_streak
# ===========================================================================


@pytest.mark.unit
class TestOverviewStreakReusesGlobal:
    """AC-4 — streak in overview == global compute_exercise_streak."""

    @pytest.mark.asyncio
    async def test_overview_streak_reuses_global_exercise_streak(
        self,
        db_session: AsyncSession,
        test_user,
    ) -> None:
        """GIVEN a user with a known 3-day exercise streak
        WHEN  fetch overview
        THEN  streak == 3 (matches compute_exercise_streak return value)

        This test patches compute_exercise_streak to return 3 so we verify the
        service wires the global streak function rather than computing its own.

        RED: SituationComprehensionService does not exist yet.
        """
        with patch(
            "src.services.gamification.streak.compute_exercise_streak",
            new=AsyncMock(return_value=3),
        ):
            service = _get_service(db_session)
            overview = await service.get_overview(user_id=test_user.id)

        assert hasattr(
            overview, "streak"
        ), "Overview must have a 'streak' field sourced from compute_exercise_streak"
        assert (
            overview.streak == 3
        ), f"Expected streak=3 (from mocked compute_exercise_streak), got {overview.streak}"

    @pytest.mark.asyncio
    async def test_overview_streak_zero_when_no_activity(
        self,
        db_session: AsyncSession,
        test_user,
    ) -> None:
        """GIVEN a user with no exercise activity
        WHEN  fetch overview
        THEN  streak == 0 (not None, not missing)

        RED: SituationComprehensionService does not exist yet.
        """
        with patch(
            "src.services.gamification.streak.compute_exercise_streak",
            new=AsyncMock(return_value=0),
        ):
            service = _get_service(db_session)
            overview = await service.get_overview(user_id=test_user.id)

        assert overview.streak == 0


# ===========================================================================
# AC-5: Recent sessions capped at 5, newest-first
# ===========================================================================


@pytest.mark.unit
class TestRecentSessions:
    """AC-5 — recent sessions are capped at 5 and ordered newest-first."""

    @pytest.mark.asyncio
    async def test_recent_sessions_capped_and_ordered(
        self,
        db_session: AsyncSession,
        test_user,
    ) -> None:
        """GIVEN 7 ExerciseReviews at different timestamps
        WHEN  fetch overview
        THEN  recent_sessions has exactly 5 entries ordered newest-first.

        RED: SituationComprehensionService does not exist yet.
        """
        situation = await SituationFactory.create(session=db_session, ready=True)
        desc = await SituationDescriptionFactory.create(
            session=db_session, situation_id=situation.id
        )

        now = datetime.now(tz=timezone.utc)
        reviews_created = []

        # Create 7 exercises + records + reviews at distinct timestamps
        for i in range(7):
            de = await DescriptionExerciseFactory.create(
                session=db_session, description_id=desc.id, approved=True
            )
            de.modality = ExerciseModality.READING
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
            review = await ExerciseReviewFactory.create(
                session=db_session,
                user_id=test_user.id,
                exercise_record_id=record.id,
                reviewed_at=now - timedelta(days=i),
            )
            reviews_created.append(review)

        await db_session.flush()

        service = _get_service(db_session)
        overview = await service.get_overview(user_id=test_user.id)

        assert hasattr(
            overview, "recent_sessions"
        ), "Overview must have a 'recent_sessions' attribute"
        sessions = overview.recent_sessions
        assert (
            len(sessions) == 5
        ), f"Expected 5 recent sessions (capped from 7), got {len(sessions)}"

        # Verify newest-first ordering
        for j in range(len(sessions) - 1):
            assert sessions[j].reviewed_at >= sessions[j + 1].reviewed_at, (
                f"recent_sessions must be ordered newest-first; "
                f"entry {j} ({sessions[j].reviewed_at}) is older than "
                f"entry {j + 1} ({sessions[j + 1].reviewed_at})"
            )

    @pytest.mark.asyncio
    async def test_recent_sessions_empty_when_no_reviews(
        self,
        db_session: AsyncSession,
        test_user,
    ) -> None:
        """GIVEN a user with no ExerciseReviews
        WHEN  fetch overview
        THEN  recent_sessions == [] (not None, not error)

        RED: SituationComprehensionService does not exist yet.
        """
        service = _get_service(db_session)
        overview = await service.get_overview(user_id=test_user.id)

        assert hasattr(overview, "recent_sessions")
        assert (
            overview.recent_sessions == [] or len(overview.recent_sessions) == 0
        ), "recent_sessions must be empty list when user has no reviews"
