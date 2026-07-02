"""Situations comprehension / stats aggregation service (SIT-27-04).

Modelled on ``CultureQuestionService.get_culture_readiness``: a weighted
SRS-stage comprehension score mapped to the shared ``VERDICT_THRESHOLDS``, plus
per-topic confidence bars, the global exercise streak, recent sessions, and a
what's-new count.

Reuse contract (no new SM-2 / gamification logic):
  - ReadinessConstants.WEIGHT_LEARNING / WEIGHT_REVIEW / WEIGHT_MASTERED (stage weights)
  - ReadinessConstants.VERDICT_THRESHOLDS (verdict mapping)
  - compute_exercise_streak (global exercise streak — looked up at call time via
    the module so test patching of the definition site takes effect)
  - core.exercise_topic.derive_exercise_topic (topic taxonomy from SIT-27-03)

Scope: the situations exercise pipeline currently wires only description-source
exercises (see situations.py get_situation_exercises TODO), so aggregation joins
through Exercise -> DescriptionExercise -> SituationDescription -> Situation.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import and_, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

# Import the streak module (not the function) so that patching
# ``src.services.gamification.streak.compute_exercise_streak`` takes effect:
# attribute lookup happens at call time, not import time.
from src.constants import ReadinessConstants
from src.core.exercise_topic import ExerciseTopic, derive_exercise_topic
from src.core.logging import get_logger
from src.db.models import (
    CardStatus,
    DescriptionExercise,
    Exercise,
    ExerciseModality,
    ExerciseRecord,
    ExerciseReview,
    ExerciseSourceType,
    Situation,
    SituationDescription,
    SituationStatus,
)
from src.schemas.learner_situation import (
    RecentSession,
    SituationComprehensionResponse,
    SituationStatsResponse,
    TopicConfidence,
)
from src.services.gamification import streak as streak_module

logger = get_logger(__name__)

# Number of recent review sessions to surface in the overview.
_RECENT_SESSIONS_LIMIT = 5
# Window (days) for the "what's new" count of recently-added situations.
_WHATS_NEW_DAYS = 7


def _verdict_for(percentage: float) -> str:
    """Map a comprehension percentage to a verdict using the shared thresholds.

    Mirrors get_culture_readiness: compares the RAW (unrounded) percentage so a
    rounded display value can never flip the verdict across a boundary.
    """
    verdict = ReadinessConstants.VERDICT_THRESHOLDS[-1][1]  # default lowest
    for threshold, label in sorted(
        ReadinessConstants.VERDICT_THRESHOLDS, key=lambda t: t[0], reverse=True
    ):
        if percentage >= threshold:
            verdict = label
            break
    return verdict


class SituationComprehensionService:
    """Aggregates per-situation and account-wide situations comprehension stats."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ------------------------------------------------------------------
    # AC-1: per-situation counts
    # ------------------------------------------------------------------
    async def get_per_situation_stats(
        self, situation_id: UUID, user_id: UUID
    ) -> SituationStatsResponse:
        """Return to_practice / in_review / mastered / audio counts for one situation.

        Status partition (over the user's records for this situation's exercises):
          to_practice = NEW or no record (never started)
          in_review   = LEARNING + REVIEW
          mastered    = MASTERED
        audio = exercises whose DescriptionExercise.modality == LISTENING.
        """
        stmt = (
            select(
                func.count(Exercise.id).label("total"),
                func.count(
                    case(
                        (
                            and_(
                                ExerciseRecord.id.isnot(None),
                                ExerciseRecord.status.in_((CardStatus.LEARNING, CardStatus.REVIEW)),
                            ),
                            Exercise.id,
                        )
                    )
                ).label("in_review"),
                func.count(
                    case(
                        (ExerciseRecord.status == CardStatus.MASTERED, Exercise.id),
                    )
                ).label("mastered"),
                func.count(
                    case(
                        (DescriptionExercise.modality == ExerciseModality.LISTENING, Exercise.id),
                    )
                ).label("audio"),
            )
            .select_from(Exercise)
            .join(DescriptionExercise, Exercise.description_exercise_id == DescriptionExercise.id)
            .join(
                SituationDescription,
                DescriptionExercise.description_id == SituationDescription.id,
            )
            .outerjoin(
                ExerciseRecord,
                and_(
                    ExerciseRecord.exercise_id == Exercise.id,
                    ExerciseRecord.user_id == user_id,
                ),
            )
            .where(SituationDescription.situation_id == situation_id)
        )
        row = (await self.db.execute(stmt)).one()

        total = row.total or 0
        in_review = row.in_review or 0
        mastered = row.mastered or 0
        # to_practice = everything that is neither in_review nor mastered (NEW + no record).
        to_practice = total - in_review - mastered

        return SituationStatsResponse(
            to_practice=to_practice,
            in_review=in_review,
            mastered=mastered,
            audio=row.audio or 0,
        )

    # ------------------------------------------------------------------
    # AC-2..5: account-wide overview
    # ------------------------------------------------------------------
    async def get_overview(self, user_id: UUID) -> SituationComprehensionResponse:
        """Return the account-wide situations comprehension overview."""
        logger.debug("Getting situation comprehension overview")

        # Per-exercise: source_type, modality, SRS status (NULL when no record =
        # NEW-equivalent, contributes 0 weight). One row per description-source
        # exercise reachable account-wide.
        rows = (
            await self.db.execute(
                select(
                    Exercise.source_type.label("source_type"),
                    DescriptionExercise.modality.label("modality"),
                    ExerciseRecord.status.label("status"),
                )
                .select_from(Exercise)
                .join(
                    DescriptionExercise,
                    Exercise.description_exercise_id == DescriptionExercise.id,
                )
                .join(
                    SituationDescription,
                    DescriptionExercise.description_id == SituationDescription.id,
                )
                .outerjoin(
                    ExerciseRecord,
                    and_(
                        ExerciseRecord.exercise_id == Exercise.id,
                        ExerciseRecord.user_id == user_id,
                    ),
                )
            )
        ).all()

        # Per-topic review accuracy: sum(score)/sum(max_score) over the user's
        # ExerciseReviews, grouped by the exercise's topic inputs.
        accuracy_rows = (
            await self.db.execute(
                select(
                    Exercise.source_type.label("source_type"),
                    DescriptionExercise.modality.label("modality"),
                    func.sum(ExerciseReview.score).label("sum_score"),
                    func.sum(ExerciseReview.max_score).label("sum_max"),
                )
                .select_from(ExerciseReview)
                .join(ExerciseRecord, ExerciseReview.exercise_record_id == ExerciseRecord.id)
                .join(Exercise, ExerciseRecord.exercise_id == Exercise.id)
                .join(
                    DescriptionExercise,
                    Exercise.description_exercise_id == DescriptionExercise.id,
                )
                .where(ExerciseReview.user_id == user_id)
                .group_by(Exercise.source_type, DescriptionExercise.modality)
            )
        ).all()

        weights = {
            CardStatus.LEARNING.value: ReadinessConstants.WEIGHT_LEARNING,
            CardStatus.REVIEW.value: ReadinessConstants.WEIGHT_REVIEW,
            CardStatus.MASTERED.value: ReadinessConstants.WEIGHT_MASTERED,
        }

        # Tally weighted sums + totals per topic (and overall).
        per_topic_weight: dict[str, float] = {t.value: 0.0 for t in ExerciseTopic}
        per_topic_total: dict[str, int] = {t.value: 0 for t in ExerciseTopic}
        overall_weight = 0.0
        overall_total = 0

        for row in rows:
            topic = derive_exercise_topic(
                _as_source_type(row.source_type), _as_modality(row.modality)
            )
            w = weights.get(_status_value(row.status) or "", 0.0)
            per_topic_weight[topic.value] += w
            per_topic_total[topic.value] += 1
            overall_weight += w
            overall_total += 1

        # Per-topic accuracy (null when no reviews for that topic).
        per_topic_accuracy: dict[str, float | None] = {t.value: None for t in ExerciseTopic}
        for acc in accuracy_rows:
            topic = derive_exercise_topic(
                _as_source_type(acc.source_type), _as_modality(acc.modality)
            )
            sum_max = acc.sum_max or 0
            if sum_max > 0:
                per_topic_accuracy[topic.value] = round((acc.sum_score or 0) / sum_max * 100, 1)

        comprehension_percentage = (
            (overall_weight / overall_total) * 100 if overall_total > 0 else 0.0
        )
        verdict = _verdict_for(comprehension_percentage)

        # Zero-filled per-topic confidence in canonical topic order.
        topic_confidence = [
            TopicConfidence(
                topic=topic.value,
                confidence_percentage=(
                    round((per_topic_weight[topic.value] / per_topic_total[topic.value]) * 100, 1)
                    if per_topic_total[topic.value] > 0
                    else 0.0
                ),
                accuracy=per_topic_accuracy[topic.value],
            )
            for topic in ExerciseTopic
        ]

        # Streak: reuse the global exercise streak (looked up at call time so the
        # test patch on the definition module is honoured).
        streak = await streak_module.compute_exercise_streak(self.db, user_id)

        # Recent sessions: last N reviews newest-first.
        recent_rows = (
            (
                await self.db.execute(
                    select(ExerciseReview)
                    .where(ExerciseReview.user_id == user_id)
                    .order_by(ExerciseReview.reviewed_at.desc(), ExerciseReview.id.desc())
                    .limit(_RECENT_SESSIONS_LIMIT)
                )
            )
            .scalars()
            .all()
        )
        recent_sessions = [
            RecentSession(
                reviewed_at=r.reviewed_at,
                score=r.score,
                max_score=r.max_score,
                quality=r.quality,
            )
            for r in recent_rows
        ]

        # What's-new: READY situations created within the last 7 days.
        cutoff = datetime.now(tz=timezone.utc) - timedelta(days=_WHATS_NEW_DAYS)
        whats_new_count = (
            await self.db.execute(
                select(func.count(Situation.id)).where(
                    Situation.status == SituationStatus.READY,
                    Situation.created_at >= cutoff,
                )
            )
        ).scalar_one()

        logger.info(
            "Situation comprehension overview retrieved",
            extra={
                "comprehension_percentage": comprehension_percentage,
                "verdict": verdict,
                "overall_total": overall_total,
                "streak": streak,
            },
        )

        return SituationComprehensionResponse(
            comprehension_percentage=round(comprehension_percentage, 1),
            verdict=verdict,
            topic_confidence=topic_confidence,
            streak=streak,
            recent_sessions=recent_sessions,
            whats_new_count=whats_new_count or 0,
        )

    # ------------------------------------------------------------------
    # PERF-15-02: standalone whats-new count for the dashboard gather layer
    # ------------------------------------------------------------------
    async def count_whats_new(self) -> int:
        """Account-wide count of READY situations created in the last 7 days.

        Must match ``get_overview().whats_new_count`` exactly (same filter:
        READY + created_at >= now_utc - 7d, account-wide, not per-user) —
        this exists so the dashboard gather layer can fetch just this count
        without paying for the rest of the overview aggregation.
        """
        cutoff = datetime.now(tz=timezone.utc) - timedelta(days=_WHATS_NEW_DAYS)
        count = (
            await self.db.execute(
                select(func.count(Situation.id)).where(
                    Situation.status == SituationStatus.READY,
                    Situation.created_at >= cutoff,
                )
            )
        ).scalar_one()
        return count or 0


def _status_value(status: "CardStatus | str | None") -> str | None:
    """Coerce a CardStatus / raw string / NULL to its string value (None when no record)."""
    if status is None:
        return None
    return status.value if isinstance(status, CardStatus) else str(status)


def _as_source_type(value: "ExerciseSourceType | str") -> ExerciseSourceType:
    """Coerce a possibly-raw DB value to ExerciseSourceType."""
    return value if isinstance(value, ExerciseSourceType) else ExerciseSourceType(value)


def _as_modality(value: "ExerciseModality | str | None") -> ExerciseModality | None:
    """Coerce a possibly-raw DB value to ExerciseModality (or None)."""
    if value is None:
        return None
    return value if isinstance(value, ExerciseModality) else ExerciseModality(value)
