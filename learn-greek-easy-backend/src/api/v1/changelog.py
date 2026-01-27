"""Public changelog API endpoints.

This module provides endpoints for changelog entries:
- GET /api/v1/changelog - List changelog entries with localization

Requires authentication.
"""

from fastapi import APIRouter, Depends, Header, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.dependencies import get_current_user
from src.db.dependencies import get_db
from src.db.models import User
from src.schemas.changelog import ChangelogListResponse
from src.services import ChangelogService

router = APIRouter()


def parse_accept_language(accept_language: str | None) -> str:
    """Parse Accept-Language header to extract preferred locale.

    Supports formats:
    - "el" -> "el"
    - "el-GR" -> "el"
    - "el,en;q=0.9" -> "el" (highest priority)

    Args:
        accept_language: Raw Accept-Language header value

    Returns:
        Two-letter locale code (defaults to "en" if parsing fails)
    """
    if not accept_language:
        return "en"

    # Split by comma and process each language tag
    languages = []
    for part in accept_language.split(","):
        part = part.strip()
        if not part:
            continue

        # Split language from quality factor (e.g., "el;q=0.9")
        if ";" in part:
            lang_part, q_part = part.split(";", 1)
            lang_part = lang_part.strip()
            try:
                q_value = float(q_part.strip().replace("q=", ""))
            except ValueError:
                q_value = 1.0
        else:
            lang_part = part
            q_value = 1.0

        # Extract base language (e.g., "el-GR" -> "el")
        base_lang = lang_part.split("-")[0].lower()

        if base_lang:
            languages.append((base_lang, q_value))

    # Sort by quality factor (descending) and return highest
    if languages:
        languages.sort(key=lambda x: x[1], reverse=True)
        return languages[0][0]

    return "en"


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
    accept_language: str | None = Header(default=None, alias="Accept-Language"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChangelogListResponse:
    """Get paginated list of changelog entries with localized content.

    Returns changelog entries ordered by creation date (newest first).
    Content is localized based on Accept-Language header.

    Requires authentication.
    """
    locale = parse_accept_language(accept_language)

    service = ChangelogService(db)
    return await service.get_public_list(
        page=page,
        page_size=page_size,
        locale=locale,
    )
