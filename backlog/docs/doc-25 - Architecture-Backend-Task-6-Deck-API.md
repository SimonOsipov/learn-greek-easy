---
id: doc-25
title: 'Architecture - Backend Task 6: Deck API'
type: other
created_date: '2025-12-07 14:07'
updated_date: '2025-12-07 20:44'
---
# Backend Task 6: Deck API - Technical Design Document

## Overview

**Feature**: RESTful API for deck management (CRUD operations)
**Architecture Pattern**: REST API with Repository Pattern
**API Version**: v1 (mounted at `/api/v1/decks`)

### Goals

1. Provide public endpoints for browsing and searching decks
2. Provide admin-only endpoints for deck management (create, update, delete)
3. Follow existing codebase patterns (FastAPI router, DeckRepository, Pydantic schemas)
4. Implement proper pagination, filtering, and error handling

### Dependencies on Existing Code

| Component | Location | Usage |
|-----------|----------|-------|
| DeckRepository | `src/repositories/deck.py` | `list_active()`, `get_with_cards()`, `count_cards()`, `search()`, inherited CRUD |
| Deck Schemas | `src/schemas/deck.py` | `DeckCreate`, `DeckUpdate`, `DeckResponse`, `DeckListResponse` |
| Auth Dependencies | `src/core/dependencies.py` | `get_current_superuser` for admin endpoints |
| Exceptions | `src/core/exceptions.py` | `DeckNotFoundException`, `ForbiddenException` |
| Database | `src/db/dependencies.py` | `get_db` for session injection |
| Router | `src/api/v1/router.py` | Mount deck router at `/decks` |

## Subtasks Progress

| Subtask | Description | Status | PR |
|---------|-------------|--------|-----|
| 06.01 | Create Deck Router and List Endpoint | ✅ Done | PR #18 |
| 06.02 | Get Single Deck Endpoint | ✅ Done | PR #19 |
| 06.03 | Search Decks Endpoint | ✅ Done | PR #21 |
| 06.04 | Create Deck Endpoint (Admin) | ✅ Done | PR #22 |
| 06.05 | Update and Delete Deck Endpoints (Admin) | ⏸️ To Do | - |
| 06.06 | Deck API Tests | ⏸️ To Do | - |

**Progress: 4/6 subtasks complete (67%)**

## System Architecture

### Component Diagram

```
Client Request
      |
      v
+---------------------+
|  FastAPI Router     |  src/api/v1/decks.py
|  /api/v1/decks      |
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
|  DeckRepository     |  src/repositories/deck.py
|  (existing)         |
+---------------------+
      |
      v
+---------------------+
|  PostgreSQL         |  Deck, Card tables
+---------------------+
```

### Data Flow

1. **List Decks**: Client -> Router -> DeckRepository.list_active() -> Response with pagination
2. **Get Deck**: Client -> Router -> DeckRepository.get_or_404() + count_cards() -> Response with card count
3. **Search Decks**: Client -> Router -> DeckRepository.search() -> Response list
4. **Create Deck**: Client -> Auth (superuser) -> Router -> DeckRepository.create() -> Response
5. **Update Deck**: Client -> Auth (superuser) -> Router -> DeckRepository.get_or_404() + update() -> Response
6. **Delete Deck**: Client -> Auth (superuser) -> Router -> DeckRepository.get_or_404() + soft delete -> Response

## API Specifications

