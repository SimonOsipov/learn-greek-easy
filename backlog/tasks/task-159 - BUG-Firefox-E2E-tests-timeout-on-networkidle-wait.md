---
id: task-159
title: 'BUG: Firefox E2E tests timeout on networkidle wait'
status: To Do
assignee: []
created_date: '2025-12-08 10:34'
labels:
  - bug
  - e2e
  - frontend
  - flaky-test
  - firefox
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Problem

E2E tests timeout in Firefox (60s) when using `waitForLoadState('networkidle')` in the auth helper.

## Error Details

**Location:** `tests/e2e/helpers/auth-helpers.ts:121`

```typescript
// Now navigate to the page - auth state will already be present
await page.goto('/');
await page.waitForLoadState('networkidle');  // <-- Times out in Firefox
```

**Error:**
```
Test timeout of 60000ms exceeded.
Error: page.waitForLoadState: Test timeout of 60000ms exceeded.
   at helpers/auth-helpers.ts:121
```

## Affected Tests

Any test using `loginViaLocalStorage()` can timeout in Firefox:
- `accessibility.spec.ts:46` - Decks page accessibility
- `auth.spec.ts:72` - Protected routes authentication
- Multiple other tests using the auth helper

## Root Cause

`networkidle` waits until there are no more than 0-2 network connections for 500ms. This is unreliable because:
1. Firefox handles network events differently than Chromium
2. Analytics scripts keep network active
3. Long-polling/WebSocket connections prevent "idle" state
4. CI environment has slower/different network behavior

## Suggested Fix

Replace `networkidle` with a more reliable wait strategy:

**Option 1 - Use domcontentloaded (fastest):**
```typescript
await page.goto('/');
await page.waitForLoadState('domcontentloaded');
```

**Option 2 - Wait for specific element:**
```typescript
await page.goto('/');
await page.waitForSelector('nav, [data-testid="app-loaded"]', { timeout: 10000 });
```

**Option 3 - Combine both:**
```typescript
await page.goto('/');
await page.waitForLoadState('domcontentloaded');
await page.waitForSelector('nav', { timeout: 10000 });
```

## References

- GitHub Actions failure: https://github.com/SimonOsipov/learn-greek-easy/actions/runs/20024489549/job/57419124057
- Playwright docs on networkidle: https://playwright.dev/docs/api/class-page#page-wait-for-load-state
- Related to task-156 (E2E test failures)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Firefox E2E tests pass without timeout
- [ ] #2 loginViaLocalStorage() uses reliable wait strategy (not networkidle)
- [ ] #3 All 3 browser E2E jobs pass in CI
<!-- AC:END -->
