# Logging Architecture

This document describes the logging infrastructure for the Learn Greek Easy backend.

## Overview

The backend uses [Loguru](https://github.com/Delgan/loguru) for structured logging with automatic context propagation. All logs are sent to Sentry Logs for centralized observability.

### Key Features

- **Consistent logging** via `get_logger(__name__)` pattern
- **Automatic context propagation** for request_id and user_id
- **Sentry Logs integration** for centralized log aggregation
- **JSON format** in production for log parsing
- **Colorized format** in development for readability

## Quick Start

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

## Context Propagation

Request-scoped context (like `request_id` and `user_id`) is automatically included in all logs without explicit passing.

### How It Works

1. **RequestLoggingMiddleware** binds `request_id` at the start of each request
2. **get_current_user dependency** binds `user_id` after authentication
3. All loggers created with `get_logger()` automatically include this context
4. Context is cleared at the end of each request

### Binding Custom Context

```python
from src.core.logging import bind_log_context, clear_log_context

# Bind additional context
bind_log_context(operation="bulk_import", batch_size=100)

# Later logs will include operation and batch_size
logger.info("Starting batch")  # Includes request_id, user_id, operation, batch_size

# Clear context when done (usually handled by middleware)
clear_log_context()
```

## Module Structure

### `src/core/logging.py`

Main logging configuration:

| Function | Description |
|----------|-------------|
| `get_logger(name)` | Get a contextualized logger instance |
| `setup_logging()` | Configure loguru based on environment |
| `bind_log_context(**kwargs)` | Bind context for all logs in current request |
| `clear_log_context()` | Clear context (called by middleware) |
| `get_log_context()` | Get current context dictionary |
| `intercept_standard_logging()` | Route stdlib logging to loguru |

### Configuration

Logging is configured via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | `INFO` | Minimum log level (DEBUG, INFO, WARNING, ERROR) |
| `APP_ENV` | `development` | Affects format (production = JSON, development = colorized) |

## Sentry Integration

Logs are automatically sent to Sentry when `SENTRY_DSN` is configured.

### Log Level Mapping

| Action | Log Level |
|--------|-----------|
| Sent to Sentry Logs | INFO and above |
| Added as breadcrumbs | INFO and above |
| Creates Sentry events | ERROR and above |

### Configuration in `src/core/sentry.py`

```python
LoguruIntegration(
    sentry_logs_level=LoggingLevels.INFO.value,  # INFO+ to Sentry Logs
    level=LoggingLevels.INFO.value,              # INFO+ as breadcrumbs
    event_level=LoggingLevels.ERROR.value,       # ERROR+ creates events
)
```

## Best Practices

### DO

```python
# Use get_logger with __name__
logger = get_logger(__name__)

# Use structured logging with extra parameters
logger.info("User logged in", user_id=user.id, method="email")

# Use appropriate log levels
logger.debug("Detailed trace info")
logger.info("Normal operation")
logger.warning("Something unexpected but handled")
logger.error("Something failed")
logger.exception("Exception with traceback")

# Let context propagation work
# request_id and user_id are automatically included
logger.info("Processing order", order_id=order.id)
```

### DON'T

```python
# Don't use standard logging module
import logging  # Wrong!
logger = logging.getLogger(__name__)

# Don't use f-strings for log messages
logger.info(f"User {user.id} logged in")  # Wrong! Loses structure

# Don't log sensitive data
logger.info("Login", password=password)  # Never log passwords!
logger.info("Token", jwt_token=token)    # Never log tokens!

# Don't forget to import from src.core.logging
from loguru import logger  # Wrong! Won't have context
```

## Log Output Examples

### Development (Colorized)

```
2024-01-15 10:30:45 | INFO     | src.api.v1.auth:login:42 - User logged in
```

### Production (JSON)

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

## Debugging

### Check Current Context

```python
from src.core.logging import get_log_context

# See what context is currently bound
context = get_log_context()
print(context)  # {'request_id': 'abc123', 'user_id': 'user-456'}
```

### Enable Debug Logging

Set `LOG_LEVEL=DEBUG` in environment or `.env` file.

### View Logs in Sentry

1. Go to Sentry dashboard
2. Navigate to "Logs" section
3. Filter by environment, level, or search log messages
4. Click on a log to see full context including request_id and user_id

## Background Tasks / Scheduled Jobs

Files like `src/tasks/scheduler.py` and `src/tasks/scheduled.py` run outside HTTP request context. They won't have `request_id` or `user_id` automatically bound.

For these tasks, consider binding a `task_id` or `job_id`:

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
        logger.info("Task completed")
    finally:
        clear_log_context()
```

## Migration Guide

If you're updating a file that still uses `logging.getLogger(__name__)`:

### Before

```python
import logging

logger = logging.getLogger(__name__)
```

### After

```python
from src.core.logging import get_logger

logger = get_logger(__name__)
```

**Note**: If the file also uses `logging.ERROR` or other constants, keep the `import logging` but still switch to `get_logger` for the logger instance.

---

# Frontend Logging

This section describes the logging infrastructure for the Learn Greek Easy frontend.

## Overview

The frontend uses [loglevel](https://github.com/pimterry/loglevel) for structured logging with Sentry Logs integration. Logs are sent to Sentry for centralized observability alongside the backend.

### Key Features

- **Consistent logging** via the default `log` export
- **Environment-aware log levels** (debug in dev, warn in prod)
- **Sentry Logs integration** for searchable logs in Sentry
- **Dual approach for errors**: Sentry Logs + Sentry Issues for alerting
- **Deferred Sentry loading** for better LCP performance

## Quick Start

```typescript
// Default import (recommended)
import log from '@/lib/logger';

// Basic logging
log.debug('Debugging info', { data });
log.info('User action completed');
log.warn('Deprecated feature used');
log.error('Failed to fetch', error);

// Named imports for convenience
import { info, error } from '@/lib/logger';

info('Component mounted');
error('API call failed', err);
```

## Log Level Mapping

### Development Mode

| Log Method | Console Output | Sentry |
|------------|----------------|--------|
| `trace()` | Yes | No |
| `debug()` | Yes | No |
| `info()` | Yes | No |
| `warn()` | Yes | No |
| `error()` | Yes | No |

### Production Mode

| Log Method | Console Output | Sentry Logs | Sentry Issues | Breadcrumbs |
|------------|----------------|-------------|---------------|-------------|
| `trace()` | Yes | No | No | No |
| `debug()` | Yes | No | No | No |
| `info()` | Yes | Yes | No | Yes |
| `warn()` | Yes | Yes | No | Yes |
| `error()` | Yes | Yes | Yes (alert) | Yes |

### Dual Approach for Errors

Errors use a dual approach:
1. **Sentry Logs**: For searching and correlation with other logs
2. **Sentry Issues**: For alerting and tracking (creates actionable tickets)
3. **Breadcrumbs**: For context in error reports

This ensures errors are both searchable in logs AND trigger alerts.

## Module Structure

### `src/lib/logger.ts`

Main logger configuration using loglevel with custom method factory.

### `src/lib/sentry-queue.ts`

Handles deferred Sentry initialization for better performance:

| Function | Description |
|----------|-------------|
| `queueException(error, context)` | Queue an exception for Sentry capture |
| `queueMessage(message, level)` | Queue a message for Sentry capture |
| `queueBreadcrumb(breadcrumb)` | Queue a breadcrumb for Sentry |
| `queueLog(level, message)` | Queue a log for Sentry Logs |
| `initSentryAsync()` | Initialize Sentry and flush queued items |
| `isSentryLoaded()` | Check if Sentry is ready |

### `src/instrument.ts`

Sentry SDK initialization with `enableLogs: true` for Sentry Logs support.

## Best Practices

### DO

```typescript
// Use the logger from @/lib/logger
import log from '@/lib/logger';

// Use appropriate log levels
log.debug('Detailed trace info');
log.info('Normal operation');
log.warn('Something unexpected but handled');
log.error('Something failed');

// Include useful context
log.info('User action', { action: 'login', userId: user.id });

// Log errors with details
log.error('API call failed', { endpoint, status, error: err.message });
```

### DON'T

```typescript
// Don't use console directly (bypasses Sentry integration)
console.log('Debug info');  // Wrong!
console.error('Error');     // Wrong!

// Don't log sensitive data
log.info('Login', { password });  // Never log passwords!
log.info('Auth', { token });      // Never log tokens!
log.info('User', { email });      // Never log PII!

// Don't use verbose logging in production-critical paths
// (info and above are sent to Sentry)
log.info('Loop iteration', { i });  // Wrong! Too verbose
```

## Runtime Level Adjustment

In development, you can adjust the log level:

```typescript
import log from '@/lib/logger';

log.setLevel('trace'); // Show all logs
log.setLevel('error'); // Only errors
log.setLevel('silent'); // Disable all logs
```

## Debugging

### Check Current Log Level

```typescript
import log from '@/lib/logger';

console.log('Current level:', log.getLevel());
// 0 = trace, 1 = debug, 2 = info, 3 = warn, 4 = error, 5 = silent
```

### View Logs in Sentry

1. Go to Sentry dashboard
2. Navigate to "Logs" section
3. Filter by environment, level, or search log messages
4. Logs from frontend will have `environment: 'production'`

### Correlating Frontend and Backend Logs

Both frontend and backend logs go to the same Sentry project. You can:
1. Search by timestamp to find related logs
2. Use Sentry's trace context (when available) to correlate requests
3. Filter by environment to separate frontend/backend logs

## Deferred Loading

Sentry is loaded asynchronously after React's first paint to improve LCP performance:

1. **Before Sentry loads**: Logs are queued in memory (max 50 items)
2. **After Sentry loads**: Queued items are flushed to Sentry
3. **Runtime**: Logs are sent to Sentry immediately

This ensures no logs are lost during the pre-Sentry window while keeping initial load fast.
