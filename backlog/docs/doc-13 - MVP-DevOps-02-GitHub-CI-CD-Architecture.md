---
id: doc-13
title: 'MVP DevOps - 02: GitHub CI/CD Architecture'
type: other
created_date: '2025-12-07 09:17'
---
# MVP DevOps - 02: GitHub CI/CD Architecture

**Status**: ✅ Complete (100%)
**Created**: 2025-12-02

## Overview

Robust CI/CD pipeline for automatic code validation, consistent formatting, and fast developer feedback.

## Scope

| Component | Status |
|-----------|--------|
| GitHub Actions workflow setup | ✅ Done |
| Fix CI pipeline errors | ✅ Done |
| Pre-commit hooks setup | ✅ Done (15 hooks) |
| CI linting & formatting | ✅ Done |

## Pipeline Architecture

```
PR Trigger → Lint & Format → Unit Tests → E2E Tests → Merge
            (Frontend)        (Vitest)    (Playwright)
            (Backend)         (Pytest)
```

## Tech Stack

| Layer | Linting | Formatting | Testing |
|-------|---------|------------|---------|
| Frontend | ESLint | Prettier | Vitest + Playwright |
| Backend | Flake8/Ruff | Black + isort | Pytest |

## Subtasks

- 02.02: Fix CI Pipeline Errors
- 02.03: Pre-commit Hooks Setup
- 02.04: CI Linting & Formatting Plan

## Key Features

- PR-only test runs
- Concurrency control (cancel in-progress)
- Codecov integration
- 15 pre-commit hooks (8 general, 3 FE, 4 BE)
