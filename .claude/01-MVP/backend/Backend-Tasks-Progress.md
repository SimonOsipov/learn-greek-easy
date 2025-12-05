# Backend Development - Tasks Progress

This document tracks all backend development tasks for the MVP.

## Overview
- **Tech Stack**: FastAPI + PostgreSQL + Redis + Celery + SQLAlchemy + Alembic
- **Python Version**: 3.14+ (latest stable)
- **Dependency Management**: Poetry 2.2+
- **Authentication**: JWT with Google OAuth support
- **Goal**: Build robust API for Greek language learning with spaced repetition algorithm
- **Status**: Task 1 Complete - Foundation established (Frontend 100% complete)

---

## Task Structure Overview

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Project Setup | ✅ | Complete |
| 2 | Database Design | ✅ | Complete |
| 3 | Authentication | 🔄 | 90% (9/10 subtasks) |
| **4** | **Backend Testing Framework** | ✅ | **Complete (10/10 subtasks)** |
| 5 | API Foundation & Middleware | 🔄 | 1/8 (05.01 CORS done) |
| 6 | Deck Management API | ⏸️ | Was Task 5 |
| 7 | Card Management API | ⏸️ | Was Task 6 |
| 8 | Review & Progress Tracking | ⏸️ | Was Task 7 |
| 9 | User Progress & Statistics | ⏸️ | Was Task 8 |
| 10 | SM-2 Algorithm | ⏸️ | Was Task 9 |
| 11 | Content Management | ⏸️ | Was Task 10 |
| 12 | Background Jobs & Celery | ⏸️ | Was Task 11 |
| 13 | Integration Testing | ⏸️ | Was Task 13 (builds on Task 4) |
| 14 | API Documentation | ⏸️ | Was Task 14 |
| 15 | Docker & Deployment | ✅ | Complete |

**Total**: 15 tasks | **Completed**: 4 | **In Progress**: 2 | **Not Started**: 9

---

## High-Level Tasks

### 1. Project Setup & Environment Configuration
**Status**: ✅ **COMPLETED** (2025-11-20)
**Actual Duration**: 2 hours
**Priority**: Critical Path
**Dependencies**: Python 3.14+, Poetry 2.2+

**Subtasks**:
- ✅ 01.01: Initialize FastAPI project structure
- ✅ 01.02: Configure Poetry environment and dependencies
- ✅ 01.03: Setup environment variables and configuration management
- ✅ 01.04: Configure logging and error handling
- ✅ 01.05: Setup project documentation structure
- ✅ 01.06: Create development scripts (run, test, migrate)

**Key Deliverables**:
- ✅ `learn-greek-easy-backend/` project structure (29 files created)
- ✅ `pyproject.toml` managed by Poetry (dependencies, build, tools)
- ✅ `poetry.lock` for reproducible builds (60+ dependencies)
- ✅ `.env.example` with all configuration options (153 lines)
- ✅ `config.py` for settings management (218 lines, Pydantic-based)
- ✅ `main.py` FastAPI application entry point (263 lines)
- ✅ Structured logging with JSON output
- ✅ Custom exception hierarchy
- ✅ FastAPI server operational on http://localhost:8000
- ✅ API documentation at /docs and /redoc
- ✅ All code quality tools configured (Black, isort, flake8, mypy)

---

### 2. Database Design & Schema Creation
**Status**: ✅ **COMPLETED** (2025-11-24)
**Actual Duration**: 5.5 hours
**Priority**: Critical Path
**Dependencies**: Task 1

**Subtasks**:
- ✅ 02.01: Database Connection & Session Management
- ✅ 02.02: Define Database Models (8 models + 4 enums)
- ✅ 02.03: PostgreSQL Enums & Alembic Configuration
- ✅ 02.04: Initial Migration
- ✅ 02.05: Pydantic Schemas (35+ schemas)
- ✅ 02.06: Database Repository Layer (7 repositories, 37 methods)

**Key Deliverables**:
- ✅ `src/db/models.py` - 8 SQLAlchemy models (User, Deck, Card, Review, etc.)
- ✅ `src/schemas/` - 35+ Pydantic schemas for API validation
- ✅ `src/repositories/` - Repository layer with generic CRUD + specialized queries
- ✅ `alembic/` - Migration configuration with initial schema
- ✅ PostgreSQL-specific features: native enums, UUID generation, CASCADE deletes

