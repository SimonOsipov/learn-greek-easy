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

### Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `SENTRY_DSN` | None | Sentry DSN (disabled if not set) |
| `SENTRY_ENVIRONMENT` | "development" | Environment tag |
| `SENTRY_TRACES_SAMPLE_RATE` | 0.1 | Performance trace sampling |
| `SENTRY_PROFILES_SAMPLE_RATE` | 0.1 | Profiling sample rate |
| `SENTRY_SEND_DEFAULT_PII` | False | Include PII in events |
| `SENTRY_DEBUG` | False | Enable SDK debug logging |

### Test User Filtering

Sentry automatically filters test users matching:
- Email starting with `e2e_` or `test_`
- Email containing `@test.`

### Debug Testing

```bash
# Trigger a test exception (debug mode only)
curl -X POST http://localhost:8000/debug/sentry-test
```

### Error Capture

- Unhandled exceptions (500): Automatically captured
- BaseAPIException (5xx): Captured
- 4xx errors: Not captured (expected behavior)
- Test user errors: Filtered

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

**CRITICAL**: When investigating bugs or unexpected behavior, DO NOT GUESS. Use this workflow to observe actual behavior with Playwright MCP.

### Why This Matters

- **No guessing**: Observe actual behavior instead of assuming
- **Reproducible**: Same seeded data ensures consistent reproduction
- **Visual proof**: Screenshots document the issue
- **Faster debugging**: See exactly what users see

### Step 1: Start Dev Environment

```bash
# Start full stack with docker-compose
cd /Users/samosipov/Downloads/learn-greek-easy && docker-compose -f docker-compose.dev.yml up -d

# Verify services are running
docker-compose -f docker-compose.dev.yml ps

# Check backend is healthy
curl http://localhost:8000/health

# Check frontend is running
curl http://localhost:5173
```

### Step 2: Seed Test Data

```bash
# Check seeding is enabled
curl http://localhost:8000/api/v1/test/seed/status

# Full seed (truncate + create all test data)
curl -X POST http://localhost:8000/api/v1/test/seed/all

# Or use CLI
cd /Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-backend && \
TEST_SEED_ENABLED=true /Users/samosipov/.local/bin/poetry run python scripts/seed_e2e_data.py
```

**Test Users Available After Seeding**:
| Email | Password | Role |
|-------|----------|------|
| e2e_learner@test.com | TestPassword123! | Regular user with progress |
| e2e_beginner@test.com | TestPassword123! | New user, no progress |
| e2e_advanced@test.com | TestPassword123! | Advanced user |
| e2e_admin@test.com | TestPassword123! | Admin user |

### Step 3: Use Playwright MCP to Investigate

Use MCP Playwright tools to visually verify and investigate:

```yaml
# Navigate to the page with the issue
mcp__playwright__browser_navigate:
  url: "http://localhost:5173"

# Take a snapshot to see the current state (better than screenshot for actions)
mcp__playwright__browser_snapshot

# Take a screenshot for documentation
mcp__playwright__browser_take_screenshot:
  filename: "bug-investigation.png"

# Interact with elements to reproduce the bug
mcp__playwright__browser_click:
  element: "Login button"
  ref: "[ref from snapshot]"

# Fill forms
mcp__playwright__browser_type:
  element: "Email input"
  ref: "[ref from snapshot]"
  text: "e2e_learner@test.com"

# Check console for errors
mcp__playwright__browser_console_messages:
  onlyErrors: true

# Check network requests
mcp__playwright__browser_network_requests
```

### Step 4: Document Findings

After investigation, document:
1. **Actual behavior observed** (with screenshots)
2. **Expected behavior** (from task/PRD)
3. **Steps to reproduce** (with Playwright commands used)
4. **Console errors** (if any)
5. **Network failures** (if any)
6. **Root cause identified** (if found)

### Common Investigation Patterns

| Scenario | Playwright Tools to Use |
|----------|------------------------|
| UI not rendering | `browser_snapshot` + `browser_take_screenshot` |
| Button not working | `browser_click` + `browser_console_messages` |
| Form submission fails | `browser_type` + `browser_network_requests` |
| Navigation broken | `browser_navigate` + `browser_snapshot` |
| Error state display | `browser_snapshot` + `browser_take_screenshot` |
| Auth issues | Login flow + `browser_network_requests` |

### Full Investigation Example

```bash
# 1. Start environment
docker-compose -f docker-compose.dev.yml up -d

# 2. Seed data
curl -X POST http://localhost:8000/api/v1/test/seed/all

# 3. Use Playwright MCP tools:
# - Navigate to http://localhost:5173
# - Take snapshot to see page structure
# - Click on elements to reproduce bug
# - Take screenshot for documentation
# - Check console for errors
# - Check network requests for API failures

# 4. Document findings in task description
```

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

## Git Workflow for Tasks

**CRITICAL**: All task implementations must follow this workflow:

### 1. Create Feature Branch
```bash
# Before starting any task
git checkout main
git pull origin main
git checkout -b feature/[task-id]-short-description

# Examples:
git checkout -b feature/task-140-response-formatting
git checkout -b fix/task-141-api-versioning
```

