# Learn Greek Easy

## Quality Over Speed (CRITICAL)

**Thoroughness and correctness are valued far more than speed.** When researching, executing, verifying, or debugging:

- **Research deeply** before providing answers. A wrong answer implemented is worse than taking extra time to find the right one.
- **Verify assumptions** by checking actual code, running tests, using Playwright to observe real behavior.
- **Never guess** - if unsure, investigate further or ask clarifying questions.
- **Double-check findings** before reporting conclusions.
- **Incomplete is better than incorrect** - say "I need to investigate more" rather than giving a potentially wrong answer.

---

## Commands

**Poetry** (always from backend dir with full path):
```bash
cd /Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-backend && /Users/samosipov/.local/bin/poetry run <cmd>
```

**Docker dev**: `docker-compose -f docker-compose.dev.yml up -d`
**Docker prod**: `docker-compose up -d` (requires JWT_SECRET_KEY in .env)

## MCP Servers

| Server | Purpose |
|--------|---------|
| Vibe Kanban | Task tracking. Project ID: `dc7e8354-2785-455f-8aa3-7787e7de85c5` |
| Context7 | Library docs - **always check before writing code** |
| Playwright | Visual verification, E2E testing, bug research |
| Railway | Deployment (no destructive actions - use dashboard for deletes) |
| Sentry | Error tracking and logs for frontend and backend |
| Auth0 | Applications, APIs, actions, logs, forms (no user management) |

## Critical Rules

1. **Model changes require Alembic migration**:
   ```bash
   poetry run alembic revision --autogenerate -m "description"
   poetry run alembic upgrade head
   ```

2. **Test alignment**: When modifying code, verify tests match current interfaces

3. **Never log**: Passwords, JWT tokens, API keys, emails, PII

4. **Bug research**: Use Playwright MCP to observe actual behavior, don't guess

## Testing

```bash
# Backend
poetry run pytest -n auto                    # All (parallel)
poetry run pytest -m unit                    # Unit only
poetry run pytest --cov=src                  # With coverage

# Frontend (from frontend dir)
npm run test                                 # Vitest
npm run test:e2e                             # Playwright E2E
```

## E2E Seeding

Requires `TEST_SEED_ENABLED=true`. Full docs: [docs/e2e-seeding.md](docs/e2e-seeding.md)

```bash
# Quick seed
curl -X POST http://localhost:8000/api/v1/test/seed/all

# Test users: e2e_learner@test.com, e2e_admin@test.com (password: TestPassword123!)
```

## Environment

Dev ports: Frontend 5173, Backend 8000, PostgreSQL 5433, Redis 6379

Required prod vars: `JWT_SECRET_KEY` (min 32 chars), `POSTGRES_PASSWORD`, `CORS_ORIGINS`

## Common Issues

| Issue | Solution |
|-------|----------|
| poetry not found | Use `/Users/samosipov/.local/bin/poetry` |
| No module 'src' | Run from backend dir with `poetry run` |
| DB connection refused | `docker ps --filter "name=learn-greek-postgres"` |
| Port 5433 vs 5432 | Dev uses 5433, prod uses 5432 |

## Deployment

**Production**: Automatic on push to `main` via GitHub Actions (`deploy-production.yml`)
**Dev/Preview**: Automatic on PR via GitHub Actions (`preview.yml`)

Manual deploy: See [docs/deployment-guide.md](docs/deployment-guide.md)

**Important**: Railway auto-deploy is DISABLED. All deploys go through GitHub Actions for sequential Backend -> Frontend deployment.

## Session Continuity (PreCompact Hook)

When context is compacted (automatically or via `/compact`), a PreCompact hook saves session state to `.claude/handoff.yaml`.

### After Compaction
If `.claude/handoff.yaml` exists with a recent timestamp:
1. **READ IT FIRST** to restore context
2. Check Vibe Kanban for current task details
3. Continue from where you left off

### During Long Sessions
Periodically update `.claude/handoff.yaml` with:
- `current_task`: Vibe Kanban task ID being worked on
- `progress`: What's done, what's in progress
- `decisions`: Key choices made
- `blockers`: Any issues encountered

### Setup (one-time per machine)
See [docs/precompact-hook-setup.md](docs/precompact-hook-setup.md) for `.claude/` files to create.

## Project Memory

Auto-updated project state file: `~/.claude/projects/-Users-samosipov-Downloads-learn-greek-easy/memory/MEMORY.md`

Update this file when features are merged, phases change, or key decisions are made.

## Documentation

- [Deployment Guide](docs/deployment-guide.md) - Sequential deploy, rollback, troubleshooting
- [E2E Seeding](docs/e2e-seeding.md) - Test data seeding infrastructure
- [CI/CD Labels](docs/ci-cd-labels.md) - PR labels for test control
- [Docker Reference](docs/docker-reference.md) - Container names, ports, commands
- [Railway Backend Privacy](docs/railway-backend-privacy.md) - Production setup
- [PR Preview Deployments](docs/pr-preview-deployments.md) - Preview environments
- [Logging](learn-greek-easy-backend/docs/logging.md) - Logging architecture and best practices
- [PreCompact Hook Setup](docs/precompact-hook-setup.md) - Session continuity configuration
