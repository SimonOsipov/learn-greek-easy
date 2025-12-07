---
id: doc-18
title: MVP - Architecture Decisions
type: other
created_date: '2025-12-07 09:25'
---
# MVP - Architecture Decisions

**Purpose**: Single source of truth for architectural decisions, technical trade-offs, and migration strategies.

## Critical Decisions

### 1. Frontend-First Development
**Decision**: Build entire frontend with mock data and localStorage before creating backend.

**Trade-offs**:
- ✅ Faster MVP launch (weeks vs months)
- ✅ Lower initial costs
- ✅ Easier user testing
- ❌ Requires refactoring (4-6 hours)
- ❌ No cross-device sync
- ❌ Data loss if browser cleared

### 2. State Management
**Current**: Zustand for UI state + localStorage persistence
**Future**: Zustand (UI only) + TanStack Query (server state)

### 3. Mock API Service Layer
Pattern enables minimal refactoring when real API ready.

## Technology Stack

### Frontend
- **React 19.1** + **TypeScript 5.9** + **Vite 7.1**
- **Zustand 5.0** (state) → **TanStack Query** (future server state)
- **Tailwind CSS 3.4** + **Shadcn/ui**
- **React Hook Form 7.65** + **Zod 3.25**

### Backend
- **FastAPI** (Python) + **PostgreSQL 16** + **Redis 7**
- **SQLAlchemy** + **Alembic** (migrations)
- **Poetry 2.2** (dependencies)

## Migration Strategy (22-31 hours total)

**Backend (15-20h)**: Database schema, Auth endpoints, Deck/Card CRUD, SM-2 algorithm, Seed data

**Frontend (4-6h)**: Install TanStack Query + axios, Replace mock API, Refactor stores, Update components

**Testing (3-5h)**: Auth flow, Deck browsing, Review session, Cross-device sync

## Security

**MVP Limitations** (will fix):
- localStorage for auth tokens → httpOnly cookies
- Client-side validation only → Server-side Pydantic
- No rate limiting → Redis-based limiting

**Production Improvements**:
- bcrypt password hashing (cost 12)
- JWT with refresh tokens (30min/30day)
- CORS whitelist, CSRF protection

## Testing Strategy

**Stack**: Vitest + React Testing Library + Playwright
**Coverage**: 70% unit, 20% integration, 10% E2E

**Key Lesson**: Zustand persist middleware incompatible with unit tests - use integration/E2E instead.

**Metrics**:
- 404 tests (351 passing, 53 skipped)
- 98%+ coverage on testable code
- 1.7s execution time

## Performance Targets

**Frontend**: FCP < 1.5s, TTI < 3s, Lighthouse > 90
**Backend**: API < 200ms (p95), DB query < 50ms (p95)

**Optimizations**: Code splitting, debounced search, memoization, TanStack Query caching
