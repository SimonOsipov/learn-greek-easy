# Docker Reference

## Development (Full Stack with Hot Reload)

```bash
# Start all services
cd /Users/samosipov/Downloads/learn-greek-easy && docker-compose -f docker-compose.dev.yml up -d

# Start specific services
docker-compose -f docker-compose.dev.yml up -d postgres redis
docker-compose -f docker-compose.dev.yml up -d backend

# View logs
docker-compose -f docker-compose.dev.yml logs -f backend
docker-compose -f docker-compose.dev.yml logs -f frontend

# Stop all services
docker-compose -f docker-compose.dev.yml down

# Rebuild after changes
docker-compose -f docker-compose.dev.yml up -d --build backend
```

## Production

```bash
# Requires .env file with JWT_SECRET_KEY
cd /Users/samosipov/Downloads/learn-greek-easy && docker-compose up -d

# Stop services
docker-compose down

# View status
docker-compose ps
```

## Database Access

```bash
# Development (port 5433)
docker exec -it learn-greek-postgres-dev psql -U postgres -d learn_greek_easy

# Production (port 5432)
docker exec -it learn-greek-postgres psql -U postgres -d learn_greek_easy

# Redis CLI
docker exec -it learn-greek-redis-dev redis-cli
docker exec -it learn-greek-redis redis-cli
```

## Container Names

| Service | Development | Production |
|---------|-------------|------------|
| Frontend | learn-greek-frontend-dev | learn-greek-frontend |
| Backend | learn-greek-backend-dev | learn-greek-backend |
| PostgreSQL | learn-greek-postgres-dev | learn-greek-postgres |
| Redis | learn-greek-redis-dev | learn-greek-redis |

## Ports

| Service | Development | Production |
|---------|-------------|------------|
| Frontend | 5173 | 80 |
| Backend | 8000 | 8000 |
| PostgreSQL | 5433 | (internal) |
| Redis | 6379 | (internal) |

## Health Endpoints

Backend exposes three health check endpoints:

| Endpoint | Purpose |
|----------|---------|
| `/health` | Full health check with DB and Redis status |
| `/health/live` | Kubernetes liveness probe (app is running) |
| `/health/ready` | Kubernetes readiness probe (dependencies ready) |

```bash
# Quick checks
curl http://localhost:8000/health
curl http://localhost:8000/health/live
curl http://localhost:8000/health/ready
```

**Status Values**: `healthy`, `degraded`, `unhealthy`
