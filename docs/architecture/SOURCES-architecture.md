# [SOURCES] Culture Website Sources Config - Technical Architecture

## Overview

**Feature**: Admin interface to manage news website sources used for AI-powered culture question generation.
**Location**: `/admin/culture/sources` (new tab in admin panel)
**Architecture Pattern**: REST API with Repository Pattern + React UI with TanStack Query

This feature adds full CRUD operations for a `NewsSource` entity that stores website configurations used by the AI question generator. Admin users can add, edit, toggle active status, and delete news sources.

## System Architecture

### Component Diagram

```
Frontend (React)                          Backend (FastAPI)
+------------------------+                +------------------------+
|  AdminPage.tsx         |                |  admin.py router       |
|  - Sources tab         |                |  /admin/culture/sources|
+------------------------+                +------------------------+
           |                                         |
           v                                         v
+------------------------+                +------------------------+
|  NewsSourcesSection    |                |  NewsSourceService     |
|  - Table view          |                |  - CRUD operations     |
|  - Add/Edit modal      |                |  - URL validation      |
+------------------------+                +------------------------+
           |                                         |
           v                                         v
+------------------------+                +------------------------+
|  newsSourceAPI.ts      |   HTTP/REST   |  NewsSourceRepository  |
|  - CRUD methods        | ------------> |  - DB operations       |
+------------------------+                +------------------------+
                                                    |
                                                    v
                                         +------------------------+
                                         |  NewsSource model      |
                                         |  (PostgreSQL)          |
                                         +------------------------+
```

### Data Flow

1. **Admin navigates** to `/admin/culture/sources` tab
2. **Frontend requests** source list via `GET /api/v1/admin/culture/sources`
3. **Backend validates** admin role, queries database
4. **Repository returns** paginated source list
5. **Frontend renders** table with edit/delete actions
6. **CRUD operations** use modal forms and confirmation dialogs

### Integration Points

- **Admin authentication**: Uses existing `get_current_superuser` dependency
- **Database**: PostgreSQL via SQLAlchemy async
- **Frontend state**: TanStack Query for caching and mutations
- **i18n**: Uses existing translation infrastructure

## Data Model

### NewsSource Entity

```python
class NewsSource(Base, TimestampMixin):
    """News website source for AI question generation."""

    __tablename__ = "news_sources"

    # Primary key
    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        server_default=func.uuid_generate_v4(),
    )

    # Source information
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Display name for the source",
    )
    url: Mapped[str] = mapped_column(
        String(500),
        unique=True,
        nullable=False,
        index=True,
        comment="Base URL of the news source (must be unique)",
    )

    # Status
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        index=True,
        comment="Whether source is used for question generation",
    )

    # TimestampMixin provides: created_at, updated_at
```

### Database Migration

```sql
-- Alembic migration
CREATE TABLE news_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    url VARCHAR(500) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_news_sources_is_active ON news_sources(is_active);
CREATE INDEX idx_news_sources_url ON news_sources(url);
```

## API Specifications

### Endpoints

All endpoints are admin-only (require superuser authentication).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/admin/culture/sources` | List all sources (paginated) |
| POST | `/api/v1/admin/culture/sources` | Create new source |
| GET | `/api/v1/admin/culture/sources/{id}` | Get single source |
| PATCH | `/api/v1/admin/culture/sources/{id}` | Update source |
| DELETE | `/api/v1/admin/culture/sources/{id}` | Delete source |

### Request/Response Schemas

```python
# Request: Create Source
class NewsSourceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    url: HttpUrl = Field(..., description="Must be unique")
    is_active: bool = Field(default=True)

# Request: Update Source
class NewsSourceUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    url: Optional[HttpUrl] = None
    is_active: Optional[bool] = None

# Response: Source Item
class NewsSourceResponse(BaseModel):
    id: UUID
    name: str
    url: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

# Response: List
class NewsSourceListResponse(BaseModel):
    sources: List[NewsSourceResponse]
    total: int
    page: int
    page_size: int
```

### Error Responses

| Status | Condition |
|--------|-----------|
| 400 | Invalid URL format |
| 401 | Not authenticated |
| 403 | Not superuser |
| 404 | Source not found |
| 409 | URL already exists (uniqueness violation) |
| 422 | Validation error |

## Implementation Approach

### Backend Code Organization

```
learn-greek-easy-backend/src/
  api/v1/
    admin.py              # Add sources endpoints
  db/
    models.py             # Add NewsSource model
  repositories/
    __init__.py           # Export NewsSourceRepository
    news_source.py        # NEW: NewsSourceRepository
  services/
    __init__.py           # Export NewsSourceService
    news_source_service.py # NEW: NewsSourceService
  schemas/
    admin.py              # Add NewsSource schemas
