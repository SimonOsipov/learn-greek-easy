# Testing

This document covers the project's test strategy, directory layout, how to run tests, pytest markers, fixture patterns, factory patterns, coverage configuration, CI/CD integration, and seed data.

---

## 1. Test Strategy

Three-tier pyramid: prefer unit tests, use integration tests for real-DB contracts, and reserve E2E tests for critical user flows.

| Tier | Location | Speed | DB | Purpose |
|------|----------|-------|----|---------|
| Unit | `tests/unit/` | Fast | Mocked | Services, utilities, schemas, isolated logic |
| Integration | `tests/integration/` | Slower | Real PostgreSQL | Repository contracts, API endpoint wiring |
| E2E (backend) | `tests/e2e/` | Slowest | Real PostgreSQL | Full API workflows, user journeys, scenarios |
| E2E (frontend) | `tests/e2e/` (Playwright) | Slowest | Deployed stack | Browser flows, visual regressions |

**Rule:** Add a unit test first. Escalate to integration only when you need to verify real-DB behaviour. Escalate to E2E only when you need to verify full-stack flows.

---

## 2. Directory Structure

### Backend

```
learn-greek-easy-backend/tests/
├── conftest.py                  # Global fixtures; auto-imports from fixtures/
├── fixtures/
│   ├── auth.py                  # User + auth-header fixtures
│   ├── database.py              # Engine + session fixtures
│   ├── deck.py                  # Deck + card fixtures
│   ├── progress.py              # Progress + review fixtures
│   └── html/                    # Static HTML files for parser tests
├── factories/
│   ├── base.py                  # BaseFactory (async create/build)
│   ├── auth.py                  # UserFactory, UserSettingsFactory
│   ├── content.py               # DeckFactory, CardFactory
│   ├── progress.py              # UserDeckProgressFactory, CardStatisticsFactory, ReviewFactory
│   ├── culture.py               # CultureDeckFactory, CultureQuestionFactory, ...
│   ├── news.py                  # NewsItemFactory
│   ├── situation.py             # SituationFactory
│   ├── situation_description.py # SituationDescriptionFactory, ...
│   ├── situation_picture.py     # SituationPictureFactory, ...
│   ├── xp_achievements.py       # UserXPFactory, XPTransactionFactory, ...
│   └── providers/
│       └── greek.py             # Faker GreekProvider
├── helpers/
│   └── database.py              # get_test_database_url(), count_table_rows()
├── unit/
│   ├── api/v1/                  # Unit tests for API route handlers
│   ├── core/                    # Unit tests for core modules
│   ├── db/                      # Unit tests for DB layer
│   ├── middleware/               # Unit tests for middleware
│   ├── models/                  # Unit tests for model logic
│   ├── repositories/            # Unit tests for repositories
│   ├── schemas/                 # Unit tests for Pydantic schemas
│   ├── scripts/                 # Unit tests for ETL scripts
│   ├── services/                # Unit tests for service classes
│   ├── tasks/                   # Unit tests for background tasks
│   └── utils/                   # Unit tests for utilities
├── integration/
│   ├── api/                     # Integration tests for API endpoints
│   ├── models/                  # Integration tests for ORM models
│   ├── services/                # Integration tests for service + DB
│   └── tasks/                   # Integration tests for background tasks
├── e2e/
│   ├── workflows/               # End-to-end user journey tests
│   ├── scenarios/               # Business scenario tests
│   └── edge_cases/              # Edge-case tests
└── utils/                       # Shared test utilities
```

### Frontend

```
learn-greek-easy-frontend/
├── src/
│   └── **/__tests__/            # Co-located Vitest unit tests (*.test.ts, *.test.tsx)
└── tests/
    ├── e2e/                     # Playwright E2E tests (*.spec.ts)
    ├── integration/             # Playwright integration tests
    └── visual/                  # Playwright visual/snapshot tests
```

---

