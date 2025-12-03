#!/bin/bash
set -e

# =============================================================================
# Docker Entrypoint Script
# Handles startup tasks before running the main application
# =============================================================================

echo "Starting Learn Greek Easy Backend..."
echo "Environment: ${APP_ENV:-production}"

# -----------------------------------------------------------------------------
# Wait for dependencies (optional, for docker-compose)
# -----------------------------------------------------------------------------
wait_for_postgres() {
    if [ -n "$DATABASE_URL" ]; then
        echo "Waiting for PostgreSQL..."

        # Extract host and port from DATABASE_URL
        # Format: postgresql+asyncpg://user:pass@host:port/dbname
        DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
        DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')

        # Default port if not specified
        DB_PORT=${DB_PORT:-5432}

        # Wait loop
        MAX_RETRIES=30
        RETRY_COUNT=0

        while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
            if curl -s "http://${DB_HOST}:${DB_PORT}" > /dev/null 2>&1 || \
               python -c "import socket; socket.create_connection(('${DB_HOST}', ${DB_PORT}), timeout=2)" 2>/dev/null; then
                echo "PostgreSQL is available!"
                break
            fi

            RETRY_COUNT=$((RETRY_COUNT + 1))
            echo "Waiting for PostgreSQL... ($RETRY_COUNT/$MAX_RETRIES)"
            sleep 2
        done

        if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
            echo "Warning: Could not connect to PostgreSQL, proceeding anyway..."
        fi
    fi
}

# -----------------------------------------------------------------------------
# Run database migrations (optional)
# -----------------------------------------------------------------------------
run_migrations() {
    if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
        echo "Running database migrations..."
        alembic upgrade head
        echo "Migrations completed!"
    fi
}

# -----------------------------------------------------------------------------
# Main execution
# -----------------------------------------------------------------------------

# Wait for PostgreSQL if in production mode
if [ "${APP_ENV}" = "production" ] || [ "${WAIT_FOR_DB:-false}" = "true" ]; then
    wait_for_postgres
fi

# Run migrations if enabled
run_migrations

# Execute the main command
echo "Starting application..."
exec "$@"
