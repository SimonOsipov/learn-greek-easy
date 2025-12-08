---
id: task-160
title: 'BUG: Firefox E2E tests timeout on auth/navigation'
status: Done
assignee: []
created_date: '2025-12-08 12:17'
labels:
  - bug
  - e2e-tests
  - firefox
  - flaky-test
  - frontend
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Problem

Firefox E2E tests intermittently fail with timeout errors on page navigation and authentication state handling.

## Error Details

**Test:** Various auth and navigation tests in Firefox
**Error:** `page.waitForLoadState: Test timeout of 60000ms exceeded`
**Location:** `helpers/auth-helpers.ts:121`

```
Error: page.waitForLoadState: Test timeout of 60000ms exceeded.

   at helpers/auth-helpers.ts:121

     119 |   // Now navigate to the page - auth state will already be present
     120 |   await page.goto('/');
   > 121 |   await page.waitForLoadState('networkidle');
```

## Affected Tests

- `auth-Authentication-Flow` tests
- `deck-browsing-Deck-Browsing` tests
- Any test using `setupAuthenticatedPage` helper

## Observations

- **Chromium:** PASSES consistently
- **WebKit:** PASSES consistently
- **Firefox:** FAILS intermittently with timeouts

## Possible Causes

1. Firefox is slower in CI environment and 60s timeout is insufficient
2. `networkidle` wait strategy may not work reliably in Firefox
3. Race condition in auth state initialization for Firefox

## Suggested Investigation

1. Check if increasing timeout resolves the issue
2. Consider using `domcontentloaded` instead of `networkidle` for Firefox
3. Add Firefox-specific wait conditions in auth helpers
4. Check if this correlates with CI environment resource constraints

## Related

- Discovered during task-158 CI run
- GitHub Actions run: https://github.com/SimonOsipov/learn-greek-easy/actions/runs/20026336482
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Firefox E2E tests pass consistently in CI
- [x] #2 No timeout errors on auth/navigation tests
- [x] #3 Test reliability matches Chromium and WebKit
<!-- AC:END -->

## Implementation Notes

### Resolution (PR #30)

Fixed Firefox E2E timeout issue by replacing `networkidle` wait strategy with `domcontentloaded`:

**Changes made:**
- Updated `auth-helpers.ts` to use `domcontentloaded` instead of `networkidle` for Firefox
- All browsers now pass consistently in CI
- PR: https://github.com/SimonOsipov/learn-greek-easy/pull/30
