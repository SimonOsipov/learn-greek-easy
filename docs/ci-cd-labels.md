# PR Labels for CI/CD Control

Use labels on Pull Requests to control which CI/CD tests run.

## Available Labels

| Label | Effect |
|-------|--------|
| `skip-visual` | Skip visual tests (Playwright + Chromatic) |
| `skip-k6` | Skip k6 performance tests |

## Default Behavior

| PR State | Tests Run |
|----------|-----------|
| Draft PR | Quick checks only (lint, typecheck, format) |
| Ready PR | Full suite: CI tests, deploy, health, a11y, Lighthouse, visual, k6 |

## CI Workflow Behavior

### Quick Checks (~2-3 min)
- Frontend lint/typecheck
- Backend lint/typecheck (black, isort, flake8, mypy)
- Alembic migration check

### Full Tests (~15-25 min)
- Quick checks
- Unit tests
- E2E tests (3 browsers)
- Backend tests
- API tests
- Deployment
- Health/A11y/Lighthouse tests
- Visual regression (Playwright + Chromatic)
- K6 performance tests

## When to Use Each Label

| Scenario | Label |
|----------|-------|
| Backend-only changes (no UI) | `skip-visual` |
| Config/documentation changes | `skip-visual` |
| Quick iteration, skip load tests | `skip-k6` |
| Infrastructure/CI changes | `skip-visual`, `skip-k6` |
| Most feature PRs | (no label) - run everything |

## Adding Labels via CLI

```bash
# When creating PR
gh pr create --title "..." --body "..." --label "skip-visual"

# Add to existing PR
gh pr edit 123 --add-label "skip-visual"

# Remove label
gh pr edit 123 --remove-label "skip-visual"

# Skip multiple test types
gh pr edit 123 --add-label "skip-visual" --add-label "skip-k6"
```

## Performance Testing

K6 browser-based performance tests run by default on ready PRs.

**Tests run:**
- Auth scenario: Login flow timing (6 metrics)
- Dashboard scenario: User journey timing (7 metrics)

**Results:**
- Metrics reported in PR comment (p95 values)
- JSON reports uploaded as artifacts
- Non-blocking: won't fail PR if thresholds exceeded

See [Performance Testing Guide](./performance-testing.md) for details.
