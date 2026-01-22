# Culture News HTML Scraper - Technical Architecture

## Overview

**Feature**: Background task system that fetches raw HTML from configured news sources on a schedule and stores it for later AI processing. Includes admin UI reorganization with tabbed navigation.

**PRD Reference**: `/home/dev/tasks/Culture - News HTML Scraper.md`

**Architecture Pattern**:
- Backend: Repository pattern with service layer, APScheduler for background tasks
- Frontend: React with tabbed navigation, component-based architecture

## System Architecture

### Component Diagram

```
+------------------+     +-------------------+     +------------------+
|   Admin UI       |     |   Backend API     |     |   Scheduler      |
|  (React + Tabs)  |---->|   (FastAPI)       |     |   (APScheduler)  |
+------------------+     +-------------------+     +------------------+
        |                        |                        |
        |                        v                        |
        |                +-------------------+            |
        |                |  NewsSourceService|<-----------+
        |                |  FetchService     |
        |                +-------------------+
        |                        |
        v                        v
+------------------+     +-------------------+
|   Translation    |     |   PostgreSQL      |
|   (i18n keys)    |     |   - news_sources  |
+------------------+     |   - source_fetch  |
                         |     _history      |
                         +-------------------+
```

### Components

1. **SourceFetchHistory Model** - New database table for fetch history
2. **SourceFetchRepository** - Data access for fetch history
3. **SourceFetchService** - Business logic for HTML fetching
4. **Admin API Endpoints** - Manual fetch trigger, history retrieval
5. **Scheduler Task** - Daily automated fetching
6. **Admin UI Tabs** - Reorganized Culture section with Decks/News tabs
7. **E2E Seed Data** - Test data for fetch history

### Data Flow

1. **Scheduled Fetch Flow**:
   - APScheduler triggers `fetch_all_active_sources_task` at 06:00 EET daily
   - Task queries all active NewsSource records
   - For each source, fetches HTML via httpx
   - Stores result in SourceFetchHistory (success or error)

2. **Manual Fetch Flow**:
   - Admin clicks "Fetch Now" button on any source (active or inactive)
   - POST to `/api/v1/admin/culture/sources/{id}/fetch`
   - Service fetches HTML synchronously
   - Returns fetch result immediately

3. **History Viewing Flow**:
   - Admin expands source row to see history
   - GET to `/api/v1/admin/culture/sources/{id}/history`
   - Returns last N fetch attempts with metadata
   - Click on successful entry shows raw HTML in modal

## Data Model

### SourceFetchHistory (New Table)

```sql
CREATE TABLE source_fetch_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id UUID NOT NULL REFERENCES news_sources(id) ON DELETE CASCADE,
    fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    status VARCHAR(20) NOT NULL,  -- 'success' or 'error'
    html_content TEXT,            -- NULL if error
    html_size_bytes INTEGER,      -- NULL if error
    error_message VARCHAR(500),   -- NULL if success
    trigger_type VARCHAR(20) NOT NULL,  -- 'manual' or 'scheduled'
    final_url VARCHAR(500),       -- Final URL after redirects (optional)
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fetch_history_source_fetched
    ON source_fetch_history(source_id, fetched_at DESC);
```

### SQLAlchemy Model

```python
class SourceFetchHistory(Base, TimestampMixin):
    """HTML fetch history for news sources."""

    __tablename__ = "source_fetch_history"

    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        server_default=func.uuid_generate_v4(),
    )
    source_id: Mapped[UUID] = mapped_column(
        ForeignKey("news_sources.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        comment="'success' or 'error'",
    )
    html_content: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Raw HTML content (null if error)",
    )
    html_size_bytes: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    error_message: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )
    trigger_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        comment="'manual' or 'scheduled'",
    )
    final_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        comment="Final URL after redirects",
    )

    # Relationship
    source: Mapped["NewsSource"] = relationship(
        back_populates="fetch_history",
        lazy="selectin",
    )
```

### Update NewsSource Model

Add relationship to existing NewsSource:

```python
# In NewsSource model
fetch_history: Mapped[List["SourceFetchHistory"]] = relationship(
    back_populates="source",
    lazy="selectin",
    cascade="all, delete-orphan",
)
```

## API Specifications

### Trigger Manual Fetch

```
POST /api/v1/admin/culture/sources/{source_id}/fetch
```

**Response** (201 Created):
```json
{
  "id": "uuid",
  "source_id": "uuid",
  "fetched_at": "2024-01-20T10:30:00Z",
  "status": "success",
  "html_size_bytes": 45230,
  "trigger_type": "manual",
  "final_url": "https://example.com/news"
}
```

**Response** (201 Created - Error Case):
```json
{
  "id": "uuid",
  "source_id": "uuid",
  "fetched_at": "2024-01-20T10:30:00Z",
  "status": "error",
  "error_message": "Connection timeout after 30s",
  "trigger_type": "manual"
}
```

### Get Fetch History

```
GET /api/v1/admin/culture/sources/{source_id}/history?limit=10
```

**Query Parameters**:
- `limit`: Max results (default 10, max 50)

**Response** (200 OK):
```json
{
  "items": [
    {
      "id": "uuid",
      "fetched_at": "2024-01-20T10:30:00Z",
      "status": "success",
      "html_size_bytes": 45230,
      "trigger_type": "scheduled",
      "final_url": "https://example.com/news"
    },
    {
      "id": "uuid",
      "fetched_at": "2024-01-19T06:00:00Z",
      "status": "error",
      "error_message": "Connection refused",
      "trigger_type": "scheduled"
    }
  ],
  "total": 15
}
```

### Get Fetch HTML Content

```
GET /api/v1/admin/culture/sources/history/{history_id}/html
```

