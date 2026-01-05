/**
 * E2E Tests: Token Refresh Flow
 *
 * Verifies the token refresh mechanism behavior:
 * 1. Invalid tokens redirect to login (not silently fail)
 * 2. Fresh tokens do NOT trigger unnecessary refresh requests
 * 3. Multiple page reloads maintain authentication
 *
 * Philosophy: "401 is an error to investigate, not noise to hide"
 *
 * These tests validate the authentication behavior after the fix
 * for the token refresh race condition.
 *
 * NOTE: Testing proactive refresh of expiring tokens is done via unit tests
 * (tokenUtils.test.ts, api.test.ts) because E2E cannot reliably create
 * valid tokens with specific expiry times.
 */

import { test, expect } from '@playwright/test';
import { SEED_USERS, loginViaUI, waitForAppReady } from './helpers/auth-helpers';

test.describe('Token Refresh Flow', () => {
  // Use empty storageState for all tests - we'll handle auth manually
  test.use({ storageState: { cookies: [], origins: [] } });

  test('AUTH-E2E-01: Invalid token with failed refresh redirects to login', async ({ page }) => {
    // Navigate to login page first to be able to set localStorage
    await page.goto('/login');

    // Set up completely invalid auth state
    await page.evaluate(() => {
      localStorage.setItem('auth-storage', JSON.stringify({
        state: {
          token: 'completely.invalid.token',
          refreshToken: 'also.invalid',
          isAuthenticated: true,
          rememberMe: true,
          user: { id: 'fake', email: 'fake@test.com' },
        },
        version: 0,
      }));
    });

    // Try to access protected page
    await page.goto('/dashboard');
    await page.waitForTimeout(3000);

    // Should be redirected to login (401 correctly handled)
    await expect(page).toHaveURL(/\/login/);
  });

  test('AUTH-E2E-02: Fresh token does NOT trigger proactive refresh', async ({ page }) => {
    // Set up listeners FIRST
    const refreshRequests: string[] = [];

    page.on('response', response => {
      if (response.url().includes('/auth/refresh')) {
        refreshRequests.push(response.url());
      }
    });

    // Login normally - token will be fresh (30 min expiry)
    await loginViaUI(page, SEED_USERS.LEARNER);
    await waitForAppReady(page);

    // Reset counter after login (login doesn't trigger refresh)
    refreshRequests.length = 0;

    // Navigate to another page - should NOT trigger refresh
    await page.goto('/decks');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Should NOT see any refresh requests (token is fresh)
    expect(refreshRequests.length).toBe(0);
  });

  test('AUTH-E2E-03: Navigation between pages maintains authentication', async ({ page }) => {
    // This test verifies navigation between pages works without 401s

    // Step 1: Set up listeners FIRST
    const requests401: string[] = [];
    const allApiRequests: string[] = [];

    page.on('response', response => {
      const url = response.url();
      if (response.status() === 401) {
        requests401.push(url);
      }
      if (url.includes('/api/v1/')) {
        allApiRequests.push(url);
      }
    });

    // Step 2: Login normally
    await loginViaUI(page, SEED_USERS.LEARNER);
    await waitForAppReady(page);

    // Reset counters after login
    requests401.length = 0;
    allApiRequests.length = 0;

    // Step 3: Navigate to a different page
    await page.goto('/decks');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Step 4: Navigate to profile
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Step 5: Assertions
    // Zero 401 errors during navigation
    expect(requests401.length).toBe(0);

    // Should have made API calls
    expect(allApiRequests.length).toBeGreaterThan(0);

    // Should still be authenticated
    expect(page.url()).not.toContain('/login');

    // Should see profile page content
    await expect(page.getByRole('heading', { name: /profile/i })).toBeVisible({ timeout: 10000 });
  });
});
