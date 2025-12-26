# Learn Greek Easy - Project Configuration

## MCP Servers (Model Context Protocol)

**5 MCP servers are available** - use them to enhance development workflow:

| Server | Prefix | Purpose |
|--------|--------|---------|
| **Vibe Kanban** | `mcp__vibe_kanban__*` | Task management, project tracking |
| **Context7** | `mcp__context7__*` | Documentation for libraries, APIs, languages, databases |
| **Playwright** | `mcp__playwright__*` | Browser automation, screenshots, testing |
| **GitHub** | `mcp__github__*` | Repos, issues, PRs, code search |
| **Railway** | `mcp__railway-mcp-server__*` | Cloud deployment, environments, variables |

### Usage Guidelines

1. **Vibe Kanban (Task Management)** - **Use for all task tracking**
   - Create and manage tasks for features, bugs, and improvements
   - Track task status: `todo` → `inprogress` → `inreview` → `done`
   - Store implementation plans and specs in task descriptions
   - Tools: `list_projects`, `list_tasks`, `create_task`, `get_task`, `update_task`
   - **Project ID**: `cb892c2b-4a17-4402-83f2-8f6cb086468b` (learn-greek-easy)

2. **Context7 (Documentation)** - **CRITICAL: Use before writing code**
   - Always verify API signatures and usage patterns before implementation
   - Look up latest docs for any library/framework being used
   - Use for: libraries, frameworks, APIs, programming languages, databases, ORMs, etc.
   - Tools: `resolve-library-id` → `get-library-docs`

3. **Playwright (Browser Automation)**
   - Use for visual verification of UI changes
   - Take screenshots to confirm implementations
   - Test user flows and interactions

4. **GitHub (Repository Operations)**
   - Search code across repositories
   - Manage issues and pull requests
   - Review commits and branches

5. **Railway (Cloud Deployment)**
   - Deploy applications and templates
   - Manage environments and variables
   - View logs and deployments
   - Link projects and services
   - **⚠️ NO DESTRUCTIVE ACTIONS AVAILABLE** - For delete/destroy operations, guide the user to perform them manually via Railway dashboard or CLI

---

## Poetry Commands

**CRITICAL**: Always use full poetry path and cd to backend directory first.

```bash
# Pattern
cd /Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-backend && /Users/samosipov/.local/bin/poetry run <command>

# Examples
/Users/samosipov/.local/bin/poetry run python scripts/verify_migration.py
/Users/samosipov/.local/bin/poetry run alembic upgrade head
/Users/samosipov/.local/bin/poetry run uvicorn src.main:app --reload
/Users/samosipov/.local/bin/poetry run pytest
/Users/samosipov/.local/bin/poetry install
/Users/samosipov/.local/bin/poetry add <package>
```

**DO NOT use**:
- ❌ `poetry run <command>` (without full path)
- ❌ `python <script>` (without poetry run)

---

## Database Migrations (Alembic)

**CRITICAL**: When you modify any SQLAlchemy model in `src/db/models.py`, you MUST create an Alembic migration.

### Why?
- **CI/CD tests** use `Base.metadata.create_all()` (schema from models directly)
- **Production** uses Alembic migrations (incremental changes to preserve data)
- Without a migration, production database won't have your changes!

### Creating a Migration

```bash
# After modifying models, generate migration:
cd /Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-backend && \
/Users/samosipov/.local/bin/poetry run alembic revision --autogenerate -m "description_of_change"

# Example: Added new column to User model
/Users/samosipov/.local/bin/poetry run alembic revision --autogenerate -m "add_avatar_url_to_users"

# Review the generated migration file in alembic/versions/
# Then apply locally to verify:
/Users/samosipov/.local/bin/poetry run alembic upgrade head
```

### Migration Workflow

```
1. Modify model in src/db/models.py
2. Run: alembic revision --autogenerate -m "description"
3. Review generated migration in alembic/versions/
4. Test locally: alembic upgrade head
5. Commit migration file with your changes
6. On deploy: Railway runs migrations (if RUN_MIGRATIONS=true)
```

### Common Commands

```bash
# Check current migration version
/Users/samosipov/.local/bin/poetry run alembic current

# View migration history
/Users/samosipov/.local/bin/poetry run alembic history

# Upgrade to latest
/Users/samosipov/.local/bin/poetry run alembic upgrade head

# Downgrade one step (careful in production!)
/Users/samosipov/.local/bin/poetry run alembic downgrade -1
```

### Railway Production

Set `RUN_MIGRATIONS=true` in Railway environment variables for auto-migrations on deploy.
Or run manually: `railway run alembic upgrade head`

