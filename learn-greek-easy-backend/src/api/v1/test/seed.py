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
from pydantic import BaseModel, EmailStr
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.core.exceptions import (
    SeedDisabledException,
    SeedForbiddenException,
    SeedUnauthorizedException,
)
from src.core.security import create_access_token, create_refresh_token
from src.db.dependencies import get_db
from src.db.models import NewsItem
from src.repositories.user import UserRepository
from src.schemas.seed import SeedRequest, SeedResultResponse, SeedStatusResponse
from src.services.seed_service import SeedService


class TestAuthRequest(BaseModel):
    """Request model for test authentication."""

    email: EmailStr


class TestCreateUserRequest(BaseModel):
    """Request model for creating a test user."""

    email: EmailStr
    full_name: str = "E2E Test User"


class TestAuthResponse(BaseModel):
    """Response model for test authentication."""

    success: bool
    access_token: str
    refresh_token: str
    token_type: str = "Bearer"
    user_id: str
    email: str
    is_superuser: bool


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

        # Create user-owned decks (My Decks feature)
        user_decks_result = await service.seed_user_decks(users_result["users"])

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
            "user_decks": user_decks_result,
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


@router.post(
    "/culture",
    response_model=SeedResultResponse,
    summary="Seed culture decks and questions only",
    description="Create culture decks and questions without users or progress. "
    "Creates 5 culture decks with 10 Greek culture questions each.",
    dependencies=[Depends(verify_seed_access)],
)
async def seed_culture(
    db: AsyncSession = Depends(get_db),
) -> SeedResultResponse:
    """Create culture decks and questions without users or progress.

    Creates:
    - 5 culture decks (History, Geography, Politics, Culture, Traditions)
    - 50 questions total (10 trilingual questions per deck: el, en, ru)

    Returns:
        SeedResultResponse with culture content creation results and timing
    """
    start_time = perf_counter()
    service = SeedService(db)
    result = await service.seed_culture_decks_and_questions()
    await db.commit()
    duration_ms = (perf_counter() - start_time) * 1000

    return SeedResultResponse(
        success=True,
        operation="culture",
        timestamp=datetime.now(timezone.utc),
        duration_ms=duration_ms,
        results=result,
    )


@router.post(
    "/mock-exams",
    response_model=SeedResultResponse,
    summary="Seed mock exam history",
    description="Create mock exam history for the learner test user. "
    "Creates 5 completed mock exam sessions (3 passed, 2 failed). "
    "Requires culture questions to be seeded first.",
    dependencies=[Depends(verify_seed_access)],
)
async def seed_mock_exams(
    db: AsyncSession = Depends(get_db),
) -> SeedResultResponse:
    """Create mock exam history for learner user.

    Creates:
    - 5 mock exam sessions (3 passed, 2 failed with 80% threshold)
    - 125 mock exam answers (25 per session)

    Requires culture questions to be seeded first (seed_all or seed_culture).

    Returns:
        SeedResultResponse with mock exam creation results and timing
    """
    start_time = perf_counter()
    service = SeedService(db)

    # Get learner user
    user_repo = UserRepository(db)
    learner = await user_repo.get_by_email("e2e_learner@test.com")

    if not learner:
        return SeedResultResponse(
            success=False,
            operation="mock-exams",
            timestamp=datetime.now(timezone.utc),
            duration_ms=(perf_counter() - start_time) * 1000,
            results={"error": "Learner user not found. Run /api/v1/test/seed/users first."},
        )

    result = await service.seed_mock_exam_history(user_id=learner.id)
    await db.commit()
    duration_ms = (perf_counter() - start_time) * 1000

    return SeedResultResponse(
        success=result.get("success", False),
        operation="mock-exams",
        timestamp=datetime.now(timezone.utc),
        duration_ms=duration_ms,
        results=result,
    )


@router.post(
    "/pending-question",
    response_model=SeedResultResponse,
    summary="Seed a pending culture question",
    description="Creates a pending review question for testing the review UI.",
)
async def seed_pending_question(
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_seed_access),
) -> SeedResultResponse:
    """Seed a pending culture question for review testing."""
    start = perf_counter()

    service = SeedService(db)
    result = await service.seed_pending_question()
    await db.commit()

    duration_ms = (perf_counter() - start) * 1000

    return SeedResultResponse(
        success=True,
        operation="pending-question",
        timestamp=datetime.now(timezone.utc),
        duration_ms=round(duration_ms, 2),
        results=result,
    )


