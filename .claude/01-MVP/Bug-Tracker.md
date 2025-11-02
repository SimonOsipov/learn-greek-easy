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

**Total Active Bugs**: 0

| Bug ID | Title | Severity | Status | Discovered | Assigned | Task | Files Affected |
|--------|-------|----------|--------|------------|----------|------|----------------|
| - | No active bugs | - | - | - | - | - | - |

---

## Fixed Bugs

**Total Fixed Bugs**: 1

| Bug ID | Title | Severity | Fixed Date | Fixed By | Task | PR/Commit |
|--------|-------|----------|------------|----------|------|-----------|
| BUG-001 | Greek text search not case-insensitive | 🟡 Medium | 2025-11-02 | Task 04.08 | 04.08 | mockDeckAPI.ts:31 |

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

### Bug Statistics (Updated Weekly)

**Current Sprint (2025-11-02)**:
- Total Bugs Discovered: 1
- Active Bugs: 0
- Fixed Bugs: 1
- Won't Fix: 0
- Duplicate: 0

**By Severity**:
- 🔴 Critical: 0
- 🟠 High: 0
- 🟡 Medium: 1 (fixed)
- 🟢 Low: 0

**By Component**:
- Mock API Services: 1 (fixed)
- Deck Components: 0
- Authentication: 0
- UI/Styling: 0

**Resolution Time**:
- BUG-001: Discovered 2025-11-01, Fixed 2025-11-02 (1 day turnaround)

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

**Last Updated**: 2025-11-01
**Next Review**: Weekly during Task 04 development
**Version**: 1.0
