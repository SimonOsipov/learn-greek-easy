# PR Labels for CI/CD Control

Use labels on Pull Requests to control which CI/CD tests run.

## Available Labels

| Label | Effect |
|-------|--------|
| `run-full-tests` | Force full test suite + deployment on draft PRs |
| `visual-test` | Force full visual regression suite (all pages, all viewports) |
| `skip-visual` | Skip post-deploy visual tests (Playwright visual + Chromatic) |
| `skip-seed` | Skip database seeding in dev environment |
| (no label) | Default - see workflow behavior below |

## CI Workflow Behavior

The CI is split into **Quick Checks** (every commit) and **Full Tests** (on-demand):

| PR State | Quick Checks | Full Tests | Deployment |
|----------|--------------|------------|------------|
| Draft PR | Every commit | Skipped | Skipped |
| Draft + `run-full-tests` label | Every commit | Runs | Runs |
| Ready for review | Every commit | Runs | Runs |

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
- Health/A11y/Lighthouse/Visual tests

## When to Use Each Label

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

## Adding Labels via CLI

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
