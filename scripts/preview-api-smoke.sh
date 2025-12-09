#!/bin/bash
# Preview Environment API Smoke Tests
#
# Usage:
#   ./scripts/preview-api-smoke.sh <BACKEND_URL>
#
# Parameters:
#   BACKEND_URL - The backend deployment URL (required)
#
# This script performs extended API testing to verify endpoints respond correctly.
# It tests health endpoints, documentation, auth endpoints, and public API endpoints.
#
# Exit codes:
#   0 - All API tests passed
#   N - Number of failed API tests

set -e

# ============================================================================
# Parameters
# ============================================================================

BACKEND_URL=$1

# ============================================================================
# Validation
# ============================================================================

if [ -z "$BACKEND_URL" ]; then
    echo "Usage: $0 <BACKEND_URL>"
    echo ""
    echo "Parameters:"
    echo "  BACKEND_URL - The backend deployment URL (required)"
    echo ""
    echo "Example:"
    echo "  $0 https://backend-dev-b901.up.railway.app"
    exit 1
fi

# Remove trailing slash from URL
BACKEND_URL="${BACKEND_URL%/}"

# ============================================================================
# Functions
# ============================================================================

# Test an API endpoint
# Arguments: method, endpoint, expected_status, name
# Returns: 0 on success, 1 on failure
test_api() {
    local method=$1
    local endpoint=$2
    local expected_status=$3
    local name=$4

    status=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$BACKEND_URL$endpoint" --max-time 10 2>/dev/null || echo "000")
    if [ "$status" = "$expected_status" ]; then
        echo "[PASS] $name: $status"
        return 0
    else
        echo "[FAIL] $name: got $status, expected $expected_status"
        return 1
    fi
}

# ============================================================================
# API Smoke Tests
# ============================================================================

echo "=============================================="
echo "API Smoke Tests"
echo "=============================================="
echo ""
echo "Backend URL: $BACKEND_URL"
echo ""

# Track results
RESULTS=()
FAILED=0

# --- Health Endpoints ---
echo "--- Health Endpoints ---"
if test_api GET "/health" "200" "Health endpoint"; then
    RESULTS+=("Health endpoint: PASS")
else
    RESULTS+=("Health endpoint: FAIL")
    FAILED=$((FAILED + 1))
fi

if test_api GET "/health/live" "200" "Liveness probe"; then
    RESULTS+=("Liveness probe: PASS")
else
    RESULTS+=("Liveness probe: FAIL")
    FAILED=$((FAILED + 1))
fi

if test_api GET "/health/ready" "200" "Readiness probe"; then
    RESULTS+=("Readiness probe: PASS")
else
    RESULTS+=("Readiness probe: FAIL")
    FAILED=$((FAILED + 1))
fi

echo ""

# --- Documentation Endpoints ---
echo "--- Documentation Endpoints ---"
if test_api GET "/docs" "200" "Swagger docs"; then
    RESULTS+=("Swagger docs: PASS")
else
    RESULTS+=("Swagger docs: FAIL")
    FAILED=$((FAILED + 1))
fi

if test_api GET "/redoc" "200" "ReDoc"; then
    RESULTS+=("ReDoc: PASS")
else
    RESULTS+=("ReDoc: FAIL")
    FAILED=$((FAILED + 1))
fi

if test_api GET "/openapi.json" "200" "OpenAPI spec"; then
    RESULTS+=("OpenAPI spec: PASS")
else
    RESULTS+=("OpenAPI spec: FAIL")
    FAILED=$((FAILED + 1))
fi

echo ""

# --- Auth Endpoints (expect 422 without body) ---
echo "--- Auth Endpoints (no body -> 422) ---"
if test_api POST "/api/v1/auth/register" "422" "Register (no body)"; then
    RESULTS+=("Register (no body): PASS")
else
    RESULTS+=("Register (no body): FAIL")
    FAILED=$((FAILED + 1))
fi

if test_api POST "/api/v1/auth/login" "422" "Login (no body)"; then
    RESULTS+=("Login (no body): PASS")
else
    RESULTS+=("Login (no body): FAIL")
    FAILED=$((FAILED + 1))
fi

echo ""

# --- Protected Endpoints (expect 401 without auth) ---
echo "--- Protected Endpoints (no auth -> 401) ---"
if test_api GET "/api/v1/auth/me" "401" "Auth/me (no auth)"; then
    RESULTS+=("Auth/me (no auth): PASS")
else
    RESULTS+=("Auth/me (no auth): FAIL")
    FAILED=$((FAILED + 1))
fi

echo ""

# --- Public API Endpoints ---
echo "--- Public API Endpoints ---"
# Note: /api/v1/decks is a public endpoint (no auth required)
if test_api GET "/api/v1/decks" "200" "Decks list (public)"; then
    RESULTS+=("Decks list (public): PASS")
else
    RESULTS+=("Decks list (public): FAIL")
    FAILED=$((FAILED + 1))
fi

# ============================================================================
# Print Results and Generate JSON Report
# ============================================================================

TOTAL=${#RESULTS[@]}
PASSED=$((TOTAL - FAILED))

echo ""
echo "=============================================="
echo "API SMOKE TEST RESULTS"
echo "=============================================="
for result in "${RESULTS[@]}"; do
    echo "  $result"
done
echo "=============================================="
echo "Total: $PASSED passed, $FAILED failed (out of $TOTAL)"
echo "=============================================="

# Generate JSON report
cat > api-smoke-results.json << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
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
echo "JSON report written to: api-smoke-results.json"

# Exit with failure count (0 = success)
exit $FAILED