---

### 3. Core Authentication System
**Status**: 🔄 **IN PROGRESS** (Started 2025-11-24)
**Actual Duration**: 6.5+ hours
**Priority**: Critical Path
**Dependencies**: Task 2 ✅

**Subtasks**:
- ✅ 03.01: Password hashing with bcrypt (cost factor 12)
- ✅ 03.02: JWT token generation/validation (HS256, 30min/30day expiry)
- ✅ 03.03: User registration endpoint
- ✅ 03.04: Email/password login endpoint
- ✅ 03.05: Token refresh endpoint (rotation)
- ⏸️ 03.06: Google OAuth flow (placeholder)
- ✅ 03.07: GET /auth/me endpoint
- ✅ 03.08: Authentication middleware (audit logging)
- ✅ 03.09: Session management & token revocation
- ✅ 03.10: Logout endpoints

**Progress**: 9/10 subtasks completed (90%)

**Key Deliverables**:
- ✅ `src/core/security.py` - Password hashing, JWT tokens
- ✅ `src/core/dependencies.py` - Auth dependencies (get_current_user, etc.)
- ✅ `src/services/auth_service.py` - Authentication business logic
- ✅ `src/api/v1/auth.py` - Auth API endpoints
- ✅ `src/middleware/auth.py` - Request logging middleware

---

### 4. Backend Testing Framework
**Status**: ✅ **COMPLETED** (2025-12-01)
**Actual Duration**: ~6 hours
**Priority**: Critical Path
**Dependencies**: Task 2, Task 3

**Subtasks**:
- ✅ 04.01: Configure pytest with async support (asyncio_mode="auto")
- ✅ 04.02: Setup test database with PostgreSQL fixtures
- ✅ 04.03: Create base test classes (BaseTestCase, AuthenticatedTestCase)
- ✅ 04.04: Implement domain test fixtures (decks, cards, progress)
- ✅ 04.05: Create factory classes (factory-boy, 8 factories)
- ✅ 04.06: Configure coverage reporting (90%+ target)
- ✅ 04.07: Setup parallel test execution (3.7x speedup)
- ✅ 04.08: Create test utilities and helpers (40+ functions)
- ✅ 04.09: Establish testing conventions
- ✅ 04.10: Document testing best practices (TESTING.md 2054 lines)
- ✅ 04.04.01: Fix failing tests (2025-12-04) - Backend: 452 passed, Frontend: 694 passed/74 skipped

**Key Deliverables**:
- ✅ `tests/conftest.py` - Global fixtures and configuration
- ✅ `tests/fixtures/` - Database, auth, deck, progress fixtures
- ✅ `tests/factories/` - 8 test data factories with traits
- ✅ `tests/helpers/` - Assertions, time, API, mocks utilities
- ✅ `tests/utils/` - Fluent builders for complex scenarios
- ✅ `TESTING.md` - 2054 lines comprehensive documentation
- ✅ pytest-xdist parallel execution (30.8s → 8.3s)
- ✅ Coverage reporting with 90% threshold

---

### 5. API Foundation & Middleware
**Status**: 🔄 **IN PROGRESS** (1/8 subtasks)
**Estimated Duration**: 2-3 hours
**Priority**: High
**Dependencies**: Task 3, Task 4

**Subtasks**:
- ✅ 05.01: Configure CORS middleware (expose_headers, production validation)
- ⏸️ 05.02: Implement request logging middleware
- ⏸️ 05.03: Create error handling middleware
- ⏸️ 05.04: Add rate limiting middleware
- ⏸️ 05.05: Implement request validation
- ⏸️ 05.06: Create response formatting utilities
- ⏸️ 05.07: Setup API versioning (/api/v1/)
- ⏸️ 05.08: Add health check endpoint

**Key Deliverables**:
- `middleware/` directory with all middleware
- `GET /health` endpoint
- `GET /api/v1/status` endpoint
- Centralized error handling
- Request/response logging

