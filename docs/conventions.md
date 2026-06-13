# Conventions

Architectural decisions and established patterns. All agents (Feature, Architecture, Executor, QA) must read this before designing or implementing features. Deviations require explicit justification.

## CI/CD

| Decision | Convention | Reference |
|----------|-----------|-----------|
| Draft PRs | Quick checks only (lint, typecheck, format) | docs/ci-cd-labels.md |
| Ready PRs | CI tests (lint/unit/E2E) run on every push. Dev deploy + downstream jobs require a deliberate release signal. | docs/ci-cd-labels.md |
| Dev deploy trigger | `workflow_dispatch` OR applying the `ready-to-verify` label — not every push | docs/ci-cd-labels.md |
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
| Coverage threshold | 80% target (current: statements/lines 52%, functions 58%, branches 80%) | docs/testing.md |
| Factories | Inherit BaseFactory, async create, flush not commit | docs/testing.md |
| Markers | 19 markers in pyproject.toml, --strict-markers enforced | docs/testing.md |
| DB isolation | db_session wraps each test in rolled-back transaction | docs/testing.md |

## Logging

| Decision | Convention | Reference |
|----------|-----------|-----------|
| Backend logger | `get_logger(__name__)` from `src.core.logging` (Loguru) — never `print` or stdlib `logging` | docs/logging.md |
| Structured context | Pass context as kwargs (`logger.info("msg", action=..., user_id=...)`), not f-strings | docs/logging.md |
| Context propagation | `request_id` / `user_id` auto-bound by middleware + auth dependency — don't pass manually | docs/logging.md |
| Aggregation | Logs flow to Sentry Logs; JSON in prod, colorized in dev | docs/logging.md |
| Never log | Passwords, JWT tokens, API keys, emails, PII | docs/logging.md |

## Analytics (PostHog)

| Decision | Convention | Reference |
|----------|-----------|-----------|
| Event naming | `{domain}_{entity}_{action}`, snake_case, past-tense action | docs/analytics-events.md |
| No admin events | Admin panel actions are not product analytics — never instrument them | docs/analytics-events.md |
| Errors → Sentry | Error tracking uses Sentry, not PostHog | docs/analytics-events.md |
| Create-event test | Only add an event if it informs a stated product decision | docs/analytics-events.md |
| Forbidden prefixes | No `my_`, `admin_`, or `page_` prefixes | docs/analytics-events.md |

## Progress Metrics

| Decision | Convention | Reference |
|----------|-----------|-----------|
| Glossary | One canonical definition per progress term (started/learned/mastered = начато/выучено/освоено) — same label → same value everywhere | [docs/progress-glossary.md](progress-glossary.md) |
| Single selector | Each metric (mastered count, learned count, stage distribution, deck completion %) has exactly one computation in `src/lib/progressGlossary.ts`; no surface recomputes it independently | [docs/progress-glossary.md](progress-glossary.md) |
| `due` excluded | `due` from `cards_by_status` is an overlapping scheduling dimension; never included in stage-percentage denominators | [docs/progress-glossary.md](progress-glossary.md) |

## Design System

| Decision | Convention | Reference |
|----------|-----------|-----------|
| Source of truth | All color/spacing/radius/shadow/font/animation values come from the design system; unlisted values don't ship | docs/design-system.md |
| No raw hex | Use HSL tokens (`hsl(var(--token))`), not raw hex / `rgba(...)` / arbitrary Tailwind values. **Mobile carve-out:** under `learn-greek-easy-mobile/**`, explicit `rgba(...)` opacity tokens in `tailwind.config.js` are REQUIRED (not forbidden) for translucent native surfaces — the `/<NN>` modifier on var-backed tokens renders dark on iOS (NativeWind v4 `color-mix()` defect). See [`learn-greek-easy-mobile/docs/design-tokens.md`](../learn-greek-easy-mobile/docs/design-tokens.md) (MOB-13). | docs/design-system.md |
| Reuse primitives | Compose existing `src/components/ui/*` (shadcn) — don't re-implement Dialog/Popover/Select/etc. | docs/design-system.md |
| New tokens/animations | Add to `src/index.css` + `tailwind.config.js` AND update the design-system doc in the same PR | docs/design-system.md |
| Three palettes | App / Landing / Practice palettes are distinct — don't cross them | docs/design-system.md |
