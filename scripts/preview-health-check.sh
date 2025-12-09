#!/bin/bash
# Preview Environment Health Check Script
#
# Usage:
#   ./scripts/preview-health-check.sh <FRONTEND_URL> <BACKEND_URL> [MAX_RETRIES] [RETRY_INTERVAL]
#
# Parameters:
#   FRONTEND_URL   - The frontend deployment URL (required)
#   BACKEND_URL    - The backend deployment URL (required)
#   MAX_RETRIES    - Maximum number of retry attempts (default: 30)
#   RETRY_INTERVAL - Seconds between retries (default: 10)
#
# This script waits for services to become ready, then runs smoke tests
# to verify the deployment is functional.
#
# Exit codes:
#   0 - All health checks passed
#   N - Number of failed health checks

set -e

# ============================================================================
# Parameters
# ============================================================================

FRONTEND_URL=$1
BACKEND_URL=$2
MAX_RETRIES=${3:-30}
RETRY_INTERVAL=${4:-10}

# ============================================================================
# Validation
# ============================================================================

if [ -z "$FRONTEND_URL" ] || [ -z "$BACKEND_URL" ]; then
    echo "Usage: $0 <FRONTEND_URL> <BACKEND_URL> [MAX_RETRIES] [RETRY_INTERVAL]"
    echo ""
    echo "Parameters:"
    echo "  FRONTEND_URL   - The frontend deployment URL (required)"
    echo "  BACKEND_URL    - The backend deployment URL (required)"
    echo "  MAX_RETRIES    - Maximum number of retry attempts (default: 30)"
    echo "  RETRY_INTERVAL - Seconds between retries (default: 10)"
    exit 1
fi

# Remove trailing slashes from URLs
FRONTEND_URL="${FRONTEND_URL%/}"
BACKEND_URL="${BACKEND_URL%/}"

# ============================================================================
# Functions
# ============================================================================

# Check if an endpoint returns expected status code
# Arguments: url, name, expected_status (default: 200)
# Returns: 0 on success, 1 on failure
check_endpoint() {
    local url=$1
    local name=$2
    local expected_status=${3:-200}

    status=$(curl -s -o /dev/null -w "%{http_code}" "$url" --max-time 10 2>/dev/null || echo "000")
    if [ "$status" = "$expected_status" ]; then
        echo "[PASS] $name: $status"
        return 0
    else
        echo "[FAIL] $name: got $status, expected $expected_status"
        return 1
    fi
}

# ============================================================================
# Phase 1: Wait for services to be ready
# ============================================================================

echo "=============================================="
echo "Preview Environment Health Check"
echo "=============================================="
echo ""
echo "Frontend URL: $FRONTEND_URL"
echo "Backend URL:  $BACKEND_URL"
echo "Max Retries:  $MAX_RETRIES"
echo "Retry Interval: ${RETRY_INTERVAL}s"
echo ""
echo "Waiting for services to be ready..."
echo ""

for i in $(seq 1 $MAX_RETRIES); do
    READY=true

    # Check frontend health
    frontend_status=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL/health" --max-time 10 2>/dev/null || echo "000")
    if [ "$frontend_status" != "200" ]; then
        echo "  Frontend /health: $frontend_status (waiting...)"
        READY=false
    else
        echo "  Frontend /health: $frontend_status (ready)"
    fi

    # Check backend health
    backend_status=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/health" --max-time 10 2>/dev/null || echo "000")
    if [ "$backend_status" != "200" ]; then
        echo "  Backend /health: $backend_status (waiting...)"
        READY=false
    else
        echo "  Backend /health: $backend_status (ready)"
    fi

    if [ "$READY" = true ]; then
        echo ""
        echo "All services are ready!"
        break
    fi

    if [ $i -eq $MAX_RETRIES ]; then
        echo ""
        echo "ERROR: Services did not become ready after $MAX_RETRIES attempts"
        echo "Frontend status: $frontend_status"
        echo "Backend status: $backend_status"
        exit 1
    fi

    echo "  Retry $i/$MAX_RETRIES - waiting ${RETRY_INTERVAL}s..."
    echo ""
    sleep $RETRY_INTERVAL
done

# ============================================================================
# Phase 2: Run smoke tests
# ============================================================================

echo ""
echo "=============================================="
echo "Running Smoke Tests"
echo "=============================================="
echo ""

# Track results
RESULTS=()
FAILED=0

# Frontend smoke tests
echo "--- Frontend Tests ---"
if check_endpoint "$FRONTEND_URL" "Frontend Index"; then
    RESULTS+=("Frontend Index: PASS")
else
    RESULTS+=("Frontend Index: FAIL")
    FAILED=$((FAILED + 1))
fi

if check_endpoint "$FRONTEND_URL/health" "Frontend Health"; then
    RESULTS+=("Frontend Health: PASS")
else
    RESULTS+=("Frontend Health: FAIL")
    FAILED=$((FAILED + 1))
fi

echo ""
echo "--- Backend Tests ---"
if check_endpoint "$BACKEND_URL/health" "Backend Health"; then
    RESULTS+=("Backend Health: PASS")
else
    RESULTS+=("Backend Health: FAIL")
    FAILED=$((FAILED + 1))
fi

if check_endpoint "$BACKEND_URL/health/live" "Backend Liveness"; then
    RESULTS+=("Backend Liveness: PASS")
else
    RESULTS+=("Backend Liveness: FAIL")
    FAILED=$((FAILED + 1))
fi

if check_endpoint "$BACKEND_URL/health/ready" "Backend Readiness"; then
    RESULTS+=("Backend Readiness: PASS")
else
    RESULTS+=("Backend Readiness: FAIL")
    FAILED=$((FAILED + 1))
fi

echo ""
echo "--- Documentation Tests ---"
if check_endpoint "$BACKEND_URL/docs" "API Docs (Swagger)"; then
    RESULTS+=("API Docs: PASS")
else
    RESULTS+=("API Docs: FAIL")
    FAILED=$((FAILED + 1))
fi

if check_endpoint "$BACKEND_URL/openapi.json" "OpenAPI Schema"; then
    RESULTS+=("OpenAPI Schema: PASS")
else
    RESULTS+=("OpenAPI Schema: FAIL")
    FAILED=$((FAILED + 1))
fi

# ============================================================================
# Phase 3: Print results and generate JSON report
# ============================================================================

TOTAL=${#RESULTS[@]}
PASSED=$((TOTAL - FAILED))

echo ""
echo "=============================================="
echo "SMOKE TEST RESULTS"
echo "=============================================="
for result in "${RESULTS[@]}"; do
    echo "  $result"
done
echo "=============================================="
echo "Total: $PASSED passed, $FAILED failed (out of $TOTAL)"
echo "=============================================="

# Generate JSON report
cat > health-check-results.json << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "frontend_url": "$FRONTEND_URL",
  "backend_url": "$BACKEND_URL",
  "total_tests": $TOTAL,
  "passed": $PASSED,
  "failed": $FAILED,
  "results": [
    $(printf '"%s",' "${RESULTS[@]}" | sed 's/,$//')
  ]
}
EOF

echo ""
echo "JSON report written to: health-check-results.json"

# Exit with failure count (0 = success)
exit $FAILED