### Endpoints Overview

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/decks` | Public | List active decks (paginated) |
| GET | `/api/v1/decks/{id}` | Public | Get single deck with card count |
| GET | `/api/v1/decks/search` | Public | Search decks by name/description |
| POST | `/api/v1/decks` | Admin | Create new deck |
| PATCH | `/api/v1/decks/{id}` | Admin | Update deck |
| DELETE | `/api/v1/decks/{id}` | Admin | Soft delete deck |

### GET /api/v1/decks

**Purpose**: List all active decks with optional filtering and pagination

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | int | 1 | Page number (min: 1) |
| `page_size` | int | 20 | Items per page (min: 1, max: 100) |
| `level` | DeckLevel | null | Filter by CEFR level (A1, A2, B1, B2, C1, C2) |

**Response** (200 OK):
```json
{
  "total": 42,
  "page": 1,
  "page_size": 20,
  "decks": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Greek A1 Vocabulary",
      "description": "Essential beginner vocabulary",
      "level": "A1",
      "is_active": true,
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

**Implementation Notes**:
- Use `DeckRepository.list_active(skip, limit, level)`
- Calculate `skip` from `(page - 1) * page_size`
- Get total count with separate query for pagination metadata

### GET /api/v1/decks/{id}

**Purpose**: Get a single deck by ID with card count

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Deck UUID |

**Response** (200 OK):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Greek A1 Vocabulary",
  "description": "Essential beginner vocabulary for Greek learners",
  "level": "A1",
  "is_active": true,
  "card_count": 50,
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

**Error Responses**:
- 404: Deck not found
- 422: Invalid UUID format

**Implementation Notes**:
- Use `DeckRepository.get_or_404(id)` to fetch deck
- Use `DeckRepository.count_cards(id)` to get card count
- Return 404 if deck doesn't exist or is inactive for public users

**New Schema Required**:
```python
class DeckDetailResponse(DeckResponse):
    """Deck response with card count."""
    card_count: int
```

### GET /api/v1/decks/search

**Purpose**: Search decks by name or description

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `q` | string | required | Search query (min 1 char) |
| `page` | int | 1 | Page number |
| `page_size` | int | 20 | Items per page (max: 50) |

**Response** (200 OK):
```json
{
  "total": 5,
  "page": 1,
  "page_size": 20,
  "query": "vocabulary",
  "decks": [
    {
      "id": "...",
      "name": "Greek A1 Vocabulary",
      "description": "...",
      "level": "A1",
      "is_active": true,
      "created_at": "...",
      "updated_at": "..."
    }
  ]
}
```

**Error Responses**:
- 422: Missing or empty query parameter

**Implementation Notes**:
- Use `DeckRepository.search(query_text, skip, limit)`
- Only returns active decks (already filtered in repository)

**New Schema Required**:
```python
class DeckSearchResponse(BaseModel):
    """Schema for deck search results."""
    total: int
    page: int
    page_size: int
    query: str
    decks: list[DeckResponse]
```

### POST /api/v1/decks

**Purpose**: Create a new deck (admin only)

**Authentication**: Required (superuser)

**Request Body**:
```json
{
  "name": "Greek B1 Grammar",
  "description": "Intermediate grammar concepts",
  "level": "B1"
}
```

**Response** (201 Created):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Greek B1 Grammar",
  "description": "Intermediate grammar concepts",
  "level": "B1",
  "is_active": true,
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

**Error Responses**:
- 401: Not authenticated
- 403: Not a superuser
- 422: Validation error (missing name, invalid level)

**Implementation Notes**:
- Use `get_current_superuser` dependency
- Use `DeckRepository.create(DeckCreate)`
- Commit transaction and refresh to get generated fields

### PATCH /api/v1/decks/{id}

**Purpose**: Update an existing deck (admin only)

**Authentication**: Required (superuser)

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Deck UUID |

**Request Body** (all fields optional):
```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "level": "B2",
  "is_active": false
}
```

**Response** (200 OK):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Updated Name",
  "description": "Updated description",
  "level": "B2",
  "is_active": false,
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-16T14:00:00Z"
}
```

**Error Responses**:
- 401: Not authenticated
- 403: Not a superuser
- 404: Deck not found
- 422: Validation error

**Implementation Notes**:
- Use `get_current_superuser` dependency
- Use `DeckRepository.get_or_404(id)` to fetch existing deck
- Use `DeckRepository.update(deck, DeckUpdate)` with partial update
- Only update fields that are provided (exclude_unset=True)

### DELETE /api/v1/decks/{id}

**Purpose**: Soft delete a deck (admin only)

**Authentication**: Required (superuser)

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Deck UUID |

**Response** (204 No Content): Empty response

**Error Responses**:
- 401: Not authenticated
- 403: Not a superuser
- 404: Deck not found

**Implementation Notes**:
- Use `get_current_superuser` dependency
- Use `DeckRepository.get_or_404(id)` to verify deck exists
- Soft delete by setting `is_active = False` via update
- Do NOT physically delete the deck (preserves data integrity)

## Data Model

### Existing Entities (No Changes)

The Deck model already exists in `src/db/models.py`:

```python
class Deck(Base, TimestampMixin):
    id: UUID
    name: str (max 255, required)
    description: str | None
    level: DeckLevel (enum: A1, A2, B1, B2, C1, C2)
    is_active: bool (default True)
    created_at: datetime
    updated_at: datetime

    # Relationships
    cards: List[Card]
    user_progress: List[UserDeckProgress]
```

### New Schemas Required

Add to `src/schemas/deck.py`:

```python
class DeckDetailResponse(DeckResponse):
    """Schema for deck detail with card count."""
    card_count: int

