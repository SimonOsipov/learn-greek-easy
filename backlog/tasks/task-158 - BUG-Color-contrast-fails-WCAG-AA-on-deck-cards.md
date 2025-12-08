---
id: task-158
title: 'BUG: Color contrast fails WCAG AA on deck cards'
status: In Progress
assignee: []
created_date: '2025-12-08 10:32'
updated_date: '2025-12-08 10:43'
labels:
  - bug
  - accessibility
  - frontend
  - wcag
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Problem

The Decks page fails accessibility tests due to insufficient color contrast on deck card labels.

## Error Details

**Test:** `accessibility.spec.ts:46` - "Decks page should have no accessibility violations"

**Failing Element:**
```html
<p class="text-xs text-gray-500">Mastery</p>
```

**Color Contrast Analysis:**
| Metric | Current Value | Required |
|--------|---------------|----------|
| Foreground color | `#959ba5` (text-gray-500) | - |
| Background color | `#f8f9fa` (bg-bg-page) | - |
| Contrast ratio | **2.65:1** | **4.5:1** (WCAG AA) |
| Font size | 12px (small text) | - |

**WCAG Violation:** Color contrast of 2.65 does not meet the minimum ratio of 4.5:1 for small text (< 18px normal / < 14px bold).

## Affected Components

The `text-gray-500` class is used in deck card stat labels:
- "Cards" label
- "Due" label
- "Mastery" label

Location: Deck card component in the decks listing page.

## Suggested Fix

Change `text-gray-500` to `text-gray-600` for these labels:
- `text-gray-600` = `#4b5563` which gives contrast ratio of ~5.9:1 (passes WCAG AA)

Alternatively, use the semantic color `text-muted-foreground` if it has sufficient contrast.

## Related

- GitHub Actions failure: https://github.com/SimonOsipov/learn-greek-easy/actions/runs/20024489549
- Related to task-156 (E2E test failures)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Deck card labels have contrast ratio >= 4.5:1
- [ ] #2 Accessibility test `Decks page should have no accessibility violations` passes
- [ ] #3 No visual regression - labels remain readable and aesthetically appropriate
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

### Prerequisites
- [ ] Ensure frontend development environment is set up (Node.js 20+, npm 10+)
- [ ] Ensure E2E test dependencies are installed (`npm install` in frontend directory)

### Step 1: Identify All Affected Lines in DeckCard Component
**Goal**: Locate all instances of `text-gray-500` that need to be changed to `text-gray-600`

**File**: `/Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-frontend/src/components/decks/DeckCard.tsx`

**Lines requiring changes**:

| Line | Current | Change To | Context |
|------|---------|-----------|---------|
| 82 | `text-sm text-gray-500` | `text-sm text-gray-600` | English subtitle text |
| 127 | `text-xs text-gray-500` | `text-xs text-gray-600` | "X% Complete" progress text |
| 140 | `text-xs text-gray-500` | `text-xs text-gray-600` | "Cards" label |
| 146 | `text-xs text-gray-500` | `text-xs text-gray-600` | "Time" label |
| 152 | `text-xs text-gray-500` | `text-xs text-gray-600` | "Mastery" label |

**Note**: The task description mentions only Cards, Due, and Mastery labels, but the actual code shows "Time" instead of "Due". All 5 instances of `text-gray-500` should be updated for consistency and full WCAG AA compliance.

### Step 2: Make the CSS Class Changes
**Goal**: Update all 5 occurrences of `text-gray-500` to `text-gray-600`

**Actions**:
1. Open `/Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-frontend/src/components/decks/DeckCard.tsx`
2. Find and replace `text-gray-500` with `text-gray-600` on lines 82, 127, 140, 146, and 152
3. Save the file

**Color Contrast Verification**:
- `text-gray-600` = `#4b5563`
- Background `bg-bg-page` = `#f8f9fa` (from tailwind.config.js line 39)
- Expected contrast ratio: ~5.9:1 (passes WCAG AA requirement of 4.5:1)

### Step 3: Run Accessibility E2E Test Locally
**Goal**: Verify the fix resolves the accessibility violation

**Commands**:
```bash
cd /Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-frontend
npm run test:e2e -- tests/e2e/accessibility.spec.ts --grep "Decks page should have no accessibility violations"
```

**Expected Result**: Test should pass without color-contrast violations

**Alternative (full test suite)**:
```bash
npm run test:e2e -- tests/e2e/accessibility.spec.ts
```

### Step 4: Visual Verification
**Goal**: Ensure labels remain readable and aesthetically appropriate (no visual regression)

**Actions**:
1. Start the development server: `npm run dev`
2. Navigate to the Decks page
3. Verify that:
   - Stat labels ("Cards", "Time", "Mastery") are clearly visible
   - English subtitle text is readable
   - "X% Complete" text under progress bar is visible
   - Overall card appearance maintains design consistency

**Note**: The codebase already uses `text-gray-600` extensively (found in 20+ locations including DeckDetailPage.tsx), so this change aligns with existing patterns.

### Step 5: Final Verification
**Goal**: Ensure implementation is complete and all acceptance criteria are met

**Actions**:
1. Run full E2E test suite to ensure no regressions:
   ```bash
   npm run test:e2e
   ```
2. Verify against acceptance criteria:
   - [ ] Deck card labels have contrast ratio >= 4.5:1 (text-gray-600 provides ~5.9:1)
   - [ ] Accessibility test passes
   - [ ] No visual regression

### Estimated Effort
- **Total steps**: 5
- **Complexity**: Low
- **Time estimate**: ~15-30 minutes
- **Risk**: Very low (simple CSS class change, follows existing patterns)

### Additional Notes

**Why fix ALL 5 instances instead of just the 3 mentioned?**
1. All 5 use the same problematic `text-gray-500` class on small text
2. Consistency - all labels/muted text in the card should have same contrast
3. Proactive accessibility compliance - prevents future test failures
4. The accessibility test checks the entire Decks page, not individual elements

**Pattern consistency**: The rest of the codebase (especially `DeckDetailPage.tsx`) already uses `text-gray-600` for similar muted/label text, so this change aligns with existing conventions.
<!-- SECTION:PLAN:END -->
