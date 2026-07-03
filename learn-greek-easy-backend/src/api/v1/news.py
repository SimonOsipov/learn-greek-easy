"""Public news feed API endpoints.

This module provides public endpoints for news items:
- GET /api/v1/news - List news items with pagination
- GET /api/v1/news/{id} - Get a single news item

All endpoints are public (no authentication required).
"""

import hashlib
import json
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, Response
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.core.cache import get_cache
from src.core.logging import get_logger
from src.db.dependencies import get_db
from src.db.models import NewsCountry
from src.schemas.news_item import NewsItemResponse, NewsSlimListResponse
from src.services.news_item_service import NewsItemService

logger = get_logger(__name__)

router = APIRouter()

_NEWS_CACHE_CONTROL = "public, max-age=300"


def _news_cache_key(
    country: Optional[NewsCountry],
    q: Optional[str],
    page: int,
    page_size: int,
) -> str:
    """Build the shared Redis key for the public news list.

    The free-text ``q`` is HASHED (never embedded verbatim) so two distinct
    colon-laden values can't collide against the ``:`` key separator (F5); a
    blank/whitespace-only or absent ``q`` collapses to the literal ``none``
    segment, and an absent country to ``all`` (mirrors the deck-list precedent
    at ``src/api/v1/decks.py``).
    """
    country_seg = country.value if country else "all"
    if q and q.strip():
        q_hash = hashlib.sha1(q.strip().lower().encode()).hexdigest()[:16]
    else:
        q_hash = "none"
    return f"news:list:{country_seg}:{q_hash}:{page}:{page_size}"


def _news_etag(body: dict) -> str:
    """Compute a strong ETag over the serialized slim-list body.

    Uses a stable canonical JSON dump (sorted keys, no whitespace) so the ETag
    is deterministic for identical content within a TTL window (presigned URLs
    are floor-stable, so the body/ETag don't churn — D8).
    """
    canonical = json.dumps(body, sort_keys=True, separators=(",", ":"), default=str)
    return '"' + hashlib.sha1(canonical.encode()).hexdigest() + '"'


