# Bug Tracker

**Project**: Learn Greek Easy - MVP Development
**Document Purpose**: Track bugs discovered during development, verification, and testing
**Created**: 2025-11-01
**Last Updated**: 2025-11-06
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

**Total Active Bugs**: 1

| Bug ID | Title | Severity | Status | Discovered | Task | Files Affected |
|--------|-------|----------|--------|------------|------|----------------|
| BUG-003 | Date comparison discrepancy between stats and review API | 🟡 Medium | Partially Fixed | 2025-11-04 | 05.06/05.08 | dateUtils.ts, reviewStatsHelpers.ts, spacedRepetition.ts |

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

### Bug Statistics (Updated 2025-11-06)

**Total Bugs Discovered**: 5
**Active Bugs**: 1 (partially fixed)
**Fixed Bugs**: 4
**Won't Fix**: 0
**Duplicate**: 0

**By Severity**:
- 🔴 Critical: 1 (fixed - BUG-004)
- 🟠 High: 0
- 🟡 Medium: 2 (1 fixed - BUG-001, 1 partially fixed - BUG-003)
- 🟢 Low: 2 (fixed - BUG-002, BUG-005)

**By Component**:
- Mock API Services: 1 (fixed - BUG-001)
- Review System: 1 (partially fixed - BUG-003)
- Chart Components: 1 (fixed - BUG-004)
- Analytics Hooks: 1 (fixed - BUG-004)

---

**Last Updated**: 2025-11-06
**Version**: 1.5
