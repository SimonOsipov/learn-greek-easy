# Conventions

Architectural decisions and established patterns. All agents (Feature, Architecture, Executor, QA) must read this before designing or implementing features. Deviations require explicit justification.

## CI/CD

| Decision | Convention | Reference |
|----------|-----------|-----------|
| Draft PRs | Quick checks only (lint, typecheck, format) | docs/ci-cd-labels.md |
| Ready PRs | Full suite runs automatically | docs/ci-cd-labels.md |
| Visual tests | Currently disabled | — |
| K6 perf tests | Non-blocking, skip with `skip-k6` label | docs/ci-cd-labels.md |
| Deploy trigger | GitHub Actions only, Railway auto-deploy disabled | docs/deployment-guide.md |
| Deploy order | Sequential: Backend → Frontend | docs/deployment-guide.md |
| PR labels | Adding/removing a label re-triggers the workflow | docs/ci-cd-labels.md |

## Deployment

| Decision | Convention | Reference |
|----------|-----------|-----------|
| Deploy sequence | BE deploy → FE deploy → 60s DNS wait → BE warmup → health check | docs/deployment-guide.md |
| Warmup after FE | Caddy DNS must refresh after FE redeploy discovers new BE IP | docs/deployment-guide.md |
| Backend privacy | Backend only accessible via frontend proxy (`/api/v1/*`) | docs/railway-backend-privacy.md |
| Swagger UI | `/docs` only available when `debug=True` (not in production) | — |
| Manual dispatch | Production workflow supports `workflow_dispatch` with `skip_health_check` | docs/deployment-guide.md |

## Frontend Data Fetching

| Decision | Convention | Reference |
|----------|-----------|-----------|
| Filter classification | Every filter must be classified as server-side or client-side | docs/filtering-conventions.md |
| Client-side filters | Must NOT trigger API refetches — filter cached data locally | docs/filtering-conventions.md |
| Stable data caching | Cache data that doesn't change with filters (culture decks, progress, country results) | docs/filtering-conventions.md |
| No loading flash | Cached/local results must not show loading spinners | docs/filtering-conventions.md |

## Admin Generation Pipelines

| Decision | Convention | Reference |
|----------|-----------|-----------|
| SSE vs BackgroundTasks | SSE for admin generation with progress; BackgroundTasks for fire-and-forget | [docs/sse-pipelines.md](sse-pipelines.md) |
| Event naming | `{domain}:{stage}` format | [docs/sse-pipelines.md](sse-pipelines.md) |
| Frontend consumption | `useSSE` hook with POST, no retries, no reconnect | [docs/sse-pipelines.md](sse-pipelines.md) |

## Testing

| Decision | Convention | Reference |
|----------|-----------|-----------|
| Test strategy | Three-tier: unit > integration > E2E (test pyramid) | docs/testing.md |
| Coverage threshold | 80% backend, 80% frontend | docs/testing.md |
| Factories | Inherit BaseFactory, async create, flush not commit | docs/testing.md |
| Markers | 19 markers in pyproject.toml, --strict-markers enforced | docs/testing.md |
| DB isolation | db_session wraps each test in rolled-back transaction | docs/testing.md |