## 3. Running Tests

### Backend

All commands run from `learn-greek-easy-backend/` with `poetry run`:

```bash
# Run all tests in parallel (recommended)
poetry run pytest -n auto

# Run only unit tests
poetry run pytest -m unit

# Run only integration tests
poetry run pytest -m integration

# Run a focused subset
poetry run pytest -m "api and not slow"

# Run without coverage (faster feedback)
poetry run pytest --no-cov

# Run sequentially (useful for debugging)
poetry run pytest -n0

# Run with coverage explicitly
poetry run pytest --cov=src
```

### Frontend

All commands run from `learn-greek-easy-frontend/`:

```bash
# Run Vitest unit tests
npm run test

# Run Playwright E2E tests
npm run test:e2e
```

---

## 4. Pytest Markers

`--strict-markers` is enforced — every marker used in test code must be declared. Markers are auto-applied by directory (e.g. `tests/unit/` → `unit` marker, `tests/integration/` → `integration` marker).

| Marker | Description |
|--------|-------------|
| `unit` | Fast, isolated tests with mocked dependencies |
| `integration` | Slower tests that use a real PostgreSQL database |
| `slow` | Tests that take more than 1 second |
| `seed` | Seed infrastructure tests; can be excluded from regular runs |
| `auth` | Authentication-related tests |
| `api` | API endpoint tests |
| `db` | Database-related tests (auto-applied when `db_session` or `db_engine` is in fixtures) |
| `sm2` | SM-2 spaced repetition algorithm tests |
| `posthog` | PostHog analytics integration tests |
| `sentry` | Sentry error tracking integration tests |
| `stripe` | Stripe billing integration tests |
| `progress` | Progress API and service tests |
| `achievements` | Achievement system tests |
| `no_parallel` | Tests that cannot run in parallel — skipped automatically under pytest-xdist |
| `nlp` | NLP service tests (spellcheck, morphology) |
| `e2e` | End-to-end API workflow tests (auto-applied in `tests/e2e/`) |
| `workflow` | User journey tests (auto-applied in `tests/e2e/workflows/`) |
| `scenario` | Business scenario tests (auto-applied in `tests/e2e/scenarios/`) |
| `edge_case` | Edge case tests (auto-applied in `tests/e2e/edge_cases/`) |
| `pgvector` | Tests requiring the pgvector PostgreSQL extension |

---

## 5. Fixture Patterns

### Database Fixtures

All database fixtures use PostgreSQL exclusively. SQLite is not supported.

| Fixture | Scope | Description |
|---------|-------|-------------|
| `session_db_engine` | session | Shared async engine; creates schema once per worker with file-lock coordination |
| `db_engine` | function | Delegates to `session_db_engine`; tables already exist |
| `db_session` | function | **Primary fixture.** Nested-transaction pattern: outer transaction is never committed, rolled back after each test. Test code can call `commit()` — changes stay within the savepoint. |
| `db_session_with_savepoint` | function | Alternative savepoint-based session for tests that need explicit commit control |
| `fast_db_session` | function | Bare session on shared engine; rolls back on teardown. Use unique identifiers; no table recreation. |
| `clean_tables` | function | Alias over `db_session`; documents intent to start from empty tables |
| `verify_isolation` | function | Debug fixture that asserts `users` table is empty at test start |
| `db_url` | function | Returns the current `TEST_DATABASE_URL` string |
| `worker_id` | session | pytest-xdist worker ID (`"gw0"`, `"gw1"`, …) or `"master"` |
| `is_parallel_run` | session | `True` when running under pytest-xdist |

**Key rule:** `db_session` is the standard fixture. Use `flush()` (not `commit()`) in factory helpers and fixture helpers to avoid collapsing the savepoint-based isolation.

### Auth Fixtures

