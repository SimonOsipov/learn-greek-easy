# Railway Backend Privacy

This document explains the backend privacy configuration and how to access the backend service for debugging.

## Overview

The backend service is configured as **private** on Railway, meaning it does not have a public URL. All external traffic to the backend goes through the frontend's Caddy proxy.

### Benefits of Private Backend

1. **Security**: Reduces attack surface by eliminating direct backend access
2. **Cost Savings**: No need for separate SSL certificates or public endpoints
3. **Simplified Architecture**: Single entry point for all traffic
4. **Rate Limiting**: Can implement rate limiting at the proxy level

## How It Works

### Architecture

```
                                     Railway Internal Network
                                    +------------------------+
                                    |                        |
  Users ──────► Frontend (Public) ──┼──► Backend (Private)   |
               https://frontend.up  |    backend.railway.internal:8080
               .railway.app         |                        |
                                    +------------------------+
```

### Traffic Flow

1. **Frontend requests**: Users access the frontend at `https://learn-greek-frontend.up.railway.app`
2. **API requests**: The frontend's Caddy server proxies `/api/*` requests to the internal backend
3. **Health checks**: CI/CD uses `/api/v1/health/*` endpoints through the frontend proxy

### Caddy Configuration (Frontend)

The frontend's Caddyfile routes API traffic to the backend:

```caddy
:80 {
    # API routes to backend (internal network)
    reverse_proxy /api/* {$BACKEND_URL:backend.railway.internal:8080}

    # Health routes also proxied
    reverse_proxy /health* {$BACKEND_URL:backend.railway.internal:8080}
    reverse_proxy /docs* {$BACKEND_URL:backend.railway.internal:8080}

    # Frontend static files
    root * /srv
    try_files {path} /index.html
    file_server
}
```

## Health Check Endpoints

### Versioned API Endpoints (Recommended)

These endpoints are accessible through the frontend proxy:

| Endpoint | Purpose | URL |
|----------|---------|-----|
| `/api/v1/health` | Comprehensive health check | `https://frontend.url/api/v1/health` |
| `/api/v1/health/live` | Kubernetes liveness probe | `https://frontend.url/api/v1/health/live` |
| `/api/v1/health/ready` | Kubernetes readiness probe | `https://frontend.url/api/v1/health/ready` |

### Root-Level Endpoints (Also Proxied)

For backward compatibility, these are still available:

| Endpoint | Purpose | URL |
|----------|---------|-----|
| `/health` | Comprehensive health check | `https://frontend.url/health` |
| `/health/live` | Liveness probe | `https://frontend.url/health/live` |
| `/health/ready` | Readiness probe | `https://frontend.url/health/ready` |

### Example Health Check

```bash
# Check backend health via frontend proxy
curl https://learn-greek-frontend.up.railway.app/api/v1/health

# Expected response (200 OK)
{
  "status": "healthy",
  "version": "0.1.0",
  "environment": "production",
  "timestamp": "2024-12-02T10:30:00Z",
  "uptime_seconds": 3600,
  "checks": {
    "database": {"status": "healthy", "latency_ms": 5.2, "message": "OK"},
    "redis": {"status": "healthy", "latency_ms": 1.1, "message": "PONG"},
    "memory": {"status": "healthy", "used_mb": 128.5, "percent": 45.2}
  }
}
```

## Debugging the Backend

### Option 1: Railway Logs

View logs in the Railway dashboard:
1. Go to [Railway Dashboard](https://railway.app)
2. Select your project
3. Click on the Backend service
4. View the "Logs" tab

### Option 2: Railway CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to project
railway link --project <project-id>

# View logs
railway logs --service Backend

# Connect to the service shell (if supported)
railway shell --service Backend
```

### Option 3: Database Access

For database debugging, you can connect to PostgreSQL:

```bash
# Get connection string from Railway dashboard
# Settings -> Variables -> DATABASE_URL

# Connect using psql
psql <connection_string>
```

## CI/CD Configuration

All CI/CD workflows use the frontend URL to access the backend:

### Production Deployment

```yaml
env:
  PROD_FRONTEND_URL: https://learn-greek-frontend.up.railway.app

# Health checks use /api/v1/health endpoints
- name: Run Health Checks
  run: |
    curl -sf "${{ env.PROD_FRONTEND_URL }}/api/v1/health"
    curl -sf "${{ env.PROD_FRONTEND_URL }}/api/v1/health/ready"
```

### Preview Deployment

```yaml
env:
  DEV_FRONTEND_URL: frontend-dev-8db9.up.railway.app

# All backend access via frontend proxy
- name: Seed Database
  run: |
    curl -X POST "$FRONTEND_URL/api/v1/test/seed/all"
```

## Manual Backend URL Removal

After merging the backend privacy PR:

1. Go to [Railway Dashboard](https://railway.app)
2. Navigate to: Project -> Backend service -> Settings -> Networking
3. Remove the public domain (`backend-*.up.railway.app`)
4. The backend will only be accessible via the internal network

## Troubleshooting

### Health Check Failures

If `/api/v1/health` returns errors:

1. **Check frontend is running**: `curl https://frontend.url/health`
2. **Check backend logs** in Railway dashboard
3. **Verify internal network**: Backend should be on `backend.railway.internal:8080`

### 502 Bad Gateway

Usually indicates the backend is not responding:

1. Check backend deployment status in Railway
2. Review backend logs for startup errors
3. Verify `BACKEND_URL` environment variable in frontend

### Connection Refused

The backend might not be reachable:

1. Ensure backend and frontend are in the same Railway project
2. Check the internal URL format (`http://backend.railway.internal:8080`)
3. Verify backend is listening on port 8080

## Related Documentation

- [Deployment Guide](deployment-guide.md) - Full deployment procedures
- [E2E Seeding](e2e-seeding.md) - Test data seeding (uses frontend proxy)
- [Docker Reference](docker-reference.md) - Local development setup
