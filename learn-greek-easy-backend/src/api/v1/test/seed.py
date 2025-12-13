"""Seed API endpoints for E2E test database seeding.

IMPORTANT: These endpoints should NEVER be available in production.
The router is only mounted when settings.is_production is False.

Security layers:
1. Router is not mounted in production (checked at import time)
2. verify_seed_access dependency checks is_production again
3. test_seed_enabled must be True
4. Optional X-Test-Seed-Secret header validation
"""

from datetime import datetime, timezone
from time import perf_counter
from typing import Optional

from fastapi import APIRouter, Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.core.exceptions import (
    SeedDisabledException,
    SeedForbiddenException,
    SeedUnauthorizedException,
)
from src.db.dependencies import get_db
from src.schemas.seed import SeedRequest, SeedResultResponse, SeedStatusResponse
from src.services.seed_service import SeedService

router = APIRouter(
    prefix="/test/seed",
    tags=["Testing"],
    responses={
        401: {"description": "Invalid or missing seed secret"},
        403: {"description": "Seeding disabled or production environment"},
    },
)


async def verify_seed_access(
    x_test_seed_secret: Optional[str] = Header(None, alias="X-Test-Seed-Secret"),
) -> None:
    """Dependency to verify seed endpoint access.

    Checks in order:
    1. Not production environment
    2. Seeding is enabled via TEST_SEED_ENABLED
    3. If secret is configured, it must match

    Raises:
        SeedForbiddenException: If production environment
        SeedDisabledException: If seeding is disabled
        SeedUnauthorizedException: If secret is configured but invalid
    """
    if settings.is_production:
        raise SeedForbiddenException()

    if not settings.test_seed_enabled:
        raise SeedDisabledException()

    if settings.seed_requires_secret:
        if not settings.validate_seed_secret(x_test_seed_secret):
            raise SeedUnauthorizedException()


@router.get(
    "/status",
    response_model=SeedStatusResponse,
    summary="Get seed endpoint status",
    description="Check if seeding is available and what's required to use it. "
    "This endpoint does not require authentication.",
)
async def get_seed_status() -> SeedStatusResponse:
    """Get current seed endpoint status without authentication.

    Returns information about:
    - Whether seeding is enabled
    - Current environment
    - Whether a secret is required
    - Any validation errors preventing seeding
    """
    return SeedStatusResponse(
        enabled=settings.can_seed_database(),
        environment=settings.app_env,
        requires_secret=settings.seed_requires_secret,
        validation_errors=settings.get_seed_validation_errors(),
    )


@router.post(
    "/all",
    response_model=SeedResultResponse,
    summary="Seed all data",
    description="Truncate database and seed with complete test dataset. "
    "Creates users, decks, cards, card statistics, and reviews.",
    dependencies=[Depends(verify_seed_access)],
)
async def seed_all(
    request: Optional[SeedRequest] = None,
    db: AsyncSession = Depends(get_db),
) -> SeedResultResponse:
    """Execute full database seeding.

    By default, truncates all tables first, then seeds:
    - 4 test users (learner, beginner, advanced, admin)
    - 6 decks (A1-C2 CEFR levels)
    - 60 cards (10 per deck)
    - Card statistics for the learner user
    - Review history for the learner user

    Args:
        request: Optional request body with seeding options.
            - skip_truncate: If True, don't truncate tables first (additive seeding)
        db: Database session

    Returns:
        SeedResultResponse with operation results and timing
    """
    start_time = perf_counter()

    service = SeedService(db)

    # Handle optional truncation skip
    if request and request.options and request.options.skip_truncate:
        # Manual orchestration without truncate
        users_result = await service.seed_users()
        content_result = await service.seed_decks_and_cards()

        # Get first user and deck for statistics/reviews
        users = users_result.get("users", [])
        decks = content_result.get("decks", [])

        stats_result = {}
        reviews_result = {}

        if users and decks:
            learner = next((u for u in users if "learner" in u.get("email", "")), None)
            first_deck = decks[0] if decks else None

            if learner and first_deck:
                stats_result = await service.seed_card_statistics(
                    user_id=learner["id"],
                    deck_id=first_deck["id"],
                    progress_percent=50,
                )
                # Get first card for reviews
                cards = content_result.get("cards", [])
                if cards:
                    reviews_result = await service.seed_reviews(
                        user_id=learner["id"],
                        card_id=cards[0]["id"],
                        review_count=5,
                    )

        result = {
            "users": users_result,
            "content": content_result,
            "statistics": stats_result,
            "reviews": reviews_result,
        }
    else:
        result = await service.seed_all()

    duration_ms = (perf_counter() - start_time) * 1000

    return SeedResultResponse(
        success=True,
        operation="all",
        timestamp=datetime.now(timezone.utc),
        duration_ms=duration_ms,
        results=result,
    )


