#!/bin/bash
set -e

cd /Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-frontend

echo "Running lint:fix..."
npm run lint:fix

echo "Running format..."
npm run format

echo "Running type-check..."
npm run type-check

echo "Running lint check..."
npm run lint

echo "Running build..."
npm run build

echo "All checks passed!"
