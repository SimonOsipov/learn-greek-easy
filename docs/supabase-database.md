# Supabase Database

## Overview

Learn Greek Easy uses Supabase as the managed PostgreSQL provider for both development and production environments. This document covers database connectivity, configuration, and migration from the previous Railway setup.

**Key Details:**
- **Database Engine**: PostgreSQL 17.6 (aarch64-unknown-linux-gnu)
- **Connection Pooler**: Supavisor (session-mode)
- **Primary Extension**: pgvector 0.8.0 for embedding storage and similarity search
- **Security**: TLS 1.3 encryption for all connections

## Connection Modes

Supabase provides multiple connection modes via Supavisor pooler. The correct mode is critical for compatibility.

| Connection Mode | Port | IPv4 Support | Prepared Statements | Application Pooling | Status |
|-----------------|------|--------------|---------------------|---------------------|--------|
| Direct Connection | 5432 | ❌ IPv6 only | ✅ Yes | ✅ Yes | **REJECTED** (Railway hosting incompatible with IPv6) |
| Transaction Mode | 6543 | ✅ Yes | ❌ No | ❌ No | **REJECTED** (Breaks asyncpg prepared statements) |
| Session Mode | 5432 | ✅ Yes | ✅ Yes | ✅ Yes | **SELECTED** (Full compatibility) |

**Selected Mode**: Session-mode pooler at port 5432 provides full IPv4 support, prepared statement compatibility (required by asyncpg), and allows application-side connection pooling.

## Connection String Format

### Template

```
postgresql+asyncpg://postgres.{PROJECT_REF}:{DB_PASSWORD}@aws-0-eu-central-1.pooler.supabase.com:5432/postgres
```

### Component Breakdown

| Component | Value | Description |
|-----------|-------|-------------|
| Driver | `postgresql+asyncpg` | SQLAlchemy async driver for PostgreSQL |
| Username | `postgres.{PROJECT_REF}` | Supabase project-specific username |
| Password | `{DB_PASSWORD}` | Database password (from Railway env vars) |
| Host | `aws-0-eu-central-1.pooler.supabase.com` | Supavisor session-mode pooler endpoint |
| Port | `5432` | Session-mode pooler port |
| Database | `postgres` | Default Supabase database name |

### Environment-Specific Connection Strings

**Development Environment:**
```
postgresql+asyncpg://postgres.nyiyljmtbnvykbpdjfjq:{DB_PASSWORD}@aws-0-eu-central-1.pooler.supabase.com:5432/postgres
```

**Production Environment:**
```
postgresql+asyncpg://postgres.qduwfsuybkqsginndguz:{DB_PASSWORD}@aws-0-eu-central-1.pooler.supabase.com:5432/postgres
```

**Important**: Replace `{DB_PASSWORD}` with the actual password stored in Railway environment variables. Never commit credentials to version control.

## Pool Configuration

### Supavisor Pool Settings

Both dev and prod environments are configured with identical pooler settings:

| Setting | Value | Notes |
|---------|-------|-------|
| Pool Size | 30 | Maximum concurrent connections via pooler |
| Pool Mode | Session | One connection per client session |
| Default Pool Size | 15 | Supabase default (overridden to 30) |

### Application Pool Configuration

Application-side pooling (SQLAlchemy + asyncpg) is configured in `/home/dev/learn-greek-easy/learn-greek-easy-backend/src/database.py`:

```python
engine = create_async_engine(
    settings.database_url,
    pool_size=20,        # Base pool size
    max_overflow=10,     # Additional connections on demand
    # Total: 30 max connections (matches Supavisor pool_size)
)
```

### Connection Budget

Supabase PostgreSQL instances have a limited connection budget. Configuration rationale:

| Resource | Limit | Usage | Available | Notes |
|----------|-------|-------|-----------|-------|
| Max Connections | 60 | ~10 (internal) | ~50 | PostgreSQL max_connections setting |
| Supavisor Pool | 30 | 0-30 | 30 | Configured pool_size |
| Application Pool | 30 | 0-30 | 30 | pool_size (20) + max_overflow (10) |
| Buffer | 20 | 0 | 20 | Reserved for admin, monitoring, migrations |

**Strategy**: Application pool (30) matches Supavisor pool (30) to use 50% of total database capacity, leaving buffer for:
- Database admin tools (psql, Supabase Dashboard)
- Alembic migrations
- Monitoring and health checks
- Connection spike absorption

## Extensions

The following PostgreSQL extensions are enabled on both environments:

