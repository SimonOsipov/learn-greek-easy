# Performance Testing Guide

Comprehensive guide for k6 browser-based performance testing in Learn Greek Easy.

## Overview

This project uses [k6](https://k6.io/) with browser support to measure real user experience performance. Unlike traditional HTTP load testing, browser-based tests simulate actual user interactions including:

- Page navigation and rendering
- React hydration
- Form interactions
- SPA route transitions
- API call timing within the browser context

## Architecture

### Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Test Runner | k6 | Performance test execution |
| Browser Engine | Chromium (via k6 browser module) | Real browser automation |
| Metrics | k6 Trends | Custom timing measurements |
| CI Integration | GitHub Actions | Automated test runs |
| Cloud Dashboard | Grafana Cloud (optional) | Metrics visualization |

### Design Decisions

1. **Browser-based testing**: Measures actual user experience, not just API response times
2. **Shared selectors**: Uses same `data-testid` attributes as Playwright E2E tests
3. **Environment configs**: Separate configs for local and preview environments
4. **Modular structure**: Reusable auth library, centralized selectors
5. **Non-blocking CI**: Performance tests don't block PR merges (`continue-on-error: true`)

### File Organization

```
k6/
├── config/
│   ├── local.json          # localhost:5173/8000 URLs
│   └── preview.json        # ${K6_*_BASE_URL} placeholders
├── lib/
│   ├── auth.js             # login() function with 6 timing metrics
│   ├── config.js           # Environment loader, URL helpers
│   └── selectors.js        # UI selectors + API endpoints
├── scenarios/
│   ├── auth.js             # Login flow performance
│   └── dashboard.js        # Dashboard + deck browsing flow
├── scripts/
│   └── verify-config.js    # Configuration validation
└── reports/                # Generated reports (gitignored)
```

## Test Scenarios

### Auth Scenario (`scenarios/auth.js`)

Tests the complete login flow from page load to dashboard visibility.

**Flow:**
1. Navigate to `/login` and wait for React hydration
2. Wait for page loader to disappear
3. Fill email input
4. Fill password input
5. Click submit and wait for navigation
6. Wait for dashboard to be visible

**Metrics Captured:**
- `auth_navigate_time`: Page load + hydration time
- `auth_fill_email_time`: Email input interaction
- `auth_fill_password_time`: Password input interaction
- `auth_submit_time`: Form submission to navigation
- `auth_redirect_time`: Navigation to dashboard visible
- `auth_total_time`: End-to-end login time

**Usage:**
```bash
# Smoke test
k6 run k6/scenarios/auth.js

# Load test
K6_SCENARIO=load k6 run k6/scenarios/auth.js
```

### Dashboard Scenario (`scenarios/dashboard.js`)

Tests the complete user journey from login through deck interaction.

**Flow:**
1. Login (reuses auth flow)
2. Wait for dashboard stats to load
3. Navigate to `/decks` page
4. Find a culture deck (or fallback to vocabulary deck)
5. Click deck to open detail view
6. If culture deck: Start practice session
7. Answer one MCQ question

**Metrics Captured:**
- `dashboard_load_time`: Dashboard render after login
- `dashboard_stats_api_time`: Network idle after stats load
- `deck_navigation_time`: Deck card click to navigation
- `deck_load_time`: Deck detail page visibility
- `session_start_time`: Practice button to MCQ visible
- `card_interaction_time`: Answer selection and submission
- `dashboard_flow_total_time`: Total flow time

**Usage:**
```bash
k6 run k6/scenarios/dashboard.js
```

## Configuration

### Environment Configs

**Local (`config/local.json`):**
```json
{
  "environment": "local",
  "baseUrl": {
    "api": "http://localhost:8000",
    "frontend": "http://localhost:5173"
  }
}
```

**Preview (`config/preview.json`):**
```json
{
  "environment": "preview",
  "baseUrl": {
    "api": "${K6_API_BASE_URL}",
    "frontend": "${K6_FRONTEND_BASE_URL}"
  }
}
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `K6_ENV` | No | Environment: `local` (default) or `preview` |
| `K6_SCENARIO` | No | Scenario: `smoke` (default), `default`, or `load` |
| `K6_API_BASE_URL` | Preview only | Backend API URL |
| `K6_FRONTEND_BASE_URL` | Preview only | Frontend URL |
| `K6_CLOUD_TOKEN` | No | Grafana Cloud API token |

### Test Users

All test users are created by the E2E seeding system. Password for all: `TestPassword123!`

| Role Key | Email | Use Case |
|----------|-------|----------|
| `learner` | e2e_learner@test.com | Default test user with progress data |
| `beginner` | e2e_beginner@test.com | New user without study history |
| `advanced` | e2e_advanced@test.com | Advanced learner |
| `admin` | e2e_admin@test.com | Admin dashboard testing |
| `xpBoundary` | e2e_xp_boundary@test.com | XP boundary conditions |
| `xpMid` | e2e_xp_mid@test.com | Mid-range XP testing |
| `xpMax` | e2e_xp_max@test.com | Maximum XP testing |

### Scenario Configurations

| Scenario | Executor | VUs | Duration | Use Case |
|----------|----------|-----|----------|----------|
| `smoke` | constant-vus | 1 | 10s | Quick validation, CI default |
| `default` | constant-vus | 10 | 30s | Standard load testing |
| `load` | constant-vus | 50 (local) / 20 (preview) | 5m / 3m | Stress testing |

## Metrics Deep Dive

### How Metrics Are Captured

Each metric is a k6 `Trend` that captures timing data:

```javascript
import { Trend } from 'k6/metrics';

const authNavigateTime = new Trend('auth_navigate_time', true);

// Capture timing
const startTime = Date.now();
await page.goto('/login', { waitUntil: 'networkidle' });
authNavigateTime.add(Date.now() - startTime);
```

### Threshold Configuration

Thresholds define pass/fail criteria:

```javascript
thresholds: {
  auth_navigate_time: ['p(95)<3000'],  // 95th percentile < 3 seconds
  auth_total_time: ['p(95)<8000'],
  checks: ['rate>0.95'],  // 95% of iterations must pass
}
```

### Understanding Results

```
auth_navigate_time......: avg=1234ms min=987ms med=1150ms max=2345ms p(90)=1800ms p(95)=2100ms
```

- **avg**: Average across all samples
- **min/max**: Minimum and maximum values
- **med**: Median (50th percentile)
- **p(90)/p(95)**: 90th and 95th percentiles

## CI/CD Integration

### Triggering Performance Tests

Performance tests run in the preview workflow when the `perf-test` label is present:

```bash
# Add label to PR
gh pr edit 123 --add-label "perf-test"
```

### Workflow Details

The `k6-performance` job in `.github/workflows/preview.yml`:

1. **Prerequisites**: Requires deploy, health-check, and seed-database to pass
2. **Setup**: Installs k6 using `grafana/setup-k6-action@v1`
3. **Execution**: Runs auth and dashboard scenarios
4. **Reporting**: Extracts p95 metrics and adds to PR comment
5. **Artifacts**: Uploads JSON reports (7-day retention)

### Non-Blocking Design

Performance tests use `continue-on-error: true` to prevent blocking PR merges. Threshold failures are reported but don't fail the overall workflow.

### PR Comment Format

Results are included in the PR summary comment:

```
| Test | Status | Details |
|------|--------|---------|
| K6 Performance | :white_check_mark: | Auth p95: 3245ms, Dashboard p95: 8123ms |
```

## Grafana Cloud Integration

### Setup

1. Create account at [grafana.com](https://grafana.com)
2. Get API token from k6 Cloud settings
3. Add `K6_CLOUD_TOKEN` to GitHub repository secrets

### Running with Cloud Output

```bash
# Local
K6_CLOUD_TOKEN=your-token k6 run --out cloud k6/scenarios/auth.js

# CI (automatic if secret is set)
# The workflow detects K6_CLOUD_TOKEN and adds --out cloud
```

### Viewing Results

Cloud results include:
- Real-time test monitoring
- Historical trend analysis
- Detailed metric breakdowns
- Threshold comparisons

## Extending Tests

### Adding a New Scenario

1. Create `k6/scenarios/your-scenario.js`:

```javascript
import { browser } from 'k6/browser';
import { check } from 'k6';
import { Trend } from 'k6/metrics';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.1.0/index.js';

import { login } from '../lib/auth.js';
import { currentEnvironment, getScenario } from '../lib/config.js';

// Define metrics
const myMetric = new Trend('my_metric_time', true);

// Load scenario config
const scenarioName = __ENV.K6_SCENARIO || 'smoke';
const scenarioConfig = getScenario(scenarioName);

export const options = {
  scenarios: {
    myScenario: {
      executor: scenarioConfig.executor,
      vus: scenarioConfig.vus,
      duration: scenarioConfig.duration,
      exec: 'myScenarioFunc',
      options: {
        browser: { type: 'chromium' },
      },
    },
  },
  thresholds: {
    my_metric_time: ['p(95)<2000'],
    checks: ['rate>0.95'],
  },
};

export async function myScenarioFunc() {
  const page = await browser.newPage();

  try {
    // Your test logic here
    const startTime = Date.now();
    // ... perform actions
    myMetric.add(Date.now() - startTime);

    check(true, { 'scenario completed': (s) => s === true });
  } finally {
    await page.close();
  }
}

export function handleSummary(data) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return {
    [`k6/reports/my-scenario-${currentEnvironment}-${timestamp}.json`]: JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: '  ', enableColors: true }),
  };
}
```

2. Add to CI workflow if needed

### Adding New Selectors

Update `k6/lib/selectors.js`:

```javascript
export const myFeature = {
  container: 'my-feature-container',
  button: 'my-feature-button',
  // ...
};
```

Selectors must match `data-testid` attributes in the frontend.

### Adding New Test Users

1. Update `learn-greek-easy-backend/scripts/seed_e2e_data.py`
2. Add to both `config/local.json` and `config/preview.json`:

```json
"testUsers": {
  "newRole": {
    "email": "e2e_new_role@test.com",
    "password": "TestPassword123!"
  }
}
```

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| `Failed to load configuration` | Wrong working directory | Run from repo root: `k6 run k6/scenarios/auth.js` |
| `Environment variable 'X' required` | Missing preview URLs | Set `K6_API_BASE_URL` and `K6_FRONTEND_BASE_URL` |
| `Login failed for userRole` | Test data not seeded | Run: `curl -X POST http://localhost:8000/api/v1/test/seed/all` |
| `Timeout waiting for selector` | Selector mismatch or slow load | Verify selectors with `k6 run k6/scripts/verify-config.js` |
| Browser not starting | Chromium not installed | Run: `k6 browser install chromium` |
| `waitForNavigation timeout` | SPA route not triggering navigation | Use `page.waitForURL()` instead |

