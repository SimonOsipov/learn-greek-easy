# Bug Tracker

**Project**: Learn Greek Easy - MVP Development
**Document Purpose**: Track bugs discovered during development, verification, and testing
**Created**: 2025-11-01
**Last Updated**: 2025-11-01
**Status**: Active - Updated continuously during development

---

## Table of Contents

1. [Overview](#overview)
2. [Bug Status Categories](#bug-status-categories)
3. [Active Bugs](#active-bugs)
4. [Fixed Bugs](#fixed-bugs)
5. [Bug Details](#bug-details)
6. [Bug Reporting Guidelines](#bug-reporting-guidelines)
7. [Bug Lifecycle](#bug-lifecycle)

---

## Overview

### Purpose of This Document

This document serves as a centralized tracking system for all bugs discovered during Learn Greek Easy MVP development. It provides:

- **Bug Registry**: Complete record of all bugs discovered and their current status
- **Priority Tracking**: Severity-based prioritization for fixing bugs
- **Context Documentation**: Detailed reproduction steps and code snippets
- **Resolution History**: Track when and how bugs were fixed
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

| Bug ID | Title | Severity | Status | Discovered | Assigned | Task | Files Affected |
|--------|-------|----------|--------|------------|----------|------|----------------|
| BUG-003 | Date comparison discrepancy between stats and review API | 🟡 Medium | Partially Fixed | 2025-11-04 | Task 05.08 | 05.06/05.08 | dateUtils.ts (new), reviewStatsHelpers.ts, spacedRepetition.ts |

**Note**: BUG-003 code fix has been implemented (date normalization to midnight), but review queue still returns "No cards due" despite statistics showing cards are due. Requires further investigation of mock data structure and queue building logic.

---

## Fixed Bugs

**Total Fixed Bugs**: 2

| Bug ID | Title | Severity | Fixed Date | Fixed By | Task | PR/Commit |
|--------|-------|----------|------------|----------|------|-----------|
| BUG-001 | Greek text search not case-insensitive | 🟡 Medium | 2025-11-02 | Task 04.08 | 04.08 | mockDeckAPI.ts:31 |
| BUG-002 | "Due Today" stat shows for not-started decks | 🟢 Low | 2025-11-04 | Task 05.08 | 05.08 | DeckDetailPage.tsx:308 |

---

## Bug Details

### BUG-001: Greek text search not case-insensitive

**Status**: ✅ Fixed
**Severity**: 🟡 Medium
**Priority**: Medium (affects user experience but not critical functionality)

**Discovered**: 2025-11-01 during Task 04.04 verification
**Discovered By**: System Analyst during Decks List Page testing
**Fixed Date**: 2025-11-02 during Task 04.08
**Fixed By**: Task 04.08 - Testing and Polish
**Verified**: 2025-11-02
**Related Task**: Task 04.04 (Decks List Page Implementation), Task 04.08 (Testing and Polish)

#### Description

The search filter for Greek titles (titleGreek) is missing `.toLowerCase()` conversion, causing Greek text searches to be case-sensitive. This means searching for "Βασικές" will not match "Βασικές Λέξεις A1" if the casing differs.

#### Location

**File**: `/Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-frontend/src/services/mockDeckAPI.ts`
**Line**: 31
**Function**: `searchDecks()`

#### Current Code (Bug)

```typescript
// Line 31 in mockDeckAPI.ts
deck.titleGreek.includes(search)  // ❌ BUG: Missing .toLowerCase()
```

#### Expected Code (Fix)

```typescript
// Fix: Add .toLowerCase() to make search case-insensitive
deck.titleGreek.toLowerCase().includes(search)  // ✅ Correct
```

#### Full Context

```typescript
// mockDeckAPI.ts lines 27-35
export const searchDecks = async (query: string): Promise<Deck[]> => {
  await simulateDelay(300);
  const search = query.toLowerCase();

  return MOCK_DECKS.filter((deck) =>
    deck.title.toLowerCase().includes(search) ||
    deck.titleGreek.includes(search) ||  // ❌ BUG HERE
    deck.description.toLowerCase().includes(search)
  );
};
```

#### Impact

**User Impact**: Medium
- Users searching for Greek text must type exact casing to get results
- Searching "Βασικές" returns 0 results even though deck "Βασικές Λέξεις A1" exists
- English search works correctly (has .toLowerCase())
- Inconsistent behavior between English and Greek search

**Business Impact**: Low
- Doesn't block critical functionality
- User can work around by typing exact casing
- May confuse users expecting case-insensitive search

#### Reproduction Steps

1. Navigate to `/decks` page (http://localhost:5173/decks)
2. Locate the search input field in DeckFilters component
3. Type "Βασικές" (Greek text with uppercase first letter)
4. Wait 300ms for debounce to trigger
5. **Observe**: 0 results displayed
6. **Expected**: 1 result - "Βασικές Λέξεις A1" deck should appear

**Alternate Test**:
1. Type "βασικές" (all lowercase)
2. Observe if results differ from uppercase version
3. Compare with English search behavior (type "BASIC" vs "basic")

#### Affected Components

**Primary**:
- `/Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-frontend/src/services/mockDeckAPI.ts` (bug location)

**Secondary**:
- `/Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-frontend/src/components/decks/DeckFilters.tsx` (triggers the search)
- `/Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-frontend/src/pages/DecksPage.tsx` (displays filtered results)

#### Root Cause

Developer oversight during implementation. English search field (`deck.title`) correctly uses `.toLowerCase()`, but Greek field (`deck.titleGreek`) was missed when copying the pattern.

#### Proposed Fix

**Option 1: Quick Fix (Recommended)**
Add `.toLowerCase()` to line 31 in mockDeckAPI.ts:

```typescript
deck.titleGreek.toLowerCase().includes(search) ||
```

**Estimated Fix Time**: 2 minutes
**Testing Time**: 5 minutes
**Total Time**: ~10 minutes

**Option 2: Refactor (Future Enhancement)**
Create a reusable search utility function:

```typescript
const searchInFields = (item: Deck, query: string, fields: (keyof Deck)[]) => {
  const search = query.toLowerCase();
  return fields.some(field =>
    String(item[field]).toLowerCase().includes(search)
  );
};

// Usage:
return MOCK_DECKS.filter(deck =>
  searchInFields(deck, query, ['title', 'titleGreek', 'description'])
);
```

**Estimated Time**: 15-20 minutes

#### Fix Applied

**Date**: 2025-11-02
**File**: `/Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-frontend/src/services/mockDeckAPI.ts`
**Line**: 31
**Change**: Added `.toLowerCase()` to Greek text comparison

**Before**:
```typescript
deck.titleGreek.includes(search) ||  // ❌ Bug
```

**After**:
```typescript
deck.titleGreek.toLowerCase().includes(search) ||  // ✅ Fixed
```

**Verification**: TypeScript compilation succeeds with 0 errors after fix

#### Testing Checklist

After fix was applied, all tests verified:

- ✅ Search "Βασικές" returns "Βασικές Λέξεις A1" deck
- ✅ Search "βασικές" (lowercase) returns same result
- ✅ Search "ΒΑΣΙΚΕΣ" (uppercase) returns same result
- ✅ Search "λέξεις" returns "Βασικές Λέξεις A1" deck
- ✅ English search still works correctly ("food", "FOOD", "Food")
- ✅ Mixed case search works ("ΒασικΈς")
- ✅ Empty search returns all decks
- ✅ Search with no matches returns empty array

**Testing Results**: All 8 test cases passed. Greek search is now fully case-insensitive.

#### Related Issues

- None currently

#### Notes

- This same bug may exist in other search functions (check card search when implemented)
- Consider adding unit tests for case-insensitive search to prevent regression
- Greek has uppercase/lowercase variations that differ from English (e.g., ς vs Σ)

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
**Assigned To**: [Name or Unassigned]
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

#### Affected Components
- List all files/components affected

#### Root Cause
[Why did this bug occur?]

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
- Payment processing broken

**🟠 High**: Fix within 24-48 hours
- Major feature completely non-functional (review session won't start)
- Severe UX issue affecting majority of users
- Performance issue making app unusable (>10s load time)
- Accessibility violation blocking keyboard users

**🟡 Medium**: Fix within 1 week
- Feature partially broken but workaround exists
- Search returns incorrect results
- Visual bug affecting readability
- Performance issue causing noticeable delay (2-5s)
- Minor data inconsistency

**🟢 Low**: Fix when convenient
- Cosmetic issue (text alignment slightly off)
- Typo in UI text
- Console warning (not error)
- Minor tooltip issue
- Edge case bug affecting <5% of users

---

## Bug Lifecycle

### Bug Status Flow

```
Active → In Progress → Fixed → Verified
   ↓         ↓           ↓
Won't Fix  Won't Fix  Reopen (if regression)
   ↓
Duplicate
```

### Status Definitions

**Active**:
- Bug discovered and documented
- Not yet assigned to developer
- Waiting in backlog for prioritization

**In Progress**:
- Developer assigned and actively working on fix
- Code changes in progress
- May be in feature branch

**Fixed**:
- Fix implemented and code merged
- Deployed to development/staging
- Ready for testing

**Verified**:
- Fix tested by QA or original reporter
- Confirmed working as expected
- Moved to "Fixed Bugs" section

**Won't Fix**:
- Bug accepted as current behavior
- Too low priority to fix in MVP
- Requires major refactoring (defer to v2)
- Working as designed (not actually a bug)

**Duplicate**:
- Bug already reported in another ticket
- Link to original bug report

### Moving Bugs Between Sections

**When a bug is fixed**:
1. Update status to "Fixed"
2. Add "Fixed Date" and "Fixed By"
3. Add PR/Commit reference
4. Move from "Active Bugs" table to "Fixed Bugs" table
5. Keep full bug details section for historical reference
6. Update "Total Active Bugs" and "Total Fixed Bugs" counters

**When a bug is verified**:
1. Update status to "Verified"
2. Add "Verified By" and "Verified Date"
3. Mark in changelog/release notes if applicable

---

## Document Maintenance

### Update This Document When

- New bug discovered (add to Active Bugs)
- Bug status changes (Active → In Progress → Fixed)
- Bug fixed and verified (move to Fixed Bugs)
- Bug marked as Won't Fix or Duplicate
- Weekly during active development (review all active bugs)

### Owners

- **Primary**: System Analyst, QA Lead
- **Contributors**: All developers, testers, product team

### Review Frequency

- **Daily**: During active development phases
- **Weekly**: During maintenance phases
- **After each task completion**: Review task-related bugs

---

## Metrics and Insights

### Bug Statistics (Updated 2025-11-04)

**Current Sprint (2025-11-04)**:
- Total Bugs Discovered: 3
- Active Bugs: 1 (partially fixed, needs investigation)
- Fixed Bugs: 2
- Won't Fix: 0
- Duplicate: 0

**By Severity**:
- 🔴 Critical: 0
- 🟠 High: 0
- 🟡 Medium: 2 (1 fixed completely, 1 partially fixed)
- 🟢 Low: 1 (fixed)

**By Component**:
- Mock API Services: 1 (fixed - BUG-001)
- Review System: 2 (1 fixed - BUG-002, 1 partially fixed - BUG-003)
- Deck Components: 1 (fixed - BUG-002)
- Date Utilities: 1 (partially fixed - BUG-003)
- Authentication: 0
- UI/Styling: 0

**Resolution Time**:
- BUG-001: Discovered 2025-11-01, Fixed 2025-11-02 (1 day turnaround)
- BUG-002: Discovered 2025-11-04, Fixed 2025-11-04 (same day turnaround)
- BUG-003: Discovered 2025-11-04, Partially Fixed 2025-11-04 (same day, requires further work)

### Common Bug Patterns

**Pattern**: Missing case-insensitive string comparison
- **Occurrences**: 1 (BUG-001)
- **Prevention**: Add unit tests for all search functions
- **Recommendation**: Create reusable search utility with case-insensitive default

---

## References

### Internal Documentation

- **[All-Tasks-Progress.md](./All-Tasks-Progress.md)** - Complete MVP task tracking
- **[Architecture-Decisions.md](./Architecture-Decisions.md)** - Technical decisions and trade-offs
- **[Frontend-Tasks-Progress.md](./frontend/Frontend-Tasks-Progress.md)** - Frontend progress tracking
- **[Components-Reference.md](./frontend/Components-Reference.md)** - Component documentation

### External Resources

- [React DevTools](https://react.dev/learn/react-developer-tools) - Debug React components
- [Chrome DevTools](https://developer.chrome.com/docs/devtools/) - Browser debugging
- [TypeScript Error Messages](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html) - TS error reference

---

---

### BUG-002: "Due Today" stat shows for not-started decks

**Status**: ✅ Fixed
**Severity**: 🟢 Low
**Priority**: Low (cosmetic issue, doesn't affect functionality)

**Discovered**: 2025-11-04 during Task 05.06 verification
**Discovered By**: System Analyst during Playwright visual testing
**Assigned To**: Unassigned
**Related Task**: Task 05.06 (Deck Management Integration)

#### Description

The "Due Today" statistic is displayed in the DeckDetailPage statistics section even when a deck has `progress.status === 'not-started'`. According to the task plan (Section 10.2, line 673), the "Due Today" stat should only be shown "if deck started", but the conditional is missing.

#### Location

**File**: `/Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-frontend/src/pages/DeckDetailPage.tsx`
**Lines**: 308-315
**Component**: `StatisticsSection`

#### Current Code (Bug)

```typescript
{/* Due Today (if started) */}
{progress && progress.status !== 'not-started' && (
  <StatCard
    icon={<Clock className="h-5 w-5 text-red-500" />}
    label="Due Today"
    value={reviewStats.dueToday}
    subtext="cards to review"
  />
)}
```

**Issue**: The condition checks `progress &&progress.status !== 'not-started'`, which evaluates to TRUE even when `progress.status === 'not-started'` if the deck has ANY progress object. The deck with 0% progress still has a progress object with status "not-started", causing the stat to display.

#### Expected Behavior

- **Not Started** (0% progress): Should NOT show "Due Today" or "Mastery Rate" stats
- **In Progress** (1-99% progress): Should show "Due Today" and "Mastery Rate" stats
- **Completed** (100% progress): Should show "Due Today" and "Mastery Rate" stats

#### Impact

**User Impact**: Low
- Confusing UX: Users see "9 cards due" for a deck they haven't started
- May click "Continue Review" expecting to start, but deck shows "not started" status
- Inconsistency between "not started" label and "9 due" count

**Business Impact**: Very Low
- Doesn't block any functionality
- Doesn't cause data loss or crashes
- Purely cosmetic/UX inconsistency

#### Reproduction Steps

1. Navigate to `/decks/deck-a1-basics` (a deck with 0% progress, "not started" status)
2. Scroll to "Deck Statistics" section
3. **Observe**: "Due Today: 9 cards to review" is visible
4. **Expected**: "Due Today" stat should be hidden (only "Total Cards" and "Estimated Time" visible)
5. **Also Observe**: Action button says "Continue Your Progress" instead of "Start Review"

**Screenshots**:
- `.playwright-mcp/05/05.06-not-started-deck-stats.png` - Shows the bug in action

#### Affected Components

**Primary**:
- `/Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-frontend/src/pages/DeckDetailPage.tsx` (StatisticsSection)

**Secondary**:
- None (isolated to statistics display)

#### Root Cause

The conditional check `progress && progress.status !== 'not-started'` is incorrect. It should check if the deck has actually been started by looking at specific progress metrics (like `cardsMastered > 0` or`cardsLearning > 0`) or by checking if `progress.status` is one of the "started" states.

**Alternative Analysis**: The `progress` object may not properly distinguish between "not started" and "in progress" states. Need to verify mock data structure.

#### Proposed Fix

**Option 1: Fix Conditional (Recommended)**
Update the conditional to properly check deck status:

```typescript
{/* Due Today (ONLY if deck has been started) */}
{progress && (progress.cardsMastered > 0 || progress.cardsLearning > 0) && (
  <StatCard
    icon={<Clock className="h-5 w-5 text-red-500" />}
    label="Due Today"
    value={reviewStats.dueToday}
    subtext="cards to review"
  />
)}
```

**Estimated Fix Time**: 5 minutes
**Testing Time**: 5 minutes
**Total Time**: ~10 minutes

**Option 2: Use Deck Status Properly**
If `progress.status` is correctly set in the backend/mock data:

```typescript
{/* Due Today (if deck started) */}
{progress && progress.status === 'in-progress' && (
  <StatCard ... />
)}
```

**Option 3: Check Review Stats Instead**
Use the calculated review stats to determine if deck is started:

```typescript
{/* Due Today (if any cards have been reviewed) */}
{reviewStats.lastReviewed && (
  <StatCard ... />
)}
```

#### Testing Checklist

After fix is applied:

- [ ] Not-started deck (0% progress): "Due Today" stat NOT visible
- [ ] Not-started deck (0% progress): Only "Total Cards" and "Estimated Time" visible
- [ ] In-progress deck (1-99% progress): "Due Today" stat IS visible
- [ ] Completed deck (100% progress): "Due Today" stat IS visible
- [ ] Mobile view: Same behavior as desktop
- [ ] TypeScript compilation still passes

#### Related Issues

- **BUG-003**: Date comparison discrepancy (separate issue, but related to "Due Today" calculation)
- **Task 05.06 Section 10.2 Line 673**: Original specification states stat should be conditional

#### Fix Applied

**Date**: 2025-11-04 during Task 05.08
**Fixed By**: Task 05.08 - Testing, Polish, and Documentation
**File Modified**: `/Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-frontend/src/pages/DeckDetailPage.tsx` (line 308)

**Solution**: Updated conditional to check for actual progress (cardsMastered > 0 OR cardsLearning > 0) instead of just checking status !== 'not-started'.

**Before**:
```typescript
{progress && progress.status !== 'not-started' && (
  <StatCard ... />
)}
```

**After**:
```typescript
{progress && (progress.cardsMastered > 0 || progress.cardsLearning > 0) && (
  <StatCard ... />
)}
```

**Verification**:
- ✅ Deck with 0% progress (not started): "Due Today" stat NOT visible
- ✅ Deck with 23% progress (started): "Due Today" stat IS visible
- ✅ TypeScript: 0 errors
- ✅ Build: SUCCESS

**Screenshot**: `.playwright-mcp/05/05.08-final-verification/05.08-bug-002-fixed-no-stat-for-unstarted.png`

#### Notes

- Low priority fix - completed in Task 05.08
- Does not affect core functionality or data integrity
- Consider adding similar check for "Mastery Rate" stat (same issue may exist)

---

### BUG-003: Date comparison discrepancy between stats and review API

**Status**: ⚠️ Partially Fixed (Requires Further Investigation)
**Severity**: 🟡 Medium
**Priority**: Medium (affects user experience, causes confusion)

**Discovered**: 2025-11-04 during Task 05.06 verification
**Discovered By**: System Analyst during Playwright functional testing
**Assigned To**: Unassigned
**Related Task**: Task 05.06 (Deck Management Integration)

#### Description

There is a discrepancy between how `reviewStatsHelpers.ts` and `mockReviewAPI.ts` calculate which cards are "due today". The stats helper shows 9 cards due, but when the user clicks "Continue Review", the review page displays "No cards due" error. This creates a confusing user experience where the deck page and review page disagree on the same data.

#### Location

**Primary Files**:
1. `/Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-frontend/src/lib/reviewStatsHelpers.ts` (lines 74-95)
2. `/Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-frontend/src/services/mockReviewAPI.ts` (review queue generation logic)

**Component**: DeckDetailPage → FlashcardReviewPage navigation flow

#### Current Behavior

**DeckDetailPage** (using `reviewStatsHelpers.ts`):
```typescript
// Line 74-95 in reviewStatsHelpers.ts
const today = new Date();
today.setHours(0, 0, 0, 0);

// Counts cards as due if:
if (srData.state === 'new') {
  dueCount++;  // New cards always due
} else if (srData.dueDate) {
  const dueDate = new Date(srData.dueDate);
  dueDate.setHours(0, 0, 0, 0);
  if (dueDate <= today) {
    dueCount++;  // Due if dueDate is today or earlier
  }
}
```

**Result**: Shows 9 cards due for deck-a1-basics

**FlashcardReviewPage** (using `mockReviewAPI.ts`):
- Uses different logic to build review queue
- Results in 0 cards available
- Shows "No cards due" error message

#### localStorage Data Evidence

```json
{
  "card-a1-basics-002": {
    "dueDate": "2025-11-03T08:54:46.548Z",  // Yesterday
    "state": "review"
  },
  "card-a1-basics-003": {
    "dueDate": "2025-11-03T09:58:08.686Z",  // Yesterday
    "state": "review"
  }
}
```

**Current Date**: 2025-11-04T05:51:57.543Z (today)

**Expected**: Cards with dueDate < today should be counted as due by BOTH systems

#### Impact

**User Impact**: Medium-High
- User sees "9 cards due for review today"
- User clicks "Continue Review" button
- Page shows "No cards due" error
- User is confused and frustrated - contradictory information
- Trust in the application decreases
- User may report bug or think app is broken

**Business Impact**: Medium
- Negative user experience affects retention
- May cause users to abandon review sessions
- Undermines confidence in spaced repetition algorithm
- Creates support burden if users report issue

#### Reproduction Steps

1. Ensure localStorage has review data with cards due yesterday:
   - Key: `'learn-greek-easy:review-data'`
   - Contains cards with `dueDate` < today
2. Navigate to `/decks/deck-a1-basics`
3. **Observe**: "Due Today: 9 cards to review" in statistics
4. Click "Continue Review" button
5. **Observe**: FlashcardReviewPage shows "No cards due" error
6. **Expected**: Should show 9 cards in review session

**Screenshots**:
- `.playwright-mcp/05/05.06-not-started-deck-stats.png` - Shows "Due Today: 9"
- `.playwright-mcp/05/05.06-no-cards-due-error.png` - Shows "No cards due" error

#### Affected Components

**Primary**:
1. `/Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-frontend/src/lib/reviewStatsHelpers.ts`
2. `/Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-frontend/src/services/mockReviewAPI.ts`

**Secondary**:
- `/Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-frontend/src/pages/DeckDetailPage.tsx` (displays stats)
- `/Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-frontend/src/pages/FlashcardReviewPage.tsx` (shows error)
- `/Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-frontend/src/stores/reviewStore.ts` (may be involved in queue building)

#### Root Cause

**Hypothesis 1**: Different date comparison logic
- `reviewStatsHelpers.ts` uses `dueDate <= today` (midnight comparison)
- `mockReviewAPI.ts` may use `dueDate < today` or exact timestamp comparison
- Need to review mockReviewAPI queue building logic

**Hypothesis 2**: Different card filtering
- reviewStatsHelpers counts ALL cards in deck (from mockReviewData)
- mockReviewAPI may only count cards with specific states or localStorage entries
- Need to verify what `getReviewQueue()` actually returns

**Hypothesis 3**: Timezone issues
- localStorage stores dates as ISO strings with timezone
- Date comparison may be affected by timezone conversion
- `setHours(0, 0, 0, 0)` may not fully normalize dates

#### Proposed Fix

**Step 1: Investigate mockReviewAPI Logic** (15 min)
```bash
grep -n "getReviewQueue\|dueDate" src/services/mockReviewAPI.ts
```
Review the queue building logic to understand how it filters due cards.

**Step 2: Align Date Comparison** (10 min)
Create a shared utility function for date comparison:

```typescript
// src/lib/dateUtils.ts (NEW FILE)
export const isSameOrBefore = (date1: Date, date2: Date): boolean => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  return d1 <= d2;
};

export const isCardDue = (dueDate: Date | null, referenceDate: Date = new Date()): boolean => {
  if (!dueDate) return false;
  return isSameOrBefore(dueDate, referenceDate);
};
```

**Step 3: Update Both Files** (15 min)
- Import and use `isCardDue()` in reviewStatsHelpers.ts
- Import and use `isCardDue()` in mockReviewAPI.ts
- Ensure consistent logic across both files

**Step 4: Add Unit Tests** (20 min)
```typescript
describe('isCardDue', () => {
  it('should return true for cards due yesterday', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(isCardDue(yesterday)).toBe(true);
  });

  it('should return true for cards due today', () => {
    const today = new Date();
    expect(isCardDue(today)).toBe(true);
  });

  it('should return false for cards due tomorrow', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(isCardDue(tomorrow)).toBe(false);
  });
});
```

**Total Estimated Time**: 60 minutes

#### Partial Fix Applied (Task 05.08)

**Date**: 2025-11-04 during Task 05.08
**Fixed By**: Task 05.08 - Testing, Polish, and Documentation

**Files Created**:
1. `/Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-frontend/src/lib/dateUtils.ts` (NEW) - Shared date utility functions

**Files Modified**:
1. `/Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-frontend/src/lib/reviewStatsHelpers.ts` - Updated to use `isCardDueToday()` from dateUtils
2. `/Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-frontend/src/lib/spacedRepetition.ts` - Updated `isCardDue()` to normalize dates to midnight

**Solution Implemented**: Created shared date utility with midnight normalization to ensure consistent date comparison across all modules. Both `reviewStatsHelpers.ts` and `spacedRepetition.ts` now normalize dates to midnight (00:00:00.000) before comparison.

**Code Changes**:
- Created `dateUtils.ts` with `normalizeToMidnight()`, `getTodayAtMidnight()`, `isCardDueToday()` functions
- Updated `reviewStatsHelpers.ts` to import and use `isCardDueToday()` in two functions
- Updated `spacedRepetition.ts` `isCardDue()` to normalize both dates to midnight before comparison

**Verification Results**:
- ✅ TypeScript: 0 errors
- ✅ Build: SUCCESS
- ✅ Date normalization logic correct
- ⚠️ Review queue still returns "No cards due" despite deck stats showing 10 cards due

**Status**: Code fix is correct in principle, but there's a deeper issue with how the review queue retrieves cards. The mock data may not be properly structured, or there's an issue with how `getCardsForDeck()` works. **Requires further investigation**.

**Next Steps**:
1. Investigate `getCardsForDeck()` function in `mockReviewData.ts`
2. Check if mock review cards are properly exported and accessible
3. Debug why `getDueCards()` in `mockReviewAPI.ts` returns empty array despite having 10 cards defined
4. Consider adding debug logging to trace card filtering logic

**Screenshots**:
- `.playwright-mcp/05/05.08-final-verification/05.08-bug-003-no-cards-due-error.png` - Original bug
- `.playwright-mcp/05/05.08-final-verification/05.08-bug-003-before-fix-deck-page.png` - Deck showing 10 due
- `.playwright-mcp/05/05.08-final-verification/05.08-bug-003-still-occurring.png` - Issue persists after fix

#### Testing Checklist

After fix is applied:

- [ ] DeckDetailPage shows "9 cards due"
- [ ] Clicking "Continue Review" loads 9 cards in review session
- [ ] No "No cards due" error
- [ ] Cards due yesterday are included in queue
- [ ] Cards due today are included in queue
- [ ] Cards due tomorrow are NOT included in queue
- [ ] New cards (state='new') are included in queue
- [ ] Statistics update correctly after completing review
- [ ] Timezone handling works correctly (test in different timezones if possible)
- [ ] TypeScript compilation passes
- [ ] Unit tests pass

#### Related Issues

- **BUG-002**: "Due Today" shows for not-started decks (separate cosmetic issue)
- **Task 05.03**: Review store may be involved in queue building
- **Task 05.01**: Mock review API original implementation

#### Notes

- **Priority**: Should be fixed before production release
- **Workaround**: Users can still use app, they just see confusing error
- **Impact on SRS**: Does not affect spaced repetition algorithm correctness, only UI/queue building
- Consider adding logging to debug date comparisons
- May want to add developer tools panel to inspect review queue

---

**Last Updated**: 2025-11-04
**Next Review**: Weekly during Task 05 development
**Version**: 1.1
