#!/bin/sh
set -e

# Default values
export PORT=${PORT:-80}
export BACKEND_URL=${BACKEND_URL:-http://backend:8000}

echo "=== Frontend Container Starting ==="
echo "PORT: $PORT"
echo "BACKEND_URL: $BACKEND_URL"

# Validate Caddyfile syntax
echo "Validating Caddyfile configuration..."
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile

echo "Starting Caddy on port $PORT with backend at $BACKEND_URL"

# Execute caddy
exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
