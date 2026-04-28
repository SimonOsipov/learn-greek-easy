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

**Backend**: `cd learn-greek-easy-backend && poetry run uvicorn src.main:app --reload`
**Frontend**: `cd learn-greek-easy-frontend && npm run dev`

## MCP Servers

| Server | Purpose |
|--------|---------|
| Backlog | Task tracking (MCP) |
| Context7 | Library docs - **always check before writing code** |
| Playwright | Visual verification, E2E testing, bug research |
| Railway | Deployment (no destructive actions - use dashboard for deletes) |
| Sentry | Error tracking + **Logs** (use `search_events` with natural language to query backend/frontend logs — preferred over Railway for log investigation) |
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

5. **Log investigation**: Use **Sentry MCP** `search_events` tool to query production logs (not Railway MCP). Sentry Logs indexes all loguru output with severity, trace IDs, and structured attributes. Railway log filter cannot search inside loguru's serialized JSON output.

6. **TypeScript build**: `npx tsc -b` must pass before commit — `Frontend tsc -b` is a required GitHub status check on `main` (no skip mechanic).

## Design System

**Source of truth:** [docs/design-system.md](docs/design-system.md).
Visual snapshot: [Design-System-v2.4.html](docs/design-system/Design-System-v2.4.html).

**Read it first** before any task involving color, spacing, radius, shadow, font, animation, or new visual component. The doc is ~290 lines and grep-friendly.

### Drift rules (forbidden in `src/**/*.{ts,tsx,css}` outside `index.css` / `tailwind.config.js`)

- Raw hex colors → use HSL tokens via `hsl(var(--token))`.
- Inline `style={{ color: '#...' }}` or hardcoded `rgba(...)` → use tokens or utility classes.
- Arbitrary Tailwind values (`bg-[#3b82f6]`, `text-[hsl(...)]`) → use named utilities (`bg-primary`).
- New `@keyframes` in component files → add to `index.css` + `tailwind.config.js` `animation` map.

```tsx
// ❌ Don't
<div className="bg-[#3b82f6]" style={{ color: '#0f172a' }}>
// ✓ Do
<div className="bg-primary text-fg">
```

### Adding a new token / class / animation

If you need a value that isn't in the doc:

1. Define it in `src/index.css` (with light + dark) or `tailwind.config.js`.
2. Update [docs/design-system.md](docs/design-system.md) in the same PR.
3. Call it out in the PR description under **Design system delta**.

### Reuse primitives

Don't re-implement `Dialog`, `Popover`, `Tooltip`, `Select`, `DropdownMenu`, `Sheet`, `Toast`, `Accordion`, etc. Use the existing primitive in `src/components/ui/*`. Compose, don't reinvent.

### Three distinct palettes — don't cross them

- **App** (behind login): glassy, `--bg / --card / --primary / --accent`.
- **Landing** (greeklish.eu marketing): editorial, `--landing-navy / --landing-greek-blue / --landing-gold`.
- **Practice** (flashcards, culture, mock exam): slate-based, `--practice-*`.

### Legacy drift

Existing code may use raw hex (notably the `--practice-*` palette in `src/index.css`). When touching adjacent code:
- **Don't mass-migrate legacy drift** — that's a separate track (the token migration in §3).
- **Don't introduce new drift** — use tokens for what you're adding.

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

## Environment

Required prod vars: `JWT_SECRET_KEY` (min 32 chars), `DATABASE_URL`, `CORS_ORIGINS`

## Common Issues

| Issue | Solution |
|-------|----------|
| poetry not found | Use `/Users/samosipov/.local/bin/poetry` |
| No module 'src' | Run from backend dir with `poetry run` |
| DATABASE_URL not set | Set `DATABASE_URL` in `.env` -- see `config.py` for required fields |

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
2. Check Backlog for current task details
3. Continue from where you left off

### During Long Sessions
Periodically update `.claude/handoff.yaml` with:
- `current_task`: Task ID from Backlog being worked on
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
- [Railway Backend Privacy](docs/railway-backend-privacy.md) - Production setup
- [PR Preview Deployments](docs/pr-preview-deployments.md) - Preview environments
- [Logging](docs/logging.md) - Logging architecture and best practices
- [PreCompact Hook Setup](docs/precompact-hook-setup.md) - Session continuity configuration
- [Supabase Database](docs/supabase-database.md) - Database credentials, connectivity, and migration guide
- [Analytics Events](docs/analytics-events.md) - PostHog event naming, when to create, and implementation patterns
- [Testing](docs/testing.md) - Test strategy, fixtures, factories, coverage, and CI/CD
