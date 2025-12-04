# 05. Redis Configuration Architecture Plan

**Project**: Learn Greek Easy - MVP DevOps
**Task**: Redis Infrastructure and Application Integration
**Created**: 2025-12-03
**Status**: COMPLETE (100%)

---

## Table of Contents

1. [Overview](#overview)
2. [Current State Analysis](#current-state-analysis)
3. [Target Architecture](#target-architecture)
4. [Implementation Tasks](#implementation-tasks)
5. [Task Files](#task-files)
6. [Progress Summary](#progress-summary)

---

## Overview

### Purpose

Configure Redis for the Learn Greek Easy application to enable:
- **Session Storage**: Move refresh token storage from PostgreSQL to Redis for faster access
- **Caching Layer**: Cache frequently accessed data to reduce database load
- **Rate Limiting** (future): API rate limiting infrastructure
- **Background Tasks** (future): Celery broker support

### Scope

| Component | Status | Notes |
|-----------|--------|-------|
| Redis container setup | COMPLETE | Dev + prod compose, health checks, volumes |
| Redis connection pooling | COMPLETE | `src/core/redis.py` with async connection pool |
| Session storage configuration | COMPLETE | SessionRepository, auth_service integration, Redis-only (no PostgreSQL fallback) |
| Caching layer implementation | COMPLETE | CacheService, @cached decorator, 54 tests |

---

## Current State Analysis

### Infrastructure (COMPLETE)

**Docker Compose Services**:
- `redis:7-alpine` container in both dev and prod configurations
- Health checks configured (`redis-cli ping`)
- Persistent volumes for data durability
- AOF persistence enabled (`--appendonly yes`)
- Memory limits set (`--maxmemory 128mb`)
- LRU eviction policy (`--maxmemory-policy allkeys-lru`)

**Connection Management**:
- `src/core/redis.py` provides async Redis client with connection pooling
- Integrated into FastAPI lifespan (init on startup, close on shutdown)
- Health check integration in `/health` and `/health/ready` endpoints
- Graceful degradation when Redis is unavailable

### Application Integration (PENDING)

**Current Authentication**:
- JWT access tokens (30 min expiry) - stateless, stored client-side
- JWT refresh tokens (30 days) - stored in PostgreSQL `refresh_tokens` table
- Token rotation on refresh
- Session management methods in `AuthService`

**What Needs to Change**:
1. Migrate refresh token storage from PostgreSQL to Redis
2. Implement caching for frequently accessed data
3. Add cache invalidation strategies

---

## Target Architecture

### Redis Data Structure Overview

```
Redis Key Namespace:
├── session:              # User sessions (refresh tokens)
│   └── refresh:{user_id}:{token_id}    # Individual refresh tokens
│   └── user_sessions:{user_id}         # Set of token IDs per user
├── cache:                # Application cache
│   └── deck:{deck_id}                  # Cached deck data
│   └── user:{user_id}:decks            # User's deck list
│   └── cards:{deck_id}                 # Cards in a deck
│   └── due_cards:{user_id}             # User's due cards
└── rate:                 # Rate limiting (future)
    └── api:{user_id}:{endpoint}        # Request counters
```

### Data Flow Diagrams

**Session Storage Flow**:
```
┌─────────────────────────────────────────────────────────────────┐
│                    Session Storage Flow                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Login/Register                                                  │
│  ┌────────────────┐                                             │
│  │ Generate JWT   │                                             │
│  │ refresh token  │                                             │
│  └───────┬────────┘                                             │
│          │                                                       │
│          ▼                                                       │
│  ┌────────────────┐     ┌─────────────────────────┐            │
│  │ Store in Redis │────▶│ refresh:{user}:{id}     │            │
│  │ with TTL       │     │ TTL: 30 days            │            │
│  └────────────────┘     │ Value: token metadata   │            │
│                         └─────────────────────────┘            │
│                                                                  │
│  Token Refresh                                                   │
│  ┌────────────────┐     ┌─────────────────────────┐            │
│  │ Validate token │────▶│ GET refresh:{user}:{id} │            │
│  └───────┬────────┘     └─────────────────────────┘            │
│          │                                                       │
│          ▼                                                       │
│  ┌────────────────┐     ┌─────────────────────────┐            │
│  │ Delete old     │────▶│ DEL refresh:{user}:{id} │            │
│  │ Issue new      │     │ SET refresh:{user}:{new}│            │
│  └────────────────┘     └─────────────────────────┘            │
│                                                                  │
│  Logout                                                          │
│  ┌────────────────┐     ┌─────────────────────────┐            │
│  │ Revoke token   │────▶│ DEL refresh:{user}:{id} │            │
│  └────────────────┘     └─────────────────────────┘            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Caching Flow**:
```
┌─────────────────────────────────────────────────────────────────┐
│                    Cache-Aside Pattern                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Read Operation                                                  │
│  ┌────────────────┐                                             │
│  │ GET deck:123   │                                             │
│  └───────┬────────┘                                             │
│          │                                                       │
│          ▼                                                       │
│  ┌────────────────┐                                             │
│  │ Cache Hit?     │                                             │
│  └───────┬────────┘                                             │
│          │                                                       │
│     ┌────┴────┐                                                 │
│     │         │                                                 │
│     ▼         ▼                                                 │
│   [YES]      [NO]                                               │
│     │         │                                                 │
│     │         ▼                                                 │
│     │   ┌────────────────┐                                      │
│     │   │ Query Database │                                      │
│     │   └───────┬────────┘                                      │
│     │           │                                               │
│     │           ▼                                               │
│     │   ┌────────────────┐                                      │
│     │   │ SET deck:123   │                                      │
│     │   │ with TTL       │                                      │
│     │   └───────┬────────┘                                      │
│     │           │                                               │
│     └─────┬─────┘                                               │
│           │                                                      │
│           ▼                                                      │
│   ┌────────────────┐                                            │
│   │ Return Data    │                                            │
│   └────────────────┘                                            │
│                                                                  │
│  Write Operation (Cache Invalidation)                           │
│  ┌────────────────┐     ┌────────────────┐                     │
│  │ Update Database│────▶│ DEL deck:123   │                     │
│  └────────────────┘     └────────────────┘                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Tasks

### Phase 1: Infrastructure (COMPLETE)

| Task | File | Status |
|------|------|--------|
| 05.01 Redis Container Setup | [05.01-redis-container-setup.md](./05.01-redis-container-setup.md) | COMPLETE |
| 05.04 Connection Pooling | [05.04-redis-connection-pooling.md](./05.04-redis-connection-pooling.md) | COMPLETE |

### Phase 2: Application Integration (IN PROGRESS)

| Task | File | Status |
|------|------|--------|
| 05.02 Session Storage | [05.02-session-storage-configuration.md](./05.02-session-storage-configuration.md) | COMPLETE |
| 05.03 Caching Layer | [05.03-caching-layer-implementation.md](./05.03-caching-layer-implementation.md) | COMPLETE |

---

## Task Files

- **[05.01-redis-container-setup.md](./05.01-redis-container-setup.md)** - Redis Docker configuration (COMPLETE)
- **[05.02-session-storage-configuration.md](./05.02-session-storage-configuration.md)** - Refresh token migration to Redis (COMPLETE)
- **[05.03-caching-layer-implementation.md](./05.03-caching-layer-implementation.md)** - Application caching (COMPLETE)
- **[05.04-redis-connection-pooling.md](./05.04-redis-connection-pooling.md)** - Connection management (COMPLETE)

---

## Progress Summary

| Task | Status | Completion |
|------|--------|------------|
| Redis container setup | COMPLETE | 100% |
| Redis connection pooling | COMPLETE | 100% |
| Session storage configuration | COMPLETE | 100% |
| Caching layer implementation | COMPLETE | 100% |
| **Overall** | **COMPLETE** | **100%** |

---

## Dependencies

### Completed Prerequisites

- Docker infrastructure (Task 01)
- Health endpoints with Redis check (Task 01.05)
- Backend authentication system

### Required for Session Storage

- No blocking dependencies
- Can be implemented independently

### Required for Caching Layer

- Deck/Card API endpoints (currently pending)
- Recommend completing session storage first

---

## References

- [Redis Best Practices](https://redis.io/docs/management/optimization/)
- [FastAPI Caching Patterns](https://fastapi.tiangolo.com/advanced/events/)
- [JWT Session Storage in Redis](https://redis.io/docs/manual/patterns/distributed-locks/)
- [01.04 Redis Service Setup](../01/01.04-redis-service.md)
- [01.05 Health Endpoints](../01/01.05-health-endpoints.md)

---

**Next Steps**: Begin with Task 05.02 (Session Storage Configuration) to migrate refresh tokens from PostgreSQL to Redis.
