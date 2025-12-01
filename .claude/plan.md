# Implementation Plan: Task 04.06 - Configure Coverage Reporting

**Task**: Configure comprehensive code coverage reporting using pytest-cov
**Based on**: [04.06-coverage-reporting-plan.md](.claude/01-MVP/backend/04/04.06-coverage-reporting-plan.md)
**Estimated Duration**: 30-45 minutes

---

## Current State Analysis

### What Exists:
- `pytest-cov` is already installed (v5.0.0)
- Basic coverage configuration in `pyproject.toml` (lines 158-175)
- `.gitignore` already includes coverage files (htmlcov/, .coverage, coverage.xml)
- GitHub Actions workflow exists but only for frontend tests

### What's Missing:
- `branch = true` for branch coverage
- `fail_under = 90` threshold enforcement
- `[tool.coverage.html]` section
- `[tool.coverage.xml]` section
- `--cov-branch` and `--cov-fail-under=90` in pytest addopts
- Backend tests job in GitHub Actions
- Verification script

---

## Implementation Steps

### Step 1: Update pyproject.toml - Coverage Configuration
**File**: `/Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-backend/pyproject.toml`

**Changes**:
1. Enhance `[tool.coverage.run]` section:
   - Add `branch = true`
   - Add `parallel = true`
   - Update `omit` patterns to exclude `__init__.py` and `constants.py`

2. Enhance `[tool.coverage.report]` section:
   - Add `fail_under = 90`
   - Add `show_missing = true`
   - Add `skip_covered = false`
   - Add `precision = 1`
   - Add `sort = "Cover"`
   - Expand `exclude_lines` patterns

3. Add `[tool.coverage.html]` section:
   - `directory = "htmlcov"`
   - `title = "Learn Greek Easy Backend - Coverage Report"`

4. Add `[tool.coverage.xml]` section:
   - `output = "coverage.xml"`

5. Update `addopts` in `[tool.pytest.ini_options]`:
   - Add `--cov-branch`
   - Add `--cov-fail-under=90`

### Step 2: Update .gitignore
**File**: `/Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-backend/.gitignore`

**Changes**:
- Add `coverage.json` (for JSON reports)
- Verify all coverage patterns are present

### Step 3: Create Verification Script
**File**: `/Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-backend/scripts/verify_coverage_config.py`

**Contents**:
- Check pytest-cov installation
- Verify pyproject.toml has all required sections
- Test coverage report generation (HTML, XML, terminal)
- Test fail_under enforcement
- Test branch coverage

### Step 4: Update GitHub Actions Workflow
**File**: `/Users/samosipov/Downloads/learn-greek-easy/.github/workflows/test.yml`

**Changes**:
- Add new `backend-tests` job after existing frontend jobs
- Configure PostgreSQL service container
- Set up Python 3.14 with Poetry
- Run tests with coverage
- Upload coverage to Codecov
- Upload HTML report as artifact

### Step 5: Verification
1. Run pytest to verify coverage configuration works
2. Verify HTML report generates at `htmlcov/index.html`
3. Verify XML report generates at `coverage.xml`
4. Verify fail_under threshold works
5. Run verification script

---

## Files to Modify

| File | Action | Description |
|------|--------|-------------|
| `learn-greek-easy-backend/pyproject.toml` | Modify | Update coverage configuration |
| `learn-greek-easy-backend/.gitignore` | Modify | Add coverage.json |
| `learn-greek-easy-backend/scripts/verify_coverage_config.py` | Create | Verification script |
| `.github/workflows/test.yml` | Modify | Add backend tests job |

---

## Acceptance Criteria

- [ ] `branch = true` enabled in coverage config
- [ ] `fail_under = 90` enforced (build fails if coverage < 90%)
- [ ] HTML reports generate at `htmlcov/`
- [ ] XML reports generate at `coverage.xml`
- [ ] Terminal reports show missing lines
- [ ] Verification script passes all checks
- [ ] GitHub Actions includes backend tests job
- [ ] pytest runs with coverage by default (via addopts)

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Current coverage is 84%, below 90% threshold | Initially set `fail_under=80`, document plan to improve |
| Async code coverage issues | pytest-asyncio already configured with `asyncio_mode = "auto"` |
| GitHub Actions Python 3.14 availability | Use `3.14-dev` or fall back to `3.13` |

---

## Post-Implementation Tasks (Out of Scope)

These tasks are noted for future work but NOT part of this implementation:
- Improve coverage for `src/api/v1/auth.py` (58% → 85%)
- Improve coverage for `src/db/session.py` (29% → 70%)
- Improve coverage for `src/db/dependencies.py` (25% → 70%)
- Add Codecov badge to README

---

**Ready for approval.**
