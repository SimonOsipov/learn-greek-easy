#!/bin/bash

# Test script for comprehensive verification
# Navigate to frontend directory

cd "$(dirname "$0")"

echo "================================"
echo "Running TypeScript Type Check"
echo "================================"
npm run type-check
TYPE_CHECK_EXIT=$?

echo ""
echo "================================"
echo "Running ESLint"
echo "================================"
npm run lint
LINT_EXIT=$?

echo ""
echo "================================"
echo "Running Prettier Check"
echo "================================"
npm run format:check
FORMAT_EXIT=$?

echo ""
echo "================================"
echo "Running Production Build"
echo "================================"
npm run build
BUILD_EXIT=$?

echo ""
echo "================================"
echo "SUMMARY"
echo "================================"
echo "Type Check: $([ $TYPE_CHECK_EXIT -eq 0 ] && echo "✅ PASSED" || echo "❌ FAILED")"
echo "Lint Check: $([ $LINT_EXIT -eq 0 ] && echo "✅ PASSED" || echo "❌ FAILED")"
echo "Format Check: $([ $FORMAT_EXIT -eq 0 ] && echo "✅ PASSED" || echo "❌ FAILED")"
echo "Build: $([ $BUILD_EXIT -eq 0 ] && echo "✅ PASSED" || echo "❌ FAILED")"
echo "================================"

# Exit with error if any check failed
if [ $TYPE_CHECK_EXIT -ne 0 ] || [ $LINT_EXIT -ne 0 ] || [ $FORMAT_EXIT -ne 0 ] || [ $BUILD_EXIT -ne 0 ]; then
    exit 1
fi

exit 0