**Testing Requirements** (using Task 4 framework):
- Unit tests for each middleware
- Integration tests for error handling
- Test coverage: 90%+

---

### 6. Deck Management API
**Status**: ⏸️ **NOT STARTED**
**Estimated Duration**: 3-4 hours
**Priority**: High
**Dependencies**: Task 4, Task 5

**Subtasks**:
- 06.01: Implement GET /api/decks (list all decks with user progress)
- 06.02: Implement GET /api/decks/:id (single deck details)
- 06.03: Implement GET /api/decks/:id/cards (get cards for review)
- 06.04: Add filtering and search functionality
- 06.05: Add pagination support
- 06.06: Join user progress data with deck queries
- 06.07: Implement deck statistics calculations

**API Endpoints**:
- `GET /api/decks` - List available decks (with progress)
- `GET /api/decks/:id` - Get deck details
- `GET /api/decks/:id/cards` - Get cards in deck (with SRS filtering)
- Query params: `level`, `status`, `search`, `page`, `limit`

**Response Format**:
```json
{
  "id": "deck-a1-basics",
  "title": "A1: Greek Basics",
  "titleGreek": "Ελληνικά Βασικά Α1",
  "level": "A1",
  "cardCount": 100,
  "isPremium": false,
  "userProgress": {
    "status": "in_progress",
    "cardsMastered": 25,
    "cardsLearning": 15,
    "streak": 5,
    "accuracy": 87.5
  }
}
```

---

### 7. Card Management API
**Status**: ⏸️ **NOT STARTED**
**Estimated Duration**: 2-3 hours
**Priority**: Medium
**Dependencies**: Task 4, Task 6

**Subtasks**:
- 07.01: Implement GET /api/cards/:id (single card details)
- 07.02: Create card statistics endpoint
- 07.03: Implement card search functionality
- 07.04: Add card filtering by stage (new, learning, review, mastered)
- 07.05: Implement due cards query (cards ready for review)

**API Endpoints**:
- `GET /api/cards/:id` - Get single card
- `GET /api/cards/search` - Search cards
- `GET /api/cards/due` - Get due cards for review

---

### 8. Review & Progress Tracking API
**Status**: ⏸️ **NOT STARTED**
**Estimated Duration**: 4-5 hours
**Priority**: Critical Path
**Dependencies**: Task 4, Task 7, Task 10 (SM-2 Algorithm)

**Subtasks**:
- 08.01: Implement POST /api/reviews (submit card review)
- 08.02: Integrate SM-2 algorithm for interval calculation
- 08.03: Update card_stats after review
- 08.04: Update user_deck_progress statistics
- 08.05: Calculate accuracy and streak
- 08.06: Implement review validation
- 08.07: Add review history tracking
- 08.08: Create review statistics endpoint

**API Endpoints**:
- `POST /api/reviews` - Submit card review
- `GET /api/reviews/history` - Get review history
- `GET /api/reviews/stats` - Get review statistics

**Review Submission**:
```json
{
  "cardId": "card-123",
  "deckId": "deck-a1-basics",
  "quality": 4,
  "timeSpent": 5.2,
  "sessionId": "session-abc"
}
```

**Response**:
```json
{
  "success": true,
  "nextReviewDate": "2025-11-25T00:00:00Z",
  "newStage": "review",
  "easeFactor": 2.5,
  "interval": 5
}
```

---

### 9. User Progress & Statistics API
**Status**: ⏸️ **NOT STARTED**
**Estimated Duration**: 3-4 hours
**Priority**: High
**Dependencies**: Task 4, Task 8

**Subtasks**:
- 09.01: Implement GET /api/progress/overview (dashboard data)
- 09.02: Implement GET /api/progress/deck/:id (deck-specific progress)
- 09.03: Calculate daily/weekly/monthly statistics
- 09.04: Implement streak tracking logic
- 09.05: Create study time tracking
- 09.06: Implement accuracy calculations
- 09.07: Create leaderboard queries (future)
- 09.08: Add progress history endpoint

**API Endpoints**:
- `GET /api/progress/overview` - Dashboard overview
- `GET /api/progress/deck/:id` - Deck-specific progress
- `GET /api/progress/history` - Historical progress data
- `GET /api/progress/streaks` - Streak information

