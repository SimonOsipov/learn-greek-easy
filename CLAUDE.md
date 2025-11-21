# Learn Greek Easy - Project Configuration & Conventions

**Last Updated**: 2025-11-21
**Purpose**: Document project-specific configurations, conventions, and commands that AI assistants should follow

---

## Poetry Configuration

### Poetry Installation
- **Poetry Path**: `/Users/samosipov/.local/bin/poetry`
- **Python Version**: 3.14+
- **Backend Directory**: `/Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-backend`

### Running Poetry Commands

**CRITICAL**: Always use the full poetry path and change to the backend directory first.

**Command Pattern**:
```bash
cd /Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-backend && /Users/samosipov/.local/bin/poetry run <command>
```

**Examples**:
```bash
# Run Python scripts
cd /Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-backend && /Users/samosipov/.local/bin/poetry run python scripts/verify_migration.py

# Run Alembic commands
cd /Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-backend && /Users/samosipov/.local/bin/poetry run alembic upgrade head

# Run FastAPI server
cd /Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-backend && /Users/samosipov/.local/bin/poetry run uvicorn src.main:app --reload

# Run tests
cd /Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-backend && /Users/samosipov/.local/bin/poetry run pytest

# Install dependencies
cd /Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-backend && /Users/samosipov/.local/bin/poetry install

# Add new dependency
cd /Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-backend && /Users/samosipov/.local/bin/poetry add <package>
```

**DO NOT use**:
- ❌ `poetry run <command>` (without full path and cd)
- ❌ `python <script>` (without poetry run)
- ❌ Relative paths from wrong directory

---

## Docker Configuration

### Docker Compose Approach

**IMPORTANT**: This project uses a **single, centralized docker-compose.yml** at the repository root.

**Docker Compose Location**: `/Users/samosipov/Downloads/learn-greek-easy/docker-compose.yml`

### Architecture

```
learn-greek-easy/
├── docker-compose.yml           ← SINGLE SOURCE OF TRUTH
├── learn-greek-easy-frontend/   ← Frontend service
├── learn-greek-easy-backend/    ← Backend service (NO docker-compose.yml here)
└── .claude/
```

### Services Defined

**Current Services**:
1. **frontend**: React/Vite application (production build)
   - Port: 80:80
   - Container: learn-greek-easy-frontend
   - Network: learn-greek-network

2. **postgres**: PostgreSQL 16 Alpine
   - Port: 5432:5432
   - Container: learn-greek-postgres
   - Database: learn_greek_easy
   - User: postgres
   - Password: postgres
   - Volume: postgres_data (persistent)
   - Network: learn-greek-network

**Future Services** (to be added):
- Backend API service (FastAPI)
- Redis (for caching and Celery)
- Celery workers (background tasks)

### Docker Commands

**Start all services**:
```bash
cd /Users/samosipov/Downloads/learn-greek-easy && docker-compose up -d
```

**Start specific service**:
```bash
cd /Users/samosipov/Downloads/learn-greek-easy && docker-compose up -d postgres
```

**Stop all services**:
```bash
cd /Users/samosipov/Downloads/learn-greek-easy && docker-compose down
```

**View logs**:
```bash
cd /Users/samosipov/Downloads/learn-greek-easy && docker-compose logs -f postgres
```

**Connect to PostgreSQL**:
```bash
docker exec -it learn-greek-postgres psql -U postgres -d learn_greek_easy
```

**Check running containers**:
```bash
docker ps --filter "name=learn-greek"
```

### Docker Conventions

1. **No Duplicate docker-compose.yml Files**
   - If a service-specific docker-compose.yml is needed temporarily, merge it into the root file
   - Delete duplicate files after merging

2. **Shared Network**
   - All services use `learn-greek-network` bridge network
   - This allows inter-service communication

3. **Named Volumes**
   - Use named volumes for persistence (e.g., `postgres_data`)
   - Volume names should be prefixed: `learn-greek-easy-*`

4. **Container Naming**
   - Prefix all containers: `learn-greek-*`
   - Examples: `learn-greek-postgres`, `learn-greek-frontend`, `learn-greek-backend`

5. **Health Checks**
   - All services should have health checks defined
   - PostgreSQL: `pg_isready -U postgres`
   - Frontend: HTTP check on `/health` endpoint

---

## Database Configuration

### PostgreSQL Connection

**Database Details**:
- Host: localhost (or learn-greek-postgres from containers)
- Port: 5432
- Database: learn_greek_easy
- User: postgres
- Password: postgres
- Encoding: UTF-8
- Locale: en_US.UTF-8

