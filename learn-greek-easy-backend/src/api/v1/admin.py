"""Admin API endpoints.

This module provides HTTP endpoints for admin operations including:
- Dashboard statistics (deck and card counts)

All endpoints require superuser authentication.
"""

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.dependencies import get_current_superuser
from src.db.dependencies import get_db
from src.db.models import Card, Deck, User
from src.schemas.admin import AdminStatsResponse, DeckStatsItem

router = APIRouter(
    tags=["Admin"],
    responses={
        401: {"description": "Not authenticated"},
        403: {"description": "Not authorized (requires superuser)"},
        422: {"description": "Validation error"},
    },
)


@router.get(
    "/stats",
    response_model=AdminStatsResponse,
    summary="Get admin dashboard statistics",
    description="Get content statistics including deck and card counts. Requires superuser privileges.",
    responses={
        200: {
            "description": "Admin statistics",
            "content": {
                "application/json": {
                    "example": {
                        "total_decks": 6,
                        "total_cards": 360,
                        "decks": [
                            {
                                "id": "550e8400-e29b-41d4-a716-446655440000",
                                "name": "A1 Vocabulary",
                                "level": "A1",
                                "card_count": 60,
                            }
                        ],
                    }
                }
            },
        },
    },
)
async def get_admin_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> AdminStatsResponse:
    """Get admin dashboard statistics.

    Returns content statistics for the admin dashboard including:
    - Total number of active decks
    - Total number of cards across all active decks
    - Per-deck breakdown with card counts

    Only active decks are included in the statistics.

    Args:
        db: Database session (injected)
        current_user: Authenticated superuser (injected)

    Returns:
        AdminStatsResponse with deck and card counts

    Raises:
        401: If not authenticated
        403: If authenticated but not superuser
    """
    # Subquery to count cards per deck
    card_count_subquery = (
        select(Card.deck_id, func.count(Card.id).label("card_count"))
        .group_by(Card.deck_id)
        .subquery()
    )

    # Main query: get active decks with card counts
    query = (
        select(
            Deck.id,
            Deck.name,
            Deck.level,
            func.coalesce(card_count_subquery.c.card_count, 0).label("card_count"),
        )
        .outerjoin(card_count_subquery, Deck.id == card_count_subquery.c.deck_id)
        .where(Deck.is_active.is_(True))
        .order_by(Deck.level, Deck.name)
    )

    result = await db.execute(query)
    rows = result.all()

    # Build deck stats list
    deck_stats = [
        DeckStatsItem(
            id=row.id,
            name=row.name,
            level=row.level,
            card_count=row.card_count,
        )
        for row in rows
    ]

    # Calculate totals
    total_decks = len(deck_stats)
    total_cards = sum(deck.card_count for deck in deck_stats)

    return AdminStatsResponse(
        total_decks=total_decks,
        total_cards=total_cards,
        decks=deck_stats,
    )