```

### Frontend Code Organization

```
learn-greek-easy-frontend/src/
  components/admin/
    index.ts              # Export new components
    NewsSourcesSection.tsx     # NEW: Main section with table
    NewsSourceForm.tsx         # NEW: Add/Edit form
    NewsSourceDeleteDialog.tsx # NEW: Delete confirmation
  services/
    adminAPI.ts           # Add source CRUD methods
  i18n/locales/
    en/admin.json         # Add translations
    el/admin.json         # Add Greek translations
    ru/admin.json         # Add Russian translations
```

### Key Implementation Details

1. **URL Validation**:
   - Backend: Use Pydantic `HttpUrl` type for format validation
   - Check uniqueness in repository before create/update
   - Service layer handles uniqueness errors gracefully

2. **Repository Pattern**:
   - Extend `BaseRepository[NewsSource]` for standard CRUD
   - Add `get_by_url()` for uniqueness checks
   - Add `list_active()` for filtering

3. **Service Layer**:
   - Handle URL uniqueness validation
   - Wrap repository calls with business logic
   - Transform exceptions to appropriate HTTP errors

4. **Frontend Components**:
   - Reuse existing patterns from `AdminFeedbackSection`
   - Use `Dialog` for add/edit modal
   - Use `AlertDialog` for delete confirmation
   - TanStack Query for data fetching and mutations

## Security Considerations

1. **Authentication**: All endpoints require valid JWT token
2. **Authorization**: Only superusers can access (uses `get_current_superuser`)
3. **Input Validation**: Pydantic schemas validate all input
4. **URL Safety**: URLs stored as-is, displayed with proper escaping

## Performance & Scalability

1. **Indexing**: `is_active` and `url` columns indexed for fast lookups
2. **Pagination**: Default 10 items per page, max 100
3. **Caching**: TanStack Query handles frontend caching
4. **Query Optimization**: Simple queries, no complex joins needed

## Error Handling & Resilience

1. **Duplicate URL**: Returns 409 Conflict with clear message
2. **Not Found**: Returns 404 with resource identifier
3. **Validation Errors**: Returns 422 with field-level details
4. **Database Errors**: Logged, generic 500 returned to client

## Testing Strategy

### Backend Tests

1. **Unit Tests** (`tests/unit/repositories/test_news_source.py`):
   - Repository CRUD operations
   - URL uniqueness validation
   - Filtering by active status

2. **Unit Tests** (`tests/unit/services/test_news_source_service.py`):
   - Service business logic
   - Error handling for duplicates
   - Partial update handling

3. **Integration Tests** (`tests/integration/api/test_admin_sources.py`):
   - Full API endpoint tests
   - Authentication/authorization
   - Pagination
   - Error responses

### Frontend Tests

1. **Component Tests** (`src/components/admin/__tests__/NewsSourcesSection.test.tsx`):
   - Render states (loading, error, empty, data)
   - Add/edit modal interactions
   - Delete confirmation flow

### E2E Tests

1. **Playwright Tests** (`tests/e2e/admin-sources.spec.ts`):
   - Full CRUD workflow
   - Validation error display
   - Pagination

2. **Visual Tests**:
   - Sources tab screenshot
   - Add/edit modal screenshot
   - Delete dialog screenshot

## Subtasks (Implementation Order)

| Order | Ticket | Description | Testing |
|-------|--------|-------------|---------|
| 1 | SOURCES-01 | Database model + migration | Unit tests for model |
| 2 | SOURCES-02 | Repository layer | Repository unit tests |
| 3 | SOURCES-03 | Service layer | Service unit tests |
| 4 | SOURCES-04 | API endpoints | Integration tests |
| 5 | SOURCES-05 | Frontend API service + types | - |
| 6 | SOURCES-06 | Frontend components (table, modals) | Component tests |
| 7 | SOURCES-07 | i18n translations | - |
| 8 | SOURCES-08 | E2E seed data | - |
| 9 | SOURCES-09 | E2E tests + Visual tests | E2E + Visual tests |

## Branch Strategy

- **Branch**: `feature/culture-sources`
- **PR Strategy**: Single draft PR with `skip-visual` label until all subtasks complete
- **First subtask** (SOURCES-01): Creates branch and draft PR
- **Middle subtasks** (SOURCES-02 to SOURCES-08): Push to existing branch
- **Final subtask** (SOURCES-09): Mark PR ready, remove `skip-visual` label

## Shared Technical Context

### Database Connection
```python
from src.db.dependencies import get_db
```

### Admin Authentication
```python
from src.core.dependencies import get_current_superuser
```

### Base Repository Usage
```python
from src.repositories.base import BaseRepository

class NewsSourceRepository(BaseRepository[NewsSource]):
    def __init__(self, db: AsyncSession):
        super().__init__(NewsSource, db)
```

### Frontend API Pattern
```typescript
import { api } from './api';

export const newsSourceAPI = {
  list: (params) => api.get<ListResponse>('/api/v1/admin/culture/sources', { params }),
  create: (data) => api.post<Response>('/api/v1/admin/culture/sources', data),
  // ...
};
```

### i18n Namespace
```typescript
const { t } = useTranslation('admin');
// Access: t('sources.sectionTitle')
```