**Dashboard Response**:
```json
{
  "totalDecks": 6,
  "decksInProgress": 3,
  "cardsLearning": 150,
  "cardsMastered": 75,
  "currentStreak": 12,
  "accuracyRate": 86.4,
  "totalStudyTime": 1825,
  "reviewsToday": 25,
  "reviewsDue": 42
}
```

---

### 10. Spaced Repetition Algorithm (SM-2)
**Status**: ⏸️ **NOT STARTED**
**Estimated Duration**: 4-5 hours
**Priority**: Critical Path
**Dependencies**: Task 2, Task 4

**Subtasks**:
- 10.01: Implement core SM-2 algorithm
- 10.02: Create card scheduling logic
- 10.03: Implement interval calculation based on quality rating
- 10.04: Add ease factor adjustments
- 10.05: Implement stage transitions (new → learning → review → mastered)
- 10.06: Create relearning logic for failed reviews
- 10.07: Implement card difficulty tracking
- 10.08: Add due date calculations
- 10.09: Create algorithm testing utilities (75+ tests)

**SM-2 Implementation**:
```python
# src/services/spaced_repetition.py
class SM2Algorithm:
    def calculate_next_review(
        self,
        quality: int,  # 1-5 rating
        repetitions: int,
        ease_factor: float,
        interval: int,
        stage: str
    ) -> dict:
        """
        Calculate next review date and update card statistics.

        Returns:
            {
                'ease_factor': float,
                'interval': int,
                'repetitions': int,
                'next_review_date': datetime,
                'new_stage': str
            }
        """
        pass
```

**Algorithm Stages**:
1. **New**: First time seeing card
2. **Learning**: Short intervals (1 min, 10 min, 1 day)
3. **Review**: SM-2 algorithm applies (days/weeks)
4. **Relearning**: Failed review (back to learning)
5. **Mastered**: Long intervals (21+ days)

---

### 11. Content Management & Seeding
**Status**: ⏸️ **NOT STARTED**
**Estimated Duration**: 4-5 hours
**Priority**: High
**Dependencies**: Task 2, Task 4

**Subtasks**:
- 11.01: Migrate 6 Greek decks from frontend mock data
- 11.02: Create database seeding script
- 11.03: Validate all Greek vocabulary (575+ cards)
- 11.04: Add pronunciation guides to all cards
- 11.05: Add example sentences for cards
- 11.06: Create deck categories and tags
- 11.07: Implement content validation
- 11.08: Create content import/export utilities

**Deck Content**:
- A1: Greek Basics (100 cards)
- A1: Common Phrases (100 cards)
- A1: Numbers & Time (75 cards)
- A2: Daily Life (100 cards)
- A2: Traveling (100 cards)
- A2: Greek Culture (100 cards)

**Seeding Script**:
```bash
python scripts/seed_database.py
```

---

### 12. Background Jobs & Celery Setup
**Status**: ⏸️ **NOT STARTED**
**Estimated Duration**: 3-4 hours
**Priority**: Medium
**Dependencies**: Task 1, Task 4, Redis

**Subtasks**:
- 12.01: Setup Redis connection
- 12.02: Configure Celery with FastAPI
- 12.03: Create daily reminder task
- 12.04: Implement streak reset job (runs at midnight)
- 12.05: Create progress aggregation task
- 12.06: Add email notification tasks (future)
- 12.07: Implement task monitoring
- 12.08: Create task scheduling

**Background Tasks**:
- Daily streak check (midnight UTC)
- Progress aggregation (hourly)
- Email reminders (future)
- Database cleanup (weekly)

---

### 13. Integration Testing
**Status**: ⏸️ **NOT STARTED**
**Estimated Duration**: 4-5 hours
**Priority**: High
**Dependencies**: Task 4 (Testing Framework)

**Note**: This task uses the testing framework established in Task 4. Focus is on writing comprehensive integration tests.

**Subtasks**:
- 13.01: Write authentication flow tests (end-to-end)
- 13.02: Write deck browsing API tests
- 13.03: Write review submission tests
- 13.04: Write progress tracking tests
- 13.05: Test error handling and edge cases
- 13.06: Test rate limiting
- 13.07: Test CORS configuration
- 13.08: Create end-to-end user journey tests

