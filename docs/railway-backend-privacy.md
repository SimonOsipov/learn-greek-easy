# Railway Backend Privacy

This document explains the backend privacy configuration and how to access the backend service for debugging.

## Overview

The backend service is configured as **private** on Railway, meaning it does not have a public URL. All external traffic to the backend goes through the frontend's Caddy proxy.

### Benefits of Private Backend

1. **Security**: Reduces attack surface by eliminating direct backend access
2. **Simplified Architecture**: Single entry point for all traffic
3. **Rate Limiting**: Can implement rate limiting at the proxy level

## How It Works

### Architecture

```
                                     Railway Internal Network
                                    +------------------------+
                                    |                        |
  Users ──────► Frontend (Public) ──┼──► Backend (Private)   |
               https://frontend.up  |    backend.railway.internal
               .railway.app         |                        |
                                    +------------------------+
```

### Traffic Flow

1. **Frontend requests**: Users access the frontend at `https://learn-greek-frontend.up.railway.app`
2. **API requests**: The frontend's Caddy server proxies `/api/*` requests to the internal backend
3. **Health checks**: CI/CD uses `/api/v1/health/*` endpoints through the frontend proxy

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BACKEND_HOST` | `backend.railway.internal` | Backend hostname on Railway internal network |
| `BACKEND_PORT` | `8080` | Backend port (Railway sets `PORT` at runtime) |

> **Note**: The backend Dockerfile exposes port 8000 and uvicorn binds to `${PORT:-8000}`. Railway overrides `PORT` at runtime. The Caddyfile defaults to port 8080 for the proxy target.

### Caddy Configuration (Frontend)

The frontend Caddyfile uses dynamic DNS resolution to handle backend IP changes during redeployments:

```caddy
:{$PORT:80}

# API proxy to backend with dynamic DNS resolution
handle /api/* {
    reverse_proxy {
        # Dynamic A-record DNS with Railway's internal resolver
        dynamic a {$BACKEND_HOST:backend.railway.internal} {$BACKEND_PORT:8080} {
            refresh 1s
            versions ipv4 ipv6
            resolvers fd12::10      # Railway internal DNS
            dial_timeout 30s
        }

        # Buffer request body to prevent streaming race condition
        request_buffers 1MB

        # Allow retries for mutating methods (default is GET only)
        lb_retry_match {
            method POST PUT PATCH DELETE
        }

        # Aggressive retries — user never sees 502 from stale IPs
        lb_try_duration 10s
        lb_try_interval 250ms
        lb_retries 100

        # Relaxed passive health checks — prevents marking backend
        # unhealthy too fast during DNS transitions
        fail_duration 60s
        max_fails 300
        unhealthy_status 502 503 504

        transport http {
            read_timeout 120s
            write_timeout 120s
            keepalive 30s
            keepalive_idle_conns 10
        }
    }
}
```

### Proxied Routes

All routes proxied from frontend to backend:

| Route | Purpose |
|-------|---------|
| `/api/*` | All API endpoints (with request body buffering + retry for mutations) |
| `/health*` | Health check endpoints |
| `/version` | Version endpoint |
| `/docs`, `/docs/*` | Swagger UI (dev only — disabled in production) |
| `/redoc`, `/redoc/*` | ReDoc API docs (dev only) |
| `/openapi.json` | OpenAPI spec |

### Resilience Features

The Caddy proxy is configured for zero-downtime during backend redeployments:

- **Dynamic DNS** — resolves backend IP every 1 second via Railway's internal resolver (`fd12::10`)
- **Aggressive retries** — 100 retries over 10 seconds at 250ms intervals absorb DNS transitions
- **Relaxed health checks** — tolerates up to 300 failures over 60 seconds before marking unhealthy
- **Request body buffering** — 1MB buffer ensures POST/PUT bodies are fully read before upstream selection
- **Mutation retries** — POST, PUT, PATCH, DELETE can be retried (not just GET)

### Static Assets & Security

- **Static asset caching**: `Cache-Control: public, max-age=31536000, immutable`
- **Security headers**: `X-Frame-Options`, `X-Content-Type-Options`, `X-XSS-Protection`, `Referrer-Policy`, `Document-Policy` (for Sentry profiling)

## Health Check Endpoints

### Versioned API Endpoints (Recommended)

| Endpoint | Purpose |
|----------|---------|
| `/api/v1/health` | Comprehensive health check (DB, Redis, Stripe, memory) |
| `/api/v1/health/live` | Kubernetes liveness probe |
| `/api/v1/health/ready` | Kubernetes readiness probe (includes DB connectivity) |
| `/api/v1/status` | Application status |

### Root-Level Endpoints (Backward Compatibility)

| Endpoint | Purpose |
|----------|---------|
| `/health` | Comprehensive health check |
| `/health/live` | Liveness probe |
| `/health/ready` | Readiness probe |

### Example Health Check

```bash
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
    "stripe": {"status": "healthy"},
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
```

### Option 3: Database Access

```bash
# Get connection string from Railway dashboard
# Settings -> Variables -> DATABASE_URL
psql <connection_string>
```

## CI/CD Configuration

All CI/CD workflows use the frontend URL to access the backend:

### Production Deployment

```yaml
env:
  PROD_FRONTEND_URL: https://learn-greek-frontend.up.railway.app

- name: Run Health Checks
  run: |
    curl -sf "${{ env.PROD_FRONTEND_URL }}/api/v1/health"
    curl -sf "${{ env.PROD_FRONTEND_URL }}/api/v1/health/ready"
```

### Preview Deployment

```yaml
env:
  DEV_FRONTEND_URL: frontend-dev-8db9.up.railway.app

- name: Seed Database
  run: |
    curl -X POST "$FRONTEND_URL/api/v1/test/seed/all"
```

## Railway Configuration

### Auto-Deploy Status

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

## Troubleshooting

### Health Check Failures

If `/api/v1/health` returns errors:

1. **Check frontend is running**: `curl https://learn-greek-frontend.up.railway.app/health`
2. **Check backend logs** in Railway dashboard
3. **Verify internal network**: Backend should be on `backend.railway.internal`

### 502 Bad Gateway

Usually indicates the backend is not responding or DNS hasn't resolved:

1. Check backend deployment status in Railway
2. Review backend logs for startup errors
3. Verify `BACKEND_HOST` environment variable in frontend service
4. Check if deployment is mid-transition (Caddy retries should handle this — wait 10-15 seconds)

### Connection Refused

The backend might not be reachable:

1. Ensure backend and frontend are in the same Railway project
2. Check the internal URL format (`backend.railway.internal`)
3. Verify `BACKEND_PORT` matches what backend is listening on

## Related Documentation

- [Deployment Guide](deployment-guide.md) - Full deployment procedures
- [E2E Seeding](e2e-seeding.md) - Test data seeding (uses frontend proxy)
- [Supabase Database](supabase-database.md) - Database connectivity and configuration