| Extension | Version | Schema | Purpose |
|-----------|---------|--------|---------|
| `vector` | 0.8.0 | `public` | Embedding storage and similarity search (pgvector) |
| `uuid-ossp` | 1.1 | `public` | UUID generation functions |
| `pgcrypto` | 1.3 | `public` | Cryptographic functions |
| `plpgsql` | 1.0 | `pg_catalog` | Procedural language (default) |

### Extension Schema Consideration

Supabase installs extensions in the `public` schema by default, not the `extensions` schema. However, the `search_path` includes both schemas:

```sql
SHOW search_path;
-- Result: "$user", public, extensions
```

**Implication**: Vector type (`vector`) is accessible without schema qualification. Existing code using `::vector` continues to work without modification.

### Verifying pgvector Functionality

```sql
-- Test vector type creation
SELECT '[1,2,3]'::vector AS test_vector;

-- Test vector dimensions
SELECT vector_dims('[1,2,3]'::vector) AS dims;

-- Test cosine similarity
SELECT 1 - ('[1,2,3]'::vector <=> '[1,2,3]'::vector) AS similarity;
```

## Environment Variables

### Required Railway Environment Variables

Set in Railway dashboard for each environment (dev and prod):

| Variable | Format | Example | Notes |
|----------|--------|---------|-------|
| `DATABASE_URL` | `postgresql+asyncpg://...` | See connection string format | Async driver for application |

**Security**: Database passwords are stored ONLY in Railway environment variables. Never commit credentials to git or hardcode in application code.

### Auto-Derived Configuration

The following configuration is automatically derived by `/home/dev/learn-greek-easy/learn-greek-easy-backend/src/config.py`:

```python
@property
def database_url_sync(self) -> str:
    """Get synchronous database URL (for Alembic)."""
    return self.database_url.replace("+asyncpg", "")
```

**Result**: `database_url_sync` is derived from `DATABASE_URL` by removing the `+asyncpg` driver suffix, producing `postgresql://...` for Alembic and psycopg2 compatibility.

## Alembic Migration Path

Alembic uses a synchronous database connection via psycopg2 (not asyncpg). The migration path is:

1. **Configuration** (`/home/dev/learn-greek-easy/learn-greek-easy-backend/src/config.py` line 637-639):
   - `database_url_sync` derived from `DATABASE_URL` (removes `+asyncpg`)

2. **Alembic Environment** (`/home/dev/learn-greek-easy/learn-greek-easy-backend/alembic/env.py` line 60):
   ```python
   config.set_main_option("sqlalchemy.url", settings.database_url_sync)
   ```

3. **Engine Creation** (`/home/dev/learn-greek-easy/learn-greek-easy-backend/alembic/env.py` lines 142-146):
   ```python
   connectable = engine_from_config(
       config.get_section(config.config_ini_section, {}),
       prefix="sqlalchemy.",
       poolclass=pool.NullPool,  # No pooling for migrations
   )
   ```

**Result**: Alembic uses synchronous psycopg2 driver with no connection pooling (NullPool), connecting via the same session-mode pooler endpoint.

### pgvector Index Filtering

Alembic autogenerate ignores pgvector IVFFlat indexes to prevent false positives during `alembic check`. Filter is defined in `/home/dev/learn-greek-easy/learn-greek-easy-backend/alembic/env.py` (lines 96-119):

```python
def include_name(name: str | None, type_: str, parent_names: dict) -> bool:
    """Filter to exclude certain indexes from Alembic comparison."""
    if type_ == "index" and name is not None:
        # Exclude pgvector embedding indexes (created via raw SQL in migration)
        if name.startswith("idx_") and "embedding" in name:
            return False
        # ... other exclusions
    return True
```

**Reason**: pgvector IVFFlat indexes are created via raw SQL (not SQLAlchemy model metadata) and cannot be represented in model definitions. Excluding them prevents Alembic from detecting them as missing.

## Migration Notes from Railway

Key differences when migrating from Railway PostgreSQL:

| Aspect | Railway | Supabase |
|--------|---------|----------|
| Database Name | Custom (e.g., `railway`) | `postgres` (default) |
| Connection Pooler | PgBouncer | Supavisor (session mode) |
| PostgreSQL Version | Varies | 17.6 (standardized) |
| Extension Schema | `public` | `public` (default) |
| IPv6 Support | Not required | Direct connection is IPv6-only (use pooler) |
| SSL/TLS | TLS 1.2/1.3 | TLS 1.3 (verified) |

**Application Code Impact**: Minimal. Connection string changes only. Application code using `::vector` type remains unchanged.

## Troubleshooting

### "type vector does not exist"

**Cause**: pgvector extension not enabled or not in search_path.