**Test Scenarios**:
1. Complete user registration → login → deck browse → review session → progress check
2. Failed authentication attempts → rate limiting
3. Token expiration → refresh → continued access
4. Cross-device session management
5. Data persistence across sessions

**Integration Test Structure** (using Task 4 infrastructure):
```python
# tests/integration/test_auth_flow.py
@pytest.mark.integration
class TestAuthenticationFlow:
    async def test_complete_auth_journey(self, client, db_session):
        """Test: register → login → access protected → refresh → logout"""
        ...

    async def test_failed_auth_with_rate_limiting(self, client):
        """Test rate limiting on repeated failed attempts."""
        ...
```

---

### 14. API Documentation & Swagger
**Status**: ⏸️ **NOT STARTED**
**Estimated Duration**: 2-3 hours
**Priority**: Medium
**Dependencies**: All API tasks (6-9)

**Subtasks**:
- 14.01: Configure FastAPI auto-generated Swagger docs
- 14.02: Add comprehensive docstrings to all endpoints
- 14.03: Create request/response examples
- 14.04: Document authentication flow
- 14.05: Add error response documentation
- 14.06: Create API usage guide
- 14.07: Generate TypeScript types from OpenAPI schema
- 14.08: Document rate limits and quotas

**Documentation Features**:
- Interactive Swagger UI at `/docs`
- ReDoc at `/redoc`
- OpenAPI JSON schema at `/openapi.json`
- TypeScript type generation for frontend integration

---

### 15. Docker Containerization & Deployment
**Status**: ✅ **COMPLETED** (2025-12-05)
**Actual Duration**: ~8 hours
**Priority**: High
**Dependencies**: All previous tasks

**Subtasks**:
- 15.01: Create Dockerfile for FastAPI app
- 15.02: Create docker-compose.yml (backend, PostgreSQL, Redis)
- 15.03: Configure database migrations in Docker
- 15.04: Create docker-compose.dev.yml for development
- 15.05: Setup health checks
- 15.06: Configure environment variables for Docker
- 15.07: Create deployment scripts
- 15.08: Document deployment process
- 15.09: Setup CI/CD pipeline (GitHub Actions) with test execution
- 15.10: Configure production deployment (Digital Ocean/Hetzner)

**Docker Structure**:
```yaml
# docker-compose.yml
services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://...
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis

  db:
    image: postgres:16-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine

  celery:
    build: ./backend
    command: celery -A app.celery worker -l info
    depends_on:
      - redis
```

**Deliverables**:
- Multi-stage Dockerfile (optimized for production)
- docker-compose.yml for production
- docker-compose.dev.yml for development
- Deployment documentation
- CI/CD workflow configuration

---

## Progress Summary

| Category | Total Tasks | Completed | In Progress | Not Started | Progress |
|----------|-------------|-----------|-------------|-------------|----------|
| Infrastructure | 2 | 2 | 0 | 0 | 100% ✅ |
| Authentication | 1 | 0 | 1 | 0 | 90% |
| Testing Framework | 1 | 1 | 0 | 0 | 100% ✅ |
| API Development | 4 | 0 | 0 | 4 | 0% |
| Business Logic | 2 | 0 | 0 | 2 | 0% |
| Background Jobs | 1 | 0 | 0 | 1 | 0% |
| Integration Testing | 1 | 0 | 0 | 1 | 0% |
| Documentation | 1 | 0 | 0 | 1 | 0% |
| Deployment | 1 | 1 | 0 | 0 | 100% ✅ |
| **TOTAL** | **15** | **4** | **1** | **10** | **33%** |

### Overall Backend Progress: 33%

**Status**: 🔄 **IN PROGRESS** - Task 1 ✅ Complete (100%) | Task 2 ✅ Complete (100%) | Task 3 🔄 In Progress (90%) | Task 4 ✅ Complete (100%) | Task 15 ✅ Complete (100%)

**Estimated Total Duration**: 50-65 hours (~1.5-2 weeks for 1 developer)

