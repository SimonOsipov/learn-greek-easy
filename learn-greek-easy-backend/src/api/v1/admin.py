"""Admin API endpoints.

This module provides HTTP endpoints for admin operations including:
- Dashboard statistics (deck and card counts)
- Unified deck listing with search and pagination

All endpoints require superuser authentication.
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.dependencies import get_current_superuser
from src.db.dependencies import get_db
from src.db.models import Card, CultureDeck, CultureQuestion, Deck, User
from src.schemas.admin import (
    AdminDeckListResponse,
    AdminStatsResponse,
    CultureDeckStatsItem,
    DeckStatsItem,
    UnifiedDeckItem,
)

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
                        "total_decks": 8,
                        "total_cards": 450,
                        "total_vocabulary_decks": 6,
                        "total_culture_decks": 2,
                        "total_vocabulary_cards": 360,
                        "total_culture_questions": 90,
                        "decks": [
                            {
                                "id": "550e8400-e29b-41d4-a716-446655440000",
                                "name": "A1 Vocabulary",
                                "level": "A1",
                                "card_count": 60,
                            }
                        ],
                        "culture_decks": [
                            {
                                "id": "660e8400-e29b-41d4-a716-446655440000",
                                "name": {"el": "Ιστορία", "en": "History", "ru": "История"},
                                "category": "history",
                                "question_count": 45,
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
    - Total number of active decks (vocabulary + culture)
    - Total number of items across all active decks (cards + questions)
    - Per-deck breakdown with counts

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
    # ========================================
    # Vocabulary Decks Statistics
    # ========================================

    # Subquery to count cards per vocabulary deck
    card_count_subquery = (
        select(Card.deck_id, func.count(Card.id).label("card_count"))
        .group_by(Card.deck_id)
        .subquery()
    )

    # Main query: get active vocabulary decks with card counts
    vocab_query = (
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

    vocab_result = await db.execute(vocab_query)
    vocab_rows = vocab_result.all()

    # Build vocabulary deck stats list
    deck_stats = [
        DeckStatsItem(
            id=row.id,
            name=row.name,
            level=row.level,
            card_count=row.card_count,
        )
        for row in vocab_rows
    ]

    # Calculate vocabulary totals
    total_vocabulary_decks = len(deck_stats)
    total_vocabulary_cards = sum(deck.card_count for deck in deck_stats)

    # ========================================
    # Culture Decks Statistics
    # ========================================

    # Subquery to count questions per culture deck (only from active decks)
    question_count_subquery = (
        select(
            CultureQuestion.deck_id,
            func.count(CultureQuestion.id).label("question_count"),
        )
        .join(CultureDeck, CultureQuestion.deck_id == CultureDeck.id)
        .where(CultureDeck.is_active.is_(True))
        .group_by(CultureQuestion.deck_id)
        .subquery()
    )

    # Main query: get active culture decks with question counts
    culture_query = (
        select(
            CultureDeck.id,
            CultureDeck.name,
            CultureDeck.category,
            func.coalesce(question_count_subquery.c.question_count, 0).label("question_count"),
        )
        .outerjoin(question_count_subquery, CultureDeck.id == question_count_subquery.c.deck_id)
        .where(CultureDeck.is_active.is_(True))
        .order_by(CultureDeck.category, CultureDeck.order_index)
    )

    culture_result = await db.execute(culture_query)
    culture_rows = culture_result.all()

    # Build culture deck stats list
    culture_deck_stats = [
        CultureDeckStatsItem(
            id=row.id,
            name=row.name,
            category=row.category,
            question_count=row.question_count,
        )
        for row in culture_rows
    ]

    # Calculate culture totals
    total_culture_decks = len(culture_deck_stats)
    total_culture_questions = sum(deck.question_count for deck in culture_deck_stats)

    # ========================================
    # Combined Totals
    # ========================================
    total_decks = total_vocabulary_decks + total_culture_decks
    total_cards = total_vocabulary_cards + total_culture_questions

    return AdminStatsResponse(
        total_decks=total_decks,
        total_cards=total_cards,
        total_vocabulary_decks=total_vocabulary_decks,
        total_culture_decks=total_culture_decks,
        total_vocabulary_cards=total_vocabulary_cards,
        total_culture_questions=total_culture_questions,
        decks=deck_stats,
        culture_decks=culture_deck_stats,
    )


@router.get(
    "/decks",
    response_model=AdminDeckListResponse,
    summary="List all decks with search and pagination",
    description="Get a paginated list of all decks (vocabulary and culture) with optional search and filtering.",
    responses={
        200: {
            "description": "Paginated deck list",
            "content": {
                "application/json": {
                    "example": {
                        "decks": [
                            {
                                "id": "550e8400-e29b-41d4-a716-446655440000",
                                "name": "A1 Vocabulary",
                                "type": "vocabulary",
                                "level": "A1",
                                "category": None,
                                "item_count": 60,
                                "is_active": True,
                                "created_at": "2024-01-15T10:30:00Z",
                            }
                        ],
                        "total": 8,
                        "page": 1,
                        "page_size": 10,
                    }
                }
            },
        },
    },
)
async def list_decks(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(10, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search term for deck name"),
    type: Optional[str] = Query(
        None,
        description="Filter by type: 'vocabulary' or 'culture'",
        regex="^(vocabulary|culture)$",
    ),
) -> AdminDeckListResponse:
    """List all decks with search and pagination.

    Returns a paginated list of all decks (vocabulary and culture) with optional
    filtering by type and case-insensitive search by name.

    Args:
        db: Database session (injected)
        current_user: Authenticated superuser (injected)
        page: Page number (1-indexed)
        page_size: Number of items per page (max 100)
        search: Optional search term for deck name (case-insensitive)
        type: Optional filter by deck type ('vocabulary' or 'culture')

    Returns:
        AdminDeckListResponse with paginated deck list

    Raises:
        401: If not authenticated
        403: If authenticated but not superuser
    """
    unified_decks: list[UnifiedDeckItem] = []
    vocab_count = 0
    culture_count = 0

    # ========================================
    # Vocabulary Decks Query
    # ========================================
    if type is None or type == "vocabulary":
        # Count cards per vocabulary deck
        vocab_card_count_subquery = (
            select(Card.deck_id, func.count(Card.id).label("card_count"))
            .group_by(Card.deck_id)
            .subquery()
        )

        vocab_query = (
            select(
                Deck.id,
                Deck.name,
                Deck.level,
                Deck.is_active,
                Deck.created_at,
                func.coalesce(vocab_card_count_subquery.c.card_count, 0).label("item_count"),
            )
            .outerjoin(vocab_card_count_subquery, Deck.id == vocab_card_count_subquery.c.deck_id)
            .where(Deck.is_active.is_(True))
        )

        # Apply search filter
        if search:
            vocab_query = vocab_query.where(Deck.name.ilike(f"%{search}%"))

        # Get total count for vocabulary
        vocab_count_query = select(func.count()).select_from(vocab_query.subquery())
        vocab_count_result = await db.execute(vocab_count_query)
        vocab_count = vocab_count_result.scalar() or 0

        vocab_result = await db.execute(vocab_query.order_by(Deck.created_at.desc()))
        vocab_rows = vocab_result.all()

        for row in vocab_rows:
            unified_decks.append(
                UnifiedDeckItem(
                    id=row.id,
                    name=row.name,
                    type="vocabulary",
                    level=row.level,
                    category=None,
                    item_count=row.item_count,
                    is_active=row.is_active,
                    created_at=row.created_at,
                )
            )

    # ========================================
    # Culture Decks Query
    # ========================================
    if type is None or type == "culture":
        # Count questions per culture deck
        culture_question_count_subquery = (
            select(
                CultureQuestion.deck_id,
                func.count(CultureQuestion.id).label("question_count"),
            )
            .group_by(CultureQuestion.deck_id)
            .subquery()
        )

        culture_query = (
            select(
                CultureDeck.id,
                CultureDeck.name,
                CultureDeck.category,
                CultureDeck.is_active,
                CultureDeck.created_at,
                func.coalesce(culture_question_count_subquery.c.question_count, 0).label(
                    "item_count"
                ),
            )
            .outerjoin(
                culture_question_count_subquery,
                CultureDeck.id == culture_question_count_subquery.c.deck_id,
            )
            .where(CultureDeck.is_active.is_(True))
        )

        # Apply search filter (search in English name field)
        if search:
            culture_query = culture_query.where(
                CultureDeck.name["en"].astext.ilike(f"%{search}%")
            )

        # Get total count for culture
        culture_count_query = select(func.count()).select_from(culture_query.subquery())
        culture_count_result = await db.execute(culture_count_query)
        culture_count = culture_count_result.scalar() or 0

        culture_result = await db.execute(culture_query.order_by(CultureDeck.created_at.desc()))
        culture_rows = culture_result.all()

        for row in culture_rows:
            unified_decks.append(
                UnifiedDeckItem(
                    id=row.id,
                    name=row.name,
                    type="culture",
                    level=None,
                    category=row.category,
                    item_count=row.item_count,
                    is_active=row.is_active,
                    created_at=row.created_at,
                )
            )

    # ========================================
    # Sort and Paginate Combined Results
    # ========================================
    # Sort by created_at DESC
    unified_decks.sort(key=lambda d: d.created_at, reverse=True)

    total = vocab_count + culture_count
    offset = (page - 1) * page_size
    paginated_decks = unified_decks[offset : offset + page_size]

    return AdminDeckListResponse(
        decks=paginated_decks,
        total=total,
        page=page,
        page_size=page_size,
    )