@router.post(
    "/truncate",
    response_model=SeedResultResponse,
    summary="Truncate all tables",
    description="Clear all data from the database. " "Tables are truncated in FK-safe order.",
    dependencies=[Depends(verify_seed_access)],
)
async def truncate_tables(
    db: AsyncSession = Depends(get_db),
) -> SeedResultResponse:
    """Truncate all tables without seeding.

    Clears all data in FK-safe order:
    reviews -> card_statistics -> user_deck_progress ->
    refresh_tokens -> user_settings -> cards -> users -> decks

    Returns:
        SeedResultResponse with truncation results and timing
    """
    start_time = perf_counter()
    service = SeedService(db)
    result = await service.truncate_tables()
    await db.commit()
    duration_ms = (perf_counter() - start_time) * 1000

    return SeedResultResponse(
        success=True,
        operation="truncate",
        timestamp=datetime.now(timezone.utc),
        duration_ms=duration_ms,
        results=result,
    )


@router.post(
    "/users",
    response_model=SeedResultResponse,
    summary="Seed users only",
    description="Create test users without other data. "
    "Creates 4 users: learner, beginner, advanced, admin.",
    dependencies=[Depends(verify_seed_access)],
)
async def seed_users(
    db: AsyncSession = Depends(get_db),
) -> SeedResultResponse:
    """Create test users without other data.

    Creates 4 deterministic test users:
    - e2e_learner@test.com: Regular learner with progress
    - e2e_beginner@test.com: New user, no progress
    - e2e_advanced@test.com: Advanced user
    - e2e_admin@test.com: Admin user

    All users have password: TestPassword123!

    Returns:
        SeedResultResponse with user creation results and timing
    """
    start_time = perf_counter()
    service = SeedService(db)
    result = await service.seed_users()
    await db.commit()
    duration_ms = (perf_counter() - start_time) * 1000

    return SeedResultResponse(
        success=True,
        operation="users",
        timestamp=datetime.now(timezone.utc),
        duration_ms=duration_ms,
        results=result,
    )


@router.post(
    "/content",
    response_model=SeedResultResponse,
    summary="Seed decks and cards only",
    description="Create test decks and cards without users or progress. "
    "Creates 6 CEFR-level decks with 10 Greek vocabulary cards each.",
    dependencies=[Depends(verify_seed_access)],
)
async def seed_content(
    db: AsyncSession = Depends(get_db),
) -> SeedResultResponse:
    """Create test decks and cards without users or progress.

    Creates:
    - 6 decks (A1, A2, B1, B2, C1, C2 CEFR levels)
    - 60 cards total (10 Greek vocabulary cards per deck)

    Returns:
        SeedResultResponse with content creation results and timing
    """
    start_time = perf_counter()
    service = SeedService(db)
    result = await service.seed_decks_and_cards()
    await db.commit()
    duration_ms = (perf_counter() - start_time) * 1000

    return SeedResultResponse(
        success=True,
        operation="content",
        timestamp=datetime.now(timezone.utc),
        duration_ms=duration_ms,
        results=result,
    )