@router.post(
    "/news-feed",
    response_model=SeedResultResponse,
    summary="Seed news feed items",
    description="Create test news items for E2E testing.",
    dependencies=[Depends(verify_seed_access)],
)
async def seed_news_feed(
    db: AsyncSession = Depends(get_db),
) -> SeedResultResponse:
    """Create news feed test items for E2E testing."""
    start_time = perf_counter()

    seed_service = SeedService(db)
    result = await seed_service.seed_news_items()
    await db.commit()

    duration_ms = (perf_counter() - start_time) * 1000

    return SeedResultResponse(
        success=result.get("success", False),
        operation="news-feed",
        timestamp=datetime.now(timezone.utc),
        duration_ms=duration_ms,
        results=result,
    )


@router.post(
    "/news-questions",
    response_model=SeedResultResponse,
    summary="Seed news items with questions",
    description="Create test news items with and without associated culture questions for E2E testing.",
    dependencies=[Depends(verify_seed_access)],
)
async def seed_news_questions(
    db: AsyncSession = Depends(get_db),
) -> SeedResultResponse:
    """Seed news items with culture questions for E2E testing.

    Creates:
    - 2 NewsItems WITH associated CultureQuestions
    - 1 NewsItem WITHOUT associated question
    - Uses/creates 'E2E News Questions' culture deck
    """
    start_time = perf_counter()

    service = SeedService(db)
    result = await service.seed_news_questions()
    await db.commit()

    duration_ms = (perf_counter() - start_time) * 1000

    return SeedResultResponse(
        success=result.get("success", False),
        operation="news-questions",
        timestamp=datetime.now(timezone.utc),
        duration_ms=duration_ms,
        results=result,
    )


@router.post(
    "/news-feed-page",
    response_model=SeedResultResponse,
    summary="Seed news feed page",
    description="Create comprehensive test news items for E2E testing of the News Feed Page. "
    "Creates 25 news items (10 with questions, 15 without) with varied categories and difficulty levels.",
    dependencies=[Depends(verify_seed_access)],
)
async def seed_news_feed_page(
    db: AsyncSession = Depends(get_db),
) -> SeedResultResponse:
    """Seed news items for E2E testing of the News Feed Page.

    Creates:
    - 25 NewsItems with varied categories and difficulty levels
    - 10 items WITH associated CultureQuestions (3-5 questions each)
    - 15 items WITHOUT associated questions
    - Publication dates spread over the last 30 days

    This endpoint is idempotent - it clears existing test data before seeding.

    Returns:
        SeedResultResponse with news item and question creation results
    """
    start_time = perf_counter()

    service = SeedService(db)
    result = await service.seed_news_feed_page()
    await db.commit()

    duration_ms = (perf_counter() - start_time) * 1000

    return SeedResultResponse(
        success=result.get("success", False),
        operation="news-feed-page",
        timestamp=datetime.now(timezone.utc),
        duration_ms=duration_ms,
        results=result,
    )


@router.post(
    "/news-feed/clear",
    response_model=SeedResultResponse,
    summary="Clear news items only",
    description="Clear only news items without affecting other data.",
    dependencies=[Depends(verify_seed_access)],
)
async def clear_news_items(
    db: AsyncSession = Depends(get_db),
) -> SeedResultResponse:
    """Clear only news items from the database.

    Unlike /truncate, this only affects the news_items table,
    leaving users, decks, cards, and other data intact.

    Returns:
        SeedResultResponse with clear operation results and timing
    """
    start_time = perf_counter()

    # Delete only news items
    await db.execute(delete(NewsItem))
    await db.commit()

    duration_ms = (perf_counter() - start_time) * 1000

    return SeedResultResponse(
        success=True,
        operation="clear_news",
        timestamp=datetime.now(timezone.utc),
        duration_ms=duration_ms,
        results={"cleared": True, "table": "news_items"},
    )


