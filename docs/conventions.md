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