**Connection Strings** (from backend config):
- **Async**: `postgresql+asyncpg://postgres:postgres@localhost:5432/learn_greek_easy`
- **Sync** (for Alembic): `postgresql://postgres:postgres@localhost:5432/learn_greek_easy`

### Extensions Required
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
```

---

## Development Workflow

### Backend Development

1. **Start PostgreSQL**:
   ```bash
   cd /Users/samosipov/Downloads/learn-greek-easy && docker-compose up -d postgres
   ```

2. **Run migrations**:
   ```bash
   cd /Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-backend && /Users/samosipov/.local/bin/poetry run alembic upgrade head
   ```

3. **Start backend server**:
   ```bash
   cd /Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-backend && /Users/samosipov/.local/bin/poetry run uvicorn src.main:app --reload
   ```

### Frontend Development

1. **Start frontend container**:
   ```bash
   cd /Users/samosipov/Downloads/learn-greek-easy && docker-compose up -d frontend
   ```

2. **Access**: http://localhost:80

### Running Tests

```bash
# Backend tests
cd /Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-backend && /Users/samosipov/.local/bin/poetry run pytest

# With coverage
cd /Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-backend && /Users/samosipov/.local/bin/poetry run pytest --cov=src tests/
```

---

## Common Issues & Solutions

### Issue: "poetry: command not found"
**Solution**: Use full path `/Users/samosipov/.local/bin/poetry`

### Issue: "No module named 'src'"
**Solution**: Always run from backend directory and use `poetry run`

### Issue: "Database connection refused"
**Solution**: Ensure PostgreSQL container is running:
```bash
docker ps --filter "name=learn-greek-postgres"
```

### Issue: "Multiple docker-compose.yml files"
**Solution**: Always use root docker-compose.yml, merge and delete duplicates

### Issue: "Alembic can't find models"
**Solution**: Ensure all models are imported in `alembic/env.py`

---

## File Structure

```
learn-greek-easy/
├── docker-compose.yml                    ← Single source of truth
├── .claude/
│   ├── PROJECT.md                        ← This file
│   └── 01-MVP/
│       ├── All-Tasks-Progress.md
│       ├── backend/
│       │   ├── Backend-Tasks-Progress.md
│       │   └── 02/
│       │       ├── 02.02-database-models-plan.md
│       │       ├── 02.03-postgresql-enums-alembic-plan.md
│       │       └── 02.04-initial-migration-plan.md
│       └── frontend/
├── learn-greek-easy-frontend/
│   ├── Dockerfile
│   └── ...
└── learn-greek-easy-backend/
    ├── pyproject.toml                    ← Poetry config
    ├── poetry.lock
    ├── alembic/
    │   ├── versions/
    │   │   └── 20251121_1629_8e2ce3fe8e88_initial_schema_with_users_decks_cards_.py
    │   ├── env.py
    │   └── alembic.ini
    ├── src/
    │   ├── main.py
    │   ├── config.py
    │   ├── db/
    │   │   ├── models.py
    │   │   ├── base.py
    │   │   ├── session.py
    │   │   └── dependencies.py
    │   └── ...
    └── scripts/
        ├── verify_alembic_config.py
        └── verify_migration.py
```

---

## Quick Reference

### Most Common Commands

```bash
# Start PostgreSQL
cd /Users/samosipov/Downloads/learn-greek-easy && docker-compose up -d postgres

# Run migration
cd /Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-backend && /Users/samosipov/.local/bin/poetry run alembic upgrade head

# Start backend dev server
cd /Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-backend && /Users/samosipov/.local/bin/poetry run uvicorn src.main:app --reload --port 8000

# Connect to database
docker exec -it learn-greek-postgres psql -U postgres -d learn_greek_easy

# Check alembic status
cd /Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-backend && /Users/samosipov/.local/bin/poetry run alembic current

# Run verification scripts
cd /Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-backend && /Users/samosipov/.local/bin/poetry run python scripts/verify_migration.py
```

---

## Notes for AI Assistants

When working on this project:

1. **Always use full poetry path**: `/Users/samosipov/.local/bin/poetry`
2. **Always cd to backend first** before running poetry commands
3. **Use root docker-compose.yml** for all Docker operations
4. **Never create duplicate docker-compose.yml files** in subdirectories
5. **Consolidate configurations** into the root docker-compose.yml if needed
6. **Follow naming conventions**:
   - Containers: `learn-greek-*`
   - Networks: `learn-greek-network`
   - Volumes: `learn-greek-easy-*`
7. **Check this file first** before making assumptions about project structure or commands

---

**Document Version**: 1.0
**Created**: 2025-11-21
**Maintained By**: Project team and AI assistants