@router.post(
    "/auth",
    response_model=TestAuthResponse,
    summary="Get auth tokens for test user",
    description="Generate authentication tokens for a seeded test user. "
    "ONLY available when TEST_SEED_ENABLED=true and NOT in production. "
    "This endpoint bypasses normal authentication for E2E testing.",
    dependencies=[Depends(verify_seed_access)],
)
async def get_test_auth(
    request: TestAuthRequest,
    db: AsyncSession = Depends(get_db),
) -> TestAuthResponse:
    """Generate auth tokens for a test user by email.

    This endpoint allows E2E tests to authenticate as seeded users without
    going through Auth0 or the legacy login flow. It's gated behind the
    same security checks as other seed endpoints.

    Args:
        request: Contains the email of the test user
        db: Database session

    Returns:
        TestAuthResponse with access and refresh tokens

    Raises:
        HTTPException 404: If user not found
        HTTPException 403: If seeding is disabled or in production
    """
    from fastapi import HTTPException

    user_repo = UserRepository(db)
    user = await user_repo.get_by_email(request.email)

    if not user:
        raise HTTPException(
            status_code=404,
            detail=f"Test user not found: {request.email}. "
            "Make sure to seed the database first with POST /api/v1/test/seed/all",
        )

    # Generate tokens for the test user
    # create_access_token returns (token, expires_at)
    # create_refresh_token returns (token, expires_at, token_id)
    access_token, _ = create_access_token(user_id=user.id)
    refresh_token, _, _ = create_refresh_token(user_id=user.id)

    return TestAuthResponse(
        success=True,
        access_token=access_token,
        refresh_token=refresh_token,
        user_id=str(user.id),
        email=user.email,
        is_superuser=user.is_superuser,
    )


@router.post(
    "/create-user",
    response_model=TestAuthResponse,
    summary="Create test user and get auth tokens",
    description="Create a new test user with custom email and return authentication tokens. "
    "ONLY available when TEST_SEED_ENABLED=true and NOT in production. "
    "This endpoint replaces the old /auth/register for E2E testing.",
    dependencies=[Depends(verify_seed_access)],
)
async def create_test_user(
    request: TestCreateUserRequest,
    db: AsyncSession = Depends(get_db),
) -> TestAuthResponse:
    """Create a test user and return auth tokens.

    This endpoint creates a new user in the database and returns authentication
    tokens, replacing the legacy /auth/register endpoint for E2E tests.

    Args:
        request: Contains email and optional full_name
        db: Database session

    Returns:
        TestAuthResponse with access and refresh tokens

    Raises:
        HTTPException 409: If user with email already exists
        HTTPException 403: If seeding is disabled or in production
    """
    from fastapi import HTTPException

    from src.db.models import User, UserSettings

    user_repo = UserRepository(db)
    existing_user = await user_repo.get_by_email(request.email)

    if existing_user:
        raise HTTPException(
            status_code=409,
            detail=f"User with email {request.email} already exists.",
        )

    # Create user directly in the database
    user = User(
        email=request.email,
        full_name=request.full_name,
        password_hash=None,  # No password for test users
        is_active=True,
    )
    db.add(user)
    await db.flush()  # Get user ID

    # Create default user settings
    settings = UserSettings(user_id=user.id)
    db.add(settings)
    await db.commit()

    # Generate tokens for the new user
    access_token, _ = create_access_token(user_id=user.id)
    refresh_token, _, _ = create_refresh_token(user_id=user.id)

    return TestAuthResponse(
        success=True,
        access_token=access_token,
        refresh_token=refresh_token,
        user_id=str(user.id),
        email=user.email,
        is_superuser=user.is_superuser,
    )


@router.post(
    "/danger-zone",
    response_model=SeedResultResponse,
    summary="Seed danger zone test users",
    description="Create test users for danger zone E2E tests. "
    "Creates e2e_danger_reset@test.com (full data) and "
    "e2e_danger_delete@test.com (minimal data). "
    "Requires /seed/content and /seed/culture to be called first.",
    dependencies=[Depends(verify_seed_access)],
)
async def seed_danger_zone(
    db: AsyncSession = Depends(get_db),
) -> SeedResultResponse:
    """Create danger zone test users with appropriate data states.

    Creates two test users for E2E testing:
    - e2e_danger_reset@test.com: Full progress data for reset testing
    - e2e_danger_delete@test.com: Minimal data for deletion testing

    This endpoint is idempotent - it deletes existing users before recreating.
    Requires /seed/content and /seed/culture to be called first for full data.

    Returns:
        SeedResultResponse with user creation results and timing
    """
    start_time = perf_counter()

    seed_service = SeedService(db)
    result = await seed_service.seed_danger_zone_users()
    await db.commit()

    duration_ms = (perf_counter() - start_time) * 1000

    return SeedResultResponse(
        success=result.get("success", False),
        operation="danger-zone",
        timestamp=datetime.now(timezone.utc),
        duration_ms=duration_ms,
        results=result,
    )
