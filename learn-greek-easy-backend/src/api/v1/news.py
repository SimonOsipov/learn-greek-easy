"""Public news feed API endpoints.

This module provides public endpoints for news items:
- GET /api/v1/news - List news items with pagination and card associations
- GET /api/v1/news/{id}/card - Get the card associated with a news item
- GET /api/v1/news/{id} - Get a single news item

All endpoints are public (no authentication required).
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.logging import get_logger
from src.db.dependencies import get_db
from src.db.models import NewsCountry
from src.schemas.news_item import NewsCardInfo, NewsItemListWithCardsResponse, NewsItemResponse
from src.services.news_item_service import NewsItemService

logger = get_logger(__name__)

router = APIRouter()


@router.get(
    "",
    response_model=NewsItemListWithCardsResponse,
    summary="List news items with card info",
    description="Get a paginated list of news items ordered by publication date (newest first). Includes card_id and deck_id for items with associated questions.",
    responses={
        200: {
            "description": "Paginated list of news items with card associations",
            "content": {
                "application/json": {
                    "example": {
                        "total": 15,
                        "page": 1,
                        "page_size": 10,
                        "items": [
                            {
                                "id": "550e8400-e29b-41d4-a716-446655440000",
                                "title_el": "Ελληνικός Τίτλος",
                                "title_en": "English Title",
                                "title_ru": "Русский заголовок",
                                "description_el": "Ελληνική περιγραφή",
                                "description_en": "English description",
                                "description_ru": "Русское описание",
                                "publication_date": "2024-01-15",
                                "original_article_url": "https://example.com/article",
                                "image_url": "https://s3.amazonaws.com/...",
                                "created_at": "2024-01-15T10:30:00Z",
                                "updated_at": "2024-01-15T10:30:00Z",
                                "card_id": "660e8400-e29b-41d4-a716-446655440001",
                                "deck_id": "770e8400-e29b-41d4-a716-446655440002",
                            },
                            {
                                "id": "880e8400-e29b-41d4-a716-446655440003",
                                "title_el": "Άλλος τίτλος",
                                "title_en": "Another title",
                                "title_ru": "Другой заголовок",
                                "description_el": "Άλλη περιγραφή",
                                "description_en": "Another description",
                                "description_ru": "Другое описание",
                                "publication_date": "2024-01-14",
                                "original_article_url": "https://example.com/article2",
                                "image_url": "https://s3.amazonaws.com/...",
                                "created_at": "2024-01-14T10:30:00Z",
                                "updated_at": "2024-01-14T10:30:00Z",
                                "card_id": None,
                                "deck_id": None,
                            },
                        ],
                    }
                }
            },
        },
    },
)
async def list_news_items(
    page: int = Query(default=1, ge=1, description="Page number"),
    page_size: int = Query(default=10, ge=1, le=50, description="Items per page"),
    country: Optional[NewsCountry] = Query(
        None, description="Filter by country: cyprus, greece, or world"
    ),
    db: AsyncSession = Depends(get_db),
) -> NewsItemListWithCardsResponse:
    """Get paginated list of news items with card associations (public, no auth required).

    Returns news items ordered by publication date (newest first).
    Includes card_id and deck_id for items with associated culture questions.

    Args:
        page: Page number (1-indexed)
        page_size: Number of items per page (max 50)
        country: Optional country filter (cyprus, greece, or world)
        db: Database session (injected)

    Returns:
        NewsItemListWithCardsResponse with paginated news items and card info
    """
    service = NewsItemService(db)
    return await service.get_list_with_cards(page=page, page_size=page_size, country=country)


@router.get(
    "/{news_item_id}/card",
    response_model=NewsCardInfo,
    summary="Get card for news item",
    description="Get the culture question card associated with a news item.",
    responses={
        200: {
            "description": "Card info",
            "content": {
                "application/json": {
                    "example": {
                        "card_id": "660e8400-e29b-41d4-a716-446655440001",
                        "deck_id": "770e8400-e29b-41d4-a716-446655440002",
                    }
                }
            },
        },
        404: {"description": "News item not found or no associated card"},
    },
)
async def get_news_card(
    news_item_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> NewsCardInfo:
    """Get card associated with a news item.

    Args:
        news_item_id: UUID of the news item
        db: Database session (injected)

    Returns:
        NewsCardInfo with card_id and deck_id

    Raises:
        404: If news item not found or no associated card
    """
    service = NewsItemService(db)
    return await service.get_card_for_news(news_item_id)


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
