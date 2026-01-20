/**
 * E2E Tests: Notification Preferences
 *
 * Tests the notification preference toggle behavior.
 * Verifies that turning notifications on/off in preferences affects
 * the notification bell in the header.
 *
 * Test Organization:
 * - Notification bell disabled when notifications turned off
 * - Notification bell enabled when notifications turned on
 */

import { test, expect } from '@playwright/test';
import { verifyAuthSucceeded } from './helpers/auth-helpers';

/**
 * Helper to wait for the notification toggle to be ready and stable.
 * This ensures the component has fully rendered after any state changes.
 */
async function waitForToggleReady(page: import('@playwright/test').Page) {
  // Wait for any save indicator to disappear (if present)
  const savingIndicator = page.getByTestId('preferences-saving');
  // Wait up to 5 seconds for saving to complete if it's in progress
  await expect(savingIndicator).toBeHidden({ timeout: 5000 }).catch(() => {
    // Ignore if it was never visible
  });

  // Wait for toggle to be visible and stable
  const toggle = page.getByTestId('notification-toggle');
  await expect(toggle).toBeVisible({ timeout: 10000 });
  return toggle;
}

/**
 * Helper to click toggle and wait for save to complete
 */
async function clickToggleAndWaitForSave(page: import('@playwright/test').Page) {
  const toggle = page.getByTestId('notification-toggle');
  await toggle.click();

  // Wait a moment for debounce to trigger (debounce is 1000ms)
  await page.waitForTimeout(1200);

  // Wait for saving indicator to appear and then disappear
  // The save might be fast, so we use a try-catch
  try {
    const savingIndicator = page.getByTestId('preferences-saving');
    // Give it a chance to appear
    await expect(savingIndicator).toBeVisible({ timeout: 2000 });
    // Wait for it to disappear
    await expect(savingIndicator).toBeHidden({ timeout: 10000 });
  } catch {
    // Save might have completed very quickly, continue
    // Wait a bit more to ensure React has re-rendered
    await page.waitForTimeout(500);
  }

  // Wait for toggle to stabilize after save
  await waitForToggleReady(page);
}

test.describe('Notification Preferences', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/profile');
    await verifyAuthSucceeded(page, '/profile');
    await expect(page.getByTestId('profile-page')).toBeVisible({ timeout: 15000 });
  });

  test('E2E-NOTIF-PREF-01: Notification bell disabled when notifications turned off in preferences', async ({
    page,
  }) => {
    // Navigate to preferences tab
    const preferencesTab = page.getByRole('button', { name: /preferences/i });
    await preferencesTab.click();

    // Wait for preferences section to load
    await expect(page.getByTestId('preferences-section')).toBeVisible({ timeout: 10000 });

    // Wait for toggle to be ready
    await waitForToggleReady(page);

    // Check if notifications are currently on, and turn them off if so
    const isChecked = await page.getByTestId('notification-toggle').getAttribute('aria-checked');
    if (isChecked === 'true') {
      await clickToggleAndWaitForSave(page);
    }

    // Verify toggle is now off
    await expect(page.getByTestId('notification-toggle')).toHaveAttribute('aria-checked', 'false', {
      timeout: 10000,
    });

    // Navigate to dashboard to see the notification bell
    await page.goto('/dashboard');
    await verifyAuthSucceeded(page, '/dashboard');

    // Verify notification bell is disabled
    const bellButton = page.getByTestId('notifications-trigger');
    await expect(bellButton).toBeVisible({ timeout: 10000 });
    await expect(bellButton).toBeDisabled();
  });

  test('E2E-NOTIF-PREF-02: Notification bell enabled when notifications turned on', async ({
    page,
  }) => {
    // Navigate to preferences tab
    const preferencesTab = page.getByRole('button', { name: /preferences/i });
    await preferencesTab.click();

    // Wait for preferences section to load
    await expect(page.getByTestId('preferences-section')).toBeVisible({ timeout: 10000 });

    // Wait for toggle to be ready
    await waitForToggleReady(page);

    // Check if notifications are currently off, and turn them on if so
    const isChecked = await page.getByTestId('notification-toggle').getAttribute('aria-checked');
    if (isChecked === 'false') {
      await clickToggleAndWaitForSave(page);
    }

    // Verify toggle is now on
    await expect(page.getByTestId('notification-toggle')).toHaveAttribute('aria-checked', 'true', {
      timeout: 10000,
    });

    // Navigate to dashboard to see the notification bell
    await page.goto('/dashboard');
    await verifyAuthSucceeded(page, '/dashboard');

    // Verify notification bell is enabled
    const bellButton = page.getByTestId('notifications-trigger');
    await expect(bellButton).toBeVisible({ timeout: 10000 });
    await expect(bellButton).toBeEnabled();
  });

  test('E2E-NOTIF-PREF-03: Notification bell state updates after toggling preference', async ({
    page,
  }) => {
    // Navigate to preferences tab
    const preferencesTab = page.getByRole('button', { name: /preferences/i });
    await preferencesTab.click();
    await expect(page.getByTestId('preferences-section')).toBeVisible({ timeout: 10000 });

    // Wait for toggle to be ready
    await waitForToggleReady(page);

    // First ensure notifications are ON
    const isChecked = await page.getByTestId('notification-toggle').getAttribute('aria-checked');
    if (isChecked === 'false') {
      await clickToggleAndWaitForSave(page);
    }

    // Go to dashboard and verify bell is enabled
    await page.goto('/dashboard');
    await verifyAuthSucceeded(page, '/dashboard');
    let bellButton = page.getByTestId('notifications-trigger');
    await expect(bellButton).toBeVisible({ timeout: 10000 });
    await expect(bellButton).toBeEnabled();

    // Go back to profile and turn notifications OFF
    await page.goto('/profile');
    await verifyAuthSucceeded(page, '/profile');
    await expect(page.getByTestId('profile-page')).toBeVisible({ timeout: 15000 });

    await page.getByRole('button', { name: /preferences/i }).click();
    await expect(page.getByTestId('preferences-section')).toBeVisible({ timeout: 10000 });

    // Wait for toggle to be ready and click to turn OFF
    await waitForToggleReady(page);
    await clickToggleAndWaitForSave(page);

    // Go to dashboard and verify bell is now disabled
    await page.goto('/dashboard');
    await verifyAuthSucceeded(page, '/dashboard');
    bellButton = page.getByTestId('notifications-trigger');
    await expect(bellButton).toBeVisible({ timeout: 10000 });
    await expect(bellButton).toBeDisabled();
  });
});
