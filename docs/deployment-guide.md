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

### Sequential Deploy Process

1. **Backend deploys first** - Uses `railway up --ci` which waits for health check
2. **Backend warm-up** - Sends warmup requests to trigger DNS refresh and initialize pools
3. **Frontend deploys third** - Only starts after Backend is warmed up
4. **Post-deploy verification** - Health checks confirm both services are responding

### Backend Warm-up Step

After the backend deploys, a warm-up step runs before the frontend deployment begins. This step serves several important purposes:

**Why warm-up is needed:**

1. **Caddy DNS refresh** - After deployment, Caddy's DNS cache may still point to the old container IP for ~1 second. The first request can fail with a 502 error. Warm-up requests absorb this "sacrificial" failure and trigger DNS refresh.

2. **Connection pool initialization** - Database and Redis connection pools are lazily initialized. Warm-up requests ensure connections are established before real user traffic arrives.

3. **Lazy module loading** - Some Python modules and dependencies are loaded on first use. Warm-up triggers this initialization.

4. **Cache warming** - Initial requests populate any application-level caches.

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
1. **Wait for ready** - Polls `/api/v1/health/ready` until backend responds (max 20 attempts)
2. **Send warmup requests** - Makes multiple requests to `/api/v1/health`, `/api/v1/health/live`, `/api/v1/health/ready`, and `/api/v1/status`
3. **Final verification** - Confirms backend is still healthy after warmup

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
- No need for manual sleep/wait between deployments

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

### Railway Auto-Deploy Status

**IMPORTANT**: Auto-deploy must be DISABLED for GitHub Actions sequential deploy to work correctly.

| Service | Production | Dev |
|---------|------------|-----|
| Backend | DISABLED | DISABLED |
| Frontend | DISABLED | DISABLED |
| Postgres | Manual | Manual |
| Redis | Manual | Manual |

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
| `/docs` | API documentation (Swagger UI) | `<frontend-url>/docs` |

> **Note**: Root-level `/health`, `/health/ready`, `/health/live` endpoints are also available via proxy for backward compatibility.