**Response** (200 OK):
```json
{
  "id": "uuid",
  "html_content": "<!DOCTYPE html>...",
  "fetched_at": "2024-01-20T10:30:00Z",
  "final_url": "https://example.com/news"
}
```

**Error Responses**:
- 404: History entry not found
- 404: History entry has no HTML (was an error)

## Implementation Approach

### Code Organization

```
learn-greek-easy-backend/
  src/
    db/
      models.py              # Add SourceFetchHistory model
    repositories/
      source_fetch_history.py  # New repository
    services/
      source_fetch_service.py  # New service for fetching
    api/v1/
      admin.py               # Add new endpoints
    tasks/
      scheduled.py           # Add fetch_all_sources_task
      scheduler.py           # Register new task
    schemas/
      admin.py               # Add fetch history schemas
  alembic/versions/
    YYYYMMDD_HHMM_add_source_fetch_history.py

learn-greek-easy-frontend/
  src/
    components/admin/
      NewsSourcesSection.tsx   # Update with tabs, history
      FetchHistoryTable.tsx    # New component
      HtmlViewerModal.tsx      # New component
    services/
      adminAPI.ts              # Add new API methods
    i18n/locales/*/
      admin.json               # Add new translation keys
```

### HTTP Fetching with httpx

```python
import httpx

async def fetch_html(url: str) -> tuple[str | None, str | None, str | None]:
    """Fetch HTML from URL.

    Returns:
        Tuple of (html_content, final_url, error_message)
        - On success: (html, final_url, None)
        - On error: (None, None, error_message)
    """
    async with httpx.AsyncClient(
        timeout=30.0,
        follow_redirects=True,
        max_redirects=5,
        headers={
            "User-Agent": "LearnGreekEasy/1.0 (News Scraper Bot)"
        }
    ) as client:
        try:
            response = await client.get(url)
            response.raise_for_status()
            return response.text, str(response.url), None
        except httpx.TimeoutException:
            return None, None, "Connection timeout after 30s"
        except httpx.HTTPStatusError as e:
            return None, None, f"HTTP {e.response.status_code}"
        except httpx.RequestError as e:
            return None, None, str(e)
```

### APScheduler Task Registration

Add to `src/tasks/scheduler.py`:

```python
from apscheduler.triggers.cron import CronTrigger

# In setup_scheduler():
_scheduler.add_job(
    fetch_all_sources_task,
    CronTrigger(hour=4, minute=0, timezone="Europe/Athens"),  # 06:00 EET = 04:00 UTC
    id="fetch_news_sources",
    name="Daily News Source Fetch",
)
```

## Security Considerations

1. **Admin-only access**: All endpoints require superuser authentication
2. **Rate limiting**: Consider rate limiting manual fetch to prevent abuse
3. **HTML storage**: Raw HTML stored as-is; sanitization happens during AI processing
4. **User-Agent**: Clearly identify bot in requests for transparency

## Performance & Scalability

1. **Parallel fetching**: Scheduled task fetches sources concurrently with `asyncio.gather`
2. **HTML size**: Store `html_size_bytes` to monitor content sizes
3. **History retention**: Consider cleanup job for old history entries (future)
4. **Index optimization**: Composite index on (source_id, fetched_at DESC) for history queries

## Error Handling & Resilience

1. **Per-source isolation**: One source failure doesn't stop others
2. **Error recording**: All fetch attempts recorded (success and error)
3. **Timeout handling**: 30-second timeout prevents hanging
4. **Redirect tracking**: Store final URL after redirects

## Testing Strategy

### Unit Tests
- SourceFetchRepository CRUD operations
- SourceFetchService fetch logic with mocked httpx
- Schema validation

### Integration Tests
- API endpoint authentication
- Database operations
- Full fetch flow with test server

### E2E Tests
- Manual fetch button functionality
- History display and pagination
- HTML viewer modal

## Subtasks (Implementation Order)

1. **[SCRAPER-01] Data Model & Migration** - SourceFetchHistory model and Alembic migration
2. **[SCRAPER-02] Repository & Service Layer** - Repository and fetch service implementation
3. **[SCRAPER-03] API Endpoints** - Manual fetch, history, and HTML content endpoints
4. **[SCRAPER-04] Scheduler Task** - Daily fetch task registration
5. **[SCRAPER-05] Frontend UI Tabs & History** - Admin UI with tabs, history table, HTML modal
6. **[SCRAPER-06] E2E Seeding & Tests** - Seed data and E2E test coverage

## Branch Strategy

- **Branch**: `feature/news-html-scraper`
- **Single draft PR** for all subtasks with `skip-visual` label
- First subtask creates branch and draft PR
- Final subtask marks PR ready and removes `skip-visual` label

## Translation Keys Needed

```json
{
  "sources": {
    "tabs": {
      "decks": "Decks",
      "news": "News"
    },
    "fetchNow": "Fetch Now",
    "fetching": "Fetching...",
    "history": {
      "title": "Fetch History",
      "empty": "No fetch history yet",
      "viewHtml": "View HTML",
      "status": {
        "success": "Success",
        "error": "Error"
      },
      "trigger": {
        "manual": "Manual",
        "scheduled": "Scheduled"
      },
      "columns": {
        "timestamp": "Timestamp",
        "status": "Status",
        "size": "Size",
        "trigger": "Trigger"
      }
    },
    "htmlViewer": {
      "title": "Raw HTML Content",
      "close": "Close",
      "copy": "Copy",
      "copied": "Copied!"
    },
    "fetch": {
      "success": {
        "title": "Fetch Complete",
        "message": "HTML fetched successfully ({{size}} KB)"
      },
      "error": {
        "title": "Fetch Failed",
        "message": "{{error}}"
      }
    }
  }
}
```
