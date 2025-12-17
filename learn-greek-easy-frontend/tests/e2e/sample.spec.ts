/**
 * Sample E2E Test - Validates Playwright Setup
 */

import { test, expect } from '@playwright/test';

// Tests that require authentication (default - uses learner storageState from config)
test.describe('Playwright Setup Validation - Authenticated', () => {
  test('should load homepage', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Learn Greek Easy/i);
  });

  test('should access dashboard when authenticated', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: /your progress/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /active decks/i })).toBeVisible();
  });
});

// Tests that require NO authentication
test.describe('Playwright Setup Validation - Unauthenticated', () => {
  // Override storageState to be empty (no auth)
  test.use({ storageState: { cookies: [], origins: [] } });

  test('should navigate to login page', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL('/login');
    await expect(page.getByTestId('login-card')).toBeVisible();
    await expect(page.getByTestId('login-title')).toBeVisible();
    await expect(page.getByTestId('login-title')).toHaveText('Καλώς ήρθατε!');
  });

  test('should redirect to login when accessing protected route unauthenticated', async ({
    page,
  }) => {
    // Navigate to protected route - should redirect to login since no auth
    await page.goto('/');

    // Should redirect to login
    await page.waitForURL('/login', { timeout: 10000 });
    await page.waitForLoadState('domcontentloaded');

    await expect(page).toHaveURL('/login');
    await expect(page.getByTestId('login-card')).toBeVisible();
    await expect(page.getByTestId('login-title')).toBeVisible();
    await expect(page.getByTestId('login-title')).toHaveText('Καλώς ήρθατε!');
  });
});