### 2. Implement and Commit
```bash
# Make changes, then commit
git add .
git commit -m "[task-id] Description of changes"

# Example:
git commit -m "[task-140] Add response formatting utilities"
```

### 3. Push and Create PR
```bash
# Push branch
git push -u origin feature/[task-id]-short-description

# Create PR using GitHub CLI
gh pr create --title "[task-id] Feature description" --body "## Summary
- Description of changes

## Test Plan
- How to verify

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

### 4. Add PR Link to Task
After creating PR, update task description in Vibe Kanban with the PR link.

### Branch Naming Convention

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feature/[task-id]-description` | `feature/task-140-response-formatting` |
| Bug Fix | `fix/[task-id]-description` | `fix/task-141-validation-error` |
| Refactor | `refactor/[task-id]-description` | `refactor/task-142-cleanup` |

### Task Completion Rules

- **Executor**: Creates branch, implements, creates PR, adds PR link to notes
- **Executor**: Leaves status as "In Progress" after PR creation
- **QA Agent**: Verifies implementation, marks task as "Done"
- **Only QA can mark tasks as Done!**

---

## Pre-commit Hooks

### First-Time Setup

```bash
# Option 1: Use setup script (recommended)
./scripts/setup-hooks.sh

# Option 2: Manual setup
pip install pre-commit  # or: brew install pre-commit
pre-commit install
```

### Daily Usage

Pre-commit hooks run automatically on `git commit`. No action needed!

```bash
# If hooks fail:
# 1. Auto-fixed files are already staged
# 2. Review changes: git diff
# 3. Stage and commit again: git add . && git commit

# Manual commands
pre-commit run                    # Run on staged files only
pre-commit run --all-files        # Run on entire codebase
pre-commit run black --all-files  # Run specific hook
pre-commit autoupdate             # Update hook versions

# Skip hooks (emergency only!)
git commit --no-verify -m "message"
```

### Troubleshooting

| Issue | Solution |
|-------|----------|
| "pre-commit: command not found" | Run: `pip install pre-commit` |
| Hook fails but CI passes | Run: `pre-commit autoupdate` |
| "npm: command not found" in hook | Ensure Node.js is installed |
| MyPy missing dependencies | Run: `cd learn-greek-easy-backend && poetry install` |
| Want to skip hooks once | Use: `git commit --no-verify` |

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

## Railway Production Backend Privacy

**CRITICAL**: In production, the backend service should NOT have a public domain. It should only be accessible via Railway's private network through the frontend nginx proxy.

### Network Architecture

