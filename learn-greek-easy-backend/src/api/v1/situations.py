from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.core.dependencies import get_current_user
from src.core.exceptions import NotFoundException
from src.core.exercise_topic import ExerciseTopic, derive_exercise_topic
from src.db.dependencies import get_db
from src.db.models import (
    CardStatus,
    DescriptionExercise,
    Exercise,
    ExerciseRecord,
    ExerciseSourceType,
    ExerciseType,
    ListeningDialog,
    PictureStatus,
    Situation,
    SituationDescription,
    SituationStatus,
    User,
)
from src.schemas.exercise_queue import ExerciseQueue, ExerciseQueueItem
from src.schemas.learner_situation import (
    LearnerDescriptionNested,
    LearnerDialogNested,
    LearnerSituationDetailResponse,
    LearnerSituationListResponse,
    SituationComprehensionResponse,
    SituationStatsResponse,
)
from src.services.exercise_sm2_service import ExerciseSM2Service
from src.services.learner_situation_service import LearnerSituationService
from src.services.s3_service import IMAGE_PRESIGN_EXPIRY_SECONDS, get_s3_service
from src.services.situation_comprehension_service import SituationComprehensionService

router = APIRouter(
    responses={
        401: {"description": "Not authenticated"},
        422: {"description": "Validation error"},
    },
)


