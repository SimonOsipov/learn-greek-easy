---
id: doc-26
title: 'MVP Backend - 07: Cards API'
type: other
created_date: '2025-12-08 05:17'
updated_date: '2025-12-08 07:03'
---
# Backend Task 07: Cards API - Technical Design Document

## Overview

**Feature**: RESTful API for card management (CRUD operations)
**Architecture Pattern**: REST API with Repository Pattern
**API Version**: v1 (mounted at `/api/v1/cards`)

### Goals

1. Provide public endpoints for browsing cards within a deck
2. Provide admin-only endpoints for card management (create, update, delete)
3. Support search and filtering by deck, difficulty, and text
4. Follow existing codebase patterns (FastAPI router, CardRepository, Pydantic schemas)
5. Implement proper pagination, error handling, and validation

### Dependencies on Existing Code

| Component | Location | Usage |
|-----------|----------|-------|
| CardRepository | `src/repositories/card.py` | `get_by_deck()`, `get_by_difficulty()`, `bulk_create()`, inherited CRUD |
| Card Schemas | `src/schemas/card.py` | `CardCreate`, `CardUpdate`, `CardResponse`, `CardStudyResponse` |
| Auth Dependencies | `src/core/dependencies.py` | `get_current_superuser` for admin endpoints |
| Exceptions | `src/core/exceptions.py` | `CardNotFoundException`, `DeckNotFoundException`, `ForbiddenException` |
| Database | `src/db/dependencies.py` | `get_db` for session injection |
| DeckRepository | `src/repositories/deck.py` | Validate deck exists before card operations |
| Router | `src/api/v1/router.py` | Mount card router at `/cards` |

## Subtasks Progress

| Subtask | Description | Status |
|---------|-------------|--------|
| 07.01 | Create Card Router and List by Deck Endpoint | Done |
| 07.02 | Get Single Card Endpoint | Done |
| 07.03 | Search Cards Endpoint | Pending |
| 07.04 | Create Card Endpoint (Admin) | Pending |
| 07.05 | Update and Delete Card Endpoints (Admin) | Pending |
| 07.06 | Bulk Create Cards Endpoint (Admin) | Pending |
| 07.07 | Cards API Tests | Pending |


**Progress: 2/7 subtasks complete (29%)**

## System Architecture

### Component Diagram

```
Client Request
      |
      v
+---------------------+
|  FastAPI Router     |  src/api/v1/cards.py
|  /api/v1/cards      |
+---------------------+
      |
      v
+---------------------+
|  Auth Dependencies  |  get_current_superuser (admin endpoints)
|                     |  get_current_user_optional (public endpoints)
+---------------------+
      |
      v
+---------------------+
|  CardRepository     |  src/repositories/card.py
|  DeckRepository     |  src/repositories/deck.py (for validation)
+---------------------+
      |
      v
+---------------------+
|  PostgreSQL         |  Card, Deck tables
+---------------------+
```

### Data Flow

1. **List Cards by Deck**: Client -> Router -> DeckRepository.get_or_404() -> CardRepository.get_by_deck() -> Response with pagination
2. **Get Card**: Client -> Router -> CardRepository.get_or_404() -> Response
3. **Search Cards**: Client -> Router -> CardRepository.search() -> Response list
4. **Create Card**: Client -> Auth (superuser) -> Router -> DeckRepository.get_or_404() -> CardRepository.create() -> Response
5. **Update Card**: Client -> Auth (superuser) -> Router -> CardRepository.get_or_404() + update() -> Response
6. **Delete Card**: Client -> Auth (superuser) -> Router -> CardRepository.get_or_404() + delete() -> Response
7. **Bulk Create**: Client -> Auth (superuser) -> Router -> DeckRepository.get_or_404() -> CardRepository.bulk_create() -> Response

## API Specifications