| Environment | Frontend Access | Backend Access |
|-------------|-----------------|----------------|
| **Production** | Public (https://learn-greek-frontend.up.railway.app) | Private (http://backend:8000 - internal only) |
| **Preview/Dev** | Public | Public (for testing) |

### Security Benefits

1. Eliminates direct backend access in production
2. Reduces attack surface (backend not publicly discoverable)
3. Enforces gateway pattern (all requests via frontend)
4. CORS defense-in-depth

### CORS Configuration

Backend CORS must be configured to allow only the production frontend:

**Environment Variable (Production Backend)**:
```bash
CORS_ORIGINS=https://learn-greek-frontend.up.railway.app
```

This is configured in `.railway/variables.json` under the `production` section.

### Implementation Guide

For detailed steps on removing the backend public domain and configuring production security, see:

**[docs/railway-backend-privacy.md](docs/railway-backend-privacy.md)**

Key steps:
1. Update backend `CORS_ORIGINS` environment variable in Railway
2. Remove backend public domain via Railway Dashboard (Settings → Public Networking → Remove Domain)
3. Verify frontend can reach backend via private network (`http://backend:8000`)
4. Test that direct backend access fails (connection refused)

### Verification

After implementing backend privacy:

```bash
# Frontend health check should work
curl https://learn-greek-frontend.up.railway.app/api/health

# Direct backend access should fail
curl https://learn-greek-backend.up.railway.app/health
# Expected: Connection refused or 404
```

---

## Railway PR Preview Environments

Railway PR preview environments allow testing changes in isolated environments before merging.

### Configuration Files

| File | Purpose |
|------|---------|
| `railway.json` | Root project configuration |
| `learn-greek-easy-backend/railway.json` | Backend service config |
| `learn-greek-easy-frontend/railway.json` | Frontend service config |
| `.railway/variables.json` | Environment variable templates |
| `scripts/railway-preview.sh` | CLI helper script |

### GitHub Secrets Required

Configure the following secrets in GitHub repository settings:

| Secret | Description | How to Generate |
|--------|-------------|-----------------|
| `RAILWAY_TOKEN` | Railway API token for CI/CD | Railway Dashboard > Account Settings > Tokens > Create Token |
| `PREVIEW_JWT_SECRET` | JWT secret for preview environments | `openssl rand -hex 32` |

### Setting Up Railway Token

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click on your profile icon (top right)
3. Select **Account Settings**
4. Navigate to **Tokens** section
5. Click **Create Token**
6. Name it (e.g., "GitHub Actions PR Preview")
7. Copy the token and add to GitHub Secrets

### Setting Up GitHub Secrets

1. Go to GitHub repository > **Settings** > **Secrets and variables** > **Actions**
2. Click **New repository secret**
3. Add `RAILWAY_TOKEN` with the token from Railway
4. Add `PREVIEW_JWT_SECRET` with: `openssl rand -hex 32`

### Manual Preview Environment Management

Use the helper script for manual environment management:

```bash
# Create a preview environment for PR #123
./scripts/railway-preview.sh 123 create

# Deploy to the preview environment
./scripts/railway-preview.sh 123 deploy

# Destroy the preview environment
./scripts/railway-preview.sh 123 destroy
```

### Railway MCP Tools

You can also use Railway MCP tools for environment management:

```bash
# Create environment
mcp__railway-mcp-server__create-environment

# List services
mcp__railway-mcp-server__list-services

# Set variables
mcp__railway-mcp-server__set-variables

# View logs
mcp__railway-mcp-server__get-logs
```

**Note**: Railway MCP does not support delete/destroy operations. Use the Railway CLI or Dashboard for cleanup.

---

## PR Preview Deployments

PR preview deployments provide automatic testing and deployment for every pull request. This section covers the deployed workflow and how to use it.

### Overview

Every pull request automatically receives a preview deployment on Railway's dev environment. This includes:
- Full stack deployment (frontend, backend, database, Redis)
- Automated testing (health, performance, visual, accessibility)
- PR comment with deployment URLs and test results

### Workflow

```
PR Opened/Updated --> CI Tests --> Deploy to Dev Environment --> Run Tests --> Report Results
PR Closed/Merged --> Auto-stop Services (environment preserved for stable URLs)
```

### Preview URLs

The dev environment uses stable URLs (for OAuth callback compatibility):

| Service | URL |
|---------|-----|
| Frontend | https://frontend-dev-8db9.up.railway.app |
| Backend | https://backend-dev-bc44.up.railway.app |
| API Docs | https://backend-dev-bc44.up.railway.app/docs |

### Test Results

| Test | Purpose | Threshold |
|------|---------|-----------|
| Health Check | Verify deployment works | All endpoints 200 |
| Lighthouse (Desktop) | Performance metrics | Score >= 80 |
| Lighthouse (Mobile) | Mobile performance | Score >= 70 |
| Visual Regression | UI change detection | Review in Chromatic |
| Accessibility | WCAG 2.1 AA compliance | No critical/serious violations |

### Skipping Preview Deployment

Documentation-only changes (`.md` files, `docs/` folder) skip preview automatically.

### Manual Scripts

```bash
# Run health checks manually
./scripts/preview-health-check.sh <FRONTEND_URL> <BACKEND_URL> [MAX_RETRIES] [RETRY_INTERVAL]

# Example
./scripts/preview-health-check.sh https://frontend-dev-8db9.up.railway.app https://backend-dev-bc44.up.railway.app 30 10

# Run API smoke tests
./scripts/preview-api-smoke.sh <BACKEND_URL>

# Example
./scripts/preview-api-smoke.sh https://backend-dev-bc44.up.railway.app

# Manual environment management (legacy per-PR environments)
./scripts/railway-preview.sh <PR_NUMBER> create|deploy|destroy
```

For comprehensive documentation, see [docs/pr-preview-deployments.md](docs/pr-preview-deployments.md).

<!-- VIBE KANBAN MCP GUIDELINES START -->

## Vibe Kanban Task Management

This project uses **Vibe Kanban MCP** for task management.

### Project ID

```
cb892c2b-4a17-4402-83f2-8f6cb086468b
```

### Quick Reference

```bash
# List all tasks
mcp__vibe_kanban__list_tasks:
  project_id: "cb892c2b-4a17-4402-83f2-8f6cb086468b"

# Create a task
mcp__vibe_kanban__create_task:
  project_id: "cb892c2b-4a17-4402-83f2-8f6cb086468b"
  title: "Task title"
  description: "Full specification including acceptance criteria and implementation plan"

# Get task details
mcp__vibe_kanban__get_task:
  task_id: "[task-uuid]"

# Update task status
mcp__vibe_kanban__update_task:
  task_id: "[task-uuid]"
  status: "inprogress"  # todo, inprogress, inreview, done, cancelled
```

### Task Status Flow

```
todo → inprogress → inreview → done
```

| Status | When to Use |
|--------|-------------|
| `todo` | Task created, not started |
| `inprogress` | Actively being worked on |
| `inreview` | PR created, awaiting review |
| `done` | Completed and verified (QA only) |
| `cancelled` | No longer needed |

### Key Differences from Backlog.md

- **No document storage** - PRDs and architecture go in task descriptions
- **No separate plan field** - Implementation plan is part of description
- **No notes field** - All updates appended to description
- **Simpler status** - Uses `todo/inprogress/inreview/done/cancelled`

For full agent workflow instructions, see `~/.claude/CLAUDE.md`.

<!-- VIBE KANBAN MCP GUIDELINES END -->
