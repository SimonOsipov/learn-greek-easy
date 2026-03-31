"""Exercise SM-2 spaced repetition service."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.core.logging import get_logger
from src.core.posthog import capture_event
from src.core.sm2 import calculate_next_review_date, calculate_sm2, derive_exercise_quality
from src.db.models import (
    CardStatus,
    DeckLevel,
    DescriptionExercise,
    Exercise,
    ExerciseModality,
    ExerciseRecord,
    ExerciseSourceType,
    ExerciseType,
    SituationDescription,
)
from src.repositories.exercise_record import ExerciseRecordRepository
from src.repositories.exercise_review import ExerciseReviewRepository
from src.schemas.exercise_queue import (
    ExerciseItemPayload,
    ExerciseQueue,
    ExerciseQueueItem,
    ExerciseReviewResult,
)
from src.services.s3_service import get_s3_service

logger = get_logger(__name__)


class ExerciseSM2Service:
    """Orchestrates exercise study queue assembly and SM-2 review processing."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.record_repo = ExerciseRecordRepository(db)
        self.review_repo = ExerciseReviewRepository(db)

    async def get_study_queue(
        self,
        user_id: UUID,
        *,
        source_type: ExerciseSourceType | None = None,
        modality: ExerciseModality | None = None,
        audio_level: DeckLevel | None = None,
        limit: int = 20,
        include_new: bool = True,
        new_limit: int = 10,
        include_early_practice: bool = False,
        early_practice_limit: int = 5,
    ) -> ExerciseQueue:
        """Assemble a prioritized exercise study queue: due → new → early practice."""
        # Tier 1: Due exercises
        due_records = await self.record_repo.get_due_exercises(
            user_id,
            source_type=source_type,
            modality=modality,
            audio_level=audio_level,
            limit=limit,
        )

        # Tier 2: New exercises (if space remains)
        new_exercises: list[Exercise] = []
        if include_new and len(due_records) < limit:
            remaining = min(new_limit, limit - len(due_records))
            new_exercises = await self.record_repo.get_new_exercises(
                user_id,
                source_type=source_type,
                modality=modality,
                audio_level=audio_level,
                limit=remaining,
            )

        # Tier 3: Early practice (if space remains)
        early_records: list[ExerciseRecord] = []
        if include_early_practice and len(due_records) + len(new_exercises) < limit:
            remaining = min(early_practice_limit, limit - len(due_records) - len(new_exercises))
            early_records = await self.record_repo.get_early_practice_exercises(
                user_id,
                source_type=source_type,
                modality=modality,
                audio_level=audio_level,
                limit=remaining,
            )

        logger.debug(
            "exercise_queue_assembled",
            user_id=str(user_id),
            due=len(due_records),
            new=len(new_exercises),
            early=len(early_records),
        )

        # Build initial queue items
        due_items = [self._build_item_from_record(r, is_early_practice=False) for r in due_records]
        new_items = [self._build_item_from_exercise(e) for e in new_exercises]
        early_items = [
            self._build_item_from_record(r, is_early_practice=True) for r in early_records
        ]

        all_items = due_items + new_items + early_items

        # Collect exercise IDs for description-source enrichment
        all_exercises = (
            [r.exercise for r in due_records]
            + list(new_exercises)
            + [r.exercise for r in early_records]
        )
        description_exercise_ids = [
            e.id for e in all_exercises if e.source_type == ExerciseSourceType.DESCRIPTION
        ]

        # Enrich description-source items with audio + situation context
        if description_exercise_ids:
            enrichment_map = await self._load_description_enrichment(
                description_exercise_ids, audio_level=audio_level
            )
            for item in all_items:
                if item.exercise_id in enrichment_map:
                    enriched = enrichment_map[item.exercise_id]
                    item.situation_id = enriched.get("situation_id")
                    item.scenario_el = enriched.get("scenario_el")
                    item.scenario_en = enriched.get("scenario_en")
                    item.scenario_ru = enriched.get("scenario_ru")
                    item.description_text_el = enriched.get("description_text_el")
                    item.description_audio_url = enriched.get("description_audio_url")
                    item.description_audio_duration = enriched.get("description_audio_duration")
                    item.word_timestamps = enriched.get("word_timestamps")
                    item.items = enriched.get("items", [])
                    exercise_type = enriched.get("exercise_type")
                    if exercise_type is not None:
                        item.exercise_type = exercise_type
                    enriched_modality = enriched.get("modality")
                    if enriched_modality is not None:
                        item.modality = enriched_modality
                    audio_level_value = enriched.get("audio_level_value")
                    if audio_level_value is not None:
                        item.audio_level = audio_level_value

        return ExerciseQueue(
            total_due=len(due_records),
            total_new=len(new_exercises),
            total_early_practice=len(early_records),
            total_in_queue=len(all_items),
            exercises=all_items,
        )

    def _build_item_from_record(
        self,
        record: ExerciseRecord,
        *,
        is_early_practice: bool,
    ) -> ExerciseQueueItem:
        """Build an ExerciseQueueItem from an existing ExerciseRecord (exercise eager-loaded)."""
        exercise = record.exercise  # eager-loaded by selectinload in repository
        return ExerciseQueueItem(
            exercise_id=exercise.id,
            source_type=exercise.source_type,
            exercise_type=ExerciseType.FILL_GAPS,  # placeholder; enriched for description-source
            status=record.status,
            is_new=False,
            is_early_practice=is_early_practice,
            due_date=record.next_review_date,
            easiness_factor=record.easiness_factor,
            interval=record.interval,
        )

    def _build_item_from_exercise(self, exercise: Exercise) -> ExerciseQueueItem:
        """Build an ExerciseQueueItem for a new (unstudied) exercise."""
        return ExerciseQueueItem(
            exercise_id=exercise.id,
            source_type=exercise.source_type,
            exercise_type=ExerciseType.FILL_GAPS,  # placeholder; enriched for description-source
            status=CardStatus.NEW,
            is_new=True,
            is_early_practice=False,
        )

    async def _load_description_enrichment(
        self,
        exercise_ids: list[UUID],
        *,
        audio_level: DeckLevel | None = None,
    ) -> dict[UUID, dict]:
        """Batch-load description exercise enrichment data (audio, text, situation, items)."""
        stmt = (
            select(Exercise)
            .where(Exercise.id.in_(exercise_ids))
            .options(
                selectinload(Exercise.description_exercise).options(
                    selectinload(DescriptionExercise.description).options(
                        selectinload(SituationDescription.situation)
                    ),
                    selectinload(DescriptionExercise.items),
                )
            )
        )
        result = await self.db.execute(stmt)
        exercises = list(result.scalars().all())

        s3_service = get_s3_service()
        enrichment: dict[UUID, dict] = {}

        for exercise in exercises:
            de = exercise.description_exercise
            if de is None:
                continue

            desc = de.description
            situation = desc.situation if desc else None

            # Determine audio/text based on level
            use_a2 = audio_level == DeckLevel.A2
            if use_a2:
                text_el = desc.text_el_a2 or desc.text_el if desc else None
                audio_key = desc.audio_a2_s3_key if desc else None
                duration = desc.audio_a2_duration_seconds if desc else None
                timestamps = desc.word_timestamps_a2 if desc else None
            else:
                text_el = desc.text_el if desc else None
                audio_key = desc.audio_s3_key if desc else None
                duration = desc.audio_duration_seconds if desc else None
                timestamps = desc.word_timestamps if desc else None

            audio_url = s3_service.generate_presigned_url(audio_key) if audio_key else None

            items = [
                ExerciseItemPayload(item_index=item.item_index, payload=item.payload)
                for item in sorted(de.items, key=lambda x: x.item_index)
            ]

            enrichment[exercise.id] = {
                "situation_id": situation.id if situation else None,
                "scenario_el": situation.scenario_el if situation else None,
                "scenario_en": situation.scenario_en if situation else None,
                "scenario_ru": situation.scenario_ru if situation else None,
                "description_text_el": text_el,
                "description_audio_url": audio_url,
                "description_audio_duration": duration,
                "word_timestamps": timestamps,
                "items": items,
                "exercise_type": de.exercise_type,
                "modality": de.modality,
                "audio_level_value": de.audio_level,
            }

        return enrichment

    async def process_review(
        self,
        user_id: UUID,
        exercise_id: UUID,
        score: int,
        max_score: int,
        user_email: str | None = None,
    ) -> ExerciseReviewResult:
        """Process an exercise review using SM-2 algorithm."""
        # Load exercise (to get source_type for PostHog)
        exercise_result = await self.db.execute(select(Exercise).where(Exercise.id == exercise_id))
        exercise = exercise_result.scalar_one_or_none()
        if exercise is None:
            raise ValueError(f"Exercise {exercise_id} not found")

        record, _created = await self.record_repo.get_or_create(user_id, exercise_id)

        previous_status = record.status
        is_first_review = record.status == CardStatus.NEW
        ef_before = record.easiness_factor
        interval_before = record.interval
        repetitions_before = record.repetitions

        quality = derive_exercise_quality(score, max_score)
        sm2_result = calculate_sm2(
            current_ef=record.easiness_factor,
            current_interval=record.interval,
            current_repetitions=record.repetitions,
            quality=quality,
        )
        next_review_date = calculate_next_review_date(sm2_result.new_interval)

        await self.record_repo.update_sm2_data(
            record_id=record.id,
            easiness_factor=sm2_result.new_easiness_factor,
            interval=sm2_result.new_interval,
            repetitions=sm2_result.new_repetitions,
            next_review_date=next_review_date,
            status=sm2_result.new_status,
        )

        await self.review_repo.create_review(
            exercise_record_id=record.id,
            user_id=user_id,
            quality=quality,
            score=score,
            max_score=max_score,
            easiness_factor_before=ef_before,
            easiness_factor_after=sm2_result.new_easiness_factor,
            interval_before=interval_before,
            interval_after=sm2_result.new_interval,
            repetitions_before=repetitions_before,
            repetitions_after=sm2_result.new_repetitions,
        )

        newly_mastered = (
            sm2_result.new_status == CardStatus.MASTERED and previous_status != CardStatus.MASTERED
        )

        if newly_mastered:
            days_to_master = 0
            if hasattr(record, "created_at") and record.created_at is not None:
                created_at = record.created_at
                if created_at.tzinfo is not None:
                    created_at = created_at.replace(tzinfo=None)
                days_to_master = (datetime.now(timezone.utc).replace(tzinfo=None) - created_at).days
            capture_event(
                distinct_id=str(user_id),
                event="exercise_mastered",
                properties={
                    "exercise_id": str(exercise_id),
                    "source_type": exercise.source_type.value,
                    "reviews_to_master": sm2_result.new_repetitions,
                    "days_to_master": days_to_master,
                },
                user_email=user_email,
            )

        logger.info(
            "exercise_review_processed",
            user_id=str(user_id),
            exercise_id=str(exercise_id),
            quality=quality,
            previous_status=previous_status.value,
            new_status=sm2_result.new_status.value,
        )

        return ExerciseReviewResult(
            exercise_id=exercise_id,
            quality=quality,
            score=score,
            max_score=max_score,
            previous_status=previous_status,
            new_status=sm2_result.new_status,
            easiness_factor=sm2_result.new_easiness_factor,
            interval=sm2_result.new_interval,
            repetitions=sm2_result.new_repetitions,
            next_review_date=next_review_date,
            message=self._get_review_message(
                quality=quality,
                is_first_review=is_first_review,
                newly_mastered=newly_mastered,
            ),
        )

    def _get_review_message(
        self,
        *,
        quality: int,
        is_first_review: bool,
        newly_mastered: bool,
    ) -> str | None:
        """Generate a human-readable message for the review result."""
        if newly_mastered:
            return "Exercise mastered! Great work."
        if is_first_review:
            return None
        if quality >= 4:
            return None
        if quality == 3:
            return "Good, keep practicing."
        return "Keep it up — this one needs more practice."


def get_exercise_sm2_service(db: AsyncSession) -> ExerciseSM2Service:
    """Factory function for ExerciseSM2Service (per-request, not singleton)."""
    return ExerciseSM2Service(db)
