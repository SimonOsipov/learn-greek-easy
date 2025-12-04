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