@router.get("", response_model=LearnerSituationListResponse)
async def list_situations(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    search: str | None = Query(default=None),
    has_audio: bool | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LearnerSituationListResponse:
    return await LearnerSituationService(db).list_for_learner(
        current_user.id,
        page=page,
        page_size=page_size,
        search=search,
        has_audio=has_audio,
    )


@router.get("/comprehension", response_model=SituationComprehensionResponse)
async def get_situation_comprehension(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SituationComprehensionResponse:
    """Account-wide situations comprehension overview (SIT-27-04).

    NOTE: declared BEFORE the ``/{situation_id}`` path-param route so FastAPI
    matches the literal ``/comprehension`` instead of treating it as a situation id.
    """
    service = SituationComprehensionService(db)
    return await service.get_overview(user_id=current_user.id)


@router.get("/{situation_id}", response_model=LearnerSituationDetailResponse)
async def get_situation(
    situation_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LearnerSituationDetailResponse:
    result = await db.execute(
        select(Situation)
        .options(
            selectinload(Situation.dialog).selectinload(ListeningDialog.speakers),
            selectinload(Situation.dialog).selectinload(ListeningDialog.lines),
            selectinload(Situation.description),
            selectinload(Situation.picture),
        )
        .where(
            Situation.id == situation_id,
            Situation.status == SituationStatus.READY,
        )
    )
    situation = result.scalar_one_or_none()
    if situation is None:
        raise NotFoundException("Situation not found")

    # Exercise counts
    total_q = (
        select(func.count(Exercise.id))
        .join(DescriptionExercise, Exercise.description_exercise_id == DescriptionExercise.id)
        .join(SituationDescription, DescriptionExercise.description_id == SituationDescription.id)
        .where(SituationDescription.situation_id == situation_id)
    )
    completed_q = (
        select(func.count(Exercise.id))
        .join(DescriptionExercise, Exercise.description_exercise_id == DescriptionExercise.id)
        .join(SituationDescription, DescriptionExercise.description_id == SituationDescription.id)
        .join(ExerciseRecord, ExerciseRecord.exercise_id == Exercise.id)
        .where(
            SituationDescription.situation_id == situation_id,
            ExerciseRecord.user_id == current_user.id,
            ExerciseRecord.status != CardStatus.NEW,
        )
    )
    exercise_total = (await db.execute(total_q)).scalar_one()
    exercise_completed = (await db.execute(completed_q)).scalar_one()

    # Presigned URLs
    s3 = get_s3_service()
    description_nested: LearnerDescriptionNested | None = None
    if situation.description:
        desc = situation.description
        description_nested = LearnerDescriptionNested(
            text_el=desc.text_el,
            text_el_a2=desc.text_el_a2,
            audio_url=s3.generate_presigned_url(desc.audio_s3_key) if desc.audio_s3_key else None,
            audio_a2_url=(
                s3.generate_presigned_url(desc.audio_a2_s3_key) if desc.audio_a2_s3_key else None
            ),
            audio_duration_seconds=desc.audio_duration_seconds,
            audio_a2_duration_seconds=desc.audio_a2_duration_seconds,
            word_timestamps=desc.word_timestamps,
            word_timestamps_a2=desc.word_timestamps_a2,
        )

    dialog_nested: LearnerDialogNested | None = None
    if situation.dialog:
        dlg = situation.dialog
        dlg.speakers.sort(key=lambda s: s.speaker_index)
        dlg.lines.sort(key=lambda ln: ln.line_index)
        dialog_nested = LearnerDialogNested(
            speakers=dlg.speakers,
            lines=dlg.lines,
            audio_url=s3.generate_presigned_url(dlg.audio_s3_key) if dlg.audio_s3_key else None,
            audio_duration_seconds=dlg.audio_duration_seconds,
        )

    # Source metadata
    source_image_url: str | None = None
    source_image_variants: dict[int, str] | None = None
    if situation.source_image_s3_key:
        source_image_url = s3.generate_presigned_url(
            situation.source_image_s3_key, expiry_seconds=IMAGE_PRESIGN_EXPIRY_SECONDS
        )
        _raw_source_variants = s3.get_derivative_presigned_urls(situation.source_image_s3_key)
        source_image_variants = (
            _raw_source_variants if isinstance(_raw_source_variants, dict) else None
        )

    # Picture (presigned only when generated)
    picture_url: str | None = None
    picture_variants: dict[int, str] | None = None
    if (
        situation.picture is not None
        and situation.picture.status == PictureStatus.GENERATED
        and situation.picture.image_s3_key
    ):
        picture_url = s3.generate_presigned_url(
            situation.picture.image_s3_key, expiry_seconds=IMAGE_PRESIGN_EXPIRY_SECONDS
        )
        _raw_picture_variants = s3.get_derivative_presigned_urls(situation.picture.image_s3_key)
        picture_variants = (
            _raw_picture_variants if isinstance(_raw_picture_variants, dict) else None
        )

    return LearnerSituationDetailResponse(
        id=situation.id,
        scenario_el=situation.scenario_el,
        scenario_en=situation.scenario_en,
        scenario_ru=situation.scenario_ru,
        status=situation.status,
        description=description_nested,
        dialog=dialog_nested,
        exercise_total=exercise_total,
        exercise_completed=exercise_completed,
        domain=situation.domain,
        source_url=situation.source_url,
        source_image_url=source_image_url,
        picture_url=picture_url,
        source_title=situation.source_title_en,
        picture_variants=picture_variants,
        source_image_variants=source_image_variants,
    )


def _apply_enrichment(item: ExerciseQueueItem, enriched: dict) -> None:
    """Apply a single enrichment dict (from load_description_enrichment) onto a queue item."""
    item.situation_id = enriched.get("situation_id")
    item.scenario_el = enriched.get("scenario_el")
    item.scenario_en = enriched.get("scenario_en")
    item.scenario_ru = enriched.get("scenario_ru")
    item.description_text_el = enriched.get("description_text_el")
    item.description_audio_url = enriched.get("description_audio_url")
    item.description_audio_duration = enriched.get("description_audio_duration")
    item.word_timestamps = enriched.get("word_timestamps")
    item.items = enriched.get("items", [])
    if (etype := enriched.get("exercise_type")) is not None:
        item.exercise_type = etype
    if (mod := enriched.get("modality")) is not None:
        item.modality = mod
    if (lvl := enriched.get("audio_level_value")) is not None:
        item.audio_level = lvl


@router.get("/{situation_id}/exercises", response_model=ExerciseQueue)
async def get_situation_exercises(
    situation_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ExerciseQueue:
    """Return ALL exercises linked to a READY situation, regardless of SM-2 review state.

    Complements the queue endpoint (which returns only what is studyable now).
    Frontend uses this when it wants to display every exercise in a situation,
    including those whose next_review_date is in the future.
    """
    # Validate situation — collapse missing + non-READY into a single 404 (mirrors get_situation)
    sit_result = await db.execute(
        select(Situation).where(
            Situation.id == situation_id,
            Situation.status == SituationStatus.READY,
        )
    )
    if sit_result.scalar_one_or_none() is None:
        raise NotFoundException("Situation not found")

    # Load all exercises for this situation via the description path, with per-user records.
    # TODO: extend join to cover dialog-source and picture-source when those pipelines exist.
    stmt = (
        select(Exercise, ExerciseRecord)
        .join(DescriptionExercise, Exercise.description_exercise_id == DescriptionExercise.id)
        .join(SituationDescription, DescriptionExercise.description_id == SituationDescription.id)
        .outerjoin(
            ExerciseRecord,
            and_(
                ExerciseRecord.exercise_id == Exercise.id,
                ExerciseRecord.user_id == current_user.id,
            ),
        )
        .where(SituationDescription.situation_id == situation_id)
        .order_by(Exercise.created_at.asc(), Exercise.id.asc())
    )
    rows = (await db.execute(stmt)).all()

    today = date.today()
    items: list[ExerciseQueueItem] = []
    description_exercise_ids: list[UUID] = []
    total_due = 0
    total_new = 0

    for exercise, record in rows:
        is_new = record is None
        item = ExerciseQueueItem(
            exercise_id=exercise.id,
            source_type=exercise.source_type,
            exercise_type=ExerciseType.FILL_GAPS,  # placeholder; enriched below for description-source
            status=record.status if record else CardStatus.NEW,
            is_new=is_new,
            is_early_practice=False,
            due_date=record.next_review_date if record else None,
            easiness_factor=record.easiness_factor if record else None,
            interval=record.interval if record else None,
        )
        items.append(item)
        if exercise.source_type == ExerciseSourceType.DESCRIPTION:
            description_exercise_ids.append(exercise.id)
        if is_new:
            total_new += 1
        elif record.next_review_date is not None and record.next_review_date <= today:
            total_due += 1

    # Batch-enrich description-source items (reuses the same helper as get_study_queue)
    if description_exercise_ids:
        service = ExerciseSM2Service(db)
        enrichment_map = await service.load_description_enrichment(description_exercise_ids)
        for item in items:
            if item.exercise_id in enrichment_map:
                _apply_enrichment(item, enrichment_map[item.exercise_id])

    # SIT-27-03: derive the learner-facing topic per item (after enrichment, so
    # description-source items carry their modality) and tally per-topic counts.
    # All four canonical topics are always present in the counts map.
    topic_counts: dict[str, int] = {t.value: 0 for t in ExerciseTopic}
    for item in items:
        topic = derive_exercise_topic(item.source_type, item.modality)
        item.topic = topic.value
        topic_counts[topic.value] += 1

    return ExerciseQueue(
        total_due=total_due,
        total_new=total_new,
        total_early_practice=0,
        total_in_queue=len(items),
        exercises=items,
        topic_counts=topic_counts,
    )


@router.get("/{situation_id}/stats", response_model=SituationStatsResponse)
async def get_situation_stats(
    situation_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SituationStatsResponse:
    """Per-situation exercise counts for the detail metric strip (SIT-27-04).

    Returns to_practice / in_review / mastered / audio counts. 404 when the
    situation is missing or not READY (mirrors get_situation / get_situation_exercises).
    """
    sit_result = await db.execute(
        select(Situation).where(
            Situation.id == situation_id,
            Situation.status == SituationStatus.READY,
        )
    )
    if sit_result.scalar_one_or_none() is None:
        raise NotFoundException("Situation not found")

    service = SituationComprehensionService(db)
    return await service.get_per_situation_stats(situation_id=situation_id, user_id=current_user.id)
