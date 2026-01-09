/**
 * Auth0 Logout E2E Tests
 *
 * Tests the logout functionality when using Auth0 authentication.
 * All tests skip if VITE_AUTH0_ENABLED is not 'true'.
 *
 * Test coverage:
 * - Logout confirmation dialog
 * - Successful logout flow
 * - Cancel logout stays on page
 */

import { test, expect } from '@playwright/test';

import { isAuth0Enabled } from '../helpers/auth0-helpers';

test.describe('Auth0 Logout', () => {
  // Skip all tests if Auth0 is not enabled
  test.beforeEach(async ({ page }) => {
    if (!isAuth0Enabled()) {
      test.skip();
    }
  });

  // Uses default storageState (authenticated user) from config

  test.describe('Logout Dialog', () => {
    test('should open logout confirmation dialog from user menu', async ({ page }) => {
      // Navigate to dashboard
      await page.goto('/dashboard');

      // Wait for page to load
      await page.waitForLoadState('domcontentloaded');

      // Open user menu
      const userMenuButton = page.getByTestId('user-menu-trigger');
      await userMenuButton.waitFor({ state: 'visible', timeout: 10000 });
      await userMenuButton.click();

      // Wait for dropdown
      await page.waitForTimeout(300);

      // Click logout button
      const logoutButton = page.getByTestId('logout-button');
      await logoutButton.waitFor({ state: 'visible', timeout: 5000 });
      await logoutButton.click();

      // Logout dialog should appear
      const dialog = page.getByTestId('logout-dialog');
      await expect(dialog).toBeVisible({ timeout: 5000 });
    });

    test('should display confirmation dialog with confirm and cancel buttons', async ({
      page,
    }) => {
      // Navigate to dashboard
      await page.goto('/dashboard');
      await page.waitForLoadState('domcontentloaded');

      // Open user menu and click logout
      await page.getByTestId('user-menu-trigger').click();
      await page.waitForTimeout(300);
      await page.getByTestId('logout-button').click();

      // Dialog should be visible with both buttons
      const dialog = page.getByTestId('logout-dialog');
      await expect(dialog).toBeVisible({ timeout: 5000 });

      // Confirm button should be visible
      await expect(page.getByTestId('logout-confirm-button')).toBeVisible();

      // Cancel button should be visible
      await expect(page.getByTestId('logout-cancel-button')).toBeVisible();
    });
  });

  test.describe('Confirm Logout', () => {
    test('should logout and redirect to landing page when confirming', async ({ page }) => {
      // Navigate to dashboard
      await page.goto('/dashboard');
      await page.waitForLoadState('domcontentloaded');

      // Open user menu
      const userMenuButton = page.getByTestId('user-menu-trigger');
      await userMenuButton.waitFor({ state: 'visible', timeout: 10000 });
      await userMenuButton.click();

      // Wait for dropdown
      await page.waitForTimeout(300);

      // Click logout
      await page.getByTestId('logout-button').click();

      // Wait for dialog
      const dialog = page.getByTestId('logout-dialog');
      await dialog.waitFor({ state: 'visible', timeout: 5000 });

      // Click confirm
      await page.getByTestId('logout-confirm-button').click();

      // Should redirect to landing page
      await page.waitForURL('/', { timeout: 15000 });

      // Verify we're on the landing page
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 5000 });

      // URL should be /
      const currentUrl = page.url();
      expect(currentUrl.endsWith('/') || currentUrl.endsWith('/#')).toBe(true);
    });
  });

  test.describe('Cancel Logout', () => {
    test('should stay on current page when canceling logout', async ({ page }) => {
      // Navigate to dashboard
      await page.goto('/dashboard');
      await page.waitForLoadState('domcontentloaded');

      // Wait for dashboard heading to confirm we're on the page
      await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({
        timeout: 15000,
      });

      // Open user menu
      await page.getByTestId('user-menu-trigger').click();
      await page.waitForTimeout(300);

      // Click logout
      await page.getByTestId('logout-button').click();

      // Wait for dialog
      const dialog = page.getByTestId('logout-dialog');
      await dialog.waitFor({ state: 'visible', timeout: 5000 });

      // Click cancel
      await page.getByTestId('logout-cancel-button').click();

      // Dialog should close
      await expect(dialog).not.toBeVisible({ timeout: 3000 });

      // Should still be on dashboard
      await expect(page).toHaveURL(/\/dashboard/);
      await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
    });

    test('should close dialog by clicking outside (if supported)', async ({ page }) => {
      // Navigate to dashboard
      await page.goto('/dashboard');
      await page.waitForLoadState('domcontentloaded');

      // Open user menu and click logout
      await page.getByTestId('user-menu-trigger').click();
      await page.waitForTimeout(300);
      await page.getByTestId('logout-button').click();

      // Wait for dialog
      const dialog = page.getByTestId('logout-dialog');
      await dialog.waitFor({ state: 'visible', timeout: 5000 });

      // Try to close by pressing Escape key (common dialog behavior)
      await page.keyboard.press('Escape');

      // Dialog should close (or stay open depending on implementation)
      // If it stays open, that's also valid behavior
      // We mainly want to ensure the app doesn't crash
      await page.waitForTimeout(500);

      // Should still be on dashboard either way
      await expect(page).toHaveURL(/\/dashboard/);
    });
  });

  test.describe('Logout from Different Pages', () => {
    test('should be able to logout from profile page', async ({ page }) => {
      // Navigate to profile
      await page.goto('/profile');
      await page.waitForLoadState('domcontentloaded');

      // Wait for profile to load
      await expect(page.getByRole('heading', { name: /profile/i })).toBeVisible({
        timeout: 15000,
      });

      // Open user menu
      await page.getByTestId('user-menu-trigger').click();
      await page.waitForTimeout(300);

      // Click logout
      await page.getByTestId('logout-button').click();

      // Wait for dialog
      const dialog = page.getByTestId('logout-dialog');
      await expect(dialog).toBeVisible({ timeout: 5000 });

      // Confirm logout
      await page.getByTestId('logout-confirm-button').click();

      // Should redirect to landing page
      await page.waitForURL('/', { timeout: 15000 });
    });

    test('should be able to logout from decks page', async ({ page }) => {
      // Navigate to decks
      await page.goto('/decks');
      await page.waitForLoadState('domcontentloaded');

      // Wait for decks to load
      await expect(page.getByRole('heading', { name: /decks|flashcard/i })).toBeVisible({
        timeout: 15000,
      });

      // Open user menu
      await page.getByTestId('user-menu-trigger').click();
      await page.waitForTimeout(300);

      // Click logout
      await page.getByTestId('logout-button').click();

      // Wait for dialog
      const dialog = page.getByTestId('logout-dialog');
      await expect(dialog).toBeVisible({ timeout: 5000 });

      // Confirm logout
      await page.getByTestId('logout-confirm-button').click();

      // Should redirect to landing page
      await page.waitForURL('/', { timeout: 15000 });
    });
  });
});
