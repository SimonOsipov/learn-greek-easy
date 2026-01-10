#!/bin/bash
# Preview Environment Health Check Script
#
# Usage:
#   ./scripts/preview-health-check.sh <FRONTEND_URL> [MAX_RETRIES] [RETRY_INTERVAL]
#
# Parameters:
#   FRONTEND_URL   - The frontend deployment URL (required)
#   MAX_RETRIES    - Maximum number of retry attempts (default: 30)
#   RETRY_INTERVAL - Seconds between retries (default: 10)
#
# Note:
#   The backend is private and accessed via the frontend proxy.
#   Backend health checks use /api/v1/health/* endpoints through the frontend.
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
MAX_RETRIES=${2:-30}
RETRY_INTERVAL=${3:-10}

# Threshold for slow responses (in milliseconds)
SLOW_THRESHOLD_MS=500

# Arrays to store endpoint data for JSON report
ENDPOINT_DATA=""

# ============================================================================
# Validation
# ============================================================================

if [ -z "$FRONTEND_URL" ]; then
    echo "Usage: $0 <FRONTEND_URL> [MAX_RETRIES] [RETRY_INTERVAL]"
    echo ""
    echo "Parameters:"
    echo "  FRONTEND_URL   - The frontend deployment URL (required)"
    echo "  MAX_RETRIES    - Maximum number of retry attempts (default: 30)"
    echo "  RETRY_INTERVAL - Seconds between retries (default: 10)"
    echo ""
    echo "Note: Backend is private. Health checks use /api/v1/health/* via frontend proxy."
    exit 1
fi

# Remove trailing slash from URL
FRONTEND_URL="${FRONTEND_URL%/}"

# ============================================================================
# Functions
# ============================================================================

