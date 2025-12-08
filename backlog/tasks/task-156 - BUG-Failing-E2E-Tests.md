---
id: task-156
title: 'BUG: Failing E2E Tests'
status: In Progress
assignee: []
created_date: '2025-12-08 07:12'
updated_date: '2025-12-08 10:15'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
There is, occasionally, flaky or failed E2E tests - https://github.com/SimonOsipov/learn-greek-easy/actions/runs/20022783041

We need to make sure that we don't have flaky tests, since it fails the pipeline.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan: Fix Flaky E2E Test

### Problem Analysis
The test `keyboard-navigation.spec.ts:33` "All interactive elements should be keyboard accessible" is flaky due to:
1. **Race condition**: No wait for page content to load after navigation
2. **Selector logic flaw**: Comparing different element sets

### Prerequisites
- [ ] Understand the dashboard page structure
- [ ] Verify test environment setup

### Step 1: Add Proper Wait for Page Load
**Goal**: Ensure dashboard content is fully loaded before counting elements

**File to modify**: `learn-greek-easy-frontend/tests/e2e/keyboard-navigation.spec.ts`

**Actions**:
1. After `page.goto('/dashboard')`, add wait for a reliable selector
2. Wait for either dashboard content or a loading state to resolve
3. Use `waitForSelector` with appropriate timeout

**Code change**:
```typescript
await loginViaLocalStorage(page);
await page.goto('/dashboard');

// Wait for dashboard to fully load
await page.waitForSelector('[data-testid="dashboard-content"], h1, h2', { timeout: 10000 });
```

### Step 2: Fix Selector Logic Flaw
**Goal**: Make the focusable elements comparison accurate

**Problem**: Line 42-45 compares `button, a` (without inputs) to `button, a, input, textarea, select`

**Actions**:
1. Use the same selector for both counts, OR
2. Simplify the test to just verify interactive elements exist and are focusable

**Code change** (Option - simplify test):
```typescript
// Count interactive elements
const interactiveSelector = 'button, a, input, textarea, select';
const interactiveElements = await page.locator(interactiveSelector).count();
expect(interactiveElements).toBeGreaterThan(0);

// Verify none have tabindex="-1" (explicitly unfocusable)
const unfocusableCount = await page
  .locator(`${interactiveSelector}[tabindex="-1"]`)
  .count();
expect(unfocusableCount).toBe(0);
```

### Step 3: Add Retry Logic (Optional Enhancement)
**Goal**: Make the test more resilient

**Actions**:
1. Consider using Playwright's built-in retry mechanisms
2. Use `expect.poll()` or `toPass()` for assertions that may need retries

### Step 4: Verify Fix
**Goal**: Ensure the test passes consistently

**Actions**:
1. Run the test locally multiple times
2. Run across all browsers (chromium, firefox, webkit)
3. Verify no regressions in other keyboard navigation tests

**Verification command**:
```bash
cd learn-greek-easy-frontend && npm run test:e2e -- --grep "keyboard accessible" --repeat-each=5
```

### Files to Modify
- `learn-greek-easy-frontend/tests/e2e/keyboard-navigation.spec.ts` (lines 33-46)

### Estimated Complexity
- **Low** - Single file change with straightforward fix
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implementation Complete

**PR**: https://github.com/SimonOsipov/learn-greek-easy/pull/28

**Changes Made**:
1. Added `waitForSelector('h1, h2, [data-testid]', { timeout: 10000 })` after navigation to ensure dashboard loads
2. Fixed selector logic:
   - Use proper selector for focusable elements (excluding `tabindex="-1"` and disabled)
   - Verify focusable elements exist (`> 0`)
   - Add actual Tab key test to verify keyboard navigation works
3. Skip webkit browser due to different tab focus behavior (consistent with other keyboard tests in the file)

**Test Results**:
- All keyboard navigation tests pass (22 passed, 2 skipped for webkit)
- Specific test passes on chromium and firefox
<!-- SECTION:NOTES:END -->