**Critical Path**:
1. Task 1 (Setup) → Task 2 (Database) → Task 3 (Auth) → **Task 4 (Testing Framework)** → Task 5 (API Foundation)
2. Task 6 (Decks) → Task 7 (Cards) → Task 10 (SM-2) → Task 8 (Reviews) → Task 9 (Progress)
3. Task 4 (Testing) → Task 13 (Integration Tests)
4. Task 11 (Content Seeding), Task 12 (Background Jobs), Task 14 (Documentation), Task 15 (Docker)

**Recommended Sequencing**:
- **Week 1**: Tasks 1-4 (Infrastructure, Auth, **Testing Framework**) + Task 10 (SM-2 Algorithm)
- **Week 2**: Tasks 5-9 (API Development) + Task 11 (Content)
- **Week 3**: Tasks 12-15 (Background Jobs, Integration Testing, Documentation, Deployment)

**Note**: Task 4 (Testing Framework) is now critical path - establishes foundation for all subsequent test-driven development.

---

## Status Legend
- ⏸️ Not Started
- 🔄 In Progress
- ✅ Completed
- ❌ Blocked
- 🚫 Cancelled

---

## Notes & Decisions

### Frontend-First Architecture

**Note**: The frontend MVP is 100% complete with mock data and localStorage persistence. See:
- [Frontend-Tasks-Progress.md](../frontend/Frontend-Tasks-Progress.md)
- [Architecture-Decisions.md](../Architecture-Decisions.md)

**Current Frontend State**:
- Zustand stores manage all UI and data state
- localStorage persists user progress and session
- Mock API service simulates backend delays
- 575+ Greek vocabulary cards in mock data
- SM-2 algorithm implemented client-side

**Backend Integration Strategy**:
When backend is ready (estimated 4-6 hours frontend refactoring):
1. Install TanStack Query + axios
2. Replace mock API with real API client
3. Refactor Zustand stores (remove data, keep UI state)
4. Update components to use TanStack Query hooks
5. Test authentication flow end-to-end
6. Validate cross-device sync

**Migration Checklist**: See Architecture-Decisions.md lines 483-595

---

### Technology Stack Rationale

**Python 3.14**:
- Latest stable Python release with performance improvements
- Enhanced error messages and debugging capabilities
- Improved type system and type inference
- Better async/await performance
- All modern Python features available

**Poetry 2.2**:
- Modern dependency management
- Reproducible builds with poetry.lock
- Integrated virtual environment management
- Superior dependency resolution
- Built-in build system

**FastAPI**:
- Async/await for high performance
- Automatic OpenAPI/Swagger documentation
- Excellent TypeScript type generation (for frontend)
- Pydantic for request/response validation
- Fully compatible with Python 3.14

**PostgreSQL**:
- ACID compliance for data integrity
- Excellent full-text search (Greek/English)
- JSON support for flexible schemas
- Mature ecosystem (Alembic, SQLAlchemy)

**Redis + Celery**:
- Background task processing
- Session management
- Caching layer (future optimization)
- Real-time features (future)

**SQLAlchemy + Alembic**:
- Type-safe ORM with excellent IDE support
- Database migrations with version control
- Support for PostgreSQL advanced features

---

### Security Considerations

**Authentication**:
- bcrypt password hashing (cost factor 12)
- JWT access tokens (30 min expiry, httpOnly cookies)
- JWT refresh tokens (30 days, stored in database with revocation)
- CORS whitelist (frontend domain only)
- Rate limiting on authentication endpoints (5 attempts/minute)

**API Security**:
- Pydantic validation on all inputs
- SQL injection prevention (SQLAlchemy parameterized queries)
- XSS prevention (escape user input)
- CSRF protection (SameSite cookies)
- HTTPS enforcement in production

**Data Protection**:
- Database backups (daily)
- User data encryption at rest (future)
- GDPR compliance (data export/deletion)

---

### Performance Targets

**API Response Times**:
- Authentication: < 200ms (p95)
- Deck listing: < 150ms (p95)
- Review submission: < 100ms (p95)
- Progress queries: < 200ms (p95)

**Database Optimization**:
- Indexes on frequently queried columns (user_id, deck_id, next_review_date)
- Connection pooling (SQLAlchemy pool_size=20)
- Query optimization (select specific columns, eager loading)