---

## Docker

### Development (Full Stack with Hot Reload)

```bash
# Start all services
cd /Users/samosipov/Downloads/learn-greek-easy && docker-compose -f docker-compose.dev.yml up -d

# Start specific services
docker-compose -f docker-compose.dev.yml up -d postgres redis
docker-compose -f docker-compose.dev.yml up -d backend

# View logs
docker-compose -f docker-compose.dev.yml logs -f backend
docker-compose -f docker-compose.dev.yml logs -f frontend

# Stop all services
docker-compose -f docker-compose.dev.yml down

# Rebuild after changes
docker-compose -f docker-compose.dev.yml up -d --build backend
```

### Production

```bash
# Requires .env file with JWT_SECRET_KEY
cd /Users/samosipov/Downloads/learn-greek-easy && docker-compose up -d

# Stop services
docker-compose down

# View status
docker-compose ps
```

### Database Access

```bash
# Development (port 5433)
docker exec -it learn-greek-postgres-dev psql -U postgres -d learn_greek_easy

# Production (port 5432)
docker exec -it learn-greek-postgres psql -U postgres -d learn_greek_easy

# Redis CLI
docker exec -it learn-greek-redis-dev redis-cli
docker exec -it learn-greek-redis redis-cli
```

### Container Names

| Service | Development | Production |
|---------|-------------|------------|
| Frontend | learn-greek-frontend-dev | learn-greek-frontend |
| Backend | learn-greek-backend-dev | learn-greek-backend |
| PostgreSQL | learn-greek-postgres-dev | learn-greek-postgres |
| Redis | learn-greek-redis-dev | learn-greek-redis |

### Ports

| Service | Development | Production |
|---------|-------------|------------|
| Frontend | 5173 | 80 |
| Backend | 8000 | 8000 |
| PostgreSQL | 5433 | (internal) |
| Redis | 6379 | (internal) |

---

## Health Endpoints

Backend exposes three health check endpoints:

| Endpoint | Purpose |
|----------|---------|
| `/health` | Full health check with DB and Redis status |
| `/health/live` | Kubernetes liveness probe (app is running) |
| `/health/ready` | Kubernetes readiness probe (dependencies ready) |

```bash
# Quick checks
curl http://localhost:8000/health
curl http://localhost:8000/health/live
curl http://localhost:8000/health/ready
```

**Status Values**: `healthy`, `degraded`, `unhealthy`

---

## Sentry Error Tracking

Set `SENTRY_DSN` env var to enable. Test users (`e2e_*`, `test_*`, `@test.`) are auto-filtered.
Captures: 500 errors, unhandled exceptions. Does NOT capture: 4xx errors.

---

## Structured Logging

| Component | Library | Location |
|-----------|---------|----------|
| Backend | Loguru | `src/core/logging.py` |
| Frontend | loglevel | `src/lib/logger.ts` |

**Usage**: `from loguru import logger` (backend) or `import log from '@/lib/logger'` (frontend)

**NEVER log**: Passwords, JWT tokens, API keys, emails, PII.

---

## Environment Variables

### Setup

```bash
# Backend
cp /Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-backend/.env.example \
   /Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-backend/.env
```

### Required for Production

| Variable | Description |
|----------|-------------|
| `JWT_SECRET_KEY` | Required - min 32 chars |
| `POSTGRES_PASSWORD` | Database password |
| `CORS_ORIGINS` | Allowed origins JSON array |

### Key Backend Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | postgresql+asyncpg://... | Full connection string |
| `REDIS_URL` | redis://localhost:6379/0 | Redis connection |
| `JWT_SECRET_KEY` | (required) | Token signing key |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | 30 | Token expiry |
| `LOG_LEVEL` | INFO | DEBUG, INFO, WARNING, ERROR |
| `CORS_ORIGINS` | localhost variants | Allowed origins |

### Key Frontend Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | http://localhost:8000 | Backend API URL |
| `NODE_ENV` | development | Environment mode |

---

## Backend Testing

```bash
# Run all tests (parallel)
cd /Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-backend && \
/Users/samosipov/.local/bin/poetry run pytest -n auto

# Run with coverage
/Users/samosipov/.local/bin/poetry run pytest --cov=src --cov-report=term-missing

# Run by marker
/Users/samosipov/.local/bin/poetry run pytest -m unit
/Users/samosipov/.local/bin/poetry run pytest -m integration

# Debug mode
/Users/samosipov/.local/bin/poetry run pytest -vv --tb=long -x
```

**Test Structure**: `tests/unit/`, `tests/integration/`, `tests/fixtures/`, `tests/factories/`

