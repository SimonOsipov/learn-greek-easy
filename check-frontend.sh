#!/bin/bash
set -e

cd /Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-frontend

echo "Starting quality checks..."
echo ""

echo "1. Type checking..."
npm run type-check || exit 1

echo ""
echo "2. Linting..."
npm run lint || exit 1

echo ""
echo "3. Format checking..."
npm run format:check || exit 1

echo ""
echo "4. Building..."
npm run build || exit 1

echo ""
echo "All checks passed! ✅"
