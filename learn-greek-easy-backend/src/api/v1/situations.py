from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.core.dependencies import get_current_user
from src.core.exceptions import NotFoundException
from src.db.dependencies import get_db
from src.db.models import (
    CardStatus,
    DescriptionExercise,
    Exercise,
    ExerciseRecord,
    ExerciseSourceType,
    ExerciseType,
    ListeningDialog,
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
    LearnerSituationListItem,
    LearnerSituationListResponse,
)
from src.services.exercise_sm2_service import ExerciseSM2Service
from src.services.s3_service import get_s3_service

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
    total = (await db.execute(count_query)).scalar_one()

    # Correlated scalar subqueries for exercise counts
    exercise_total_subq = (
        select(func.count(Exercise.id))
        .join(DescriptionExercise, Exercise.description_exercise_id == DescriptionExercise.id)
        .join(SituationDescription, DescriptionExercise.description_id == SituationDescription.id)
        .where(SituationDescription.situation_id == Situation.id)
        .correlate(Situation)
        .scalar_subquery()
        .label("exercise_total")
    )
    exercise_completed_subq = (
        select(func.count(Exercise.id))
        .join(DescriptionExercise, Exercise.description_exercise_id == DescriptionExercise.id)
        .join(SituationDescription, DescriptionExercise.description_id == SituationDescription.id)
        .join(ExerciseRecord, ExerciseRecord.exercise_id == Exercise.id)
        .where(
            SituationDescription.situation_id == Situation.id,
            ExerciseRecord.user_id == current_user.id,
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

    rows = (await db.execute(data_query)).all()
    s3 = get_s3_service()
    items = [
        LearnerSituationListItem(
            id=situation.id,
            scenario_el=situation.scenario_el,
            scenario_en=situation.scenario_en,
            scenario_ru=situation.scenario_ru,
            status=situation.status,
            has_audio=(
                situation.description is not None and situation.description.audio_s3_key is not None
            ),
            has_dialog=situation.dialog is not None,
            exercise_total=exercise_total or 0,
            exercise_completed=exercise_completed or 0,
            source_image_url=(
                s3.generate_presigned_url(situation.source_image_s3_key)
                if situation.source_image_s3_key
                else None
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
    if situation.source_image_s3_key:
        source_image_url = s3.generate_presigned_url(situation.source_image_s3_key)

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
        source_url=situation.source_url,
        source_image_url=source_image_url,
        source_title=situation.source_title_en,
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

    return ExerciseQueue(
        total_due=total_due,
        total_new=total_new,
        total_early_practice=0,
        total_in_queue=len(items),
        exercises=items,
    )