@router.get(
    "",
    response_model=NewsSlimListResponse,
    summary="List news items",
    description=(
        "Get a paginated list of news items ordered by publication date (newest first). "
        "List items are the card-only slim shape (PERF-17-01); the full tree "
        "(word_timestamps, linked_situation) is available on GET /news/{id}."
    ),
    responses={
        200: {
            "description": "Paginated list of slim news items",
            "content": {
                "application/json": {
                    "example": {
                        "total": 15,
                        "page": 1,
                        "page_size": 10,
                        "audio_count": 12,
                        "country_counts": {"cyprus": 6, "greece": 5, "world": 4},
                        "items": [
                            {
                                "id": "550e8400-e29b-41d4-a716-446655440000",
                                "situation_id": "660e8400-e29b-41d4-a716-446655440001",
                                "title_el": "Ελληνικός Τίτλος",
                                "title_en": "English Title",
                                "title_ru": "Русский заголовок",
                                "title_el_a2": None,
                                "description_el": "Ελληνική περιγραφή",
                                "description_el_a2": None,
                                "has_a2_content": False,
                                "publication_date": "2024-01-15",
                                "country": "cyprus",
                                "original_article_url": "https://example.com/article",
                                "image_url": "https://s3.amazonaws.com/...",
                                "image_variants": None,
                                "audio_url": None,
                                "audio_duration_seconds": None,
                                "audio_a2_url": None,
                                "audio_a2_duration_seconds": None,
                            },
                        ],
                    }
                }
            },
        },
    },
)
async def list_news_items(
    request: Request,
    response: Response,
    page: int = Query(default=1, ge=1, description="Page number"),
    page_size: int = Query(default=10, ge=1, le=50, description="Items per page"),
    country: Optional[NewsCountry] = Query(
        None, description="Filter by country: cyprus, greece, or world"
    ),
    q: Optional[str] = Query(
        default=None,
        description=(
            "Optional search term. Accent- and case-insensitive substring match across "
            "the item title, body (B1 and A2), and source URL. "
            "Blank or whitespace-only values are treated as no filter."
        ),
    ),
    db: AsyncSession = Depends(get_db),
) -> NewsSlimListResponse | Response:
    """Get paginated list of news items in the card-only slim shape (public, no auth).

    Returns news items ordered by publication date (newest first). Slim items
    drop the reader-only word_timestamps / linked_situation and card-unused
    metadata (PERF-17-01); the reader fetches those from GET /news/{id}.

    HTTP + Redis cacheable (PERF-17-02): the public (published-only) list is
    served through a shared Redis entry keyed by
    ``news:list:{country}:{q_hash}:{page}:{page_size}`` and carries
    ``Cache-Control: public, max-age=300`` plus a strong ETag. A matching
    ``If-None-Match`` short-circuits to a 304 with an empty body. No ``Vary``
    header — the slim item carries all locales, so the body is
    locale-independent (D6).

    Args:
        request: Incoming request (read for If-None-Match — injected)
        response: Outgoing response (Cache-Control/ETag headers — injected)
        page: Page number (1-indexed)
        page_size: Number of items per page (max 50)
        country: Optional country filter (cyprus, greece, or world)
        q: Optional search term (accent+case-insensitive substring)
        db: Database session (injected)

    Returns:
        NewsSlimListResponse with paginated slim news items
    """
    service = NewsItemService(db)
    cache = get_cache()
    key = _news_cache_key(country=country, q=q, page=page, page_size=page_size)

    async def _factory() -> dict:
        result = await service.get_list_slim(page=page, page_size=page_size, country=country, q=q)
        return result.model_dump(mode="json")

    cached = await cache.get_or_set(key, _factory, ttl=settings.cache_news_list_ttl)  # type: ignore[arg-type]

    if cached is not None:
        try:
            body = NewsSlimListResponse.model_validate(cached)
            body_dict = cached
        except ValidationError:
            body = await service.get_list_slim(page=page, page_size=page_size, country=country, q=q)
            body_dict = body.model_dump(mode="json")
    else:
        body = await service.get_list_slim(page=page, page_size=page_size, country=country, q=q)
        body_dict = body.model_dump(mode="json")

    etag = _news_etag(body_dict)

    # If-None-Match match -> 304 with empty body (bypasses response_model).
    if request.headers.get("if-none-match") == etag:
        return Response(
            status_code=304,
            headers={"ETag": etag, "Cache-Control": _NEWS_CACHE_CONTROL},
        )

    response.headers["Cache-Control"] = _NEWS_CACHE_CONTROL
    response.headers["ETag"] = etag
    return body


@router.get(
    "/{news_item_id}",
    response_model=NewsItemResponse,
    summary="Get news item",
    description="Get a single news item by ID.",
    responses={
        200: {
            "description": "News item details",
            "content": {
                "application/json": {
                    "example": {
                        "id": "550e8400-e29b-41d4-a716-446655440000",
                        "title_el": "Ελληνικός Τίτλος",
                        "title_en": "English Title",
                        "description_el": "Ελληνική περιγραφή",
                        "description_en": "English description",
                        "publication_date": "2024-01-15",
                        "original_article_url": "https://example.com/article",
                        "image_url": "https://s3.amazonaws.com/...",
                        "created_at": "2024-01-15T10:30:00Z",
                        "updated_at": "2024-01-15T10:30:00Z",
                    }
                }
            },
        },
        404: {"description": "News item not found"},
    },
)
async def get_news_item(
    news_item_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> NewsItemResponse:
    """Get a single news item by ID (public, no auth required).

    Args:
        news_item_id: UUID of the news item
        db: Database session (injected)

    Returns:
        NewsItemResponse with news item details

    Raises:
        404: If news item not found
    """
    service = NewsItemService(db)
    return await service.get_by_id(news_item_id)
