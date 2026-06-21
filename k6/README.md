# K6 Performance Testing

Browser-based performance testing for Learn Greek Easy using k6 with Chromium.

## Quick Start

### Prerequisites

1. **Install k6** (with browser support):
   ```bash
   # macOS
   brew install k6

   # Linux (Debian/Ubuntu)
   sudo gpg -k
   sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
   echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
   sudo apt-get update
   sudo apt-get install k6
   ```

2. **Seed test data** (required for login scenarios):
   ```bash
   curl -X POST http://localhost:8000/api/v1/test/seed/all
   ```
   See [E2E Seeding docs](../docs/e2e-seeding.md) for details.

3. **Start the application**:
   ```bash
   # Terminal 1: Backend
   cd learn-greek-easy-backend && poetry run uvicorn src.main:app --reload

   # Terminal 2: Frontend
   cd learn-greek-easy-frontend && npm run dev
   ```

### First Run

```bash
# Run auth scenario (smoke test - 1 VU, 10s)
k6 run k6/scenarios/auth.js

# Run dashboard scenario
k6 run k6/scenarios/dashboard.js
```

## Directory Structure

```
k6/
├── config/             # Environment configurations
│   ├── local.json      # Local development (localhost)
│   └── preview.json    # PR preview environments
├── lib/                # Shared libraries
│   ├── auth.js         # Login helper with timing metrics
│   ├── config.js       # Configuration loader
│   └── selectors.js    # UI selectors (data-testid) and API endpoints
├── scenarios/          # Test scenarios
│   ├── auth.js         # Authentication flow test
│   └── dashboard.js    # Dashboard + deck browsing test
├── scripts/            # Utility scripts
│   └── verify-config.js # Configuration verification
├── reports/            # Generated reports (gitignored)
└── README.md           # This file
```

## Running Tests

### Local Environment

```bash
# Default: smoke scenario (1 VU, 10s)
k6 run k6/scenarios/auth.js

# With specific scenario
K6_SCENARIO=default k6 run k6/scenarios/auth.js   # 10 VUs, 30s
K6_SCENARIO=load k6 run k6/scenarios/auth.js      # 50 VUs, 5m
```

### Preview Environment

```bash
# Set environment and URLs
K6_ENV=preview \
K6_API_BASE_URL=https://api-pr-123.railway.app \
K6_FRONTEND_BASE_URL=https://pr-123.railway.app \
k6 run k6/scenarios/auth.js
```

### Verify Configuration

```bash
# Verify config loads correctly
k6 run k6/scripts/verify-config.js
```

## Scenarios

| Scenario | VUs | Duration | Use Case |
|----------|-----|----------|----------|
| `smoke` | 1 | 10s | Quick sanity check, CI default |
| `default` | 10 | 30s | Standard load testing |
| `load` | 50 | 5m | Stress testing |

Select with `K6_SCENARIO` environment variable:
```bash
K6_SCENARIO=load k6 run k6/scenarios/auth.js
```

## Metrics Reference

### Auth Scenario Metrics

| Metric | Description | Threshold (p95) |
|--------|-------------|-----------------|
| `auth_navigate_time` | Navigate to login page, wait for React hydration | <3000ms |
| `auth_fill_email_time` | Fill email input field | <500ms |
| `auth_fill_password_time` | Fill password input field | <500ms |
| `auth_submit_time` | Click submit to navigation start | <2000ms |
| `auth_redirect_time` | Navigation start to dashboard visible | <2000ms |
| `auth_total_time` | Total login flow duration | <8000ms |

### Dashboard Scenario Metrics

| Metric | Description | Threshold (p95) |
|--------|-------------|-----------------|
| `dashboard_load_time` | Dashboard render after login | <2000ms |
| `dashboard_stats_api_time` | Network settle time (stats API) | <3000ms |
| `deck_navigation_time` | Click deck to navigation start | <1000ms |
| `deck_load_time` | Deck detail page visible | <2000ms |
| `session_start_time` | Start Practice to MCQ visible | <2000ms |
| `card_interaction_time` | Select answer and submit | <1500ms |
| `dashboard_flow_total_time` | Total flow duration | <15000ms |

## Test Users

All test users share the same password: `TestPassword123!`

| Role | Email | Description |
|------|-------|-------------|
| `learner` | e2e_learner@test.com | Regular user with study progress |
| `beginner` | e2e_beginner@test.com | New user, no progress |
| `advanced` | e2e_advanced@test.com | Advanced user |
| `admin` | e2e_admin@test.com | Admin user |
| `xpBoundary` | e2e_xp_boundary@test.com | XP boundary testing |
| `xpMid` | e2e_xp_mid@test.com | Mid-level XP testing |
| `xpMax` | e2e_xp_max@test.com | Max XP testing |

## Viewing Reports

After running tests, reports are generated in `k6/reports/`:

### HTML Reports

HTML reports provide a visual summary with charts and color-coded pass/fail indicators:

