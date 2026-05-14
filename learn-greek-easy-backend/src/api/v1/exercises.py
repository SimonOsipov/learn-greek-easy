"""Exercise API endpoints for SM2-based exercise queue and review."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.core.dependencies import get_current_user
from src.core.exceptions import InsufficientDistractorPoolException
from src.db.dependencies import get_db
from src.db.models import (
    DeckLevel,
    Exercise,
    ExerciseModality,
    ExerciseSourceType,
    PictureExercise,
    Situation,
    SituationPicture,
    User,
)
from src.schemas.exercise_queue import (
    ExerciseItemPayload,
    ExerciseQueue,
    ExerciseQueueItem,
    ExerciseReviewRequest,
    ExerciseReviewResult,
)
from src.services.exercise_sm2_service import ExerciseSM2Service
from src.services.picture_match_service import (
    InsufficientDistractorPoolError,
    assemble_picture_match_payload,
)

router = APIRouter(
    tags=["Exercises"],
    responses={
        401: {"description": "Unauthorized"},
        404: {"description": "Not found"},
        422: {"description": "Validation error"},
    },
)


@router.get("/queue", response_model=ExerciseQueue)
async def get_exercise_queue(
    source_type: ExerciseSourceType | None = Query(
        default=None, description="Filter by source type"
    ),
    modality: ExerciseModality | None = Query(default=None, description="Filter by modality"),
    audio_level: DeckLevel | None = Query(default=None, description="Filter by audio level"),
    situation_id: UUID | None = Query(default=None, description="Filter by situation"),
    limit: int = Query(default=20, ge=1, le=100, description="Max exercises to return"),
    include_new: bool = Query(default=True, description="Include new/unstudied exercises"),
    new_limit: int = Query(default=10, ge=0, le=50, description="Max new exercises"),
    include_early_practice: bool = Query(
        default=False, description="Include not-yet-due exercises"
    ),
    early_practice_limit: int = Query(
        default=5, ge=0, le=50, description="Max early practice exercises"
    ),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ExerciseQueue:
    """Get exercise queue using SM2 scheduling.

    Returns exercises ordered by priority: due first, then new, then early practice.
    """
    service = ExerciseSM2Service(db)
    return await service.get_study_queue(
        user_id=current_user.id,
        source_type=source_type,
        modality=modality,
        audio_level=audio_level,
        situation_id=situation_id,
        limit=limit,
        include_new=include_new,
        new_limit=new_limit,
        include_early_practice=include_early_practice,
        early_practice_limit=early_practice_limit,
    )


@router.post("/review", response_model=ExerciseReviewResult)
async def submit_exercise_review(
    review: ExerciseReviewRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ExerciseReviewResult:
    """Submit a review for an exercise using SM2 algorithm.

    Raises:
        404: Exercise not found
        422: score exceeds max_score (Pydantic validation)
    """
    service = ExerciseSM2Service(db)
    try:
        return await service.process_review(
            user_id=current_user.id,
            exercise_id=review.exercise_id,
            score=review.score,
            max_score=review.max_score,
            user_email=current_user.email,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.get("/{exercise_id}", response_model=ExerciseQueueItem)
async def get_exercise(
    exercise_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ExerciseQueueItem:
    """Fetch a single hydrated exercise by ID.

    For picture-match exercises (SELECT_PICTURE_FROM_DESCRIPTION,
    SELECT_DESCRIPTION_FROM_PICTURE), the distractor payload is assembled
    at request time. If fewer than 3 eligible distractor Situations exist,
    a 409 InsufficientDistractorPoolException is raised.

    For non-picture-match exercise types, returns 501 (not yet implemented
    for single-item fetch in this iteration).

    Raises:
        404: Exercise not found.
        409: Insufficient distractor pool for picture-match exercises.
        501: Single-item fetch not yet supported for non-picture-match types.
    """
    stmt = (
        select(Exercise)
        .where(Exercise.id == exercise_id)
        .options(
            selectinload(Exercise.picture_exercise).options(
                selectinload(PictureExercise.picture).options(
                    selectinload(SituationPicture.situation).options(
                        selectinload(Situation.description)
                    )
                )
            )
        )
    )
    result = await db.execute(stmt)
    exercise = result.scalar_one_or_none()

    if exercise is None:
        raise HTTPException(status_code=404, detail="exercise not found")

    if exercise.source_type != ExerciseSourceType.PICTURE:
        raise HTTPException(
            status_code=501,
            detail="single-item fetch supported only for picture-match types in this iteration",
        )

    picture_exercise = exercise.picture_exercise
    if picture_exercise is None:
        raise HTTPException(status_code=404, detail="exercise not found")

    try:
        payload = await assemble_picture_match_payload(
            db, picture_exercise, picture_exercise.exercise_type
        )
    except InsufficientDistractorPoolError as e:
        raise InsufficientDistractorPoolException() from e

    return ExerciseQueueItem(
        exercise_id=exercise.id,
        source_type=exercise.source_type,
        exercise_type=picture_exercise.exercise_type,
        is_new=False,
        situation_id=picture_exercise.picture.situation_id,
        items=[ExerciseItemPayload(item_index=0, payload=payload.model_dump(mode="json"))],
    )