| Fixture | Description |
|---------|-------------|
| `test_user` | Regular active user (`is_active=True`, `is_superuser=False`) |
| `test_superuser` | Admin user (`is_superuser=True`) |
| `test_inactive_user` | Deactivated user (`is_active=False`) |
| `two_users` | Tuple of two distinct active users for isolation tests |
| `auth_headers` | `{"Authorization": "Bearer test-user-<id>"}` — sets up `get_current_user` dependency override |
| `superuser_auth_headers` | Same as above for the superuser |
| `authenticated_user` | `AuthenticatedUser(user, headers)` named-tuple bundle |
| `authenticated_superuser` | Same bundle for the superuser |
| `invalid_token` | `"invalid.token.string"` — for 401 error tests |
| `invalid_auth_headers` | `{"Authorization": "Bearer invalid.token.string"}` |

Auth uses a token-based registry (`_test_user_registry`) so multiple user fixtures can coexist without trampling each other's dependency overrides.

### Client Fixture

```python
@pytest.fixture(scope="function")
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    ...
```

Creates an `httpx.AsyncClient` bound to the FastAPI app with `get_db` overridden to use the test session. Dependency overrides are cleared on teardown.

### Deck and Progress Fixtures

Deck fixtures (`tests/fixtures/deck.py`) provide `test_deck`, `test_deck_a1`, `test_deck_a2`, `test_deck_b1`, `deck_with_cards` (returns `DeckWithCards` named-tuple), `empty_deck`, and several composite fixtures.

Progress fixtures (`tests/fixtures/progress.py`) provide `user_deck_progress`, `fresh_user_progress`, `card_with_statistics`, `card_with_review_history`, and review-state variants (`new_card_statistics`, `learning_card_statistics`, `mastered_card_statistics`, etc.).

### Utility Fixtures

| Fixture | Description |
|---------|-------------|
| `sample_password` | `"TestPassword123!"` — meets all strength requirements |
| `sample_email` | `"test@example.com"` |
| `sample_user_data` | Dict ready for user-registration endpoint |
| `test_settings` | Session-scoped config dict for tests |
| `caplog_loguru` | Routes loguru logs through stdlib so pytest `caplog` can capture them. Required for testing loguru log output — stdlib `caplog` alone will not capture loguru messages. |
| `anyio_backend` | Returns `"asyncio"` for anyio-based tests |
| `reset_test_state` | Autouse fixture; runs before/after every test for global state cleanup |

---

## 6. Factory Patterns

All factories inherit from `BaseFactory` in `tests/factories/base.py`.

### BaseFactory

```python
class BaseFactory(factory.Factory):
    class Meta:
        abstract = True

    @classmethod
    async def create(cls, session: AsyncSession | None = None, **kwargs) -> T:
        # Uses flush() — never commit() — to preserve test transaction isolation
        db_session.add(instance)
        await db_session.flush()
        await db_session.refresh(instance)
        return instance
```

**Critical:** `create()` calls `flush()`, not `commit()`. This keeps created objects within the rolled-back outer transaction so test isolation is preserved.

Use `build()` to construct an instance without persisting it:

```python
instance = MyFactory.build(field="value")
```

### Available Factories

| Domain | Factory | Model |
|--------|---------|-------|
| Auth | `UserFactory`, `UserSettingsFactory` | `User`, `UserSettings` |
| Content | `DeckFactory`, `CardFactory` | `Deck`, `Card` |
| Progress | `UserDeckProgressFactory`, `CardStatisticsFactory`, `ReviewFactory` | `UserDeckProgress`, `CardStatistics`, `Review` |
| Culture | `CultureDeckFactory`, `CultureQuestionFactory`, `CultureQuestionStatsFactory`, `CultureAnswerHistoryFactory` | Culture models |
| Situations | `SituationFactory`, `SituationDescriptionFactory`, `DescriptionExerciseFactory`, `DescriptionExerciseItemFactory` | Situation models |
| Pictures | `SituationPictureFactory`, `PictureExerciseFactory`, `PictureExerciseItemFactory` | Picture models |
| News | `NewsItemFactory` | `NewsItem` |
| XP | `UserXPFactory`, `XPTransactionFactory`, `AchievementFactory`, `UserAchievementFactory` | XP/achievement models |
| Notifications | `NotificationFactory` | `Notification` |
| Feedback | `FeedbackFactory`, `FeedbackVoteFactory` | Feedback models |
| Listening | `ListeningDialogFactory` | `ListeningDialog` |
| Card Errors | `CardErrorReportFactory` | `CardErrorReport` |
| Announcements | `AnnouncementCampaignFactory` | `AnnouncementCampaign` |

