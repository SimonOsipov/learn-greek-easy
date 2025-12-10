# Contributing to Learn Greek Easy

Thank you for your interest in contributing to Learn Greek Easy! This guide will help you get started with the development workflow.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Development Workflow](#development-workflow)
3. [PR Preview Deployments](#pr-preview-deployments)
4. [Code Style](#code-style)
5. [Testing](#testing)
6. [Pre-commit Hooks](#pre-commit-hooks)

---

## Getting Started

### Prerequisites

- Node.js 20+
- Python 3.11+
- Docker and Docker Compose
- Poetry (Python package manager)

### Setup

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/learn-greek-easy.git
   cd learn-greek-easy
   ```

2. **Set up the development environment**
   ```bash
   # Start database and cache services
   docker-compose -f docker-compose.dev.yml up -d postgres redis

   # Install backend dependencies
   cd learn-greek-easy-backend
   poetry install

   # Install frontend dependencies
   cd ../learn-greek-easy-frontend
   npm install
   ```

3. **Configure environment variables**
   ```bash
   # Backend
   cp learn-greek-easy-backend/.env.example learn-greek-easy-backend/.env
   ```

4. **Run the development servers**
   ```bash
   # Terminal 1: Backend
   cd learn-greek-easy-backend
   poetry run uvicorn src.main:app --reload

   # Terminal 2: Frontend
   cd learn-greek-easy-frontend
   npm run dev
   ```

For detailed setup instructions, see [CLAUDE.md](CLAUDE.md).

---

## Development Workflow

### Creating a Pull Request

1. **Create a feature branch from `main`:**
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes and commit:**
   ```bash
   git add .
   git commit -m "Description of changes"
   ```

3. **Push and create PR:**
   ```bash
   git push -u origin feature/your-feature-name
   gh pr create --title "Your PR title" --body "Description of changes"
   ```

### Branch Naming Convention

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feature/description` | `feature/add-dark-mode` |
| Bug Fix | `fix/description` | `fix/login-validation` |
| Refactor | `refactor/description` | `refactor/api-cleanup` |

---

## PR Preview Deployments

When you open a pull request, a preview environment is automatically deployed. You'll receive:

1. **Live URLs** - Test your changes on a real deployment
2. **Test Results** - Performance, visual, and accessibility reports
3. **Status Checks** - Pass/fail indicators on your PR

### What Gets Tested

| Test | Purpose | Threshold |
|------|---------|-----------|
| Health Check | Verify deployment works | All endpoints 200 |
| Lighthouse (Desktop) | Performance metrics | Score >= 80 |
| Lighthouse (Mobile) | Mobile performance | Score >= 70 |
| Visual Regression | UI change detection | Review in Chromatic |
| Accessibility | WCAG 2.1 AA compliance | No critical violations |

### Tips for PRs

- **Wait for preview deployment** before requesting review
- **Check Lighthouse scores** for performance regressions
- **Review Chromatic** for visual changes (approve intentional changes in Chromatic dashboard)
- **Address accessibility violations** before merge
- **Use appropriate PR labels** to control test behavior

### PR Labels

Use labels to control which tests run:

| Label | Effect | When to Use |
|-------|--------|-------------|
| `visual-test` | Force full visual regression suite | Major UI changes, new pages |
| `skip-visual` | Skip visual regression tests | Backend-only changes |
| `skip-e2e` | Skip E2E tests | Use sparingly |
| (no label) | Smart mode - based on changed files | Most PRs |

### Skipping Preview

Documentation-only changes (`.md` files, `docs/` folder) skip preview automatically.

For detailed preview deployment documentation, see [docs/pr-preview-deployments.md](docs/pr-preview-deployments.md).

---

## Code Style

### Frontend (TypeScript/React)

```bash
cd learn-greek-easy-frontend

# Check for linting errors
npm run lint

# Fix formatting issues
npm run format

# Check TypeScript types
npm run type-check
```

**Key conventions:**
- Use functional components with hooks
- TypeScript strict mode enabled
- ESLint + Prettier for formatting
- Import order: React, external libs, internal modules, styles

### Backend (Python)

```bash
cd learn-greek-easy-backend

# Format code
poetry run black src/ tests/

# Sort imports
poetry run isort src/ tests/

# Check linting
poetry run flake8 src/ tests/

# Check types
poetry run mypy src/
```

**Key conventions:**
- Python 3.11+ type hints required
- Black for formatting (88 char line length)
- isort for import sorting
- Docstrings for public functions

---

## Testing

### Frontend Tests

```bash
cd learn-greek-easy-frontend

# Run unit tests
npm run test

# Run with watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e

# Run E2E with browser visible
npm run test:e2e:headed
```

### Backend Tests

```bash
cd learn-greek-easy-backend

# Run all tests
poetry run pytest

# Run with coverage
poetry run pytest --cov=src --cov-report=term-missing

# Run specific test file
poetry run pytest tests/unit/test_auth.py

# Run with verbose output
poetry run pytest -vv
```

### Test Guidelines

1. **Write tests for new features** - Unit tests for logic, integration tests for API endpoints
2. **Maintain test coverage** - Aim for 80%+ coverage
3. **Use descriptive test names** - `test_login_fails_with_invalid_password`
4. **Follow AAA pattern** - Arrange, Act, Assert

---

## Pre-commit Hooks

Pre-commit hooks run automatically on `git commit` to ensure code quality.

### First-Time Setup

```bash
# Install pre-commit
pip install pre-commit

# Set up hooks
pre-commit install
```

### Daily Usage

Hooks run automatically. If they fail:

1. Review auto-fixed files
2. Stage changes: `git add .`
3. Commit again: `git commit`

### Manual Commands

```bash
# Run on staged files only
pre-commit run

# Run on entire codebase
pre-commit run --all-files

# Update hook versions
pre-commit autoupdate

# Skip hooks (emergency only!)
git commit --no-verify -m "message"
```

---

## Questions?

- **Project Documentation**: See [CLAUDE.md](CLAUDE.md) for detailed project configuration
- **Bug Reports**: Open an issue with reproduction steps
- **Feature Requests**: Open an issue describing the use case
- **Security Issues**: Email the maintainers directly (do not open public issues)

Thank you for contributing!