```bash
# After running tests, open HTML report in browser
open k6/reports/auth-local-*.html      # macOS
xdg-open k6/reports/auth-local-*.html  # Linux
```

### JSON Reports

JSON reports contain raw data for programmatic analysis:

```bash
# Extract p95 from JSON report
jq '.metrics.auth_total_time.values["p(95)"]' k6/reports/auth-local-*.json
```

### GitHub Actions Artifacts

In CI/CD, reports are uploaded as GitHub Actions artifacts (30-day retention):

1. Go to the workflow run in GitHub Actions
2. Download `k6-performance-reports` artifact
3. Extract and open the HTML files in your browser

## CI/CD Integration

Performance tests run automatically in PR preview deployments when the `perf-test` label is added.

```bash
# Add perf-test label to trigger tests
gh pr edit 123 --add-label "perf-test"
```

Tests run against the deployed preview environment with results posted as a PR comment.

See [CI/CD Labels documentation](../docs/ci-cd-labels.md) for more details (including `skip-k6` to suppress the k6 job on a given PR).

## k6 Baselines

### What they are

`k6/baselines.json` is a committed file at the repo root that stores the last known-good p95 timings for every k6 metric. The PR-comment parser (`learn-greek-easy-frontend/scripts/parse-k6-results.cjs`) reads this file and renders a **Δ vs main** column in each PR comment showing whether the current run is faster, slower, or flat relative to the main branch.

**Schema:**
```json
{
  "updated_at": "<ISO-8601 timestamp>",
  "commit": "<git SHA of the run that produced these values>",
  "metrics": {
    "<metric-name>": { "p95": <number in ms, integer> }
  }
}
```

### First-run / "new" behaviour

When `metrics` is empty (the initial committed state) or a metric has no entry yet, the PR comment renders **new** in the Δ column. This is intentional — the first real CI run that populates baselines will show all entries as `new`, and subsequent PRs will see real deltas.

### How baselines are refreshed

The `.github/workflows/k6-baseline-update.yml` workflow runs on every push to `main` (except `[skip ci]` commits and changes to `k6/baselines.json` itself). It:

1. Runs the three k6 smoke scenarios (`auth`, `dashboard`, `api-latency`) against the dev environment (`frontend-dev-8db9.up.railway.app`) with `continue-on-error: true` — a flaky run or a dev-environment outage does not break anything.
2. Runs `node learn-greek-easy-frontend/scripts/write-k6-baseline.cjs` to parse the reports and write `k6/baselines.json`.
3. Uploads `k6/baselines.json` as a workflow artifact (`k6-baselines`).
4. Attempts to commit and push the updated file to `main` with `[skip ci]` in the message (to avoid re-triggering this workflow).

The workflow runs in the **`dev-release-lease` concurrency group** (same as release-verify), so baseline updates are serialized with deploys and cannot stomp on each other.

### Branch-protection caveat & manual fallback

The bot push in step 4 **will be blocked** by the `CI Gate` required status check on `main` — the `github-actions[bot]` is not a repo admin, and `enforce_admins` being `false` only allows *human* admins to bypass required checks.

Until a bypass PAT is provisioned, the fallback is:

1. After the workflow run completes, download the **`k6-baselines`** artifact from the Actions run page.
2. Extract `k6/baselines.json` and commit it directly to `main` — a repo admin (`enforce_admins=false`) can push this file directly without triggering the CI Gate requirement.

Alternatively, run the scenarios and writer locally:
```bash
# From repo root
K6_ENV=preview K6_API_BASE_URL=https://frontend-dev-8db9.up.railway.app \
  K6_FRONTEND_BASE_URL=https://frontend-dev-8db9.up.railway.app \
  K6_SCENARIO=smoke k6 run k6/scenarios/auth.js
# (repeat for dashboard.js and api-latency.js)
K6_REPORTS_DIR=./k6/reports node learn-greek-easy-frontend/scripts/write-k6-baseline.cjs
git add k6/baselines.json && git commit -m "chore(k6): refresh baselines [skip ci]"
git push origin main
```

### Threshold tuning

The D2 threshold numbers baked into the scenario files (`k6/scenarios/*.js`) are conservative starting values. Once a few real baseline runs have accumulated, refine them to sit comfortably above the observed p95 values so thresholds are meaningful without being too noisy.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `Failed to load configuration` | Ensure you're running from repo root, not k6/ directory |
| `Login failed for userRole` | Verify test data is seeded: `curl http://localhost:8000/api/v1/test/seed/status` |
| `Timeout waiting for selector` | Check if selectors match current frontend (run `verify-config.js`) |
| `Environment variable required` | For preview env, set both `K6_API_BASE_URL` and `K6_FRONTEND_BASE_URL` |
| `Browser not starting` | k6 needs Chromium; run `k6 browser install chromium` if not auto-installed |
| `CORS errors in browser` | Ensure backend CORS allows frontend URL |

## Full Documentation

For comprehensive documentation including architecture details, extending tests, and advanced configuration, see [Performance Testing Guide](../docs/performance-testing.md).