### Custom Faker Provider

`tests/factories/providers/greek.py` provides `GreekProvider`, a Faker provider that generates realistic Greek vocabulary, words, and text for test data.

---

## 7. Coverage Configuration

### Backend

Coverage is configured in `pyproject.toml` under `[tool.pytest.ini_options]` and `[tool.coverage.*]`.

| Setting | Value |
|---------|-------|
| Minimum threshold | **80%** (fails build if below) |
| Branch coverage | Enabled (`--cov-branch`) |
| Source | `src/` |
| Reports | terminal (missing lines), HTML (`htmlcov/`), XML (`coverage.xml`) |
| Parallel mode | Enabled for pytest-xdist runs |
| Context tracking | Per-test function |

The omit list excludes infrastructure modules tested indirectly (repositories, middleware, config, main), external integrations with high unit-test coverage (PostHog, Sentry, S3), and test-only code (seed service, test API endpoints).

Standard coverage exclusion patterns: `pragma: no cover`, abstract methods (`@abstractmethod`), `TYPE_CHECKING` blocks, `__repr__`/`__str__`, and `logger.debug` statements.

### Frontend

Coverage is configured in `vitest.config.ts` using the V8 provider.

| Setting | Value |
|---------|-------|
| Provider | `v8` |
| Reports | text, JSON, HTML, lcov |
| Thresholds | Not currently enforced (commented out) |

Frontend coverage excludes test utilities, config files, mock data, `dist/`, `node_modules/`, and entry points (`main.tsx`, `App.tsx`).

---

## 8. CI/CD Integration

### Draft vs. Ready PRs

| PR State | Tests Run |
|----------|-----------|
| Draft | Quick checks only: lint, typecheck, format |
| Ready | Full test suite: unit, integration, E2E, visual |

See [docs/ci-cd-labels.md](ci-cd-labels.md) for the complete label reference.

### Key Labels

| Label | Effect |
|-------|--------|
| `skip-visual` | Skip visual regression tests (use during active development) |
| `skip-k6` | Skip k6 performance tests (non-blocking by default) |

**Workflow:** When working on a feature branch, create the PR as draft with `skip-visual` label. On the final subtask, run `gh pr ready` and remove `skip-visual` to trigger the full suite.

**Note:** GitHub Actions CI for PRs runs against a merge commit (PR branch + latest main). If main advances after branch creation, CI will include those new commits. If main introduces frontend changes that break existing tests, those failures appear in your PR. Fix: `git merge main` into your branch and update affected tests.

---

## 9. Seed Data

For full documentation see [docs/e2e-seeding.md](e2e-seeding.md).

Seeding requires `TEST_SEED_ENABLED=true` (automatically set in `conftest.py` during test runs).

### Quick Seed

```bash
curl -X POST http://localhost:8000/api/v1/test/seed/all
```

### Test Users

| Email | Role | Password |
|-------|------|----------|
| `e2e_learner@test.com` | Learner | `TestPassword123!` |
| `e2e_admin@test.com` | Admin | `TestPassword123!` |

These users are recreated by the seed endpoint and can be relied upon in E2E tests. Do not use them in unit or integration tests — use the fixture-created users (`test_user`, `test_superuser`) instead.