**Caching Strategy** (Future):
- Redis cache for deck definitions (1 hour TTL)
- TanStack Query cache on frontend (5 min stale time)
- Invalidate on review submission

---

### Integration with Frontend

**API Compatibility**:
All API endpoints designed to match frontend expectations:
- Response format matches mock data structure
- Error responses compatible with frontend error handling
- Pagination matches frontend pagination component
- Filtering/search matches frontend filter UI

**TypeScript Type Generation**:
Use OpenAPI schema to generate TypeScript types:
```bash
npx openapi-typescript http://localhost:8000/openapi.json -o src/types/api.ts
```

**CORS Configuration**:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Frontend dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

### Content Management

**Greek Vocabulary**:
- 6 decks covering A1-A2 levels
- 575+ flashcards with Greek/English pairs
- Pronunciation guides (transliteration)
- Example sentences for context
- Cultural notes for advanced cards

**Content Validation**:
- Greek text encoded as UTF-8
- Pronunciation guides verified
- Example sentences grammatically correct
- Card difficulty aligned with CEFR levels

**Future Content Expansion**:
- Admin panel for content creation
- Community-contributed decks (moderated)
- B1-B2 level content
- Specialized vocabulary (business, medical, etc.)

---

### Deployment Strategy

**Development Environment**:
- docker-compose.dev.yml with hot reload
- PostgreSQL + Redis containers
- Alembic migrations on startup
- Seed data for testing

**Production Environment**:
- Digital Ocean Droplet or Hetzner VPS
- Docker Swarm or Kubernetes (future)
- Nginx reverse proxy
- Let's Encrypt SSL certificates
- Automated database backups
- CI/CD with GitHub Actions

**Monitoring**:
- Application logs (structured JSON)
- Error tracking (Sentry)
- Performance monitoring (APM)
- Database query monitoring

---

### Testing Strategy

**Test Pyramid**:
```
    /\
   /E2E\      10% - Full user journeys (Playwright)
  /------\
 /Integr.\   20% - API endpoint tests (pytest + TestClient)
/----------\
/   Unit   \ 70% - Business logic, models, utilities
```

**Critical Test Areas**:
1. **SM-2 Algorithm**: 75+ tests covering all edge cases
2. **Authentication**: Token generation, validation, refresh, revocation
3. **Review Submission**: Interval calculations, progress updates
4. **Data Integrity**: Database constraints, cascading deletes
5. **API Validation**: Pydantic schemas, error responses

**Test Coverage Targets**:
- SM-2 Algorithm: 95%+
- Authentication: 90%+
- API Endpoints: 85%+
- Overall: 80%+

---

### Technical Debt & Future Improvements

**Known Limitations (MVP)**:
1. **No Email Verification**: Users can register without email confirmation
   - Future: Send verification email with token
2. **Basic Rate Limiting**: Simple IP-based rate limiting
   - Future: User-based rate limiting, Redis-backed
3. **No Data Analytics**: Limited insights into user behavior
   - Future: Integrate analytics service (Mixpanel, Amplitude)
4. **No Real-Time Features**: No live updates or notifications
   - Future: WebSocket support for real-time progress
5. **Single Language**: English only (except Greek vocabulary)
   - Future: i18n support for UI (Greek, English, others)

**Planned Enhancements (Post-MVP)**:
- Admin dashboard for content management
- User-generated decks (community feature)
- Social features (friends, leaderboards)
- Gamification (achievements, badges)
- Mobile app (React Native)
- Offline support (Service Workers)

---

**Last Updated**: 2025-12-05
**Document Version**: 3.4
**Status**: Tasks 1, 2, 4 & 15 Complete | Task 3 In Progress (90%)
**Backend Progress**: Task 01 ✅ | Task 02 ✅ | Task 03 🔄 (9/10) | Task 04 ✅ (10/10) | Task 15 ✅ (10/10)
**Next Milestone**: Task 03.06 (Google OAuth) → Task 05 (API Foundation)
**Total Tasks**: 15 (renumbered: new Task 4 Testing Framework inserted, old Unit Testing merged)
