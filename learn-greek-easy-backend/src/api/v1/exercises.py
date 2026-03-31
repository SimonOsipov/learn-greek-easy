"""Exercise API endpoints for SM2-based exercise queue and review."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.dependencies import get_current_user
from src.db.dependencies import get_db
from src.db.models import DeckLevel, ExerciseModality, ExerciseSourceType, User
from src.schemas.exercise_queue import ExerciseQueue, ExerciseReviewRequest, ExerciseReviewResult
from src.services.exercise_sm2_service import ExerciseSM2Service

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
