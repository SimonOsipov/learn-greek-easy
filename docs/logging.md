# Logging Architecture

Logging infrastructure for both backend and frontend.

## Backend

### Overview

The backend uses [Loguru](https://github.com/Delgan/loguru) for structured logging with automatic context propagation. All logs are sent to Sentry Logs for centralized observability.

- **JSON format** in production (stdout), **colorized** in development (stderr)
- **Automatic context propagation** for `request_id` and `user_id`
- **Sentry Logs integration** for centralized log aggregation

### Quick Start

```python
from src.core.logging import get_logger

logger = get_logger(__name__)

# Basic logging
logger.info("Processing request")

# With additional context
logger.info("User action", action="login", user_id=user.id)

# Error with exception
try:
    do_something()
except Exception as e:
    logger.exception("Operation failed", operation="do_something")
```

### Context Propagation

Request-scoped context is automatically included in all logs:

1. **RequestLoggingMiddleware** binds `request_id` at the start of each request
2. **`get_current_user` dependency** binds `user_id` after authentication
3. All loggers created with `get_logger()` automatically include this context
4. Context is cleared at the end of each request

```python
from src.core.logging import bind_log_context

# Bind additional context for current request
bind_log_context(operation="bulk_import", batch_size=100)

# All subsequent logs include operation and batch_size
logger.info("Starting batch")  # Includes request_id, user_id, operation, batch_size
```

### RequestLoggingMiddleware

Pure ASGI middleware (not `BaseHTTPMiddleware`) that handles request logging:

- **Request ID**: Generates 8-character UUID short IDs, added as `X-Request-ID` response header
- **Excluded paths**: `/health/live`, `/docs`, `/redoc`, `/openapi.json`, `/favicon.ico`
- **Request logging**: method, path, query params, client IP, user agent
- **Response logging**: status code, duration in ms
- **Status-based log levels**: 5xx → ERROR, 4xx → WARNING, 2xx/3xx → INFO
- **Sensitive data redaction**:
  - Headers: `authorization`, `cookie`, `x-api-key`, `x-test-seed-secret`
  - Body fields: `password`, `token`, `secret`, `api_key`, etc.
- **Sentry context**: Sets request tags via `set_request_context(request_id, path)`

### Module Structure (`src/core/logging.py`)

| Function | Description |
|----------|-------------|
| `get_logger(name)` | Get a contextualized logger instance |
| `setup_logging()` | Configure loguru based on environment |
| `bind_log_context(**kwargs)` | Bind context for all logs in current request |
| `clear_log_context()` | Clear context (called by middleware) |
| `get_log_context()` | Get current context dictionary |
| `intercept_standard_logging()` | Route stdlib logging to loguru |

### Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | `INFO` | Minimum log level (DEBUG, INFO, WARNING, ERROR) |
| `app_env` | `development` | Affects format (production = JSON to stdout, development = colorized to stderr) |

### Sentry Integration

| Action | Log Level |
|--------|-----------|
| Sent to Sentry Logs | INFO and above |
| Added as breadcrumbs | INFO and above |
| Creates Sentry events | ERROR and above |

```python
LoguruIntegration(
    sentry_logs_level=LoggingLevels.INFO.value,  # INFO+ to Sentry Logs
    level=LoggingLevels.INFO.value,              # INFO+ as breadcrumbs
    event_level=LoggingLevels.ERROR.value,       # ERROR+ creates events
)
```

### Log Output Examples

**Development (colorized, stderr):**
```
2024-01-15 10:30:45 | INFO     | src.api.v1.auth:login:42 - User logged in
```

**Production (JSON, stdout):**
```json
{
  "text": "User logged in",
  "record": {
    "level": {"name": "INFO"},
    "name": "src.api.v1.auth",
    "function": "login",
    "line": 42,
    "extra": {
      "request_id": "abc12345",
      "user_id": "550e8400-e29b-41d4-a716-446655440000"
    }
  }
}
```

### Background Tasks

Tasks in `src/tasks/` run outside HTTP request context — no automatic `request_id` or `user_id`. Bind a `task_id` manually:

```python
from src.core.logging import bind_log_context, clear_log_context, get_logger

logger = get_logger(__name__)

async def scheduled_task():
    import uuid
    task_id = str(uuid.uuid4())[:8]
    bind_log_context(task_id=task_id)
    try:
        logger.info("Starting scheduled task")
        # ... task logic ...
    finally:
        clear_log_context()
```

### Best Practices

**DO:**
```python
logger = get_logger(__name__)                              # Use get_logger
logger.info("User logged in", user_id=user.id, method="email")  # Structured params
logger.exception("Operation failed")                       # Exception with traceback
```

**DON'T:**
```python
import logging; logger = logging.getLogger(__name__)  # Wrong — no context
logger.info(f"User {user.id} logged in")              # Wrong — loses structure
logger.info("Login", password=password)                # Never log secrets
from loguru import logger                              # Wrong — no context binding
```

### Migration Guide

If updating a file that still uses `logging.getLogger(__name__)`:

```python
# Before
import logging
logger = logging.getLogger(__name__)

# After
from src.core.logging import get_logger
logger = get_logger(__name__)
```

---

## Frontend

### Overview

The frontend uses [loglevel](https://github.com/pimterry/loglevel) with Sentry Logs integration. Sentry is loaded asynchronously after React's first paint for better LCP.

### Quick Start

```typescript
import log from '@/lib/logger';

log.debug('Debugging info', { data });
log.info('User action completed');
log.warn('Deprecated feature used');
log.error('Failed to fetch', error);
```

### Log Level Behavior

**Development** (default level: `debug`):

| Log Method | Console Output | Sentry |
|------------|----------------|--------|
| `trace()` | No (below threshold) | No |
| `debug()` | Yes | No |
| `info()` | Yes | No |
| `warn()` | Yes | No |
| `error()` | Yes | No |

**Production** (default level: `warn`):

| Log Method | Console Output | Sentry Logs | Breadcrumbs |
|------------|----------------|-------------|-------------|
| `trace()` | No | No | No |
| `debug()` | No | No | No |
| `info()` | No | No | No |
| `warn()` | Yes | Yes | Yes |
| `error()` | Yes | Yes | Yes |

> **Note:** `log.error()` sends to Sentry Logs and adds breadcrumbs, but does NOT create Sentry Issues directly. Sentry Issues are created by error boundaries and global error handlers via `captureException()`.

### Deferred Sentry Loading

Sentry is loaded asynchronously after first paint:

1. **Before Sentry loads**: Logs queued in memory (max 50 items)
2. **After Sentry loads**: Queued items flushed to Sentry
3. **Runtime**: Logs sent to Sentry immediately

### Module Structure

| File | Purpose |
|------|---------|
| `src/lib/logger.ts` | loglevel configuration with custom method factory |
| `src/lib/sentry-queue.ts` | Deferred Sentry init, queuing (`queueException`, `queueMessage`, `queueBreadcrumb`, `queueLog`, `initSentryAsync`, `isSentryLoaded`, `getSentry`) |
| `src/instrument.ts` | Sentry SDK initialization with `enableLogs: true` |

### Best Practices

**DO:**
```typescript
import log from '@/lib/logger';
log.info('User action', { action: 'login', userId: user.id });
log.error('API call failed', { endpoint, status, error: err.message });
```

**DON'T:**
```typescript
console.log('Debug info');              // Bypasses Sentry integration
log.info('Login', { password });        // Never log passwords
log.info('Auth', { token });            // Never log tokens
log.info('User', { email });            // Never log PII
log.info('Loop iteration', { i });      // Too verbose for info level
```
