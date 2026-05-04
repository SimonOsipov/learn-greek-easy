# Deployment Guide

## Overview

This project uses GitHub Actions for sequential deployments to ensure Backend is healthy before Frontend starts. Railway's native auto-deploy is **disabled** to prevent parallel deployment conflicts.

## Environments

| Environment | Trigger | Workflow | Frontend URL |
|-------------|---------|----------|--------------|
| Production | Push to `main` | `deploy-production.yml` | [learn-greek-frontend.up.railway.app](https://learn-greek-frontend.up.railway.app) |
| Dev (PR Preview) | PR opened/sync | `preview.yml` | [frontend-dev-8db9.up.railway.app](https://frontend-dev-8db9.up.railway.app) |

> **Note**: The backend is private and accessible only via the frontend proxy. All API calls go through `<frontend-url>/api/v1/*`. See [Railway Backend Privacy](railway-backend-privacy.md) for details.

## How Deployments Work

### Production Deploy Sequence

1. **Pre-deploy validation** — verifies branch is `main`
2. **Backend deploys** — uses `railway up --ci` which waits for health check
3. **Frontend deploys** — starts after Backend is healthy
4. **DNS propagation wait** — 60-second pause for Railway internal DNS to update (frontend discovers new backend IP)
5. **Backend warm-up** — sends requests to trigger DNS refresh in Caddy and initialize pools
6. **Post-deploy health check** — confirms both services are responding
7. **Deployment summary** — generates GitHub Step Summary with results

> **Why warmup comes AFTER frontend:** Frontend's Caddy proxy needs to resolve the new backend container IP. The 60-second DNS wait + warmup requests ensure Caddy's cache is refreshed before real user traffic arrives.

The production workflow also supports **manual dispatch** via `workflow_dispatch` with an optional `skip_health_check` input.

### Backend Warm-up Step

After frontend deploys and DNS propagates, the warm-up step runs. This serves several purposes:

**Why warm-up is needed:**

1. **Caddy DNS refresh** — after deployment, Caddy's DNS cache may still point to the old container IP. Warm-up requests absorb "sacrificial" failures and trigger DNS refresh.
2. **Connection pool initialization** — database and Redis connection pools are lazily initialized.
3. **Lazy module loading** — some Python modules and dependencies load on first use.
4. **Cache warming** — initial requests populate application-level caches.

**The warm-up script (`scripts/backend-warmup.sh`):**

```bash
# Usage
./scripts/backend-warmup.sh <BASE_URL> [WARMUP_REQUESTS] [RETRY_DELAY]

# Parameters
#   BASE_URL         - The frontend URL (backend is accessed via frontend proxy)
#   WARMUP_REQUESTS  - Number of warmup requests per endpoint (default: 10)
#   RETRY_DELAY      - Seconds between health check retries (default: 3)

# Example
./scripts/backend-warmup.sh "https://learn-greek-frontend.up.railway.app" 10 3
```

The script performs three phases:
1. **Wait for ready** — polls `/api/v1/health/ready` until backend responds (max 20 attempts)
2. **Send warmup requests** — makes multiple requests to `/api/v1/health`, `/api/v1/health/live`, `/api/v1/health/ready`, and `/api/v1/status`
3. **Final verification** — confirms backend is still healthy after warmup

### Why Sequential?

Railway's native GitHub integration deploys services in parallel, which can cause:
- Frontend starting before Backend is ready
- 502 errors during deployment window
- Users seeing errors while Backend initializes

### The `--ci` Flag

The `--ci` flag makes `railway up` wait for the deployment to complete AND pass health checks before returning. This provides:
- Guaranteed Backend is healthy before Frontend starts
- Failed Backend deploy prevents Frontend deploy (fail-fast)
- Clear logs showing deployment progress

## Manual Deployment

If you need to deploy manually (e.g., GitHub Actions is down):

### Prerequisites

- Railway CLI installed: `npm install -g @railway/cli`
- Railway authentication: `railway login` or set `RAILWAY_TOKEN` env var

### Deploy Commands

```bash
# Link to project and environment
railway link --project <project-id> --environment production

# Deploy Backend first (wait for health)
cd learn-greek-easy-backend
railway up --ci --service Backend

# Deploy Frontend after Backend is healthy
cd ../learn-greek-easy-frontend
railway up --ci --service Frontend
```

### Deploy Specific Commit

```bash
git checkout <commit-sha>

# Deploy Backend
cd learn-greek-easy-backend
railway up --ci --service Backend

# Deploy Frontend
cd ../learn-greek-easy-frontend
railway up --ci --service Frontend
```

## Rollback Procedure

### Option 1: Redeploy Previous Commit

```bash
# Find previous good commit
git log --oneline -10

# Checkout and deploy
git checkout <good-commit-sha>
railway up --ci --service Backend
railway up --ci --service Frontend
```

### Option 2: Railway Dashboard Rollback

1. Go to Railway Dashboard > Service > Deployments
2. Find the previous successful deployment
3. Click "Redeploy" on that deployment
4. Repeat for the other service (Backend first, then Frontend)

### Option 3: Revert and Push

```bash
git revert HEAD
git push origin main
# GitHub Actions will automatically deploy the revert
```

## Troubleshooting

### Deployment Stuck

If `railway up --ci` hangs for more than 10 minutes:

1. Check Railway dashboard for deployment status
2. Check service logs for errors
3. Cancel with Ctrl+C and check health endpoint manually via frontend proxy:
   ```bash
   curl https://learn-greek-frontend.up.railway.app/api/v1/health
   curl https://learn-greek-frontend.up.railway.app/api/v1/health/ready
   ```
4. If service is healthy but CLI hung, deployment likely succeeded

### Health Check Failing

If deployment completes but health check fails:

1. Check `/api/v1/health` and `/api/v1/health/ready` endpoints via frontend proxy
2. Review service logs in Railway dashboard
3. Verify database connectivity (check Postgres service)
4. Check environment variables are set correctly
5. Verify Redis is running (used for caching)

### Concurrent Deploy Conflict

If both Railway auto-deploy and GitHub Actions try to deploy:

1. Cancel one deployment in Railway dashboard
2. Verify auto-deploy is disabled for the service (see Configuration below)
3. Re-run GitHub Actions workflow if needed

### GitHub Actions Workflow Failed

1. Check the workflow run logs in GitHub Actions
2. Common issues:
   - `RAILWAY_API_TOKEN` secret missing or expired
   - Railway CLI container pull failed (retry usually works)
   - Timeout exceeded (increase `timeout-minutes` if needed)

## Configuration

### GitHub Secrets Required

| Secret | Description |
|--------|-------------|
| `RAILWAY_API_TOKEN` | Railway project token (generate in Railway dashboard) |
| `RAILWAY_PROJECT_ID` | Railway project ID (from project settings) |
| `RAILWAY_WORKSPACE_ID` | Railway workspace ID (from workspace settings) |

### Required Backend Environment Variables

The following variables must be set on **both** the production backend service and the dev/preview backend service in Railway before deployment. The backend will fail to start (Pydantic `ValidationError`) if any required variable is missing.

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET_KEY` | YES | Min 32 chars. Signs/verifies JWTs. |
| `DATABASE_URL` | YES | Supabase Postgres connection string (Supavisor session mode, port 5432). |
| `CORS_ORIGINS` | YES | Comma-separated list of allowed frontend origins. |
| `PICTURE_HOUSE_STYLE_DEFAULT` | YES | House-style fragment appended to every news picture prompt. See below. |

#### `PICTURE_HOUSE_STYLE_DEFAULT`

**Purpose:** A prose fragment describing the visual house style (lighting, palette, composition) that is appended to every AI-generated news picture prompt. It is consumed in two places:

1. `news_item_service.create` — pre-fills the `style_en` column when an admin pastes a scene description (so admins only need to supply the *what*, not the *how*).
2. The SCENE-01 Alembic backfill migration — populates `style_en` for all existing `news_items` rows that pre-date the structured-prompt feature.

**Required:** YES. No fallback value exists. The backend refuses to start with a Pydantic `ValidationError` if this variable is unset. The SCENE-01 backfill migration aborts with a `RuntimeError` if it is unset at migration time.

**Where to set:** Railway dashboard → both the **production** backend service and the **dev/preview** backend service (the service used by the PR preview workflow).

**When to set:** BEFORE merging the SCENE-01 PR (`feature/scene-01-structured-picture-prompt`). If the variable is missing when the post-merge deploy runs, the backend will fail at boot and the migration step will not complete.

**Example value (developer reference — do not use as a runtime fallback):**

```
Editorial photo-realistic illustration, soft natural lighting, neutral color palette, clean composition, no text or logos.
```

---

### Railway Auto-Deploy Status

**IMPORTANT**: Auto-deploy must be DISABLED for GitHub Actions sequential deploy to work correctly.

| Service | Production | Dev |
|---------|------------|-----|
| Backend | DISABLED | DISABLED |
| Frontend | DISABLED | DISABLED |

### How to Disable Auto-Deploy

1. Go to Railway Dashboard > Project > Environment
2. Select the service (Backend or Frontend)
3. Click Settings tab
4. Find "Source" or "Deployment" section
5. Disable "Auto Deploy" / "Deploy on Push" toggle
6. Save changes

## Workflow Files

| File | Purpose |
|------|---------|
| `.github/workflows/deploy-production.yml` | Production deployment on push to main |
| `.github/workflows/preview.yml` | PR preview deployment |
| `.github/workflows/preview-cleanup.yml` | Cleanup on PR close |
| `.github/workflows/preview-cleanup-scheduled.yml` | Daily cron (2 AM UTC) to clean orphaned `pr-*` environments |
| `.github/workflows/test.yml` | CI tests (reusable) |

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/backend-warmup.sh` | Warm up backend after deploy (DNS refresh, pool init) |
| `scripts/preview-health-check.sh` | Health check for preview environments |
| `scripts/preview-api-smoke.sh` | API smoke tests for preview environments |

## Health Endpoints

All health endpoints are accessed via the frontend proxy (backend is private).

| Endpoint | Purpose | URL |
|----------|---------|-----|
| `/api/v1/health` | Comprehensive health check | `<frontend-url>/api/v1/health` |
| `/api/v1/health/ready` | Readiness check (includes DB connectivity) | `<frontend-url>/api/v1/health/ready` |
| `/api/v1/health/live` | Kubernetes-style liveness probe | `<frontend-url>/api/v1/health/live` |
| `/api/v1/status` | Application status | `<frontend-url>/api/v1/status` |

> **Note**: Root-level `/health`, `/health/ready`, `/health/live` endpoints are also available via proxy for backward compatibility. `/docs` (Swagger UI) is only available when `debug=True` (not in production).