### Test Alignment Verification

**CRITICAL**: When modifying code, always verify that existing tests are aligned with the changes.

| Situation | Required Action |
|-----------|-----------------|
| Changed function signature | Update all tests calling that function |
| Changed API response format | Update API tests and E2E tests |
| Changed model fields | Update factory defaults and test assertions |
| Changed validation rules | Update validation tests |
| Renamed/moved files | Update test imports |
| Changed error messages | Update tests asserting on error messages |

**Verification Checklist**:
1. Run affected tests: `pytest tests/path/to/relevant_tests.py -v`
2. Search for usages: `grep -r "function_name" tests/`
3. Check test imports match current module structure
4. Verify mocks/stubs match current interfaces
5. Ensure test data factories produce valid data for current schema

**Common Test Drift Issues**:
- Tests pass but assert on outdated behavior
- Mocked functions have different signatures than actual
- Test fixtures create data incompatible with current schema
- E2E tests use outdated selectors or API endpoints

**Creating Test Data**:
```python
# Fixtures
async def test_example(self, db_session, test_user, auth_headers): ...

# Factories
user = await UserFactory.create_async(db_session, admin=True)
deck = await DeckFactory.create_async(db_session, a1=True)
```

---

## Frontend Testing

### Vitest (Unit/Integration)

```bash
cd /Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-frontend && npm run test
npm run test:watch      # Watch mode
npm run test:coverage   # With coverage
npm run test:ui         # Browser UI
```

### Playwright (E2E)

```bash
cd /Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-frontend && npm run test:e2e
npm run test:e2e:headed  # With browser visible
npm run test:e2e:ui      # Playwright UI
npm run test:e2e:debug   # Step through
```

---

## E2E Test Database Seeding

The seeding infrastructure provides deterministic test data for E2E tests, enabling testing of features that require real data (flashcard reviews, analytics, spaced repetition states).

### Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `TEST_SEED_ENABLED` | `false` | Enable seeding endpoints |
| `TEST_SEED_SECRET` | (none) | Optional secret for `X-Test-Seed-Secret` header |
| `SEED_ON_DEPLOY` | `false` | Auto-seed on startup (local dev only) |

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/test/seed/status` | GET | Check seeding availability (no auth) |
| `/api/v1/test/seed/all` | POST | Full seed (truncate + create all) |
| `/api/v1/test/seed/truncate` | POST | Truncate all tables |
| `/api/v1/test/seed/users` | POST | Create test users only |
| `/api/v1/test/seed/content` | POST | Create decks/cards only |

### Test Users Created

| Email | Password | Role |
|-------|----------|------|
| e2e_learner@test.com | TestPassword123! | Regular user with progress |
| e2e_beginner@test.com | TestPassword123! | New user, no progress |
| e2e_advanced@test.com | TestPassword123! | Advanced user |
| e2e_admin@test.com | TestPassword123! | Admin user |

### Data Created

- **4 Users**: Learner, Beginner, Advanced, Admin
- **6 Decks**: A1, A2, B1, B2, C1, C2 (CEFR levels)
- **60 Cards**: 10 Greek vocabulary cards per deck
- **Card Statistics**: SM-2 spaced repetition states for learner
- **Reviews**: Review history for learner user

### CLI Usage

```bash
# Full seed
cd learn-greek-easy-backend && \
TEST_SEED_ENABLED=true poetry run python scripts/seed_e2e_data.py

# Dry run (show what would be done)
TEST_SEED_ENABLED=true poetry run python scripts/seed_e2e_data.py --dry-run

# Truncate only (clear all data)
TEST_SEED_ENABLED=true poetry run python scripts/seed_e2e_data.py --truncate-only
```

### API Usage

```bash
# Check status (no auth required)
curl http://localhost:8000/api/v1/test/seed/status

# Full seed
curl -X POST http://localhost:8000/api/v1/test/seed/all

# With secret (if configured)
curl -X POST http://localhost:8000/api/v1/test/seed/all \
  -H "X-Test-Seed-Secret: your-secret"

# Skip truncation (additive seeding)
curl -X POST http://localhost:8000/api/v1/test/seed/all \
  -H "Content-Type: application/json" \
  -d '{"options": {"skip_truncate": true}}'
