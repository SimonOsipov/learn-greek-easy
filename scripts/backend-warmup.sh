#!/bin/bash
# Backend Warmup Script
#
# Purpose:
#   Warm up the backend after deployment to trigger DNS refresh in Caddy
#   and initialize connection pools, lazy-loaded modules, and caches.
#
# Usage:
#   ./scripts/backend-warmup.sh <BACKEND_URL> [WARMUP_REQUESTS] [RETRY_DELAY]
#
# Parameters:
#   BACKEND_URL      - The backend URL (required)
#   WARMUP_REQUESTS  - Number of warmup requests per endpoint (default: 10)
#   RETRY_DELAY      - Seconds between health check retries (default: 3)
#
# Exit codes:
#   0 - Warmup completed successfully
#   1 - Warmup failed (backend not healthy after max retries)
#
# Example:
#   ./scripts/backend-warmup.sh "https://backend-production-7429.up.railway.app" 10 3

set -e

# ============================================================================
# Parameters
# ============================================================================

BACKEND_URL=$1
WARMUP_REQUESTS=${2:-10}
RETRY_DELAY=${3:-3}
MAX_READY_RETRIES=20

# ============================================================================
# Validation
# ============================================================================

if [ -z "$BACKEND_URL" ]; then
    echo "Usage: $0 <BACKEND_URL> [WARMUP_REQUESTS] [RETRY_DELAY]"
    echo ""
    echo "Parameters:"
    echo "  BACKEND_URL      - The backend URL (required)"
    echo "  WARMUP_REQUESTS  - Number of warmup requests per endpoint (default: 10)"
    echo "  RETRY_DELAY      - Seconds between health check retries (default: 3)"
    exit 1
fi

# Remove trailing slash from URL
BACKEND_URL="${BACKEND_URL%/}"

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
echo "Backend URL:     $BACKEND_URL"
echo "Warmup Requests: $WARMUP_REQUESTS per endpoint"
echo "Retry Delay:     ${RETRY_DELAY}s"
echo ""
echo "Phase 1: Waiting for backend to be ready..."
echo ""

START_TIME=$(date +%s)

for i in $(seq 1 $MAX_READY_RETRIES); do
    status=$(curl -sf -o /dev/null -w "%{http_code}" "$BACKEND_URL/health/ready" --max-time 10 2>/dev/null || echo "000")

    if [ "$status" = "200" ]; then
        READY_TIME=$(date +%s)
        READY_DURATION=$((READY_TIME - START_TIME))
        echo "  /health/ready: $status (ready after ${READY_DURATION}s)"
        echo ""
        break
    fi

    echo "  Attempt $i/$MAX_READY_RETRIES: /health/ready returned $status"

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
warmup_endpoint "$BACKEND_URL/health" "/health"
warmup_endpoint "$BACKEND_URL/health/live" "/health/live"
warmup_endpoint "$BACKEND_URL/health/ready" "/health/ready"
warmup_endpoint "$BACKEND_URL/version" "/version"
warmup_endpoint "$BACKEND_URL/api/v1/status" "/api/v1/status"

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

FINAL_HEALTH=$(curl -sf "$BACKEND_URL/health" --max-time 10 2>/dev/null || echo "FAILED")
FINAL_READY=$(curl -sf "$BACKEND_URL/health/ready" --max-time 10 2>/dev/null || echo "FAILED")

if [ "$FINAL_HEALTH" = "FAILED" ] || [ "$FINAL_READY" = "FAILED" ]; then
    echo "ERROR: Final health check failed!"
    echo "  /health: $FINAL_HEALTH"
    echo "  /health/ready: $FINAL_READY"
    exit 1
fi

echo "  /health: OK"
echo "  /health/ready: OK"

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
