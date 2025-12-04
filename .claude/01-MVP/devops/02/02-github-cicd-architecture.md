# 02. GitHub CI/CD Architecture Plan

**Project**: Learn Greek Easy - MVP DevOps
**Task**: GitHub CI/CD Pipeline Setup
**Created**: 2025-12-02
**Status**: ✅ COMPLETE (100%)

---

## Table of Contents

1. [Overview](#overview)
2. [Current State Analysis](#current-state-analysis)
3. [Target Architecture](#target-architecture)
4. [GitHub Actions Workflow Structure](#github-actions-workflow-structure)
5. [Pre-commit Hooks Configuration](#pre-commit-hooks-configuration)
6. [CI Linting & Formatting Pipeline](#ci-linting--formatting-pipeline)
7. [Security Considerations](#security-considerations)
8. [Implementation Tasks](#implementation-tasks)
9. [Commands Reference](#commands-reference)

---

## Overview

### Purpose

Establish a robust CI/CD pipeline for the Learn Greek Easy application to:
- Automatically validate code quality on every pull request
- Enforce consistent code formatting across frontend and backend
- Prevent broken code from being merged into protected branches
- Enable fast feedback loops for developers
- Create foundation for future automated deployments

### Scope

| Component | Current Status | Target |
|-----------|---------------|--------|
| GitHub Actions workflow setup | ✅ Done | Optimize & Fix |
| Fix CI pipeline errors | ✅ Done | Resolve all failures |
| Pre-commit hooks setup | ✅ Done | Configure for FE & BE |
| CI linting & formatting | ✅ Done | frontend-lint + backend-lint jobs, PR #3 |

### Tech Stack Overview

| Layer | Technology | Linting | Formatting | Testing |
|-------|------------|---------|------------|---------|
| Frontend | React + TypeScript + Vite | ESLint | Prettier | Vitest + Playwright |
| Backend | FastAPI + Python 3.13 | Flake8/Ruff | Black + isort | Pytest |

---

## Current State Analysis

### Existing GitHub Actions Workflow

**Location**: `.github/workflows/test.yml`

**Current Configuration**:
```yaml
name: Test Suite

on:
  pull_request:
    branches: [main, develop]
    types: [opened, synchronize]
```

**Jobs Defined**:

| Job | Status | Description |
|-----|--------|-------------|
| `unit-tests` | Working | Frontend type-check, lint, Vitest |
| `e2e-tests` | Working | Playwright E2E tests |
| `backend-tests` | Failing | Python tests with PostgreSQL service |

### Current Job Analysis

#### Job 1: Frontend Unit Tests
```yaml
steps:
  - Checkout code
  - Setup Node.js 18
  - npm ci
  - npm run type-check      # TypeScript validation
  - npm run lint            # ESLint
  - npm run test:coverage   # Vitest with coverage
  - Upload coverage to Codecov
```
**Status**: Working

#### Job 2: E2E Tests
```yaml
steps:
  - Checkout code
  - Setup Node.js 18
  - npm ci
  - Install Playwright browsers
  - npm run test:e2e
  - Upload Playwright report (on failure)
  - Upload test results (always)
```
**Status**: Working

#### Job 3: Backend Tests
```yaml
services:
  postgres:
    image: postgres:16-alpine
    env: POSTGRES_USER, PASSWORD, DB
    ports: 5433:5432

steps:
  - Checkout code
  - Setup Python 3.13
  - Install Poetry 2.0.0
  - Load cached venv
  - poetry install
  - Create test database extensions
  - Run pytest with coverage (--cov-fail-under=90)
  - Upload coverage to Codecov
```
**Status**: FAILING - Pipeline errors before tests run

### Frontend Linting/Formatting Tools (Existing)

**ESLint Configuration** (`eslint.config.js`):
- TypeScript support via `@typescript-eslint`
- React + React Hooks plugins
- Import ordering rules
- Prettier integration

**Prettier Configuration** (`.prettierrc.json`):
```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "printWidth": 100,
  "trailingComma": "es5",
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

**Available npm Scripts**:
```json
{
  "lint": "eslint .",
  "lint:fix": "eslint . --fix",
  "format": "prettier --write \"src/**/*.{ts,tsx,css,md}\"",
  "format:check": "prettier --check \"src/**/*.{ts,tsx,css,md}\"",
  "type-check": "tsc --noEmit",
  "check-all": "npm run type-check && npm run lint && npm run test"
}
```

### Backend Linting/Formatting Tools (Existing in pyproject.toml)

**Black Configuration**:
```toml
[tool.black]
line-length = 100
target-version = ['py313']
```

**isort Configuration**:
```toml
[tool.isort]
profile = "black"
line_length = 100
```

**MyPy Configuration**:
```toml
[tool.mypy]
python_version = "3.13"
disallow_untyped_defs = true
```

**Available Dev Dependencies**:
- `black = "^24.8.0"`
- `isort = "^5.13.2"`
- `flake8 = "^7.1.0"`
- `mypy = "^1.11.0"`
- `pylint = "^3.2.0"`

### Gaps Addressed

1. ✅ **CI Pipeline Errors**: Fixed (Node 20, ESLint config, backend submodule)
2. ✅ **Pre-commit Hooks**: Configured with 15 hooks
3. ✅ **CI Linting for Backend**: Added backend-lint job with Black, isort, Flake8, MyPy
4. ✅ **Format Checks in CI**: Prettier check enforced in frontend-lint job

---

## Target Architecture

### CI/CD Pipeline Flow

```
Developer Push/PR
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│                    GitHub Actions Trigger                      │
│                   (on: pull_request to main)                   │
└───────────────────────────────────────────────────────────────┘
        │
        ├────────────────────┬────────────────────┬─────────────────────┐
        ▼                    ▼                    ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│  Lint & Format │    │  Lint & Format │    │   Frontend    │    │    Backend    │
│   (Frontend)   │    │   (Backend)    │    │    Tests      │    │     Tests     │
│                │    │                │    │               │    │               │
│ - ESLint       │    │ - Black check  │    │ - Vitest      │    │ - Pytest      │
│ - Prettier     │    │ - isort check  │    │ - Coverage    │    │ - Coverage    │
│ - TypeScript   │    │ - Flake8/Ruff  │    │               │    │ - PostgreSQL  │
│                │    │ - MyPy         │    │               │    │               │
└───────────────┘    └───────────────┘    └───────────────┘    └───────────────┘
        │                    │                    │                     │
        └────────────────────┴────────────────────┴─────────────────────┘
                                      │
                                      ▼
                          ┌───────────────────────┐
                          │     E2E Tests         │
                          │   (Playwright)        │
                          │  depends on: all      │
                          └───────────────────────┘
                                      │
                                      ▼
                          ┌───────────────────────┐
                          │  All Checks Pass?     │
                          │                       │
                          │  Yes → Merge Allowed  │
                          │  No → Merge Blocked   │
                          └───────────────────────┘
```

### Pre-commit Hook Flow

```
Developer: git commit
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│                     Pre-commit Framework                       │
└───────────────────────────────────────────────────────────────┘
        │
        ├────────────────────────────────────────────────────────┐
        │                                                        │
        ▼                                                        ▼
┌───────────────────────────────┐        ┌───────────────────────────────┐
│      Frontend Hooks           │        │       Backend Hooks           │
│                               │        │                               │
│ 1. ESLint (auto-fix)          │        │ 1. Black (auto-format)        │
│ 2. Prettier (auto-format)     │        │ 2. isort (auto-sort)          │
│ 3. TypeScript check           │        │ 3. Flake8 (lint)              │
│                               │        │ 4. MyPy (type check)          │
└───────────────────────────────┘        └───────────────────────────────┘
        │                                                        │
        └────────────────────────────────────────────────────────┘
                                      │
                                      ▼
                          ┌───────────────────────┐
                          │    All Hooks Pass?    │
                          │                       │
                          │  Yes → Commit Created │
                          │  No → Commit Blocked  │
                          └───────────────────────┘
```

---

## GitHub Actions Workflow Structure

### Recommended Workflow Organization

```
.github/
└── workflows/
    ├── test.yml           # Main PR validation (tests + lint)
    └── deploy.yml         # Future: Deployment workflow
```

### Enhanced test.yml Structure

```yaml
name: CI Pipeline

on:
  pull_request:
    branches: [main, develop]
    types: [opened, synchronize]

# Cancel in-progress runs on new pushes
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  # ============================================================================
  # Stage 1: Code Quality Checks (Fast Feedback)
  # ============================================================================

  frontend-lint:
    name: Frontend Lint & Format
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: learn-greek-easy-frontend/package-lock.json
      - run: npm ci
        working-directory: learn-greek-easy-frontend
      - run: npm run type-check
        working-directory: learn-greek-easy-frontend
      - run: npm run lint
        working-directory: learn-greek-easy-frontend
      - run: npm run format:check
        working-directory: learn-greek-easy-frontend

  backend-lint:
    name: Backend Lint & Format
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.13'
      - uses: snok/install-poetry@v1
        with:
          version: 2.0.0
          virtualenvs-create: true
          virtualenvs-in-project: true
      - run: poetry install --only dev --no-interaction
        working-directory: learn-greek-easy-backend
      - name: Check Black formatting
        run: poetry run black --check src/ tests/
        working-directory: learn-greek-easy-backend
      - name: Check isort
        run: poetry run isort --check-only src/ tests/
        working-directory: learn-greek-easy-backend
      - name: Run Flake8
        run: poetry run flake8 src/ tests/
        working-directory: learn-greek-easy-backend
      - name: Run MyPy
        run: poetry run mypy src/
        working-directory: learn-greek-easy-backend

  # ============================================================================
  # Stage 2: Unit & Integration Tests (Parallel)
  # ============================================================================

  frontend-tests:
    name: Frontend Tests
    runs-on: ubuntu-latest
    needs: [frontend-lint]  # Only run if lint passes
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: learn-greek-easy-frontend/package-lock.json
      - run: npm ci
        working-directory: learn-greek-easy-frontend
      - run: npm run test:coverage
        working-directory: learn-greek-easy-frontend
      - uses: codecov/codecov-action@v4
        with:
          files: learn-greek-easy-frontend/coverage/lcov.info
          flags: frontend
          fail_ci_if_error: false

  backend-tests:
    name: Backend Tests
    runs-on: ubuntu-latest
    needs: [backend-lint]  # Only run if lint passes
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test_learn_greek
        ports:
          - 5433:5432
        options: >-
          --health-cmd "pg_isready -U postgres"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.13'
      - uses: snok/install-poetry@v1
        with:
          version: 2.0.0
          virtualenvs-create: true
          virtualenvs-in-project: true
      - uses: actions/cache@v4
        with:
          path: learn-greek-easy-backend/.venv
          key: venv-${{ runner.os }}-${{ hashFiles('**/poetry.lock') }}
      - run: poetry install --no-interaction
        working-directory: learn-greek-easy-backend
      - name: Create database extensions
        run: |
          PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d test_learn_greek -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
      - name: Run tests
        working-directory: learn-greek-easy-backend
        env:
          TEST_DATABASE_URL: postgresql+asyncpg://postgres:postgres@localhost:5433/test_learn_greek
        run: |
          poetry run pytest tests/ \
            -n auto \
            --dist loadscope \
            --cov=src \
            --cov-report=xml \
            --cov-fail-under=90 \
            -v --tb=short
      - uses: codecov/codecov-action@v4
        with:
          files: learn-greek-easy-backend/coverage.xml
          flags: backend
          fail_ci_if_error: false
          token: ${{ secrets.CODECOV_TOKEN }}

  # ============================================================================
  # Stage 3: E2E Tests (After all other tests pass)
  # ============================================================================

  e2e-tests:
    name: E2E Tests (Playwright)
    runs-on: ubuntu-latest
    needs: [frontend-tests, backend-tests]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: learn-greek-easy-frontend/package-lock.json
      - run: npm ci
        working-directory: learn-greek-easy-frontend
      - run: npx playwright install --with-deps
        working-directory: learn-greek-easy-frontend
      - run: npm run test:e2e
        working-directory: learn-greek-easy-frontend
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: learn-greek-easy-frontend/playwright-report/
          retention-days: 7
```

---

## Pre-commit Hooks Configuration

### Installation

```bash
# Install pre-commit framework
pip install pre-commit

# Or with pipx (recommended)
pipx install pre-commit
```

### Configuration File

Create `.pre-commit-config.yaml` at repository root:

```yaml
# .pre-commit-config.yaml
# See https://pre-commit.com for more information

default_stages: [commit]
default_language_version:
  python: python3.13
  node: 18.0.0

repos:
  # =============================================================================
  # General Hooks
  # =============================================================================
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.5.0
    hooks:
      - id: trailing-whitespace
        exclude: ^(learn-greek-easy-frontend/node_modules/|\.git/)
      - id: end-of-file-fixer
        exclude: ^(learn-greek-easy-frontend/node_modules/|\.git/)
      - id: check-yaml
        args: [--unsafe]  # Allow custom tags
      - id: check-json
      - id: check-added-large-files
        args: ['--maxkb=1000']
      - id: check-merge-conflict
      - id: detect-private-key
      - id: no-commit-to-branch
        args: [--branch, main]

  # =============================================================================
  # Frontend Hooks (TypeScript/React)
  # =============================================================================
  - repo: local
    hooks:
      - id: frontend-eslint
        name: Frontend ESLint
        entry: bash -c 'cd learn-greek-easy-frontend && npm run lint:fix'
        language: system
        files: ^learn-greek-easy-frontend/.*\.(ts|tsx|js|jsx)$
        pass_filenames: false

      - id: frontend-prettier
        name: Frontend Prettier
        entry: bash -c 'cd learn-greek-easy-frontend && npm run format'
        language: system
        files: ^learn-greek-easy-frontend/.*\.(ts|tsx|js|jsx|css|md|json)$
        pass_filenames: false

      - id: frontend-typecheck
        name: Frontend TypeScript Check
        entry: bash -c 'cd learn-greek-easy-frontend && npm run type-check'
        language: system
        files: ^learn-greek-easy-frontend/.*\.(ts|tsx)$
        pass_filenames: false

  # =============================================================================
  # Backend Hooks (Python/FastAPI)
  # =============================================================================
  - repo: https://github.com/psf/black
    rev: 24.8.0
    hooks:
      - id: black
        args: [--config=learn-greek-easy-backend/pyproject.toml]
        files: ^learn-greek-easy-backend/

  - repo: https://github.com/pycqa/isort
    rev: 5.13.2
    hooks:
      - id: isort
        args: [--settings-path=learn-greek-easy-backend/pyproject.toml]
        files: ^learn-greek-easy-backend/

  - repo: https://github.com/pycqa/flake8
    rev: 7.1.0
    hooks:
      - id: flake8
        args: [--config=learn-greek-easy-backend/.flake8]
        files: ^learn-greek-easy-backend/
        additional_dependencies:
          - flake8-bugbear
          - flake8-comprehensions

  - repo: https://github.com/pre-commit/mirrors-mypy
    rev: v1.11.0
    hooks:
      - id: mypy
        args: [--config-file=learn-greek-easy-backend/pyproject.toml]
        files: ^learn-greek-easy-backend/src/
        additional_dependencies:
          - types-python-dateutil
          - types-pytz
          - types-redis
          - pydantic
```

### Backend Flake8 Configuration

Create `learn-greek-easy-backend/.flake8`:

```ini
[flake8]
max-line-length = 100
exclude =
    .git,
    __pycache__,
    .venv,
    venv,
    .eggs,
    *.egg,
    dist,
    build,
    alembic/versions,
    .mypy_cache,
    .pytest_cache
ignore =
    E203,  # whitespace before ':' (conflicts with black)
    E266,  # too many leading '#' for block comment
    E501,  # line too long (handled by black)
    W503,  # line break before binary operator (conflicts with black)
per-file-ignores =
    __init__.py:F401
    tests/*:S101
```

### Setup Script

Create `scripts/setup-hooks.sh`:

```bash
#!/bin/bash
set -e

echo "Setting up pre-commit hooks..."

# Check if pre-commit is installed
if ! command -v pre-commit &> /dev/null; then
    echo "Installing pre-commit..."
    pip install pre-commit
fi

# Install hooks
pre-commit install

# Run against all files (first time setup)
echo "Running pre-commit on all files..."
pre-commit run --all-files || true

echo "Pre-commit hooks installed successfully!"
```

---

## CI Linting & Formatting Pipeline

### Philosophy

**CI checks should mirror pre-commit hooks exactly** - if code passes pre-commit locally, it should pass CI, and vice versa.

### Frontend CI Checks

| Check | Command | Purpose |
|-------|---------|---------|
| TypeScript | `npm run type-check` | Type safety validation |
| ESLint | `npm run lint` | Code quality rules |
| Prettier | `npm run format:check` | Code formatting consistency |

### Backend CI Checks

| Check | Command | Purpose |
|-------|---------|---------|
| Black | `poetry run black --check src/ tests/` | Python formatting |
| isort | `poetry run isort --check-only src/ tests/` | Import ordering |
| Flake8 | `poetry run flake8 src/ tests/` | PEP8 + additional rules |
| MyPy | `poetry run mypy src/` | Static type checking |

### Adding Backend npm-style Scripts

Add to `learn-greek-easy-backend/pyproject.toml` for consistency:

```toml
[tool.poetry.scripts]
lint = "scripts.lint:main"
format = "scripts.format:main"
```

Or create `Makefile` in backend directory:

```makefile
# learn-greek-easy-backend/Makefile

.PHONY: lint format format-check type-check test

lint:
	poetry run flake8 src/ tests/

format:
	poetry run black src/ tests/
	poetry run isort src/ tests/

format-check:
	poetry run black --check src/ tests/
	poetry run isort --check-only src/ tests/

type-check:
	poetry run mypy src/

test:
	poetry run pytest tests/ -v

check-all: format-check lint type-check test
```

---

## Security Considerations

### Secrets Management

| Secret | Usage | Storage |
|--------|-------|---------|
| `CODECOV_TOKEN` | Coverage uploads | GitHub Secrets |
| `GITHUB_TOKEN` | Auto-provided | GitHub Actions |

### CI Security Best Practices

1. **Minimize secrets exposure**: Only expose secrets to jobs that need them
2. **Use environment protection**: Consider environment-specific secrets for deploy jobs
3. **Audit workflow permissions**: Use minimal `permissions` block
4. **Pin action versions**: Use SHA or tag versions, not `@main`
5. **Review third-party actions**: Audit before adding new actions

### Workflow Permissions

```yaml
# Add to workflow file
permissions:
  contents: read        # Checkout code
  pull-requests: write  # Comment on PRs
  checks: write         # Create check runs
```

### Dependency Security

```yaml
# Future: Add Dependabot
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/learn-greek-easy-frontend"
    schedule:
      interval: "weekly"
  - package-ecosystem: "pip"
    directory: "/learn-greek-easy-backend"
    schedule:
      interval: "weekly"
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

---

## Implementation Tasks

### Task Breakdown

| # | Task | Priority | Status | Est. Time | Dependencies |
|---|------|----------|--------|-----------|--------------|
| 02.01 | GitHub Actions workflow setup | High | ✅ Done | - | None |
| 02.02 | Fix CI pipeline errors | High | ✅ Done | ~2h | 02.01 |
| 02.03 | Pre-commit hooks setup | Medium | ✅ Done | ~1.5h | None |
| 02.04 | CI linting & formatting | Medium | ✅ Done | 1h | 02.02 |
| 02.05 | CI format check (Frontend) | Medium | ✅ Done | - | Merged into 02.04 |

### Task Details

#### 02.01 - GitHub Actions Workflow Setup (Done)

**Status**: Done

**Completed**:
- Created `.github/workflows/test.yml`
- Frontend unit tests job
- E2E tests job with Playwright
- Backend tests job with PostgreSQL service
- Codecov integration

#### 02.02 - Fix CI Pipeline Errors

**Status**: ✅ COMPLETED (2025-12-03)
**PR**: https://github.com/SimonOsipov/learn-greek-easy/pull/2

**Issues Found & Fixed**:
1. **ESLint linting `html/` build output** - Deleted folder, added to ignores
2. **Node 18 incompatible with Vite 7.x** - Updated to Node 20
3. **`cache: 'pip'` failing** - Removed (project uses Poetry)
4. **Backend as broken submodule** - Converted to regular directory
5. **Import ordering errors** - Auto-fixed with `npm run lint --fix`
6. **ESLint config gaps** - Added globals.node, React readonly, caughtErrors

**Files Modified**:
- `.github/workflows/test.yml` - Node 20, removed cache: pip
- `learn-greek-easy-frontend/.gitignore` - Added `html`
- `learn-greek-easy-frontend/eslint.config.js` - Multiple fixes
- `learn-greek-easy-frontend/package.json` - Updated engines
- 99 files - Import order/prettier auto-fixes
- 121 files - Backend converted from submodule

#### 02.03 - Pre-commit Hooks Setup

**Status**: ✅ COMPLETED (2025-12-03)
**QA Report**: `.claude/qa/02.03-pre-commit-hooks-verification.md`

**Files Created**:
- `.pre-commit-config.yaml` - Main configuration with 15 hooks
- `learn-greek-easy-backend/.flake8` - Enhanced Flake8 config
- `scripts/setup-hooks.sh` - One-command setup script (executable)
- `CLAUDE.md` - Added pre-commit documentation section

**Hooks Configured**:
- General: trailing-whitespace, end-of-file-fixer, check-yaml, check-json, check-added-large-files, check-merge-conflict, detect-private-key, no-commit-to-branch
- Frontend: ESLint (auto-fix), Prettier (auto-format), TypeScript check
- Backend: Black (24.8.0), isort (5.13.2), Flake8 (7.1.0), MyPy (v1.11.0)

**Notes**:
- Pre-existing code quality issues detected (tracked in BUG-006, BUG-007)
- Hooks working correctly - detecting existing technical debt

#### 02.04 - CI Linting & Formatting

**Status**: ✅ COMPLETED (2025-12-03)
**PR**: https://github.com/SimonOsipov/learn-greek-easy/pull/3

**Implementation Completed**:
1. Added `frontend-lint` job with TypeScript, ESLint, Prettier checks
2. Added `backend-lint` job with Black, isort, Flake8, MyPy checks
3. Updated `unit-tests` to depend on `frontend-lint`
4. Updated `backend-tests` to depend on `backend-lint`
5. Proper caching for npm and Poetry dependencies

**Files Modified**:
- `.github/workflows/test.yml` - Added 2 new lint jobs, updated dependencies

#### 02.05 - CI Format Check (Frontend)

**Status**: ✅ COMPLETED (Merged into 02.04)

Prettier format check was included in the `frontend-lint` job as part of task 02.04.

### Execution Order

```
Phase 1: Fix Existing Pipeline (Priority)
  └── 02.02: Debug and fix CI errors
      ├── Check workflow logs
      ├── Fix Poetry/Python issues
      └── Verify service health

Phase 2: Add Code Quality Checks
  ├── 02.04: Backend lint job (parallel)
  │   ├── Black check
  │   ├── isort check
  │   ├── Flake8
  │   └── MyPy
  └── 02.05: Frontend format check (parallel)
      └── Prettier check

Phase 3: Local Developer Experience
  └── 02.03: Pre-commit hooks
      ├── Create config file
      ├── Test locally
      └── Document setup
```

### Validation Checklist

- [x] `pre-commit run --all-files` passes locally
- [x] All CI jobs pass on a test PR
- [x] Code changes trigger correct CI jobs
- [x] Coverage reports upload to Codecov
- [x] Artifact uploads work (Playwright reports)
- [x] CI runs cancel on new pushes (concurrency)

---

## Commands Reference

### Pre-commit Commands

```bash
# Install pre-commit hooks (one-time setup)
pre-commit install

# Run all hooks on staged files
pre-commit run

# Run all hooks on all files
pre-commit run --all-files

# Run specific hook
pre-commit run black --all-files
pre-commit run eslint --all-files

# Update hook versions
pre-commit autoupdate

# Skip hooks temporarily (use sparingly)
git commit --no-verify -m "message"

# Uninstall hooks
pre-commit uninstall
```

### Frontend Lint/Format Commands

```bash
cd learn-greek-easy-frontend

# Check without fixing
npm run lint
npm run format:check
npm run type-check

# Fix automatically
npm run lint:fix
npm run format

# Run all checks
npm run check-all
```

### Backend Lint/Format Commands

```bash
cd learn-greek-easy-backend

# Check without fixing
poetry run black --check src/ tests/
poetry run isort --check-only src/ tests/
poetry run flake8 src/ tests/
poetry run mypy src/

# Fix automatically
poetry run black src/ tests/
poetry run isort src/ tests/

# Or with Makefile (if created)
make format-check
make format
make lint
make type-check
make check-all
```

### GitHub Actions Debugging

```bash
# View workflow runs
gh run list

# View specific run
gh run view <run-id>

# View run logs
gh run view <run-id> --log

# Re-run failed jobs
gh run rerun <run-id>

# Watch run in progress
gh run watch <run-id>
```

---

## References

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Pre-commit Framework](https://pre-commit.com/)
- [Black Formatter](https://black.readthedocs.io/)
- [ESLint](https://eslint.org/)
- [Prettier](https://prettier.io/)
---

**Status**: ✅ COMPLETE (100%) - All tasks (02.01-02.05) completed