class DeckSearchResponse(BaseModel):
    """Schema for deck search results."""
    total: int
    page: int
    page_size: int
    query: str
    decks: list[DeckResponse]
```

## Implementation Approach

### Code Organization

```
src/api/v1/
    __init__.py
    router.py          # Add deck_router import
    auth.py            # Existing
    decks.py           # NEW - Deck endpoints
```

### Router Implementation Pattern

Follow the existing auth.py pattern:

```python
# src/api/v1/decks.py
from fastapi import APIRouter, Depends, Query, status
from uuid import UUID

router = APIRouter(
    tags=["Decks"],
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
from src.api.v1.decks import router as deck_router

v1_router.include_router(
    deck_router,
    prefix="/decks",
    tags=["Decks"],
)
```

## Security Considerations

### Authentication and Authorization

| Endpoint | Auth Required | Role Required |
|----------|---------------|---------------|
| GET /decks | No | - |
| GET /decks/{id} | No | - |
| GET /decks/search | No | - |
| POST /decks | Yes | superuser |
| PATCH /decks/{id} | Yes | superuser |
| DELETE /decks/{id} | Yes | superuser |

### Implementation

- Use `get_current_superuser` dependency for admin endpoints
- Public endpoints should return only active decks (`is_active=True`)
- No need for `get_current_user_optional` as we don't personalize public deck listings

## Error Handling

### Error Responses

Follow existing exception patterns:

```python
from src.core.exceptions import DeckNotFoundException, ForbiddenException

# In endpoint:
deck = await repo.get(deck_id)
if deck is None:
    raise DeckNotFoundException(deck_id=str(deck_id))
```

### Validation Errors

Pydantic handles validation automatically:
- Invalid UUID format -> 422
- Missing required fields -> 422
- Invalid enum values -> 422

## Testing Strategy

### Unit Tests

Location: `tests/unit/api/test_decks.py`

| Test Case | Description |
|-----------|-------------|
| test_list_decks_empty | Empty database returns empty list |
| test_list_decks_pagination | Pagination parameters work correctly |
| test_list_decks_filter_by_level | Level filter returns correct decks |
| test_get_deck_success | Valid ID returns deck with card count |
| test_get_deck_not_found | Invalid ID returns 404 |
| test_search_decks_success | Search returns matching decks |
| test_search_decks_empty_query | Empty query returns 422 |
| test_create_deck_success | Admin can create deck |
| test_create_deck_unauthorized | Non-admin gets 403 |
| test_update_deck_partial | Partial updates work |
| test_delete_deck_soft_delete | Delete sets is_active=False |

### Integration Tests

Location: `tests/integration/api/test_decks.py`

| Test Case | Description |
|-----------|-------------|
| test_deck_crud_flow | Full create-read-update-delete flow |
| test_deck_search_integration | Search with real database |
| test_deck_pagination_integration | Pagination with multiple decks |
| test_deck_auth_integration | Auth checks with real tokens |

### Test Fixtures

Use existing factories:
```python
from tests.factories.content import DeckFactory, CardFactory
from tests.factories.auth import UserFactory

# Create test deck
deck = await DeckFactory.create(session=db_session, a1=True)

# Create deck with cards
deck, cards = await DeckFactory.create_with_cards(session=db_session, card_count=10)

# Create admin user
admin = await UserFactory.create(session=db_session, superuser=True)
```

## Technical Risks and Mitigations

### Identified Risks

1. **N+1 Query on Card Count**
   - **Impact**: Medium
   - **Probability**: Medium (if listing decks with card counts)
   - **Mitigation**: Use single count query per deck, or batch query if needed later

2. **Search Performance at Scale**
   - **Impact**: Medium
   - **Probability**: Low (small dataset initially)
   - **Mitigation**: ILIKE is sufficient for now; add full-text search if needed later

### Technical Debt

- No caching for deck lists (acceptable for MVP)
- Simple ILIKE search (not full-text search)
- Card count requires separate query (could optimize with annotation later)

## Open Questions

### Resolved

1. **Should inactive decks be visible to admins?**
   - Decision: Yes, admins can see all decks via direct ID access

2. **Should search include inactive decks?**
   - Decision: No, search only returns active decks (per repository)

### Assumptions

1. DeckRepository methods work as documented
2. Authentication dependencies (get_current_superuser) work correctly
3. Database connection and session management handled by existing infrastructure
4. Existing DeckCreate/DeckUpdate schemas are sufficient
