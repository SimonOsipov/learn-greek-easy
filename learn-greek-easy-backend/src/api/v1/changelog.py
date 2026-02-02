"""Public changelog API endpoints.

This module provides endpoints for changelog entries:
- GET /api/v1/changelog - List changelog entries with localization

Requires authentication.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.dependencies import get_current_user, get_locale_from_header
from src.db.dependencies import get_db
from src.db.models import User
from src.schemas.changelog import ChangelogListResponse
from src.services import ChangelogService

router = APIRouter()


@router.get(
    "",
    response_model=ChangelogListResponse,
    summary="Get changelog entries",
    description="""
Get a paginated list of changelog entries with localized content.

**Localization**: Content is returned in the language specified by the
Accept-Language header. Supported languages: en (English), el (Greek), ru (Russian).
Falls back to English if the requested language is not supported.

**Pagination**: Use page and page_size parameters for pagination.
Default is 5 items per page, maximum 50.
""",
)
async def get_changelog(
    page: int = Query(default=1, ge=1, description="Page number"),
    page_size: int = Query(default=5, ge=1, le=50, description="Items per page (max 50)"),
    locale: str = Depends(get_locale_from_header),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChangelogListResponse:
    """Get paginated list of changelog entries with localized content.

    Returns changelog entries ordered by creation date (newest first).
    Content is localized based on Accept-Language header.

    Requires authentication.
    """
    service = ChangelogService(db)
    return await service.get_public_list(
        page=page,
        page_size=page_size,
        locale=locale,
    )