### Preview Environment Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Connection refused | Service not deployed | Check deploy job completed |
| 502 Bad Gateway | Service starting up | Wait for health check to pass |
| Login fails | Database not seeded | Check seed-database job passed |
| Slow first request | Cold start | Add warm-up iteration or accept first-request latency |

### Debugging Tips

1. **Run verification script**:
   ```bash
   k6 run k6/scripts/verify-config.js
   ```

2. **Check seeding status**:
   ```bash
   curl http://localhost:8000/api/v1/test/seed/status
   ```

3. **Increase timeout temporarily**:
   ```javascript
   await login(page, { timeout: 60000 });
   ```

4. **Add console logging**:
   ```javascript
   console.log(`Current URL: ${page.url()}`);
   ```

5. **Run with verbose output**:
   ```bash
   k6 run --verbose k6/scenarios/auth.js
   ```

## Security Considerations

1. **Test users only**: Never use real user credentials in performance tests
2. **No secrets in config**: Use environment variables for sensitive data
3. **CI secrets**: Store `K6_CLOUD_TOKEN` as a GitHub secret
4. **Network isolation**: Preview environments should be isolated

## Related Documentation

- [E2E Seeding Guide](./e2e-seeding.md) - Test data seeding
- [CI/CD Labels](./ci-cd-labels.md) - PR labels for test control
- [k6 README](../k6/README.md) - Quick start guide
- [k6 Official Documentation](https://k6.io/docs/)
- [k6 Browser Module](https://k6.io/docs/javascript-api/k6-browser/)
