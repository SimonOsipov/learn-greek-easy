"""Learner-facing situations list service (PERF-15-02).

Extracted verbatim from the inline handler in
``src.api.v1.situations.list_situations`` (situations.py:49-160): READY-only
filter, ``created_at DESC`` ordering, the per-situation
exercise_total/exercise_completed correlated subqueries, and search /
has_audio filtering. The router delegates to this service so its response
stays byte-identical to the pre-extraction behavior.
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.db.models import (
    CardStatus,
    DescriptionExercise,
    Exercise,
    ExerciseRecord,
    Situation,
    SituationDescription,
    SituationStatus,
)
from src.schemas.learner_situation import LearnerSituationListItem, LearnerSituationListResponse
from src.services.s3_service import IMAGE_PRESIGN_EXPIRY_SECONDS, get_s3_service


class LearnerSituationService:
    """Assembles the learner-facing paginated READY-situations list."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_for_learner(
        self,
        user_id: UUID,
        *,
        page: int = 1,
        page_size: int = 20,
        search: str | None = None,
        has_audio: bool | None = None,
    ) -> LearnerSituationListResponse:
        """READY-only, ``created_at DESC``, per-situation exercise counts scoped
        to ``user_id`` — verbatim extraction of the former router logic."""
        base_filters = [Situation.status == SituationStatus.READY]

        if search:
            pattern = f"%{search}%"
            base_filters.append(
                or_(
                    Situation.scenario_el.ilike(pattern),
                    Situation.scenario_en.ilike(pattern),
                    Situation.scenario_ru.ilike(pattern),
                )
            )

        audio_filter = None
        if has_audio is True:
            audio_filter = Situation.description.has(SituationDescription.audio_s3_key.isnot(None))
        elif has_audio is False:
            audio_filter = or_(
                ~Situation.description.has(),
                Situation.description.has(SituationDescription.audio_s3_key.is_(None)),
            )

        # Count query
        count_query = select(func.count(Situation.id)).where(*base_filters)
        if audio_filter is not None:
            count_query = count_query.where(audio_filter)
        total = (await self.db.execute(count_query)).scalar_one()

        # Correlated scalar subqueries for exercise counts
        exercise_total_subq = (
            select(func.count(Exercise.id))
            .join(DescriptionExercise, Exercise.description_exercise_id == DescriptionExercise.id)
            .join(
                SituationDescription, DescriptionExercise.description_id == SituationDescription.id
            )
            .where(SituationDescription.situation_id == Situation.id)
            .correlate(Situation)
            .scalar_subquery()
            .label("exercise_total")
        )
        exercise_completed_subq = (
            select(func.count(Exercise.id))
            .join(DescriptionExercise, Exercise.description_exercise_id == DescriptionExercise.id)
            .join(
                SituationDescription, DescriptionExercise.description_id == SituationDescription.id
            )
            .join(ExerciseRecord, ExerciseRecord.exercise_id == Exercise.id)
            .where(
                SituationDescription.situation_id == Situation.id,
                ExerciseRecord.user_id == user_id,
                ExerciseRecord.status != CardStatus.NEW,
            )
            .correlate(Situation)
            .scalar_subquery()
            .label("exercise_completed")
        )

        # Data query
        data_query = (
            select(Situation, exercise_total_subq, exercise_completed_subq)
            .options(
                selectinload(Situation.description),
                selectinload(Situation.dialog),
            )
            .where(*base_filters)
            .order_by(Situation.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        if audio_filter is not None:
            data_query = data_query.where(audio_filter)

        rows = (await self.db.execute(data_query)).all()
        s3 = get_s3_service()
        items = [
            LearnerSituationListItem(
                id=situation.id,
                scenario_el=situation.scenario_el,
                scenario_en=situation.scenario_en,
                scenario_ru=situation.scenario_ru,
                status=situation.status,
                has_audio=(
                    situation.description is not None
                    and situation.description.audio_s3_key is not None
                ),
                has_dialog=situation.dialog is not None,
                exercise_total=exercise_total or 0,
                exercise_completed=exercise_completed or 0,
                source_image_url=(
                    s3.generate_presigned_url(
                        situation.source_image_s3_key, expiry_seconds=IMAGE_PRESIGN_EXPIRY_SECONDS
                    )
                    if situation.source_image_s3_key
                    else None
                ),
                domain=situation.domain,
                description_source_type=(
                    situation.description.source_type.value if situation.description else None
                ),
            )
            for situation, exercise_total, exercise_completed in rows
        ]

        return LearnerSituationListResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
        )


__all__ = ["LearnerSituationService"]
