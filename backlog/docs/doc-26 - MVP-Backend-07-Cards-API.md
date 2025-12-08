---
id: doc-26
title: 'MVP Backend - 07: Cards API'
type: other
created_date: '2025-12-08 05:17'
updated_date: '2025-12-08 16:46'
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
| 07.03 | Search Cards Endpoint | Done |
| 07.04 | Create Card Endpoint (Admin) | Done |
| 07.05 | Update and Delete Card Endpoints (Admin) | Done |
| 07.06 | Bulk Create Cards Endpoint (Admin) | Done |
| 07.07 | Cards API Tests | Pending |


**Progress: 6/7 subtasks complete (86%)**

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
  "cards": [...]
}
```

**Error Responses**:
- 404: Deck not found (if deck_id provided but invalid)
- 422: Missing or empty query parameter

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
    }
  ]
}
```

**Response** (201 Created):
```json
{
  "deck_id": "550e8400-e29b-41d4-a716-446655440000",
  "created_count": 2,
  "cards": [...]
}
```

**Error Responses**:
- 401: Not authenticated
- 403: Not a superuser
- 404: Deck not found
- 422: Validation error (empty array, too many cards, invalid card data)

### PATCH /api/v1/cards/{id}

**Purpose**: Update an existing card (admin only)

**Authentication**: Required (superuser)

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

**Response** (200 OK): Updated CardResponse

**Error Responses**:
- 401: Not authenticated
- 403: Not a superuser
- 404: Card not found
- 422: Validation error

### DELETE /api/v1/cards/{id}

**Purpose**: Delete a card (admin only)

**Authentication**: Required (superuser)

**Response** (204 No Content): Empty response

**Error Responses**:
- 401: Not authenticated
- 403: Not a superuser
- 404: Card not found

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

## Testing Strategy

### Integration Tests (Located in `tests/integration/api/test_cards.py`)

- TestListCardsIntegration: 14 tests
- TestListCardsValidation: 6 tests
- TestGetCardEndpoint: 5 tests
- TestCreateCardEndpoint: 14 tests (Added in task-152)
- TestBulkCreateCardsEndpoint: 20 tests (Added in task-154)

Total: 59 integration tests passing
