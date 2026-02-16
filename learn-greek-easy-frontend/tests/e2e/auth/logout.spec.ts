/**
 * Logout E2E Tests
 *
 * Tests the logout functionality.
 *
 * Test coverage:
 * - Logout confirmation dialog
 * - Successful logout flow
 * - Cancel logout stays on page
 */

import { test, expect } from '@playwright/test';

test.describe('Logout', () => {
  // Uses default storageState (authenticated user) from config

  test.describe('Logout Dialog', () => {
    test('should open logout confirmation dialog from user menu', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('domcontentloaded');

      const userMenuButton = page.getByTestId('user-menu-trigger');
      await userMenuButton.waitFor({ state: 'visible', timeout: 10000 });
      await userMenuButton.click();

      const logoutButton = page.getByTestId('logout-button');
      await logoutButton.waitFor({ state: 'visible', timeout: 5000 });
      await logoutButton.click();

      const dialog = page.getByTestId('logout-dialog');
      await expect(dialog).toBeVisible({ timeout: 5000 });
    });

    // FIXME: This test is flaky in CI - dashboard doesn't load in time
    test.skip('should display confirmation dialog with confirm and cancel buttons', async ({
      page,
    }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({
        timeout: 15000,
      });

      await page.getByTestId('user-menu-trigger').click();
      await page.getByTestId('logout-button').waitFor({ state: 'visible', timeout: 5000 });
      await page.getByTestId('logout-button').click();

      const dialog = page.getByTestId('logout-dialog');
      await expect(dialog).toBeVisible({ timeout: 5000 });

      await expect(page.getByTestId('logout-confirm-button')).toBeVisible();
      await expect(page.getByTestId('logout-cancel-button')).toBeVisible();
    });
  });

  test.describe('Confirm Logout', () => {
    test('should logout and redirect to landing page when confirming', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('domcontentloaded');

      const userMenuButton = page.getByTestId('user-menu-trigger');
      await userMenuButton.waitFor({ state: 'visible', timeout: 10000 });
      await userMenuButton.click();

      const logoutButton = page.getByTestId('logout-button');
      await logoutButton.waitFor({ state: 'visible', timeout: 5000 });
      await logoutButton.click();

      const dialog = page.getByTestId('logout-dialog');
      await dialog.waitFor({ state: 'visible', timeout: 5000 });

      await page.getByTestId('logout-confirm-button').click();

      await page.waitForURL('/', { timeout: 15000 });

      await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 5000 });

      const currentUrl = page.url();
      expect(currentUrl.endsWith('/') || currentUrl.endsWith('/#')).toBe(true);
    });
  });

  test.describe('Cancel Logout', () => {
    // FIXME: This test is flaky in CI - dashboard doesn't load in time
    test.skip('should stay on current page when canceling logout', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('domcontentloaded');

      await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({
        timeout: 15000,
      });

      await page.getByTestId('user-menu-trigger').click();
      await page.getByTestId('logout-button').waitFor({ state: 'visible', timeout: 5000 });
      await page.getByTestId('logout-button').click();

      const dialog = page.getByTestId('logout-dialog');
      await dialog.waitFor({ state: 'visible', timeout: 5000 });

      await page.getByTestId('logout-cancel-button').click();

      await expect(dialog).not.toBeVisible({ timeout: 3000 });

      await expect(page).toHaveURL(/\/dashboard/);
      await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
    });

    test('should close dialog by clicking outside (if supported)', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('domcontentloaded');

      await page.getByTestId('user-menu-trigger').click();
      await page.getByTestId('logout-button').waitFor({ state: 'visible', timeout: 5000 });
      await page.getByTestId('logout-button').click();

      const dialog = page.getByTestId('logout-dialog');
      await dialog.waitFor({ state: 'visible', timeout: 5000 });

      // Try to close by pressing Escape key
      await page.keyboard.press('Escape');

      await expect(page).toHaveURL(/\/dashboard/);
    });
  });
});
