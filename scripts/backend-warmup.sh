#!/bin/bash
# Backend Warmup Script
#
# Purpose:
#   Warm up the backend after deployment to trigger DNS refresh in Caddy
#   and initialize connection pools, lazy-loaded modules, and caches.
#
# Note:
#   The backend is now private and accessed via the frontend proxy.
#   This script uses /api/v1/health/* endpoints which route through Caddy
#   to the internal backend service.
#
# Usage:
#   ./scripts/backend-warmup.sh <BASE_URL> [WARMUP_REQUESTS] [RETRY_DELAY]
#
# Parameters:
#   BASE_URL         - The base URL (frontend URL, which proxies to backend)
#   WARMUP_REQUESTS  - Number of warmup requests per endpoint (default: 10)
#   RETRY_DELAY      - Seconds between health check retries (default: 3)
#
# Exit codes:
#   0 - Warmup completed successfully
#   1 - Warmup failed (backend not healthy after max retries)
#
# Example:
#   ./scripts/backend-warmup.sh "https://learn-greek-frontend.up.railway.app" 10 3

set -e

# ============================================================================
# Parameters
# ============================================================================

BASE_URL=$1
WARMUP_REQUESTS=${2:-10}
RETRY_DELAY=${3:-3}
MAX_READY_RETRIES=20

# ============================================================================
# Validation
# ============================================================================

if [ -z "$BASE_URL" ]; then
    echo "Usage: $0 <BASE_URL> [WARMUP_REQUESTS] [RETRY_DELAY]"
    echo ""
    echo "Parameters:"
    echo "  BASE_URL         - The base URL (frontend URL, which proxies to backend)"
    echo "  WARMUP_REQUESTS  - Number of warmup requests per endpoint (default: 10)"
    echo "  RETRY_DELAY      - Seconds between health check retries (default: 3)"
    echo ""
    echo "Note: Backend is private. Use frontend URL to access via proxy."
    exit 1
fi

# Remove trailing slash from URL
BASE_URL="${BASE_URL%/}"

# ============================================================================
# Functions
# ============================================================================

# Make a warmup request to an endpoint
# Arguments: url, endpoint_name
warmup_endpoint() {
    local url=$1
    local name=$2
    local success=0
    local failed=0

    for i in $(seq 1 $WARMUP_REQUESTS); do
        status=$(curl -sf -o /dev/null -w "%{http_code}" "$url" --max-time 5 2>/dev/null || echo "000")
        if [ "$status" = "200" ]; then
            success=$((success + 1))
        else
            failed=$((failed + 1))
        fi
    done

    echo "  $name: $success/$WARMUP_REQUESTS successful"
    return 0
}

# ============================================================================
# Phase 1: Wait for /health/ready with retries
# ============================================================================

echo "=============================================="
echo "Backend Warmup Script"
echo "=============================================="
echo ""
echo "Base URL:        $BASE_URL"
echo "Health Endpoint: $BASE_URL/api/v1/health (via frontend proxy)"
echo "Warmup Requests: $WARMUP_REQUESTS per endpoint"
echo "Retry Delay:     ${RETRY_DELAY}s"
echo ""
echo "Phase 1: Waiting for backend to be ready..."
echo ""

START_TIME=$(date +%s)

for i in $(seq 1 $MAX_READY_RETRIES); do
    # Use /api/v1/health/ready - accessed via frontend proxy to private backend
    status=$(curl -sf -o /dev/null -w "%{http_code}" "$BASE_URL/api/v1/health/ready" --max-time 10 2>/dev/null || echo "000")

    if [ "$status" = "200" ]; then
        READY_TIME=$(date +%s)
        READY_DURATION=$((READY_TIME - START_TIME))
        echo "  /api/v1/health/ready: $status (ready after ${READY_DURATION}s)"
        echo ""
        break
    fi

    echo "  Attempt $i/$MAX_READY_RETRIES: /api/v1/health/ready returned $status"

    if [ $i -eq $MAX_READY_RETRIES ]; then
        echo ""
        echo "ERROR: Backend did not become ready after $MAX_READY_RETRIES attempts"
        echo "Last status: $status"
        exit 1
    fi

    sleep $RETRY_DELAY
done

# ============================================================================
# Phase 2: Warmup requests to multiple endpoints
# ============================================================================

echo "Phase 2: Sending warmup requests..."
echo ""

WARMUP_START=$(date +%s)

# Warmup endpoints (public only - no auth required)
# All endpoints are accessed via frontend proxy to private backend
warmup_endpoint "$BASE_URL/api/v1/health" "/api/v1/health"
warmup_endpoint "$BASE_URL/api/v1/health/live" "/api/v1/health/live"
warmup_endpoint "$BASE_URL/api/v1/health/ready" "/api/v1/health/ready"
warmup_endpoint "$BASE_URL/api/v1/status" "/api/v1/status"

WARMUP_END=$(date +%s)
WARMUP_DURATION=$((WARMUP_END - WARMUP_START))

echo ""
echo "Warmup requests completed in ${WARMUP_DURATION}s"

# ============================================================================
# Phase 3: Final health verification
# ============================================================================

echo ""
echo "Phase 3: Final health verification..."
echo ""

# Readiness check is the deployment gate
FINAL_READY=$(curl -sf "$BASE_URL/api/v1/health/ready" --max-time 10 2>/dev/null || echo "FAILED")

# Also fetch comprehensive health for logging (but don't gate on it)
FINAL_HEALTH=$(curl -s "$BASE_URL/api/v1/health" --max-time 10 2>/dev/null || echo '{"status":"timeout"}')

if [ "$FINAL_READY" = "FAILED" ]; then
    echo "ERROR: Readiness check failed!"
    echo "  /api/v1/health/ready: FAILED"
    echo "  /api/v1/health (info only): $FINAL_HEALTH"
    exit 1
fi

echo "  /api/v1/health/ready: $FINAL_READY"
echo "  /api/v1/health (info only): $FINAL_HEALTH"

# ============================================================================
# Summary
# ============================================================================

END_TIME=$(date +%s)
TOTAL_DURATION=$((END_TIME - START_TIME))

echo ""
echo "=============================================="
echo "WARMUP COMPLETE"
echo "=============================================="
echo "Total duration: ${TOTAL_DURATION}s"
echo "Backend is warm and ready for traffic!"
echo "=============================================="

exit 0
