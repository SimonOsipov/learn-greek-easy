import asyncio
from datetime import date
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.core.dependencies import get_current_user
from src.core.event_bus import dashboard_event_bus
from src.core.logging import get_logger
from src.core.posthog import capture_event
from src.core.redis import get_redis
from src.core.subscription import check_premium_deck_access
from src.db.dependencies import get_db
from src.db.models import User, UserSettings
from src.repositories.card_record import CardRecordRepository
from src.repositories.card_record_review import CardRecordReviewRepository
from src.schemas.v2_sm2 import V2ReviewRequest, V2ReviewResult
from src.services.v2_sm2_service import V2SM2Service
from src.tasks.background import (
    award_flashcard_xp_task,
    check_achievements_task,
    log_analytics_task,
)

logger = get_logger(__name__)

STREAK_MILESTONES = [3, 7, 14, 30, 60, 90, 180, 365]


def _check_streak_milestone(
    user_id: UUID,
    user_email: str,
    new_streak: int,
    previous_streak: int,
) -> None:
    """Check if user crossed a streak milestone and track if so."""
    for milestone in STREAK_MILESTONES:
        if new_streak >= milestone and previous_streak < milestone:
            capture_event(
                distinct_id=str(user_id),
                event="streak_achieved",
                properties={
                    "streak_days": new_streak,
                    "milestone": milestone,
                },
                user_email=user_email,
            )
            break


async def _check_daily_goal_notification(
    db: AsyncSession,
    user_id: UUID,
    reviews_before: int,
) -> None:
    """Check if daily goal was just completed and create notification."""
    try:
        result = await db.execute(select(UserSettings).where(UserSettings.user_id == user_id))
        user_settings = result.scalar_one_or_none()
        daily_goal = user_settings.daily_goal if user_settings else 20

        reviews_after = reviews_before + 1

        if reviews_before >= daily_goal:
            return

        if reviews_after < daily_goal:
            return

        redis = get_redis()
        if redis:
            cache_key = f"daily_goal_notified:{user_id}:{date.today().isoformat()}"
            was_set = await redis.setnx(cache_key, "1")
            if not was_set:
                return
            await redis.expire(cache_key, 86400)

        from src.services.notification_service import NotificationService

        notification_service = NotificationService(db)
        await notification_service.notify_daily_goal_complete(
            user_id=user_id,
            reviews_completed=reviews_after,
        )

        logger.info(
            "Daily goal notification created",
            extra={"user_id": str(user_id), "reviews": reviews_after},
        )

    except Exception as e:
        logger.warning(
            "Failed to check/create daily goal notification",
            extra={"user_id": str(user_id), "error": str(e)},
        )


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

    # Step 3: Track streak before review
    v2_review_repo = CardRecordReviewRepository(db)
    previous_streak = await v2_review_repo.get_streak(current_user.id)

    # Step 4: Count reviews before
    reviews_before = await v2_review_repo.count_reviews_today(current_user.id)

    # Step 5: Process review
    service = V2SM2Service(db)
    result = await service.process_review(
        user_id=current_user.id,
        card_record=card_record,
        quality=review.quality,
        time_taken=review.time_taken,
        user_email=current_user.email,
    )

    # Step 6: Check streak after
    new_streak = await v2_review_repo.get_streak(current_user.id)

    # Step 7: Fire streak milestone event if streak increased
    if new_streak > previous_streak:
        _check_streak_milestone(current_user.id, current_user.email, new_streak, previous_streak)

    # Step 8: Check daily goal notification
    await _check_daily_goal_notification(db, current_user.id, reviews_before)

    # Step 9: Schedule background tasks
    if settings.feature_background_tasks:
        background_tasks.add_task(
            check_achievements_task,
            user_id=current_user.id,
            db_url=settings.database_url,
        )
        background_tasks.add_task(
            log_analytics_task,
            event_type="review_completed",
            user_id=current_user.id,
            data={
                "card_record_id": str(review.card_record_id),
                "quality": review.quality,
                "time_taken": review.time_taken,
                "new_status": result.new_status.value,
            },
        )
        background_tasks.add_task(
            award_flashcard_xp_task,
            user_id=current_user.id,
            card_record_id=card_record.id,
            quality=review.quality,
            db_url=settings.database_url,
        )

    # Step 10: Signal dashboard SSE
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
