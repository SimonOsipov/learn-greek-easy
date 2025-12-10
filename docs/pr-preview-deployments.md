# PR Preview Deployments

## Table of Contents

1. [Overview](#overview)
2. [How It Works](#how-it-works)
3. [Configuration](#configuration)
4. [Test Results](#test-results)
5. [Troubleshooting](#troubleshooting)
6. [Cost Management](#cost-management)
7. [Scripts Reference](#scripts-reference)

---

## Overview

PR Preview Deployments provide a live deployed version of each pull request for testing. This enables:

- **Live testing**: Reviewers can interact with actual features
- **Automated QA**: Performance, visual, and accessibility testing
- **Fast feedback**: Results appear directly in PR comments

### Key Features

- Shared dev environment (not per-PR) for stable OAuth callback URLs
- Full stack deployment: frontend, backend, PostgreSQL, Redis
- Automated test suite: health, Lighthouse, Chromatic, axe-core
- PR comment with deployment URLs and test results table

---

## How It Works

### Deployment Flow

1. **PR Opened/Updated**
   - CI tests run (lint, unit, integration, E2E) via `test.yml` workflow
   - If CI passes, code deploys to dev environment
   - Full stack deployed (frontend, backend - Postgres/Redis always running)

2. **Tests Run on Preview**
   - Health/smoke tests verify deployment is functional
   - Lighthouse CI measures desktop and mobile performance
   - Playwright captures screenshots, uploaded to Chromatic for visual regression
   - axe-core scans pages for accessibility violations

3. **Results Reported**
   - PR comment updated with URLs and test results table
   - GitHub status checks show pass/fail for each test category

4. **PR Closed**
   - Backend and Frontend services stopped (saves compute costs)
   - Postgres and Redis kept running (stateful services)
   - Environment preserved with stable URLs for future PRs

### Environment Structure

The dev environment is shared across PRs (one active PR at a time):

| Service | Description | Lifecycle |
|---------|-------------|-----------|
| Frontend | React frontend (Vite) | Started/stopped per PR |
| Backend | FastAPI backend | Started/stopped per PR |
| Postgres | PostgreSQL database | Always running |
| Redis | Redis cache | Always running |

---

## Configuration

### Required GitHub Secrets

Configure these secrets in GitHub repository settings:

| Secret | Description | How to Get |
|--------|-------------|------------|
| `RAILWAY_API_TOKEN` | Railway API token | Railway Dashboard > Account Settings > Tokens |
| `RAILWAY_PROJECT_ID` | Railway project ID | Railway Dashboard > Project Settings |
| `RAILWAY_WORKSPACE_ID` | Railway workspace ID | Railway Dashboard > Workspace Settings |
| `CHROMATIC_PROJECT_TOKEN` | Chromatic project token | Chromatic Dashboard > Project > Manage |
| `PREVIEW_JWT_SECRET` | JWT secret for previews | Generate: `openssl rand -hex 32` |

### Workflow Files

| File | Purpose |
|------|---------|
| `.github/workflows/preview.yml` | Main deployment and testing workflow |
| `.github/workflows/preview-cleanup.yml` | Cleanup on PR close/merge |
| `.github/workflows/preview-cleanup-scheduled.yml` | Daily cleanup of orphaned environments |
| `.github/workflows/test.yml` | Reusable CI test suite |

### Lighthouse Configuration

**Desktop** (`lighthouserc.cjs`):
- Performance: 80+ (warn)
- Accessibility: 90+ (error)
- Best Practices: 80+ (warn)
- SEO: 80+ (warn)

**Mobile** (`lighthouserc.mobile.cjs`):
- Performance: 70+ (warn)
- Accessibility: 90+ (error)
- Best Practices: 80+ (warn)
- SEO: 80+ (warn)

### PR Labels

Control which tests run using PR labels:

| Label | Effect |
|-------|--------|
| `visual-test` | Force full visual regression suite (all pages, all viewports) |
| `skip-visual` | Skip visual regression tests entirely |
| `skip-e2e` | Skip E2E tests (use sparingly) |
| (no label) | Smart mode - run tests based on changed files |

**When to use each label:**

| Scenario | Recommended Label |
|----------|-------------------|
| Major UI changes, new pages | `visual-test` |
| Design system updates | `visual-test` |
| Backend-only changes | `skip-visual` |
| Config/documentation changes | `skip-visual` |
| Most feature PRs | (no label) - smart detection |

---

## Test Results

### Health Check

Verifies all services are responding correctly:

| Endpoint | Expected |
|----------|----------|
| Frontend `/` | 200 |
| Frontend `/health` | 200 |
| Backend `/health` | 200 |
| Backend `/health/live` | 200 |
| Backend `/health/ready` | 200 |
| Backend `/docs` | 200 (when DEBUG=true) |
| Backend `/openapi.json` | 200 (when DEBUG=true) |

### Lighthouse CI

Measures web vitals across desktop and mobile configurations:

**Metrics collected:**
- Performance (LCP, FCP, TBT, CLS)
- Accessibility
- Best Practices
- SEO

**Thresholds:**
- Desktop Performance: 80+ (pass), 60-79 (warning), <60 (fail)
- Mobile Performance: 70+ (pass), 50-69 (warning), <50 (fail)
- Accessibility: 90+ required (both configs)

Reports available via temporary public storage links in PR comment.

### Visual Regression (Chromatic)

Uses Playwright to capture screenshots, uploaded to Chromatic for comparison:

- Compares against main branch baseline
- Review visual diffs in Chromatic dashboard
- Approve/reject changes directly in Chromatic UI
- Results appear as status check on PR

**Chromatic Workflow:**
1. Visual changes detected? Review in Chromatic dashboard (link in PR comment)
2. Approve intentional changes to update baseline
3. Reject unintentional changes and fix in code

### Accessibility (axe-core)

Scans pages for WCAG 2.1 AA violations:

**Pages tested:**
- Home page (`/`)
- Login page (`/login`)
- Register page (`/register`)

**Severity levels:**
- Critical/Serious: Block PR (must fix)
- Moderate/Minor: Warning (should fix)

Detailed reports available in workflow artifacts.

---

## Troubleshooting

### Preview Not Deploying

1. **Check CI tests passed**
   - The `test.yml` workflow must succeed before deployment starts
   - Look for failures in lint, unit tests, or E2E tests

2. **Verify not docs-only change**
   - Changes only to `.md` files or `docs/` folder are auto-skipped
   - Add code changes or use manual deployment if needed

3. **Check GitHub Actions logs**
   - Navigate to Actions tab > PR Preview Deployment workflow
   - Look for error messages in the Deploy job

4. **Verify Railway token is valid**
   - Tokens can expire or be revoked
   - Generate new token in Railway Dashboard > Account Settings > Tokens

### Health Checks Failing

1. **Check Railway deployment logs**
   - Use Railway dashboard or `railway logs` CLI command
   - Look for startup errors or crash loops

2. **Verify database migrations ran**
   - Backend startup runs migrations automatically
   - Check for migration errors in logs

3. **Check environment variables**
   - Ensure `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET_KEY` are set
   - Verify `CORS_ORIGINS` includes the frontend URL

4. **Look for connection errors**
   - Database connection issues
   - Redis connection issues
   - External API timeouts

### Visual Tests Failing

1. **Review diffs in Chromatic dashboard**
   - Link available in PR comment
   - Compare expected vs actual screenshots

2. **Approve intentional changes**
   - If changes are expected, approve in Chromatic UI
   - This updates the baseline for future comparisons

3. **Handle flaky tests**
   - Add delay for animations: `chromatic: { delay: 300 }` in story
   - Disable problematic snapshots: `chromatic: { disableSnapshot: true }`

4. **Check Playwright test results**
   - Download `visual-test-results` artifact
   - Review screenshots for unexpected differences

### Accessibility Tests Failing

1. **Download accessibility report**
   - Available in workflow artifacts as `accessibility-report.md`

2. **Review specific violations**
   - Each violation includes affected elements
   - Use the `helpUrl` for remediation guidance

3. **Prioritize fixes**
   - Critical/Serious violations must be fixed
   - Moderate/Minor can be addressed later

4. **Common fixes**
   - Missing alt text on images
   - Low color contrast
   - Missing form labels
   - Incorrect heading hierarchy

### Cleanup Not Working

1. **Check cleanup workflow ran**
   - `preview-cleanup.yml` triggers on PR close
   - Look for workflow run in Actions tab

2. **Manually stop services**
   - Go to Railway dashboard
   - Navigate to dev environment
   - Stop Frontend and Backend services

3. **Check Railway API token permissions**
   - Token needs write access to project
   - Regenerate if necessary

4. **Review workflow logs**
   - Check for specific error messages
   - Verify Railway CLI commands succeeded

---

## Cost Management

### Estimated Costs (Railway)

| Resource | Cost | Notes |
|----------|------|-------|
| Compute (Backend) | ~$0.01/hr | Stopped on PR close |
| Compute (Frontend) | ~$0.01/hr | Stopped on PR close |
| PostgreSQL | ~$5/month | Always running (shared) |
| Redis | ~$5/month | Always running (shared) |
| **Base cost** | **~$10-15/month** | When no PRs active |

**Per-PR cost:** Minimal (~$0.02/hr while active)

### External Services (Free Tiers)

| Service | Free Tier | Usage |
|---------|-----------|-------|
| Chromatic | 5,000 snapshots/month | Visual regression testing |
| Lighthouse CI | Free (temporary storage) | Performance reports |
| axe-core | Free (open source) | Accessibility testing |

### Cost Optimization Tips

1. **Close PRs promptly when done reviewing**
   - Compute services stop automatically on PR close
   - Don't leave draft PRs open unnecessarily

2. **Use `skip-visual` label for backend-only changes**
   - Saves Chromatic snapshots for when they matter
   - Use for API changes, config updates, documentation

3. **Cleanup workflow runs automatically**
   - On PR close: stops compute services
   - Scheduled cleanup: runs daily for orphaned resources

4. **Postgres/Redis always running**
   - Minimal cost when idle (~$10/month total)
   - Required for quick deployment (no cold start)

5. **Use smart test detection (no labels)**
   - Let the workflow decide which tests to run
   - Based on which files changed in the PR

---

## Scripts Reference

### preview-health-check.sh

Wait for services to become ready and run smoke tests.

```bash
# Usage
./scripts/preview-health-check.sh <FRONTEND_URL> <BACKEND_URL> [MAX_RETRIES] [RETRY_INTERVAL]

# Parameters
#   FRONTEND_URL   - The frontend deployment URL (required)
#   BACKEND_URL    - The backend deployment URL (required)
#   MAX_RETRIES    - Maximum retry attempts (default: 30)
#   RETRY_INTERVAL - Seconds between retries (default: 10)

# Example
./scripts/preview-health-check.sh \
  https://frontend-dev-8db9.up.railway.app \
  https://backend-dev-bc44.up.railway.app \
  30 \
  10
```

**Exit codes:**
- `0` - All health checks passed
- `N` - Number of failed health checks

### preview-api-smoke.sh

Extended API endpoint testing beyond basic health checks.

```bash
# Usage
./scripts/preview-api-smoke.sh <BACKEND_URL>

# Example
./scripts/preview-api-smoke.sh https://backend-dev-bc44.up.railway.app
```

**Tests performed:**
- Health endpoints (`/health`, `/health/live`, `/health/ready`)
- Documentation (`/docs`, `/redoc`, `/openapi.json`)
- Auth endpoints (expect 422 without body)
- Protected endpoints (expect 401 without auth)
- Public API endpoints (expect 200)

### railway-preview.sh (Legacy)

Manual environment management for per-PR environments.

```bash
# Usage
./scripts/railway-preview.sh <PR_NUMBER> <ACTION>

# Actions
#   create  - Create a new preview environment
#   deploy  - Deploy to an existing preview environment
#   destroy - Destroy a preview environment

# Examples
./scripts/railway-preview.sh 123 create
./scripts/railway-preview.sh 123 deploy
./scripts/railway-preview.sh 123 destroy
```

**Note:** The current implementation uses a shared dev environment instead of per-PR environments. This script is kept for manual testing and backwards compatibility.

---

## References

- [Railway Documentation](https://docs.railway.app/)
- [Lighthouse CI Documentation](https://github.com/GoogleChrome/lighthouse-ci)
- [Chromatic Documentation](https://www.chromatic.com/docs/)
- [axe-core Documentation](https://github.com/dequelabs/axe-core)
- Architecture Document: doc-27 in Backlog.md