**Solution**:
```sql
-- Verify extension is enabled
SELECT * FROM pg_extension WHERE extname = 'vector';

-- Check search_path includes 'public' or 'extensions'
SHOW search_path;

-- If needed, set search_path
SET search_path TO "$user", public, extensions;
```

### Connection Timeout or Pool Exhausted

**Cause**: Supavisor pool_size too small for application connection demand.

**Solution**:
1. Check Supabase Dashboard → Database → Connection Pooling → Session Mode → Pool Size
2. Increase if needed (currently 30)
3. Verify application pool (pool_size + max_overflow) does not exceed Supavisor pool_size

### Prepared Statement Errors (asyncpg)

**Cause**: Using transaction-mode pooler (port 6543) instead of session-mode (port 5432).

**Solution**:
1. Verify connection string uses port 5432 (session mode)
2. Check endpoint: `aws-0-eu-central-1.pooler.supabase.com:5432`
3. Transaction mode (port 6543) does NOT support prepared statements

### SSL/TLS Verification Errors

**Cause**: SSL mode mismatch or certificate verification issues.

**Solution**:
```sql
-- Verify SSL is active and using TLS 1.3
SELECT pid, ssl, version FROM pg_stat_ssl WHERE pid = pg_backend_pid();
-- Expected: ssl=true, version=TLSv1.3
```

Supavisor connections use SSL by default. No additional `sslmode` parameter needed in connection string.

### IPv6 Connection Errors

**Cause**: Attempting to use direct connection (IPv6-only) on IPv4-only infrastructure (Railway).

**Solution**:
1. Always use pooler endpoint: `aws-0-eu-central-1.pooler.supabase.com`
2. Never use direct connection endpoint (db.{PROJECT_REF}.supabase.co)
3. Session-mode pooler supports IPv4

### "max_connections" Limit Reached

**Cause**: Total active connections exceed PostgreSQL max_connections (60).

**Solution**:
1. Check active connections:
   ```sql
   SELECT count(*) FROM pg_stat_activity;
   ```
2. Identify idle connections:
   ```sql
   SELECT pid, usename, state, state_change
   FROM pg_stat_activity
   WHERE state = 'idle'
   ORDER BY state_change;
   ```
3. Terminate long-idle connections if needed:
   ```sql
   SELECT pg_terminate_backend(pid)
   FROM pg_stat_activity
   WHERE state = 'idle'
   AND state_change < NOW() - INTERVAL '10 minutes';
   ```

## Testing Database Connectivity

### psql CLI Test

```bash
# Development environment
psql "postgresql://postgres.nyiyljmtbnvykbpdjfjq:{DB_PASSWORD}@aws-0-eu-central-1.pooler.supabase.com:5432/postgres"

# Production environment
psql "postgresql://postgres.qduwfsuybkqsginndguz:{DB_PASSWORD}@aws-0-eu-central-1.pooler.supabase.com:5432/postgres"

# Verify connectivity
\conninfo
SELECT version();
SELECT current_database();
\dx  -- List extensions
```

### Python asyncpg Test

```python
import asyncpg
import asyncio

async def test_connection():
    conn = await asyncpg.connect(
        "postgresql://postgres.{PROJECT_REF}:{DB_PASSWORD}@aws-0-eu-central-1.pooler.supabase.com:5432/postgres"
    )

    # Test basic query
    version = await conn.fetchval("SELECT version()")
    print(f"PostgreSQL: {version}")

    # Test pgvector
    result = await conn.fetchval("SELECT '[1,2,3]'::vector")
    print(f"Vector test: {result}")

    # Test prepared statement
    result = await conn.fetchval("SELECT $1::int + $2::int", 10, 20)
    print(f"Prepared statement test: {result}")

    await conn.close()

asyncio.run(test_connection())
```

### SQLAlchemy Sync Engine Test (Alembic Path)

```python
from sqlalchemy import create_engine, pool, text

# Test synchronous engine (matches Alembic configuration)
engine = create_engine(
    "postgresql://postgres.{PROJECT_REF}:{DB_PASSWORD}@aws-0-eu-central-1.pooler.supabase.com:5432/postgres",
    poolclass=pool.NullPool,  # Matches Alembic
)

with engine.connect() as conn:
    result = conn.execute(text("SELECT 1")).scalar()
    assert result == 1
    print("SQLAlchemy sync engine: PASS")

    version = conn.execute(text("SELECT version()")).scalar()
    print(f"PostgreSQL version: {version}")

engine.dispose()
```

## References

- Supabase Connection Pooling: https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler
- pgvector Documentation: https://github.com/pgvector/pgvector
- Alembic Documentation: https://alembic.sqlalchemy.org/
- asyncpg Documentation: https://magicstack.github.io/asyncpg/
