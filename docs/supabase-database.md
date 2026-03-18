# Supabase Database

## Overview

Learn Greek Easy uses Supabase as the managed PostgreSQL provider for both development and production environments.

**Key Details:**
- **Database Engine**: PostgreSQL 17.6 (aarch64-unknown-linux-gnu)
- **Connection Pooler**: Supavisor (session-mode)
- **Primary Extension**: pgvector 0.8.0 for embedding storage and similarity search
- **Security**: TLS 1.3 encryption for all connections, SSL `require` in production

## Connection Modes

Supabase provides multiple connection modes via Supavisor pooler. The correct mode is critical for compatibility.

| Connection Mode | Port | IPv4 Support | Prepared Statements | Application Pooling | Status |
|-----------------|------|--------------|---------------------|---------------------|--------|
| Direct Connection | 5432 | IPv6 only | Yes | Yes | **REJECTED** (Railway hosting incompatible with IPv6) |
| Transaction Mode | 6543 | Yes | No | No | **REJECTED** (Breaks asyncpg prepared statements) |
| Session Mode | 5432 | Yes | Yes | Yes | **SELECTED** (Full compatibility) |

**Selected Mode**: Session-mode pooler at port 5432 provides full IPv4 support, prepared statement compatibility (required by asyncpg), and allows application-side connection pooling.

## Connection String Format

### Template

```
postgresql+asyncpg://postgres.{PROJECT_REF}:{DB_PASSWORD}@aws-1-eu-central-1.pooler.supabase.com:5432/postgres
```

### Component Breakdown

| Component | Value | Description |
|-----------|-------|-------------|
| Driver | `postgresql+asyncpg` | SQLAlchemy async driver for PostgreSQL |
| Username | `postgres.{PROJECT_REF}` | Supabase project-specific username |
| Password | `{DB_PASSWORD}` | Database password (from Supabase Dashboard) |
| Host | `aws-1-eu-central-1.pooler.supabase.com` | Supavisor session-mode pooler endpoint |
| Port | `5432` | Session-mode pooler port |
| Database | `postgres` | Default Supabase database name |

### Environment-Specific Connection Strings

**Development Environment:**
```
postgresql+asyncpg://postgres.nyiyljmtbnvykbpdjfjq:{DB_PASSWORD}@aws-1-eu-central-1.pooler.supabase.com:5432/postgres
```

**Production Environment:**
```
postgresql+asyncpg://postgres.qduwfsuybkqsginndguz:{DB_PASSWORD}@aws-1-eu-central-1.pooler.supabase.com:5432/postgres
```

**Important**: Replace `{DB_PASSWORD}` with the actual database password from the Supabase Dashboard. Never commit credentials to version control.

## Pool Configuration

### Supavisor Pool Settings

Both dev and prod environments are configured with identical pooler settings:

| Setting | Value | Notes |
|---------|-------|-------|
| Pool Size | 30 | Maximum concurrent connections via pooler |
| Pool Mode | Session | One connection per client session |
| Default Pool Size | 15 | Supabase default (overridden to 30) |

### Application Pool Configuration

Application-side pooling (SQLAlchemy + asyncpg) is configured in `learn-greek-easy-backend/src/db/session.py`:

```python
engine_kwargs = {
    "future": True,
    "pool_pre_ping": True,           # Verify connections before using
    "pool_recycle": 3600,            # Recycle connections after 1 hour
    "connect_args": {
        "server_settings": {"jit": "off"},  # Disable JIT for consistent perf
        "command_timeout": 60,
        # SSL require in production only
        **({"ssl": "require"} if settings.is_production else {}),
    },
}

# Production: AsyncAdaptedQueuePool with configurable limits
engine_kwargs["pool_size"] = settings.database_pool_size       # Default: 20
engine_kwargs["max_overflow"] = settings.database_max_overflow  # Default: 10
engine_kwargs["pool_timeout"] = settings.database_pool_timeout  # Default: 30

# Testing: NullPool (no connection pooling)
if settings.is_testing:
    engine_kwargs["poolclass"] = NullPool

engine = create_async_engine(settings.database_url, **engine_kwargs)
```

### Connection Budget

| Resource | Limit | Usage | Available | Notes |
|----------|-------|-------|-----------|-------|
| Max Connections | 60 | ~10 (internal) | ~50 | PostgreSQL max_connections setting |
| Supavisor Pool | 30 | 0-30 | 30 | Configured pool_size |
| Application Pool | 30 | 0-30 | 30 | pool_size (20) + max_overflow (10) |
| Buffer | 20 | 0 | 20 | Reserved for admin, monitoring, migrations |

**Strategy**: Application pool (30) matches Supavisor pool (30) to use 50% of total database capacity, leaving buffer for admin tools, Alembic migrations, monitoring, and health checks.

## Extensions