```

### Auto-Seeding on Startup

Set `SEED_ON_DEPLOY=true` to automatically seed the database when the application starts. Only works in non-production environments with `TEST_SEED_ENABLED=true`.

### Security

1. **Production blocked**: Returns 403 in production environment
2. **Feature flag**: Requires `TEST_SEED_ENABLED=true`
3. **Optional secret**: Can require `X-Test-Seed-Secret` header
4. **Router not mounted**: Seed router is not even imported in production

---

## Bug Research Workflow

**DO NOT GUESS** - Use Playwright MCP to observe actual behavior.

1. Start dev environment: `docker-compose -f docker-compose.dev.yml up -d`
2. Seed test data: `curl -X POST http://localhost:8000/api/v1/test/seed/all`
3. Use Playwright MCP: `browser_navigate` → `browser_snapshot` → `browser_click` → `browser_console_messages`
4. Document: actual behavior, expected behavior, console errors, network failures

---

## Common Issues

| Issue | Solution |
|-------|----------|
| poetry: command not found | Use `/Users/samosipov/.local/bin/poetry` |
| No module named 'src' | Run from backend directory with `poetry run` |
| Database connection refused | Check: `docker ps --filter "name=learn-greek-postgres"` |
| Multiple docker-compose.yml | Use root docker-compose.yml only |
| Container unhealthy | Check logs: `docker-compose -f docker-compose.dev.yml logs backend` |
| Redis connection failed | Ensure Redis is running: `docker ps --filter "name=learn-greek-redis"` |
| JWT_SECRET_KEY required | Set in .env file or environment (min 32 chars for production) |
| Health check fails | Verify endpoint: `curl -v http://localhost:8000/health` |
| Port 5433 vs 5432 | Dev uses 5433, prod uses 5432 for PostgreSQL |

---

## Pre-commit Hooks

Setup: `./scripts/setup-hooks.sh` or `pip install pre-commit && pre-commit install`

Hooks run automatically on `git commit`. If hooks fail, stage fixed files and commit again.
Skip hooks (emergency): `git commit --no-verify`

---

## PR Labels for CI/CD Control

Use labels on Pull Requests to control which CI/CD tests run:

| Label | Effect |
|-------|--------|
| `run-full-tests` | Force full test suite + deployment on draft PRs |
| `visual-test` | Force full visual regression suite (all pages, all viewports) |
| `skip-visual` | Skip post-deploy visual tests (Playwright visual + Chromatic) |
| `skip-seed` | Skip database seeding in dev environment |
| (no label) | Default - see workflow behavior below |

### CI Workflow Behavior

The CI is split into **Quick Checks** (every commit) and **Full Tests** (on-demand):

| PR State | Quick Checks | Full Tests | Deployment |
|----------|--------------|------------|------------|
| Draft PR | Every commit | Skipped | Skipped |
| Draft + `run-full-tests` label | Every commit | Runs | Runs |
| Ready for review | Every commit | Runs | Runs |

**Quick Checks (~2-3 min):** Frontend lint/typecheck, Backend lint/typecheck (black, isort, flake8, mypy), Alembic migration check

**Full Tests (~15-25 min):** Quick checks + Unit tests, E2E tests (3 browsers), Backend tests, API tests, Deployment, Health/A11y/Lighthouse/Visual tests

### When to Use Each Label

| Scenario | Recommended Label |
|----------|-------------------|
| Working on draft PR, need full tests | `run-full-tests` |
| Major UI changes, new pages | `visual-test` |
| Design system updates | `visual-test` |
| Backend-only changes | `skip-visual` |
| Config/documentation changes | `skip-visual` |
| Backend-only changes (no test data needed) | `skip-seed` |
| Infrastructure/CI changes | `skip-seed` |
| Most feature PRs | (no label) - smart detection |

### Adding Labels via CLI

```bash
# When creating PR
gh pr create --title "..." --body "..." --label "visual-test"

# Add to existing PR
gh pr edit 123 --add-label "skip-visual"

# Force full tests on draft PR
gh pr edit 123 --add-label "run-full-tests"

# Remove label
gh pr edit 123 --remove-label "visual-test"
```

---

## Railway

### Production Backend Privacy

Production backend has NO public domain - only accessible via frontend nginx proxy (`http://backend:8000`).
CORS: `CORS_ORIGINS=https://learn-greek-frontend.up.railway.app`

See **[docs/railway-backend-privacy.md](docs/railway-backend-privacy.md)** for setup.

### PR Preview Environments

| Service | URL |
|---------|-----|
| Frontend | https://frontend-dev-8db9.up.railway.app |
| Backend | https://backend-dev-bc44.up.railway.app |

**GitHub Secrets**: `RAILWAY_TOKEN`, `PREVIEW_JWT_SECRET`

See **[docs/pr-preview-deployments.md](docs/pr-preview-deployments.md)** for full documentation.
