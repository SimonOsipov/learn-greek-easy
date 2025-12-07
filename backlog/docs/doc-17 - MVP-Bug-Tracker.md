---
id: doc-17
title: MVP - Bug Tracker
type: other
created_date: '2025-12-07 09:25'
---
# MVP - Bug Tracker

**Last Updated**: 2025-12-03
**Total Active Bugs**: 3

## Severity Levels

| Severity | Icon | Priority | Examples |
|----------|------|----------|----------|
| Critical | 🔴 | Fix immediately | Login broken, data loss, security |
| High | 🟠 | 24-48 hours | Major feature broken |
| Medium | 🟡 | 1 week | Feature partially broken |
| Low | 🟢 | When convenient | Cosmetic issues |

## Active Bugs

| Bug ID | Title | Severity | Status |
|--------|-------|----------|--------|
| BUG-003 | Date comparison discrepancy | 🟡 Medium | Partially Fixed |
| BUG-006 | Flake8 code quality issues | 🟢 Low | Active |
| BUG-007 | MyPy type checking errors | 🟡 Medium | Active |

## Bug Details

### BUG-003: Date Comparison Discrepancy
**Status**: Partially Fixed | **Severity**: 🟡 Medium

Stats show cards due, but review page shows "No cards due". Date normalization fix applied, but deeper issue with review queue building.

**Files**: dateUtils.ts, reviewStatsHelpers.ts, spacedRepetition.ts

### BUG-006: Flake8 Pre-existing Issues
**Status**: Active | **Severity**: 🟢 Low

51 Flake8 violations: F401 (unused imports), F541, F841, C901 (complexity), E402

**Files**: Multiple backend files (src/, scripts/, alembic/)

### BUG-007: MyPy Type Errors
**Status**: Active | **Severity**: 🟡 Medium

17 MyPy errors: no-any-return, attr-defined, arg-type, union-attr

**Priority Files**:
- auth_service.py (4 errors) - RefreshToken missing attributes
- user.py (6 errors) - SQLAlchemy Result typing
- auth.py, redis.py, health_service.py

## Statistics

- **Total Discovered**: 7
- **Fixed**: 4 (BUG-001, 002, 004, 005)
- **Active**: 3
- **By Severity**: 🔴 1 fixed, 🟡 3, 🟢 3
