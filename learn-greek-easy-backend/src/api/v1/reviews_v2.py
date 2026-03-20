import asyncio

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.core.dependencies import get_current_user
from src.core.event_bus import dashboard_event_bus
from src.core.logging import get_logger
from src.core.subscription import check_premium_deck_access
from src.db.dependencies import get_db
from src.db.models import User
from src.repositories.card_record import CardRecordRepository
from src.repositories.card_record_review import CardRecordReviewRepository
from src.schemas.v2_sm2 import V2ReviewRequest, V2ReviewResult
from src.services.v2_sm2_service import V2SM2Service
from src.tasks.background import persist_deck_review_task

logger = get_logger(__name__)


router = APIRouter(
    tags=["Reviews V2"],
    responses={
        401: {"description": "Unauthorized"},
        403: {"description": "Forbidden"},
        404: {"description": "Not found"},
        422: {"description": "Validation error"},
    },
)


@router.post("/v2", response_model=V2ReviewResult, summary="Submit a V2 card review")
async def submit_v2_review(
    review: V2ReviewRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> V2ReviewResult:
    """Submit a single card review using the SM2 V2 algorithm."""
    # Step 1: Fetch card record
    card_record = await CardRecordRepository(db).get(review.card_record_id)
    if card_record is None:
        raise HTTPException(status_code=404, detail="Card record not found")

    # Step 2: Check premium access
    check_premium_deck_access(current_user, card_record.deck)

    # Step 3: Count reviews before
    v2_review_repo = CardRecordReviewRepository(db)
    reviews_before = await v2_review_repo.count_reviews_today(current_user.id)

    # Step 4: Compute review (fast, no DB writes)
    service = V2SM2Service(db)
    result, context = await service.compute_review(
        user_id=current_user.id,
        card_record=card_record,
        quality=review.quality,
        time_taken=review.time_taken,
    )

    # Step 5: Persist review — background or synchronous fallback
    if settings.feature_background_tasks:
        background_tasks.add_task(
            persist_deck_review_task,
            **context,
            reviews_before=reviews_before,
            user_email=current_user.email,
            db_url=settings.database_url,
        )
    else:
        await service.persist_review(context)

    # Step 8: Signal dashboard SSE
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(
            dashboard_event_bus.signal(
                f"dashboard:{current_user.id}",
                {"reason": "review_completed"},
            )
        )
    except RuntimeError:
        pass

    return result
