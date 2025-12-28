#!/bin/sh
set -e

# Default values
export PORT=${PORT:-80}
export BACKEND_HOST=${BACKEND_HOST:-backend.railway.internal}
export BACKEND_PORT=${BACKEND_PORT:-8080}

echo "=== Frontend Container Starting ==="
echo "PORT: $PORT"
echo "Using dynamic DNS resolution for ${BACKEND_HOST}:${BACKEND_PORT}"
echo "DNS refresh interval: 30s"

# Validate Caddyfile syntax
echo "Validating Caddyfile configuration..."
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile

echo "Starting Caddy on port $PORT with dynamic backend resolution"

# Execute caddy
exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
