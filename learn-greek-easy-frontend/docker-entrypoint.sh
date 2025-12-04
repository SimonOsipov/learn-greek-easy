#!/bin/sh
set -e

# Default values
export PORT=${PORT:-80}
export BACKEND_URL=${BACKEND_URL:-http://backend:8000}

echo "=== Frontend Container Starting ==="
echo "PORT: $PORT"
echo "BACKEND_URL: $BACKEND_URL"

# Substitute environment variables in nginx config
envsubst '${PORT} ${BACKEND_URL}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

# Test nginx configuration
echo "Testing nginx configuration..."
nginx -t

echo "Starting nginx on port $PORT with backend at $BACKEND_URL"

# Execute nginx
exec nginx -g 'daemon off;'
