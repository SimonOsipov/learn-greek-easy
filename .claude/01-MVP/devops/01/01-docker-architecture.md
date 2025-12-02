# 01. Docker Architecture Plan

**Project**: Learn Greek Easy - MVP DevOps
**Task**: Docker Infrastructure Setup
**Created**: 2025-12-02
**Status**: ✅ Complete

---

## Table of Contents

1. [Overview](#overview)
2. [Current State Analysis](#current-state-analysis)
3. [Target Architecture](#target-architecture)
4. [Backend Dockerfile](#backend-dockerfile)
5. [Production Docker Compose](#production-docker-compose)
6. [Multi-Stage Build Strategy](#multi-stage-build-strategy)
7. [Environment Configuration](#environment-configuration)
8. [Networking & Volumes](#networking--volumes)
9. [Health Checks](#health-checks)
10. [Security Considerations](#security-considerations)
11. [Implementation Tasks](#implementation-tasks)

---

## Overview

### Purpose

Containerize the Learn Greek Easy application for:
- Consistent development environments across team members
- Reproducible production deployments
- Simplified CI/CD pipeline integration
- Horizontal scaling capability (future)

### Scope

| Component | Current Status | Target |
|-----------|---------------|--------|
| Development docker-compose | Done | Maintain |
| Frontend Dockerfile | Done | Optimize |
| Backend Dockerfile | Done | Create |
| Production docker-compose | Done | Create |
| Multi-stage builds | Done | Complete |

---

## Current State Analysis

### Existing Infrastructure

**docker-compose.yml** (root level):
```yaml
services:
  frontend:     # Port 80 (nginx)
  postgres:     # Port 5433 (mapped from 5432)
```

**Frontend Dockerfile** (exists):
- Multi-stage build (builder + nginx)
- Node 18 Alpine base
- Health check configured
- Nginx production server

**Backend**:
- No Dockerfile exists
- FastAPI + Uvicorn application
- Python 3.14 (Poetry dependencies)
- PostgreSQL + Redis dependencies

### Gaps to Address

1. **Backend Dockerfile**: No container for FastAPI backend
2. **Redis Service**: Listed in dependencies but not in docker-compose
3. **Production Configuration**: Development config only
4. **Service Discovery**: No backend service in compose network
5. **Environment Separation**: No dev/prod compose file separation

---

## Target Architecture

### Service Topology

```
                    ┌─────────────────┐
                    │   nginx:80      │
                    │   (frontend)    │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
    ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
    │ API:8000    │  │ API:8000    │  │ API:8000    │
    │ (backend-1) │  │ (backend-2) │  │ (backend-n) │
    └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
           │                │                │
           └────────────────┼────────────────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
              ▼             ▼             ▼
    ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
    │ PostgreSQL  │  │    Redis    │  │   Celery    │
    │   :5432     │  │   :6379     │  │  (workers)  │
    └─────────────┘  └─────────────┘  └─────────────┘
```

### Container Images

| Service | Base Image | Size Target | Purpose |
|---------|-----------|-------------|---------|
| frontend | nginx:alpine | < 50MB | Static asset serving |
| backend | python:3.14-slim | < 500MB | FastAPI application |
| postgres | postgres:16-alpine | N/A (official) | Database |
| redis | redis:7-alpine | N/A (official) | Cache/Sessions |
| celery | python:3.14-slim | < 500MB | Background tasks |

---

## Backend Dockerfile

### Design Principles

1. **Multi-stage build**: Separate build and runtime stages
2. **Non-root user**: Security best practice
3. **Layer optimization**: Cache dependencies before code
4. **Health checks**: Container orchestration readiness

### Dockerfile Structure

```dockerfile
# =============================================================================
# Stage 1: Builder - Install dependencies with Poetry
# =============================================================================
FROM python:3.14-slim AS builder

WORKDIR /app

# Install system dependencies for building Python packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Poetry
ENV POETRY_VERSION=1.8.0
ENV POETRY_HOME=/opt/poetry
ENV POETRY_VENV=/opt/poetry-venv
ENV POETRY_NO_INTERACTION=1
ENV POETRY_VIRTUALENVS_CREATE=false

RUN python -m venv $POETRY_VENV \
    && $POETRY_VENV/bin/pip install -U pip setuptools \
    && $POETRY_VENV/bin/pip install poetry==$POETRY_VERSION

ENV PATH="${POETRY_VENV}/bin:${PATH}"

# Copy dependency files first (layer caching)
COPY pyproject.toml poetry.lock ./

# Install production dependencies only
RUN poetry install --only=main --no-root

# Copy application code
COPY src/ ./src/
COPY alembic/ ./alembic/
COPY alembic.ini ./

# =============================================================================
# Stage 2: Runtime - Minimal production image
# =============================================================================
FROM python:3.14-slim AS runtime

WORKDIR /app

# Install runtime dependencies only
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Create non-root user
RUN groupadd --gid 1000 appgroup \
    && useradd --uid 1000 --gid appgroup --shell /bin/bash appuser

# Copy installed packages from builder
COPY --from=builder /usr/local/lib/python3.14/site-packages /usr/local/lib/python3.14/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy application code
COPY --from=builder /app/src ./src
COPY --from=builder /app/alembic ./alembic
COPY --from=builder /app/alembic.ini ./

# Create necessary directories
RUN mkdir -p /app/logs && chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Environment variables
ENV PYTHONPATH=/app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl --fail http://localhost:8000/health || exit 1

# Default command
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Development Dockerfile Variant

For development with hot reload:

```dockerfile
# learn-greek-easy-backend/Dockerfile.dev
FROM python:3.14-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Poetry
ENV POETRY_VERSION=1.8.0
RUN pip install poetry==$POETRY_VERSION

# Copy and install dependencies
COPY pyproject.toml poetry.lock ./
RUN poetry config virtualenvs.create false \
    && poetry install --no-interaction

# Copy application
COPY . .

ENV PYTHONPATH=/app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

---

## Production Docker Compose

### File Structure

```
learn-greek-easy/
├── docker-compose.yml          # Development (existing)
├── docker-compose.prod.yml     # Production
├── docker-compose.override.yml # Local overrides (gitignored)
└── .env.example               # Environment template
```

### Production Compose Configuration

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  # ==========================================================================
  # Frontend - Nginx serving React SPA
  # ==========================================================================
  frontend:
    build:
      context: ./learn-greek-easy-frontend
      dockerfile: Dockerfile
    image: learn-greek-easy-frontend:${IMAGE_TAG:-latest}
    container_name: learn-greek-frontend
    ports:
      - "80:80"
      - "443:443"
    environment:
      - NODE_ENV=production
    volumes:
      - ./nginx/ssl:/etc/nginx/ssl:ro  # SSL certificates
    depends_on:
      backend:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - learn-greek-network
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 256M
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # ==========================================================================
  # Backend - FastAPI Application
  # ==========================================================================
  backend:
    build:
      context: ./learn-greek-easy-backend
      dockerfile: Dockerfile
      target: runtime
    image: learn-greek-easy-backend:${IMAGE_TAG:-latest}
    container_name: learn-greek-backend
    expose:
      - "8000"
    environment:
      - ENVIRONMENT=production
      - DATABASE_URL=postgresql+asyncpg://postgres:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      - REDIS_URL=redis://redis:6379/0
      - SECRET_KEY=${SECRET_KEY}
      - CORS_ORIGINS=${CORS_ORIGINS:-http://localhost}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - learn-greek-network
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '1'
          memory: 512M
    healthcheck:
      test: ["CMD", "curl", "--fail", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # ==========================================================================
  # PostgreSQL Database
  # ==========================================================================
  postgres:
    image: postgres:16-alpine
    container_name: learn-greek-postgres
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB:-learn_greek_easy}
      POSTGRES_INITDB_ARGS: "--encoding=UTF8 --locale=en_US.UTF-8"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init.sql:ro
    networks:
      - learn-greek-network
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 1G
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d ${POSTGRES_DB:-learn_greek_easy}"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped
    command: >
      postgres
      -c shared_preload_libraries=pg_stat_statements
      -c pg_stat_statements.track=all
      -c max_connections=100
      -c shared_buffers=256MB
      -c effective_cache_size=768MB
      -c maintenance_work_mem=64MB
      -c checkpoint_completion_target=0.7
      -c wal_buffers=16MB
      -c default_statistics_target=100

  # ==========================================================================
  # Redis Cache
  # ==========================================================================
  redis:
    image: redis:7-alpine
    container_name: learn-greek-redis
    command: redis-server --appendonly yes --maxmemory 128mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    networks:
      - learn-greek-network
    deploy:
      resources:
        limits:
          cpus: '0.25'
          memory: 256M
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 3
    restart: unless-stopped

  # ==========================================================================
  # Celery Worker (Background Tasks)
  # ==========================================================================
  celery-worker:
    build:
      context: ./learn-greek-easy-backend
      dockerfile: Dockerfile
      target: runtime
    image: learn-greek-easy-backend:${IMAGE_TAG:-latest}
    container_name: learn-greek-celery-worker
    command: celery -A src.tasks worker --loglevel=info --concurrency=2
    environment:
      - ENVIRONMENT=production
      - DATABASE_URL=postgresql+asyncpg://postgres:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      - REDIS_URL=redis://redis:6379/0
      - SECRET_KEY=${SECRET_KEY}
    depends_on:
      - redis
      - postgres
    restart: unless-stopped
    networks:
      - learn-greek-network
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M

  # ==========================================================================
  # Celery Beat (Scheduled Tasks)
  # ==========================================================================
  celery-beat:
    build:
      context: ./learn-greek-easy-backend
      dockerfile: Dockerfile
      target: runtime
    image: learn-greek-easy-backend:${IMAGE_TAG:-latest}
    container_name: learn-greek-celery-beat
    command: celery -A src.tasks beat --loglevel=info
    environment:
      - ENVIRONMENT=production
      - DATABASE_URL=postgresql+asyncpg://postgres:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - redis
    restart: unless-stopped
    networks:
      - learn-greek-network
    deploy:
      resources:
        limits:
          cpus: '0.25'
          memory: 256M

# =============================================================================
# Networks
# =============================================================================
networks:
  learn-greek-network:
    driver: bridge
    name: learn-greek-network

# =============================================================================
# Volumes
# =============================================================================
volumes:
  postgres_data:
    name: learn-greek-easy-postgres-data
  redis_data:
    name: learn-greek-easy-redis-data
```

---

## Multi-Stage Build Strategy

### Frontend (Existing - Optimized)

| Stage | Base Image | Purpose | Artifacts |
|-------|-----------|---------|-----------|
| builder | node:18-alpine | npm install, vite build | dist/ |
| runtime | nginx:alpine | Serve static files | dist/ copied |

**Size**: ~30-50MB (optimal)

### Backend (New)

| Stage | Base Image | Purpose | Artifacts |
|-------|-----------|---------|-----------|
| builder | python:3.14-slim | Poetry install, compile | site-packages/ |
| runtime | python:3.14-slim | Run application | app code + packages |

**Optimization Techniques**:

1. **Dependency caching**: Copy pyproject.toml before source code
2. **Production-only deps**: `poetry install --only=main`
3. **No dev tools in runtime**: Exclude pytest, black, mypy
4. **Minimal base image**: Use `-slim` variant
5. **Clean apt cache**: `rm -rf /var/lib/apt/lists/*`

**Expected Size**: ~400-500MB (acceptable for Python apps)

---

## Environment Configuration

### Environment File Template

```bash
# .env.example (commit this)

# =============================================================================
# Application
# =============================================================================
ENVIRONMENT=development
IMAGE_TAG=latest

# =============================================================================
# Security (CHANGE IN PRODUCTION)
# =============================================================================
SECRET_KEY=change-this-in-production-use-openssl-rand-hex-32
JWT_SECRET_KEY=change-this-also-32-bytes-minimum

# =============================================================================
# Database
# =============================================================================
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=learn_greek_easy
DATABASE_URL=postgresql+asyncpg://postgres:postgres@postgres:5432/learn_greek_easy

# =============================================================================
# Redis
# =============================================================================
REDIS_URL=redis://redis:6379/0

# =============================================================================
# CORS
# =============================================================================
CORS_ORIGINS=http://localhost,http://localhost:3000,http://localhost:5173

# =============================================================================
# API
# =============================================================================
API_V1_PREFIX=/api/v1
```

### Environment Loading Order

1. `.env` file (gitignored)
2. `docker-compose.*.yml` environment section
3. Shell environment variables (override)

---

## Networking & Volumes

### Network Configuration

```yaml
networks:
  learn-greek-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.28.0.0/16
```

### Service Discovery

| Service | Internal Hostname | Port |
|---------|------------------|------|
| frontend | frontend | 80 |
| backend | backend | 8000 |
| postgres | postgres | 5432 |
| redis | redis | 6379 |

### Volume Strategy

| Volume | Type | Purpose | Backup Required |
|--------|------|---------|----------------|
| postgres_data | Named | Database persistence | Yes |
| redis_data | Named | Cache persistence | No |
| logs | Bind mount | Application logs | Optional |
| ssl | Bind mount | SSL certificates | Yes |

---

## Health Checks

### Health Check Endpoints

| Service | Endpoint | Method | Expected Response |
|---------|----------|--------|-------------------|
| frontend | /health | GET | 200 OK |
| backend | /health | GET | 200 OK + JSON |
| postgres | pg_isready | CLI | exit 0 |
| redis | redis-cli ping | CLI | PONG |

### Backend Health Endpoint

```python
# src/api/v1/health.py
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from src.db.dependencies import get_db

router = APIRouter()

@router.get("/health")
async def health_check(db: AsyncSession = Depends(get_db)):
    """Health check endpoint for container orchestration."""
    try:
        # Check database connectivity
        await db.execute("SELECT 1")
        db_status = "healthy"
    except Exception:
        db_status = "unhealthy"

    return {
        "status": "healthy" if db_status == "healthy" else "degraded",
        "database": db_status,
        "version": "1.0.0"
    }
```

---

## Security Considerations

### Container Security

1. **Non-root user**: All containers run as non-root
2. **Read-only filesystem**: Where possible, mount as read-only
3. **No privileged mode**: Never use `privileged: true`
4. **Resource limits**: CPU and memory constraints defined
5. **Network isolation**: Services only exposed as needed

### Image Security

1. **Official base images**: Always use official Docker Hub images
2. **Minimal images**: Alpine/slim variants preferred
3. **Regular updates**: Base images updated monthly
4. **Vulnerability scanning**: Run `docker scan` in CI/CD

### Secrets Management

| Secret | Storage Method | Notes |
|--------|---------------|-------|
| POSTGRES_PASSWORD | Environment variable | Consider Docker secrets in Swarm |
| SECRET_KEY | Environment variable | 32+ characters |
| SSL certificates | Bind mount | External management (Let's Encrypt) |

---

## Implementation Tasks

### Task Breakdown

| # | Task | Priority | Status | Dependencies |
|---|------|----------|--------|--------------|
| 1 | Create Backend Dockerfile | High | ✅ Done | None |
| 2 | Add backend to docker-compose.yml | High | ✅ Done | Task 1 |
| 3 | Create docker-compose.prod.yml | Medium | ✅ Done | Tasks 1-2 |
| 4 | Add Redis service | Medium | ✅ Done | None |
| 5 | Implement health endpoints | Medium | ✅ Done | Task 1 |
| 6 | Create .env.example | Low | ✅ Done | None |
| 7 | Add Celery services | Low | ⏸️ Deferred | Not needed for MVP |
| 8 | Documentation update | Low | ✅ Done | All |

### Execution Order

```
Phase 1: Core Infrastructure ✅ COMPLETE
  └── Task 1: Backend Dockerfile ✅
  └── Task 2: Update development compose ✅
  └── Task 3: Production compose ✅

Phase 2: Production Readiness ✅ COMPLETE
  └── Task 4: Redis service ✅
  └── Task 5: Health endpoints ✅

Phase 3: Background Processing ✅ COMPLETE
  └── Task 6: Environment config ✅
  └── Task 7: Celery services ⏸️ (deferred - not needed for MVP)

Phase 4: Documentation ✅ COMPLETE
  └── Task 8: Update CLAUDE.md ✅
```

### Validation Checklist

- [ ] `docker build` succeeds for both frontend and backend
- [ ] `docker-compose up` starts all services
- [ ] Health checks pass for all containers
- [ ] Backend can connect to PostgreSQL
- [ ] Backend can connect to Redis
- [ ] Frontend can reach backend API
- [ ] Logs are accessible via `docker-compose logs`
- [ ] Containers restart on failure
- [ ] No secrets in image layers (`docker history`)

---

## Commands Reference

### Development

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f backend

# Rebuild single service
docker-compose build backend

# Shell into container
docker-compose exec backend bash

# Run migrations
docker-compose exec backend alembic upgrade head
```

### Production

```bash
# Start with production config
docker-compose -f docker-compose.prod.yml up -d

# Scale backend
docker-compose -f docker-compose.prod.yml up -d --scale backend=3

# Rolling update
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d --no-deps backend

# Database backup
docker-compose exec postgres pg_dump -U postgres learn_greek_easy > backup.sql
```

---

## References

- [Docker Multi-stage Builds](https://docs.docker.com/build/building/multi-stage/)
- [Docker Compose Specification](https://docs.docker.com/compose/compose-file/)
- [FastAPI Docker Deployment](https://fastapi.tiangolo.com/deployment/docker/)
- [Poetry in Docker](https://python-poetry.org/docs/faq/#poetry-busts-my-docker-cache-because-it-requires-me-to-copy-my-source-files-in-before-installing-3rd-party-dependencies)

---

**Status**: ✅ ALL DOCKER ARCHITECTURE TASKS COMPLETE