### Endpoints Overview

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/cards` | Public | List cards with optional deck/difficulty filter |
| GET | `/api/v1/cards/{id}` | Public | Get single card by ID |
| GET | `/api/v1/cards/search` | Public | Search cards by text |
| POST | `/api/v1/cards` | Admin | Create new card |
| POST | `/api/v1/cards/bulk` | Admin | Bulk create cards |
| PATCH | `/api/v1/cards/{id}` | Admin | Update card |
| DELETE | `/api/v1/cards/{id}` | Admin | Delete card (hard delete) |

### GET /api/v1/cards

**Purpose**: List cards with optional filtering by deck and difficulty

**Query Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `deck_id` | UUID | **Yes** | - | Filter by deck (required for context) |
| `difficulty` | CardDifficulty | No | null | Filter by difficulty (easy, medium, hard) |
| `page` | int | No | 1 | Page number (min: 1) |
| `page_size` | int | No | 50 | Items per page (min: 1, max: 100) |

**Response** (200 OK):
```json
{
  "total": 150,
  "page": 1,
  "page_size": 50,
  "deck_id": "550e8400-e29b-41d4-a716-446655440000",
  "cards": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "deck_id": "550e8400-e29b-41d4-a716-446655440000",
      "front_text": "kalimera",
      "back_text": "good morning",
      "example_sentence": "Kalimera! Pos eisai;",
      "pronunciation": "kalimera",
      "difficulty": "easy",
      "order_index": 1,
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

**Error Responses**:
- 404: Deck not found (invalid deck_id)
- 422: Validation error (missing deck_id, invalid UUID format)

**Implementation Notes**:
- Deck ID is required to prevent listing all cards across all decks (performance)
- Use `CardRepository.get_by_deck(deck_id, skip, limit)` for basic listing
- Use `CardRepository.get_by_difficulty(deck_id, difficulty)` when difficulty filter is set
- Validate deck exists using `DeckRepository.get_or_404()`
- Cards are ordered by `order_index` (ascending)

**New Schema Required**:
```python
class CardListResponse(BaseModel):
    """Schema for paginated card list."""
    total: int
    page: int
    page_size: int
    deck_id: UUID
    cards: list[CardResponse]
```

### GET /api/v1/cards/{id}

**Purpose**: Get a single card by ID

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Card UUID |

**Response** (200 OK):
```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "deck_id": "550e8400-e29b-41d4-a716-446655440000",
  "front_text": "kalimera",
  "back_text": "good morning",
  "example_sentence": "Kalimera! Pos eisai;",
  "pronunciation": "kalimera",
  "difficulty": "easy",
  "order_index": 1,
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

**Error Responses**:
- 404: Card not found
- 422: Invalid UUID format

**Implementation Notes**:
- Use `CardRepository.get_or_404(id)` to fetch card
- Return full card details including deck_id for context

### GET /api/v1/cards/search

**Purpose**: Search cards by Greek or English text

**Query Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `q` | string | **Yes** | - | Search query (min 1 char) |
| `deck_id` | UUID | No | null | Optional: limit search to specific deck |
| `page` | int | No | 1 | Page number |
| `page_size` | int | No | 20 | Items per page (max: 50) |

**Response** (200 OK):
```json
{
  "total": 5,
  "page": 1,
  "page_size": 20,
  "query": "morning",
  "deck_id": null,
  "cards": [
    {
      "id": "...",
      "deck_id": "...",
      "front_text": "kalimera",
      "back_text": "good morning",
      "example_sentence": "...",
      "pronunciation": "kalimera",
      "difficulty": "easy",
      "order_index": 1,
      "created_at": "...",
      "updated_at": "..."
    }
  ]
}
```

**Error Responses**:
- 404: Deck not found (if deck_id provided but invalid)
- 422: Missing or empty query parameter

**Implementation Notes**:
- Search in `front_text`, `back_text`, and `example_sentence`
- Use ILIKE for case-insensitive partial matching
- If `deck_id` provided, validate deck exists first
- **Requires new repository method**: `CardRepository.search()`

**New Schema Required**:
```python
class CardSearchResponse(BaseModel):
    """Schema for card search results."""
    total: int
    page: int
    page_size: int
    query: str
    deck_id: UUID | None
    cards: list[CardResponse]
```

**New Repository Method Required**:
```python
async def search(
    self,
    query_text: str,
    deck_id: UUID | None = None,
    *,
    skip: int = 0,
    limit: int = 50,
) -> list[Card]:
    """Search cards by text in front_text, back_text, example_sentence."""
```

### POST /api/v1/cards

**Purpose**: Create a new card (admin only)

**Authentication**: Required (superuser)

**Request Body**:
```json
{
  "deck_id": "550e8400-e29b-41d4-a716-446655440000",
  "front_text": "efharisto",
  "back_text": "thank you",
  "example_sentence": "Efharisto poly!",
  "pronunciation": "efharisto",
  "difficulty": "easy",
  "order_index": 0
}
```

**Validation Rules**:
- `deck_id`: Required, must be valid UUID, deck must exist
- `front_text`: Required, min 1 character (Greek text)
- `back_text`: Required, min 1 character (English translation)
- `example_sentence`: Optional
- `pronunciation`: Optional, max 255 characters
- `difficulty`: Required, one of: easy, medium, hard
- `order_index`: Optional, defaults to 0, must be >= 0

**Response** (201 Created):
```json
{
  "id": "660e8400-e29b-41d4-a716-446655440002",
  "deck_id": "550e8400-e29b-41d4-a716-446655440000",
  "front_text": "efharisto",
  "back_text": "thank you",
  "example_sentence": "Efharisto poly!",
  "pronunciation": "efharisto",
  "difficulty": "easy",
  "order_index": 0,
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

**Error Responses**:
- 401: Not authenticated
- 403: Not a superuser
- 404: Deck not found
- 422: Validation error

**Implementation Notes**:
- Use `get_current_superuser` dependency
- Validate deck exists using `DeckRepository.get_or_404(deck_id)`
- Use `CardRepository.create(CardCreate)`
- Commit transaction and refresh to get generated fields

### POST /api/v1/cards/bulk

**Purpose**: Create multiple cards in one request (admin only)

**Authentication**: Required (superuser)

**Request Body**:
```json
{
  "deck_id": "550e8400-e29b-41d4-a716-446655440000",
  "cards": [
    {
      "front_text": "kalimera",
      "back_text": "good morning",
      "difficulty": "easy",
      "order_index": 1
    },
    {
      "front_text": "kalispera",
      "back_text": "good evening",
      "difficulty": "easy",
      "order_index": 2
    }
  ]
}
```

**Validation Rules**:
- `deck_id`: Required, must be valid UUID, deck must exist
- `cards`: Required, array of 1-100 card objects
- Each card follows same validation as single card create (excluding deck_id)

**Response** (201 Created):
```json
{
  "deck_id": "550e8400-e29b-41d4-a716-446655440000",
  "created_count": 2,
  "cards": [
    {
      "id": "...",
      "deck_id": "...",
      "front_text": "kalimera",
      "back_text": "good morning",
      ...
    },
    {
      "id": "...",
      "deck_id": "...",
      "front_text": "kalispera",
      "back_text": "good evening",
      ...
    }
  ]
}
```

**Error Responses**:
- 401: Not authenticated
- 403: Not a superuser
- 404: Deck not found
- 422: Validation error (empty array, too many cards, invalid card data)

**Implementation Notes**:
- Use `get_current_superuser` dependency
- Validate deck exists
- Limit to 100 cards per request for performance
- Use `CardRepository.bulk_create()` for efficient insertion
- All-or-nothing: if any card fails validation, reject entire request

**New Schemas Required**:
```python
class CardBulkItemCreate(BaseModel):
    """Single card in bulk create (without deck_id)."""
    front_text: str = Field(..., min_length=1)
    back_text: str = Field(..., min_length=1)
    example_sentence: Optional[str] = None
    pronunciation: Optional[str] = Field(None, max_length=255)
    difficulty: CardDifficulty
    order_index: int = Field(default=0, ge=0)

class CardBulkCreateRequest(BaseModel):
    """Request body for bulk card creation."""
    deck_id: UUID
    cards: list[CardBulkItemCreate] = Field(..., min_length=1, max_length=100)

class CardBulkCreateResponse(BaseModel):
    """Response for bulk card creation."""
    deck_id: UUID
    created_count: int
    cards: list[CardResponse]
```

### PATCH /api/v1/cards/{id}

**Purpose**: Update an existing card (admin only)

**Authentication**: Required (superuser)

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Card UUID |

**Request Body** (all fields optional):
```json
{
  "front_text": "Updated Greek text",
  "back_text": "Updated English text",
  "example_sentence": "Updated example",
  "pronunciation": "updated-pronunciation",
  "difficulty": "hard",
  "order_index": 5
}
```

**Validation Rules**:
- `front_text`: If provided, min 1 character
- `back_text`: If provided, min 1 character
- `pronunciation`: If provided, max 255 characters
- `order_index`: If provided, must be >= 0
- Note: `deck_id` cannot be changed (cards cannot be moved between decks)

**Response** (200 OK):
```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "deck_id": "550e8400-e29b-41d4-a716-446655440000",
  "front_text": "Updated Greek text",
  "back_text": "Updated English text",
  "example_sentence": "Updated example",
  "pronunciation": "updated-pronunciation",
  "difficulty": "hard",
  "order_index": 5,
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-16T14:00:00Z"
}
```

**Error Responses**:
- 401: Not authenticated
- 403: Not a superuser
- 404: Card not found
- 422: Validation error

**Implementation Notes**:
- Use `get_current_superuser` dependency
- Use `CardRepository.get_or_404(id)` to fetch existing card
- Use `CardRepository.update(card, CardUpdate)` with partial update
- Only update fields that are provided (exclude_unset=True)
- Deck ID is NOT updatable (design decision for data integrity)

### DELETE /api/v1/cards/{id}

**Purpose**: Delete a card (admin only)

**Authentication**: Required (superuser)

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Card UUID |

**Response** (204 No Content): Empty response

**Error Responses**:
- 401: Not authenticated
- 403: Not a superuser
- 404: Card not found

**Implementation Notes**:
- Use `get_current_superuser` dependency
- Use `CardRepository.get_or_404(id)` to verify card exists
- **Hard delete**: Unlike decks, cards are physically deleted
- This is acceptable because:
  - Cards don't have soft-delete semantics (no `is_active` field)
  - Related `card_statistics` and `reviews` cascade delete via FK
  - Deck remains intact; only the card is removed

## Data Model

### Existing Entity (No Changes Required)

The Card model already exists in `src/db/models.py`:

```python
class Card(Base, TimestampMixin):
    id: UUID (PK, auto-generated)
    deck_id: UUID (FK -> decks.id, CASCADE delete)
    front_text: str (Text, required) - Greek text
    back_text: str (Text, required) - English translation
    example_sentence: str | None (Text)
    pronunciation: str | None (max 255)
    difficulty: CardDifficulty (enum: easy, medium, hard)
    order_index: int (default 0) - For sequential display
    created_at: datetime
    updated_at: datetime

    # Relationships
    deck: Deck
    statistics: List[CardStatistics]
    reviews: List[Review]
```

### Existing Schemas (In `src/schemas/card.py`)

- `CardBase` - Base with common fields
- `CardCreate` - For creating (includes deck_id)
- `CardUpdate` - For updating (all optional)
- `CardResponse` - Standard response
- `CardStudyResponse` - Limited info for study (front only)

### New Schemas Required

Add to `src/schemas/card.py`:

```python
class CardListResponse(BaseModel):
    """Schema for paginated card list by deck."""
    total: int
    page: int
    page_size: int
    deck_id: UUID
    cards: list[CardResponse]

class CardSearchResponse(BaseModel):
    """Schema for card search results."""
    total: int
    page: int
    page_size: int
    query: str
    deck_id: UUID | None
    cards: list[CardResponse]

class CardBulkItemCreate(BaseModel):
    """Single card in bulk create (without deck_id)."""
    front_text: str = Field(..., min_length=1)
    back_text: str = Field(..., min_length=1)
    example_sentence: Optional[str] = None
    pronunciation: Optional[str] = Field(None, max_length=255)
    difficulty: CardDifficulty
    order_index: int = Field(default=0, ge=0)

class CardBulkCreateRequest(BaseModel):
    """Request body for bulk card creation."""
    deck_id: UUID
    cards: list[CardBulkItemCreate] = Field(..., min_length=1, max_length=100)

class CardBulkCreateResponse(BaseModel):
    """Response for bulk card creation."""
    deck_id: UUID
    created_count: int
    cards: list[CardResponse]
```

## Repository Enhancements

### New Methods for CardRepository

Add to `src/repositories/card.py`:

```python
async def count_by_deck(self, deck_id: UUID) -> int:
    """Count total cards in a deck."""
    query = select(func.count()).select_from(Card).where(Card.deck_id == deck_id)
    result = await self.db.execute(query)
    return result.scalar_one()

async def search(
    self,
    query_text: str,
    deck_id: UUID | None = None,
    *,
    skip: int = 0,
    limit: int = 50,
) -> list[Card]:
    """Search cards by text in front_text, back_text, example_sentence.

    Args:
        query_text: Search query (case-insensitive)
        deck_id: Optional deck filter
        skip: Pagination offset
        limit: Max results

    Returns:
        List of matching cards ordered by order_index
    """
    query = select(Card).where(
        or_(
            Card.front_text.ilike(f"%{query_text}%"),
            Card.back_text.ilike(f"%{query_text}%"),
            Card.example_sentence.ilike(f"%{query_text}%"),
        )
    )

    if deck_id:
        query = query.where(Card.deck_id == deck_id)

    query = query.order_by(Card.order_index).offset(skip).limit(limit)
    result = await self.db.execute(query)
    return list(result.scalars().all())

async def count_search(
    self,
    query_text: str,
    deck_id: UUID | None = None,
) -> int:
    """Count cards matching search query."""
    query = select(func.count()).select_from(Card).where(
        or_(
            Card.front_text.ilike(f"%{query_text}%"),
            Card.back_text.ilike(f"%{query_text}%"),
            Card.example_sentence.ilike(f"%{query_text}%"),
        )
    )

    if deck_id:
        query = query.where(Card.deck_id == deck_id)

    result = await self.db.execute(query)
    return result.scalar_one()
```

## Implementation Approach

### Code Organization

```
src/api/v1/
    __init__.py
    router.py          # Add card_router import
    auth.py            # Existing
    decks.py           # Existing
    cards.py           # NEW - Card endpoints
```

### Router Implementation Pattern

Follow the existing decks.py pattern:

```python
# src/api/v1/cards.py
from fastapi import APIRouter, Depends, Query, Response, status
from uuid import UUID

router = APIRouter(
    tags=["Cards"],
    responses={
        401: {"description": "Authentication required"},
        403: {"description": "Admin privileges required"},
        422: {"description": "Validation error"},
    },
)

# Public endpoints first, then admin endpoints
```

### Register Router

Update `src/api/v1/router.py`:

```python
from src.api.v1.cards import router as card_router

v1_router.include_router(
    card_router,
    prefix="/cards",
    tags=["Cards"],
)
```

## Security Considerations

### Authentication and Authorization

| Endpoint | Auth Required | Role Required |
|----------|---------------|---------------|
| GET /cards | No | - |
| GET /cards/{id} | No | - |
| GET /cards/search | No | - |
| POST /cards | Yes | superuser |
| POST /cards/bulk | Yes | superuser |
| PATCH /cards/{id} | Yes | superuser |
| DELETE /cards/{id} | Yes | superuser |

### Implementation

- Use `get_current_superuser` dependency for admin endpoints
- Public endpoints require deck context (deck_id) for listing
- All cards in active decks are visible to public
- No user-specific card visibility (cards are shared content)

### Input Validation

- All text inputs are sanitized by Pydantic
- UUIDs validated by FastAPI/Pydantic
- Search queries use parameterized ILIKE (SQL injection safe)
- Bulk create limited to 100 cards to prevent DoS

## Error Handling

### Error Responses

Follow existing exception patterns:

```python
from src.core.exceptions import CardNotFoundException, DeckNotFoundException

# Card not found
card = await repo.get(card_id)
if card is None:
    raise CardNotFoundException(card_id=str(card_id))

# Deck not found (for card listing/creation)
deck = await deck_repo.get(deck_id)
if deck is None:
    raise DeckNotFoundException(deck_id=str(deck_id))
```

### Validation Errors

Pydantic handles validation automatically:
- Invalid UUID format -> 422
- Missing required fields -> 422
- Invalid enum values -> 422
- String length violations -> 422

## Performance Considerations

### Database Indexes

The Card model already has appropriate indexes:
- `deck_id` - Foreign key index (for filtering by deck)
- `difficulty` - Index (for difficulty filtering)

### Query Optimization

1. **List by Deck**: Uses indexed `deck_id` column
2. **Filter by Difficulty**: Uses indexed `difficulty` column
3. **Search**: ILIKE queries - acceptable for MVP dataset size
   - Consider adding PostgreSQL full-text search for future scaling

### Pagination

- Default page size: 50 for listing, 20 for search
- Max page size: 100 for listing, 50 for search
- Required `deck_id` for listing prevents full table scans

## Testing Strategy

### Unit Tests

Location: `tests/unit/api/test_cards.py`

| Test Case | Description |
|-----------|-------------|
| test_list_cards_empty_deck | Empty deck returns empty list |
| test_list_cards_pagination | Pagination parameters work correctly |
| test_list_cards_filter_by_difficulty | Difficulty filter returns correct cards |
| test_list_cards_invalid_deck | Invalid deck_id returns 404 |
| test_get_card_success | Valid ID returns card |
| test_get_card_not_found | Invalid ID returns 404 |
| test_search_cards_success | Search returns matching cards |
| test_search_cards_empty_query | Empty query returns 422 |
| test_search_cards_with_deck_filter | Search with deck_id filter works |
| test_create_card_success | Admin can create card |
| test_create_card_invalid_deck | Invalid deck_id returns 404 |
| test_create_card_unauthorized | Non-admin gets 403 |
| test_bulk_create_cards_success | Admin can bulk create |
| test_bulk_create_cards_limit | Over 100 cards returns 422 |
| test_update_card_partial | Partial updates work |
| test_update_card_no_deck_change | deck_id not updatable |
| test_delete_card_success | Admin can delete card |

### Integration Tests

Location: `tests/integration/api/test_cards.py`

| Test Case | Description |
|-----------|-------------|
| test_card_crud_flow | Full create-read-update-delete flow |
| test_card_search_integration | Search with real database |
| test_card_pagination_integration | Pagination with many cards |
| test_bulk_create_integration | Bulk create with database |
| test_card_auth_integration | Auth checks with real tokens |
| test_card_deck_relationship | Card properly linked to deck |

### Test Fixtures

Use existing factories:
```python
from tests.factories.content import DeckFactory, CardFactory
from tests.factories.auth import UserFactory

# Create deck with cards
deck, cards = await DeckFactory.create_with_cards(session=db_session, card_count=10)

# Create single card
card = await CardFactory.create(session=db_session, deck_id=deck.id)

# Create admin user
admin = await UserFactory.create(session=db_session, superuser=True)
```

## Technical Risks and Mitigations

### Identified Risks

1. **Bulk Create Performance**
   - **Impact**: Medium
   - **Probability**: Low
   - **Mitigation**: Limit to 100 cards, use `bulk_create()` with single flush

2. **Search Performance at Scale**
   - **Impact**: Medium
   - **Probability**: Low (small dataset initially)
   - **Mitigation**: ILIKE is sufficient for MVP; add full-text search later if needed

3. **Cascade Delete Data Loss**
   - **Impact**: High
   - **Probability**: Low (admin-only operation)
   - **Mitigation**: Warn in API docs; consider adding confirmation in frontend

### Technical Debt

- No soft-delete for cards (acceptable for MVP)
- Simple ILIKE search (not full-text search)
- No card reordering endpoint (can use bulk update via PATCH)

## Open Questions

### Resolved

1. **Should cards have soft delete like decks?**
   - Decision: No, hard delete is acceptable. Cards don't need historical preservation like decks.

2. **Should deck_id be updatable in card update?**
   - Decision: No, cards cannot move between decks. This simplifies data integrity.

3. **Should card listing require deck_id?**
   - Decision: Yes, to prevent listing all cards globally (performance concern).

### Assumptions

1. CardRepository methods work as documented
2. DeckRepository.get_or_404() properly validates deck existence
3. Authentication dependencies work correctly
4. Cascade delete is acceptable for card statistics/reviews
5. Maximum 100 cards per bulk create is sufficient for admin workflows