| Extension | Version | Schema | Purpose |
|-----------|---------|--------|---------|
| `vector` | 0.8.0 | `public` | Embedding storage and similarity search (pgvector) |
| `uuid-ossp` | 1.1 | `public` | UUID generation functions |
| `pgcrypto` | 1.3 | `public` | Cryptographic functions |
| `plpgsql` | 1.0 | `pg_catalog` | Procedural language (default) |

### Extension Schema Consideration

Supabase installs extensions in the `public` schema by default. The `search_path` includes both schemas:

```sql
SHOW search_path;
-- Result: "$user", public, extensions
```

Vector type (`vector`) is accessible without schema qualification.

## Environment Variables

### Required

| Variable | Format | Notes |
|----------|--------|-------|
| `DATABASE_URL` | `postgresql+asyncpg://...` | Async driver for application |

### Auto-Derived Configuration

```python
@property
def database_url_sync(self) -> str:
    """Get synchronous database URL (for Alembic)."""
    return self.database_url.replace("+asyncpg", "")
```

Produces `postgresql://...` for Alembic and psycopg2 compatibility.

## Schemas

The database uses two schemas:

| Schema | Purpose | Managed By |
|--------|---------|------------|
| `public` | Application tables (users, decks, cards, etc.) | Alembic autogenerate |
| `reference` | Read-only reference data (greek_lexicon, translations, wiktionary_morphology) | Hand-written migrations |

The `reference` schema is excluded from Alembic autogenerate to prevent false positives. See Alembic section below.

## Alembic Migration Path

Alembic uses a synchronous database connection via psycopg2 (not asyncpg).

1. **Configuration** (`config.py`):
   - `database_url_sync` derived from `DATABASE_URL` (removes `+asyncpg`)

2. **Alembic Environment** (`alembic/env.py`):
   ```python
   config.set_main_option("sqlalchemy.url", settings.database_url_sync)
   ```

3. **Engine Creation** (`alembic/env.py`):
   ```python
   connectable = engine_from_config(
       config.get_section(config.config_ini_section, {}),
       prefix="sqlalchemy.",
       poolclass=pool.NullPool,
   )
   ```

4. **Context Configuration**:
   - `compare_type=True` — detects column type changes
   - `compare_server_default=True` — detects default value changes

### Autogenerate Filters

Two filters prevent false positives during `alembic check`:

**`include_object`** — filters metadata-side objects:
```python
def include_object(object, _name, type_, _reflected, _compare_to):
    # Exclude reference-schema tables from metadata comparison
    if type_ == "table" and getattr(object, "schema", None) == "reference":
        return False
    return True
```

**`include_name`** — filters database-reflected objects:
```python
def include_name(name, type_, parent_names):
    # Exclude reference schema entirely
    if type_ == "schema" and name == "reference":
        return False
    if type_ == "table" and parent_names.get("schema_name") == "reference":
        return False
    if type_ == "index" and name is not None:
        # pgvector IVFFlat indexes (created via raw SQL)
        if name.startswith("idx_") and "embedding" in name:
            return False
        # Partial index on culture_questions.original_article_url
        if name == "ix_culture_questions_original_article_url":
            return False
        # DESC index on announcement_campaigns.created_at
        if name == "ix_announcement_campaigns_created_at":
            return False
    return True
```

## Migration Notes from Railway

Key differences from previous Railway PostgreSQL setup:

| Aspect | Railway | Supabase |
|--------|---------|----------|
| Database Name | Custom (e.g., `railway`) | `postgres` (default) |
| Connection Pooler | PgBouncer | Supavisor (session mode) |
| PostgreSQL Version | Varies | 17.6 (standardized) |
| IPv6 Support | Not required | Direct connection is IPv6-only (use pooler) |
| SSL/TLS | TLS 1.2/1.3 | TLS 1.3 (verified) |

## Troubleshooting

### "type vector does not exist"

**Cause**: pgvector extension not enabled or not in search_path.

```sql
SELECT * FROM pg_extension WHERE extname = 'vector';
SHOW search_path;
```

### Connection Timeout or Pool Exhausted

1. Check Supabase Dashboard > Database > Connection Pooling > Session Mode > Pool Size
2. Increase if needed (currently 30)
3. Verify application pool (pool_size + max_overflow) does not exceed Supavisor pool_size

### Prepared Statement Errors (asyncpg)

**Cause**: Using transaction-mode pooler (port 6543) instead of session-mode (port 5432).

1. Verify connection string uses port 5432 (session mode)
2. Check endpoint: `aws-1-eu-central-1.pooler.supabase.com:5432`
3. Transaction mode (port 6543) does NOT support prepared statements

### "max_connections" Limit Reached

```sql
-- Check active connections
SELECT count(*) FROM pg_stat_activity;

-- Find idle connections
SELECT pid, usename, state, state_change
FROM pg_stat_activity
WHERE state = 'idle'
ORDER BY state_change;
```

## References

- Supabase Connection Pooling: https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler
- pgvector Documentation: https://github.com/pgvector/pgvector
- Alembic Documentation: https://alembic.sqlalchemy.org/
- asyncpg Documentation: https://magicstack.github.io/asyncpg/