# Check if an endpoint returns expected status code
# Arguments: url, name, expected_status (default: 200), max_retries (default: 3), retry_delay (default: 2)
# Returns: 0 on success, 1 on failure
# Side effect: Appends endpoint data to ENDPOINT_DATA string
# Note: Retries on 5xx errors and curl timeouts (000), not on 4xx errors
check_endpoint() {
    local url=$1
    local name=$2
    local expected_status=${3:-200}
    local max_retries=${4:-3}
    local retry_delay=${5:-2}

    local attempt=1
    local retries_used=0
    local status="000"
    local time_total="0"

    # Retry loop for 5xx errors and curl timeouts
    while [ $attempt -le $max_retries ]; do
        # Get both status code and response time using curl's -w format
        response=$(curl -s -o /dev/null -w "%{http_code}|%{time_total}" "$url" --max-time 10 2>/dev/null || echo "000|0")
        status=$(echo "$response" | cut -d'|' -f1)
        time_total=$(echo "$response" | cut -d'|' -f2)

        # Success - break out
        if [ "$status" = "$expected_status" ]; then
            break
        fi

        # 5xx error OR curl timeout (000) - retry if attempts remaining
        if [[ "$status" =~ ^5[0-9]{2}$ || "$status" = "000" ]] && [ $attempt -lt $max_retries ]; then
            echo "  [$name] Got $status, retrying ($attempt/$max_retries)..."
            sleep $retry_delay
            attempt=$((attempt + 1))
            continue
        fi

        # Non-retryable error or max retries reached - fail
        break
    done

    # Calculate retries used
    retries_used=$((attempt - 1))

    # Convert time_total (seconds) to milliseconds
    time_ms=$(echo "$time_total * 1000" | bc | cut -d'.' -f1)
    if [ -z "$time_ms" ]; then
        time_ms=0
    fi

    # Determine if passed and if slow
    local passed="false"
    local slow="false"
    if [ "$status" = "$expected_status" ]; then
        passed="true"
    fi
    if [ "$time_ms" -gt "$SLOW_THRESHOLD_MS" ]; then
        slow="true"
    fi

    # Build JSON entry for this endpoint (append to ENDPOINT_DATA)
    local entry="{\"name\": \"$name\", \"url\": \"$url\", \"status_code\": $status, \"expected_status\": $expected_status, \"response_time_ms\": $time_ms, \"passed\": $passed, \"slow\": $slow, \"retries\": $retries_used}"
    if [ -n "$ENDPOINT_DATA" ]; then
        ENDPOINT_DATA="$ENDPOINT_DATA, $entry"
    else
        ENDPOINT_DATA="$entry"
    fi

    # Print result with retry information
    local retry_suffix=""
    if [ "$retries_used" -gt 0 ]; then
        if [ "$retries_used" -eq 1 ]; then
            retry_suffix=" (after $retries_used retry)"
        else
            retry_suffix=" (after $retries_used retries)"
        fi
    fi

    if [ "$passed" = "true" ]; then
        if [ "$slow" = "true" ]; then
            echo "[SLOW] $name: $status (${time_ms}ms)$retry_suffix"
        else
            echo "[PASS] $name: $status (${time_ms}ms)$retry_suffix"
        fi
        return 0
    else
        local fail_retry_suffix=""
        if [ "$retries_used" -gt 0 ]; then
            fail_retry_suffix=" after $retries_used retries"
        fi
        echo "[FAIL] $name: got $status, expected $expected_status (${time_ms}ms)$fail_retry_suffix"
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
echo "Backend API:  $FRONTEND_URL/api/v1 (via frontend proxy)"
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

    # Check backend health via frontend proxy
    backend_status=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL/api/v1/health" --max-time 10 2>/dev/null || echo "000")
    if [ "$backend_status" != "200" ]; then
        echo "  Backend /api/v1/health: $backend_status (waiting...)"
        READY=false
    else
        echo "  Backend /api/v1/health: $backend_status (ready)"
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
echo "--- Backend Tests (via frontend proxy) ---"
# Backend is private - all health checks use /api/v1/health/* via frontend proxy
if check_endpoint "$FRONTEND_URL/api/v1/health" "Backend Health"; then
    RESULTS+=("Backend Health: PASS")
else
    RESULTS+=("Backend Health: FAIL")
    FAILED=$((FAILED + 1))
fi

if check_endpoint "$FRONTEND_URL/api/v1/health/live" "Backend Liveness"; then
    RESULTS+=("Backend Liveness: PASS")
else
    RESULTS+=("Backend Liveness: FAIL")
    FAILED=$((FAILED + 1))
fi

if check_endpoint "$FRONTEND_URL/api/v1/health/ready" "Backend Readiness"; then
    RESULTS+=("Backend Readiness: PASS")
else
    RESULTS+=("Backend Readiness: FAIL")
    FAILED=$((FAILED + 1))
fi

echo ""
echo "--- Documentation Tests (Optional - Non-Blocking) ---"
# Note: /docs and /openapi.json are accessed via frontend proxy
# These tests are informational only and don't block the health check
if check_endpoint "$FRONTEND_URL/docs" "API Docs (Swagger)"; then
    RESULTS+=("API Docs: PASS")
else
    RESULTS+=("API Docs: SKIP (DEBUG mode disabled)")
    echo "  Note: API docs are disabled when DEBUG=false"
fi

if check_endpoint "$FRONTEND_URL/openapi.json" "OpenAPI Schema"; then
    RESULTS+=("OpenAPI Schema: PASS")
else
    RESULTS+=("OpenAPI Schema: SKIP (DEBUG mode disabled)")
    echo "  Note: OpenAPI schema is disabled when DEBUG=false"
fi

# ============================================================================
# Phase 3: Print results and generate JSON report
# ============================================================================

TOTAL=${#RESULTS[@]}
PASSED_COUNT=$((TOTAL - FAILED))

# Count slow endpoints by parsing ENDPOINT_DATA
# Using grep to count occurrences of "slow": true
SLOW_COUNT=$(echo "$ENDPOINT_DATA" | grep -o '"slow": true' | wc -l | tr -d ' ')
if [ -z "$SLOW_COUNT" ]; then
    SLOW_COUNT=0
fi

echo ""
echo "=============================================="
echo "SMOKE TEST RESULTS"
echo "=============================================="
for result in "${RESULTS[@]}"; do
    echo "  $result"
done
echo "=============================================="
echo "Total: $PASSED_COUNT passed, $FAILED failed, $SLOW_COUNT slow (out of $TOTAL)"
echo "=============================================="

# Generate enhanced JSON report with endpoint details
cat > health-check-results.json << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "frontend_url": "$FRONTEND_URL",
  "backend_api_url": "$FRONTEND_URL/api/v1",
  "summary": {
    "total": $TOTAL,
    "passed": $PASSED_COUNT,
    "failed": $FAILED,
    "slow": $SLOW_COUNT
  },
  "thresholds": {
    "slow_response_ms": $SLOW_THRESHOLD_MS
  },
  "endpoints": [
    $ENDPOINT_DATA
  ]
}
EOF

echo ""
echo "JSON report written to: health-check-results.json"

# Exit with failure count (0 = success)
exit $FAILED
