# =============================================================================
# Learn Greek Easy - Backend Dockerfile
# Multi-stage build for production deployment
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Builder
# Install dependencies and prepare application
# -----------------------------------------------------------------------------
FROM python:3.13-slim AS builder

# Set build-time environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Poetry configuration
ENV POETRY_VERSION=1.8.0 \
    POETRY_HOME=/opt/poetry \
    POETRY_VENV=/opt/poetry-venv \
    POETRY_NO_INTERACTION=1 \
    POETRY_VIRTUALENVS_CREATE=false

WORKDIR /app

# Install system dependencies for building
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Poetry in isolated virtualenv
RUN python -m venv $POETRY_VENV \
    && $POETRY_VENV/bin/pip install --upgrade pip setuptools \
    && $POETRY_VENV/bin/pip install poetry==$POETRY_VERSION

# Add Poetry to PATH
ENV PATH="${POETRY_VENV}/bin:${PATH}"

# Copy dependency files first (layer caching optimization)
COPY pyproject.toml poetry.lock ./

# Install production dependencies only (no dev dependencies)
RUN poetry install --only=main --no-root --no-directory
RUN pip install https://github.com/explosion/spacy-models/releases/download/el_core_news_sm-3.8.0/el_core_news_sm-3.8.0-py3-none-any.whl

# Copy application source code
COPY src/ ./src/
COPY alembic/ ./alembic/
COPY alembic.ini ./

# -----------------------------------------------------------------------------
# Stage 2: Runtime
# Minimal production image
# -----------------------------------------------------------------------------
FROM python:3.13-slim AS runtime

# Labels for image metadata
LABEL maintainer="Learn Greek Easy Team" \
      version="0.1.0" \
      description="Learn Greek Easy Backend API"

# Runtime environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    APP_HOME=/app

WORKDIR $APP_HOME

# Install runtime-only system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean \
    && apt-get autoremove -y

# Create non-root user for security
RUN groupadd --gid 1000 appgroup \
    && useradd --uid 1000 --gid appgroup --shell /bin/bash --create-home appuser

# Copy installed Python packages from builder
COPY --from=builder /usr/local/lib/python3.13/site-packages /usr/local/lib/python3.13/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy application code from builder
COPY --from=builder /app/src ./src
COPY --from=builder /app/alembic ./alembic
COPY --from=builder /app/alembic.ini ./

# Copy entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod 755 /usr/local/bin/docker-entrypoint.sh

# Create logs directory and set permissions
RUN mkdir -p /app/logs \
    && chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Expose API port
EXPOSE 8000

# Health check for container orchestration
# Note: Railway uses its own health checks, but this is useful for local Docker
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl --fail --silent http://localhost:${PORT:-8000}/health || exit 1

# Entrypoint handles startup tasks
ENTRYPOINT ["docker-entrypoint.sh"]

# Default command: run uvicorn
# Use shell form to expand PORT variable (Railway sets this dynamically)
CMD uvicorn src.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1
