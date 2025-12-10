# Learn Greek Easy - Project Configuration

## MCP Servers (Model Context Protocol)

**4 MCP servers are available** - use them to enhance development workflow:

| Server | Prefix | Purpose |
|--------|--------|---------|
| **Context7** | `mcp__context7__*` | Documentation for libraries, APIs, languages, databases |
| **Playwright** | `mcp__playwright__*` | Browser automation, screenshots, testing |
| **GitHub** | `mcp__github__*` | Repos, issues, PRs, code search |
| **Railway** | `mcp__railway-mcp-server__*` | Cloud deployment, environments, variables |

### Usage Guidelines

1. **Context7 (Documentation)** - **CRITICAL: Use before writing code**
   - Always verify API signatures and usage patterns before implementation
   - Look up latest docs for any library/framework being used
   - Use for: libraries, frameworks, APIs, programming languages, databases, ORMs, etc.
   - Tools: `resolve-library-id` → `get-library-docs`

2. **Playwright (Browser Automation)**
   - Use for visual verification of UI changes
   - Take screenshots to confirm implementations
   - Test user flows and interactions

3. **GitHub (Repository Operations)**
   - Search code across repositories
   - Manage issues and pull requests
   - Review commits and branches

4. **Railway (Cloud Deployment)**
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
After creating PR, add the link to task implementation notes in Backlog.

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
| `visual-test` | Force full visual regression suite (all pages, all viewports) |
| `skip-visual` | Skip post-deploy visual tests (Playwright visual + Chromatic) |
| (no label) | Default - all tests run |

**Note:** E2E tests (functional tests in CI) always run and cannot be skipped via labels. They verify functionality, not appearance.

### When to Use Each Label

| Scenario | Recommended Label |
|----------|-------------------|
| Major UI changes, new pages | `visual-test` |
| Design system updates | `visual-test` |
| Backend-only changes | `skip-visual` |
| Config/documentation changes | `skip-visual` |
| Most feature PRs | (no label) - smart detection |

### Adding Labels via CLI

```bash
# When creating PR
gh pr create --title "..." --body "..." --label "visual-test"

# Add to existing PR
gh pr edit 123 --add-label "skip-visual"

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

<!-- BACKLOG.MD MCP GUIDELINES START -->

<CRITICAL_INSTRUCTION>

## BACKLOG WORKFLOW INSTRUCTIONS

This project uses Backlog.md MCP for all task and project management activities.

**CRITICAL GUIDANCE**

- If your client supports MCP resources, read `backlog://workflow/overview` to understand when and how to use Backlog for this project.
- If your client only supports tools or the above request fails, call `backlog.get_workflow_overview()` tool to load the tool-oriented overview (it lists the matching guide tools).

- **First time working here?** Read the overview resource IMMEDIATELY to learn the workflow
- **Already familiar?** You should have the overview cached ("## Backlog.md Overview (MCP)")
- **When to read it**: BEFORE creating tasks, or when you're unsure whether to track work

These guides cover:
- Decision framework for when to create tasks
- Search-first workflow to avoid duplicates
- Links to detailed guides for task creation, execution, and completion
- MCP tools reference

You MUST read the overview resource to understand the complete workflow. The information is NOT summarized here.

</CRITICAL_INSTRUCTION>

<!-- BACKLOG.MD MCP GUIDELINES END -->
