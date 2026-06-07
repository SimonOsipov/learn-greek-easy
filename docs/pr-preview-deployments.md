# PR Preview Deployments

## Two-Workflow Model

The CI/CD pipeline is split into two distinct workflows:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `preview.yml` | Every push / PR event | Per-push test half: CI Tests, Mobile CI, CI Gate |
| `release-verify.yml` | `ready-to-verify` label OR manual dispatch | Dev-touching release half: Deploy → Seed → Verify |

**preview.yml (per-push test half)** runs on every PR push and gates branch protection via the `CI Gate` required check. It contains: `should-run-full`, `changes`, `ci-tests`, `mobile-ci`, `ci-gate`, `backend-coverage-comment`, `draft-skip-comment`, and `dispatch-release-verify`.

**release-verify.yml (dev-touching release half)** holds the shared dev environment exclusively for its entire window. It contains: `changes` (duplicated leaf), `should-deploy`, `deploy`, `health-check`, `health-check-comment`, `seed-database`, `mobile-e2e`, `k6-performance`, `k6-comment`, `accessibility`, `accessibility-comment`, `lighthouse`, `lighthouse-comment`, `report-results`, `skip-comment`.

## Release Flow

### Via Label (Standard)

1. PR is ready for a release run.
2. Add the `ready-to-verify` label to the PR.
3. `preview.yml` fires the `dispatch-release-verify` job (triggered by `labeled` event).
4. `dispatch-release-verify` calls `actions.createWorkflowDispatch` to trigger `release-verify.yml` with the PR's number, head SHA, head ref, and current labels as inputs.
5. `release-verify.yml` acquires the `dev-release-lease` and runs deploy → seed → verify.
6. Results are posted as a PR comment.

### Via Manual Dispatch

For ad-hoc releases (e.g., re-running after an environment issue), dispatch manually:

```bash
BRANCH="feature/your-branch"
PR_NUMBER="123"
PR_HEAD_SHA="$(git rev-parse origin/$BRANCH)"

gh workflow run release-verify.yml \
  --ref "$BRANCH" \
  -f pr_number="$PR_NUMBER" \
  -f pr_head_sha="$PR_HEAD_SHA" \
  -f pr_head_ref="$BRANCH" \
  -f pr_labels='[]'
```

To pass existing labels (e.g., skip-k6):

```bash
gh workflow run release-verify.yml \
  --ref "$BRANCH" \
  -f pr_number="$PR_NUMBER" \
  -f pr_head_sha="$PR_HEAD_SHA" \
  -f pr_head_ref="$BRANCH" \
  -f pr_labels='["skip-k6"]'
```

## The `dev-release-lease` Concurrency Model

`release-verify.yml` declares:

```yaml
concurrency:
  group: dev-release-lease
  cancel-in-progress: false
```

Key properties:

- **One active release at a time**: only one `release-verify.yml` run holds dev at any moment.
- **Queuing, not cancellation**: `cancel-in-progress: false` means a second triggered release auto-queues and starts only after the first finishes. There is no race or stomping of the shared dev environment.
- **Whole-window lock**: the concurrency group covers deploy, seed, AND all verification jobs in a single window — a queued run cannot start until deploy + seed + all verify jobs of the prior run complete (or fail).
- **Per-push tests are unaffected**: `preview.yml` uses a separate concurrency group (`dev-preview-shared`) and is never blocked by a release run.

## Cutover Runbook (F8)

After this PR merges to `main`, in-flight PRs that were opened before the merge will still have the old `preview.yml` (with auto-deploy on push) in their HEAD tree. Those PRs will deploy outside the lease on their next push.

**Operator actions after merge:**

1. List all open PRs targeting main:
   ```bash
   gh pr list --state open --base main
   ```

2. For each open PR, either:
   - **Rebase onto new main** (preferred): `git fetch origin && git rebase origin/main` — this brings in the new `preview.yml` and `release-verify.yml`, so future pushes no longer auto-deploy.
   - **Pause pushes**: hold off on new commits until the PR is rebased.

3. **NEVER run a RALPH release on an un-rebased PR.** An un-rebased PR still has the old `preview.yml` which would auto-deploy on push, bypassing the lease.

4. Once all open PRs are rebased (or closed), the old auto-deploy path is fully retired.

## `--ref` Bootstrap Note

`workflow_dispatch` resolves the workflow definition from the ref it targets. This means:

- **Before merge to `main`**: dispatch must target the PR head branch (e.g., `feature/infra-05-dev-release-gate`). The `dispatch-release-verify` shim in `preview.yml` automatically passes `context.payload.pull_request.head.ref` as the `ref`, so label-triggered dispatches work correctly.
- **After merge to `main`**: `release-verify.yml` exists on `main`. Manual dispatches should use `--ref main` (or the target feature branch if re-releasing a PR).
- **First release after merge**: if dispatching manually for the first post-merge PR, use `--ref main`.

## Required Check Note

`CI Gate` (from `preview.yml`) is the **only required branch-protection check**. It gates:
- Web changes → `ci-tests` must succeed.
- Mobile changes → `mobile-ci` must succeed.

`mobile-e2e` and all `release-verify.yml` jobs are **release-gates**, not branch-protection checks. They run only when a release is explicitly triggered (via `ready-to-verify` label or manual dispatch) and do not block PR merge. Do NOT add `release-verify` jobs to branch protection.

## Web Verify (Authenticated Oracle)

The `web-verify` job in `release-verify.yml` provides an authenticated smoke oracle for every web-touching release run. It:

1. Logs in as the seeded `e2e_beginner@test.com` user via the real login form.
2. Confirms the authenticated dashboard renders (`[data-testid="dashboard"]` visible).
3. Confirms the deck list is non-empty (`[data-testid="deck-card"]` count ≥ 1).

### Screenshot artifact

Artifact name: **`web-verify-screenshots`**

| File | Captured at |
|------|-------------|
| `01-login.png` | Login page loaded, before submission |
| `02-dashboard.png` | Dashboard after successful login |
| `03-decks.png` | Decks page with at least one deck card |
| `99-failure.png` | Page state at the moment of any failure (best-effort) |

RALPH Phase 3.5 consumes these screenshots as part of the visual gate review.

### Path-filter symmetry with mobile-e2e

- **Mobile-only PR** (`changes.outputs.web == 'false'`): `web-verify` is skipped; `mobile-e2e` runs.
- **Web-only PR** (`changes.outputs.mobile == 'false'`): `mobile-e2e` is skipped; `web-verify` runs.
- **Mixed PR**: both jobs run in parallel after `seed-database` succeeds.
