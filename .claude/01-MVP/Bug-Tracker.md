# Bug Tracker

**Project**: Learn Greek Easy - MVP Development
**Document Purpose**: Track bugs discovered during development, verification, and testing
**Created**: 2025-11-01
**Last Updated**: 2025-12-03
**Status**: Active

---

## Table of Contents

1. [Overview](#overview)
2. [Bug Status Categories](#bug-status-categories)
3. [Active Bugs](#active-bugs)
4. [Bug Reporting Guidelines](#bug-reporting-guidelines)

---

## Overview

### Purpose of This Document

This document serves as a centralized tracking system for all bugs discovered during Learn Greek Easy MVP development. It provides:

- **Bug Registry**: Complete record of all active bugs and their current status
- **Priority Tracking**: Severity-based prioritization for fixing bugs
- **Context Documentation**: Detailed reproduction steps and code snippets
- **Quality Metrics**: Understand common bug patterns and areas needing improvement

### When to Report a Bug

Report a bug in this tracker when you discover:

- Incorrect functionality (feature doesn't work as expected)
- User experience issues (confusing behavior, poor UX)
- Performance problems (slow loading, memory leaks)
- Accessibility violations (keyboard navigation broken, missing ARIA labels)
- Visual bugs (layout issues, styling problems)
- Data integrity issues (incorrect calculations, lost data)

**Note**: Don't report here: feature requests, enhancement ideas, or architectural improvements. Those belong in task planning documents.

---

## Bug Status Categories

### Severity Levels

| Severity | Icon | Description | Priority | Examples |
|----------|------|-------------|----------|----------|
| **Critical** | 🔴 | Blocks core functionality, data loss, security issue | Fix immediately | Login broken, data corruption, XSS vulnerability |
| **High** | 🟠 | Major feature broken, severe UX issue | Fix within 24-48 hours | Search returns no results, cards won't flip |
| **Medium** | 🟡 | Feature partially broken, workaround exists | Fix within 1 week | Greek text search case-sensitive, slow filtering |
| **Low** | 🟢 | Minor issue, cosmetic problem | Fix when convenient | Text alignment off, tooltip typo, console warning |

### Bug Status Lifecycle

| Status | Description |
|--------|-------------|
| **Active** | Bug discovered, not yet assigned or in progress |
| **In Progress** | Developer actively working on fix |
| **Fixed** | Fix implemented and deployed |
| **Verified** | Fix tested and confirmed working |
| **Won't Fix** | Bug accepted as current behavior or too low priority |
| **Duplicate** | Bug already reported elsewhere |

---

## Active Bugs

**Total Active Bugs**: 3

| Bug ID | Title | Severity | Status | Discovered | Task | Files Affected |
|--------|-------|----------|--------|------------|------|----------------|
| BUG-003 | Date comparison discrepancy between stats and review API | 🟡 Medium | Partially Fixed | 2025-11-04 | 05.06/05.08 | dateUtils.ts, reviewStatsHelpers.ts, spacedRepetition.ts |
| BUG-006 | Flake8 pre-existing code quality issues | 🟢 Low | Active | 2025-12-03 | 02.03 | Multiple backend files (src/, scripts/) |
| BUG-007 | MyPy type checking errors in production code | 🟡 Medium | Active | 2025-12-03 | 02.03 | 8 files in src/ |

**Note**: BUG-003 code fix has been implemented (date normalization to midnight), but review queue still returns "No cards due" despite statistics showing cards are due. Requires further investigation of mock data structure and queue building logic.

---

## Bug Details

### BUG-003: Date comparison discrepancy between stats and review API

**Status**: ⚠️ Partially Fixed (Requires Further Investigation)
**Severity**: 🟡 Medium
**Priority**: Medium (affects user experience, causes confusion)

**Discovered**: 2025-11-04 during Task 05.06 verification
**Discovered By**: System Analyst during Playwright functional testing
**Related Task**: Task 05.06 (Deck Management Integration)

#### Description

There is a discrepancy between how `reviewStatsHelpers.ts` and `mockReviewAPI.ts` calculate which cards are "due today". The stats helper shows cards due, but when the user clicks "Continue Review", the review page displays "No cards due" error. This creates a confusing user experience where the deck page and review page disagree on the same data.

#### Location

**Primary Files**:
1. `/Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-frontend/src/lib/reviewStatsHelpers.ts` (lines 74-95)
2. `/Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-frontend/src/services/mockReviewAPI.ts` (review queue generation logic)

**Component**: DeckDetailPage → FlashcardReviewPage navigation flow

#### Impact

**User Impact**: Medium-High
- User sees "X cards due for review today"
- User clicks "Continue Review" button
- Page shows "No cards due" error
- User is confused and frustrated - contradictory information

**Business Impact**: Medium
- Negative user experience affects retention
- May cause users to abandon review sessions
- Undermines confidence in spaced repetition algorithm

#### Partial Fix Applied (Task 05.08)

**Date**: 2025-11-04 during Task 05.08
**Fixed By**: Task 05.08 - Testing, Polish, and Documentation

**Files Created**:
1. `/Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-frontend/src/lib/dateUtils.ts` (NEW) - Shared date utility functions

**Files Modified**:
1. `/Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-frontend/src/lib/reviewStatsHelpers.ts` - Updated to use `isCardDueToday()` from dateUtils
2. `/Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-frontend/src/lib/spacedRepetition.ts` - Updated `isCardDue()` to normalize dates to midnight

**Solution Implemented**: Created shared date utility with midnight normalization to ensure consistent date comparison across all modules. Both `reviewStatsHelpers.ts` and `spacedRepetition.ts` now normalize dates to midnight (00:00:00.000) before comparison.

**Verification Results**:
- ✅ TypeScript: 0 errors
- ✅ Build: SUCCESS
- ✅ Date normalization logic correct
- ⚠️ Review queue still returns "No cards due" despite deck stats showing cards due

**Status**: Code fix is correct in principle, but there's a deeper issue with how the review queue retrieves cards. The mock data may not be properly structured, or there's an issue with how `getCardsForDeck()` works. **Requires further investigation**.

#### Next Steps

1. Investigate `getCardsForDeck()` function in `mockReviewData.ts`
2. Check if mock review cards are properly exported and accessible
3. Debug why `getDueCards()` in `mockReviewAPI.ts` returns empty array despite having cards defined
4. Consider adding debug logging to trace card filtering logic

#### Testing Checklist

After full fix is applied:

- [ ] DeckDetailPage shows correct count of due cards
- [ ] Clicking "Continue Review" loads correct cards in review session
- [ ] No "No cards due" error when cards are actually due
- [ ] Cards due yesterday are included in queue
- [ ] Cards due today are included in queue
- [ ] Cards due tomorrow are NOT included in queue
- [ ] New cards (state='new') are included in queue
- [ ] Statistics update correctly after completing review
- [ ] TypeScript compilation passes

---

### BUG-006: Flake8 Pre-existing Code Quality Issues

**Status**: Active
**Severity**: 🟢 Low
**Priority**: Low (code quality, not functional bugs)

**Discovered**: 2025-12-03 during Task 02.03 (Pre-commit Hooks Setup)
**Discovered By**: Pre-commit hooks automated linting
**Related Task**: Task 02.03 (DevOps - Pre-commit Hooks)

#### Description

Pre-commit hooks identified existing Flake8 violations in the backend codebase. These are code quality issues that should be addressed to maintain clean code standards. The issues do not affect functionality but indicate technical debt.

#### Summary

| Issue Type | Count | Description |
|------------|-------|-------------|
| F401 | 35+ | Unused imports |
| F541 | 12 | f-string missing placeholders |
| F841 | 4 | Unused variables |
| C901 | 10 | Function too complex (>10) |
| E402 | 25+ | Module level import not at top |
| E226 | 3 | Missing whitespace around operator |

#### Production Code Issues (Priority)

| File | Line | Issue | Description |
|------|------|-------|-------------|
| `src/api/v1/auth.py` | 22 | F401 | `UserResponse` imported but unused |
| `src/api/v1/auth.py` | 176 | F841 | Variable `e` assigned but never used |
| `src/config.py` | 3 | F401 | `os` imported but unused |
| `src/config.py` | 5 | F401 | `Dict` imported but unused |
| `src/core/redis.py` | 7 | F401 | `redis.asyncio` imported but unused |
| `src/core/security.py` | 28 | F401 | `status` imported but unused |

#### Scripts Issues (Lower Priority)

| File | Issues |
|------|--------|
| `scripts/verify_refresh.py` | C901 (complexity 25), E402, F541 (7 occurrences), E226 |
| `scripts/verify_database_fixtures.py` | C901 (complexity 24) |
| `scripts/verify_pytest_async.py` | C901 (complexity 20) |
| `scripts/verify_parallel_execution.py` | C901 (complexity 13, 19) |
| `scripts/verify_session_management.py` | F401, E226, C901 (complexity 18) |
| `scripts/verify_registration.py` | C901, E402, F541 |
| `scripts/verify_login.py` | F401, E402, F841 |
| `scripts/verify_auth_middleware.py` | C901 (complexity 13) |

#### Note on Alembic

The `alembic/env.py` file has 12 F401 (unused import) warnings. These imports are **intentional** - they ensure SQLAlchemy knows about all models for migration autogeneration. Consider adding to `.flake8` per-file ignores.

#### Recommended Fix

1. **Production code** (`src/`): Remove unused imports and variables
2. **Alembic**: Add to `.flake8`: `alembic/env.py:F401`
3. **Scripts**: Either refactor for complexity or add to lint ignores (verification scripts are not production code)

#### Testing Checklist

- [ ] `poetry run flake8 src/` passes with no errors
- [ ] Backend tests still pass after removing unused imports
- [ ] CI pipeline passes

---

### BUG-007: MyPy Type Checking Errors in Production Code

**Status**: Active
**Severity**: 🟡 Medium
**Priority**: Medium (type safety issues could indicate runtime bugs)

**Discovered**: 2025-12-03 during Task 02.03 (Pre-commit Hooks Setup)
**Discovered By**: Pre-commit hooks automated type checking
**Related Task**: Task 02.03 (DevOps - Pre-commit Hooks)

#### Description

Pre-commit hooks identified 20 MyPy type errors in the backend production code. These indicate potential type safety issues that could lead to runtime errors. Some errors suggest missing model attributes or incorrect type annotations.

#### Summary

| Error Type | Count | Description |
|------------|-------|-------------|
| no-any-return | 8 | Returning `Any` from typed function |
| attr-defined | 6 | Attribute doesn't exist on type |
| arg-type | 1 | Incompatible argument type |
| return-value | 1 | Incompatible return type |
| union-attr | 2 | Attribute access on union with incompatible type |
| valid-type | 1 | Invalid type expression |

#### Detailed Findings

##### `src/services/auth_service.py` (4 errors) - HIGH PRIORITY

```
Line 178: Argument 2 to "verify_password" has incompatible type "str | None"; expected "str"
Line 304: "RefreshToken" has no attribute "is_active"
Line 310: "RefreshToken" has no attribute "email"
Line 333: "RefreshToken" has no attribute "email"
Line 336: Incompatible return value type (got "tuple[str, str, RefreshToken]", expected "tuple[str, str, User]")
```

**Impact**: May indicate missing model attributes on `RefreshToken` or incorrect service implementation.

##### `src/repositories/user.py` (6 errors)

```
Line 181, 198, 216: Returning Any from function declared to return "int"
Line 181, 198, 216: "Result[Any]" has no attribute "rowcount"
```

**Fix**: Use proper SQLAlchemy `Result` type or `CursorResult` for `rowcount`.

##### `src/middleware/auth.py` (3 errors)

```
Line 119, 124, 128: Returning Any from function declared to return "str | None"
```

**Fix**: Add explicit type casts when returning values from JWT decode.

##### `src/core/redis.py` (1 error)

```
Line 71: "Redis[Any]" has no attribute "aclose"; maybe "close"?
```

**Fix**: Use `close()` instead of `aclose()` or check redis-py version compatibility.

##### `src/services/health_service.py` (2 errors)

```
Line 191, 194: Item "BaseException" of "ComponentHealth | BaseException" has no attribute "status"
```

**Fix**: Add type narrowing with `isinstance()` check before accessing `.status`.

##### Other Files

| File | Line | Error |
|------|------|-------|
| `src/config.py` | 120 | no-any-return |
| `src/core/security.py` | 521 | no-any-return |
| `src/repositories/base.py` | 198 | valid-type (method named `list` conflicts) |

#### Recommended Fix Priority

1. **Priority 1**: `auth_service.py` - May indicate actual bugs (missing RefreshToken attributes)
2. **Priority 2**: `user.py` - SQLAlchemy typing issues
3. **Priority 3**: Other `no-any-return` errors - Add explicit type casts

#### Testing Checklist

- [ ] `poetry run mypy src/` passes with no errors
- [ ] RefreshToken model has required attributes (is_active, email)
- [ ] Auth service refresh token flow works correctly
- [ ] All backend tests pass

---

## Bug Reporting Guidelines

### How to Report a New Bug

When you discover a bug, add it to this document following this template:

#### Bug Report Template

```markdown
### BUG-XXX: [Short descriptive title]

**Status**: Active
**Severity**: [🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low]
**Priority**: [Critical | High | Medium | Low]

**Discovered**: YYYY-MM-DD during [Task/Phase]
**Discovered By**: [Name/Role]
**Related Task**: [Task number and name]

#### Description
[Clear description of the bug and why it's incorrect]

#### Location
**File**: /absolute/path/to/file.ts
**Line**: [Line number]
**Function**: [Function name if applicable]

#### Current Code (Bug)
```typescript
// Buggy code snippet
```

#### Expected Code (Fix)
```typescript
// Correct code snippet
```

#### Impact
**User Impact**: [How does this affect users?]
**Business Impact**: [How does this affect the product/business?]

#### Reproduction Steps
1. Step 1
2. Step 2
3. **Observe**: [What happens]
4. **Expected**: [What should happen]

#### Proposed Fix
[Suggested solution with code snippets]

#### Testing Checklist
- [ ] Test case 1
- [ ] Test case 2
```

### Severity Guidelines

**🔴 Critical**: Fix immediately
- Authentication completely broken (can't login/logout)
- Data loss or corruption (user progress deleted)
- Security vulnerability (XSS, SQL injection)
- App crashes on load

**🟠 High**: Fix within 24-48 hours
- Major feature completely non-functional (review session won't start)
- Severe UX issue affecting majority of users
- Performance issue making app unusable (>10s load time)

**🟡 Medium**: Fix within 1 week
- Feature partially broken but workaround exists
- Search returns incorrect results
- Visual bug affecting readability
- Minor data inconsistency

**🟢 Low**: Fix when convenient
- Cosmetic issue (text alignment slightly off)
- Typo in UI text
- Console warning (not error)
- Edge case bug affecting <5% of users

---

## Metrics and Insights

### Bug Statistics (Updated 2025-12-03)

**Total Bugs Discovered**: 7
**Active Bugs**: 3 (1 partially fixed, 2 new)
**Fixed Bugs**: 4
**Won't Fix**: 0
**Duplicate**: 0

**By Severity**:
- 🔴 Critical: 1 (fixed - BUG-004)
- 🟠 High: 0
- 🟡 Medium: 3 (1 fixed - BUG-001, 1 partially fixed - BUG-003, 1 active - BUG-007)
- 🟢 Low: 3 (2 fixed - BUG-002, BUG-005, 1 active - BUG-006)

**By Component**:
- Mock API Services: 1 (fixed - BUG-001)
- Review System: 1 (partially fixed - BUG-003)
- Chart Components: 1 (fixed - BUG-004)
- Analytics Hooks: 1 (fixed - BUG-004)
- Backend Code Quality: 1 (active - BUG-006)
- Backend Type Safety: 1 (active - BUG-007)

---

**Last Updated**: 2025-12-03
**Version**: 1.6
