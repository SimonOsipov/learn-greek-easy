# PR Labels for CI/CD Control

Use labels on Pull Requests to control which CI/CD tests run. Adding or removing a label re-triggers the workflow.

## Required Status Checks

The following checks are required on `main` and must pass before merging:

| Check name | Workflow | Skip mechanic |
|------------|----------|---------------|
| `Frontend tsc -b` | `test.yml` (`tsc-build` job) | None — TS errors must be 0 to merge |

Add `Frontend tsc -b` under **Settings → Branches → Branch protection rules → Require status checks** in GitHub to enforce this gate.

## Available Labels

| Label | Effect |
|-------|--------|
| `skip-k6` | Skip k6 performance tests |

> **Note:** `skip-visual` label exists but has no effect — visual regression tests are currently disabled (being reorganized).

## Default Behavior

| PR State | Tests Run |
|----------|-----------|
| Draft PR | Quick checks only (lint, typecheck, format) |
| Ready PR | Full suite: CI tests, deploy, health, a11y, Lighthouse, k6 |

## CI Workflow Behavior

### Quick Checks (~2-3 min)
- Frontend lint/typecheck + Prettier formatting
- Backend lint/typecheck (black, isort, flake8, mypy)
- Alembic migration check

### Full Tests (~15-25 min)
- Quick checks
- Unit tests
- E2E tests (3 browsers x 3 shards = 9 parallel jobs)
- Backend tests + coverage comment on PR
- API tests
- Deployment (Railway preview)
- Health/A11y/Lighthouse tests
- K6 performance tests (non-blocking)

## When to Use Each Label

| Scenario | Label |
|----------|-------|
| Quick iteration, skip load tests | `skip-k6` |
| Infrastructure/CI changes | `skip-k6` |
| Most feature PRs | (no label) - run everything |

## Adding Labels via CLI

```bash
# When creating PR
gh pr create --title "..." --body "..." --label "skip-k6"

# Add to existing PR
gh pr edit 123 --add-label "skip-k6"

# Remove label
gh pr edit 123 --remove-label "skip-k6"
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
