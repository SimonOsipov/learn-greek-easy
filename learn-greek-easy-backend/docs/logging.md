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
