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
 * Helper to navigate to preferences tab and wait for toggle
 */
async function navigateToPreferencesAndWaitForToggle(page: import('@playwright/test').Page) {
  const preferencesTab = page.getByRole('button', { name: /preferences/i });
  await preferencesTab.click();
  await expect(page.getByTestId('preferences-section')).toBeVisible({ timeout: 10000 });

  // Wait for toggle to be visible
  const toggle = page.getByTestId('notification-toggle');
  await expect(toggle).toBeVisible({ timeout: 10000 });
  return toggle;
}

/**
 * Helper to set notification preference to a specific state.
 * Returns true if a click was needed to change the state.
 */
async function setNotificationState(
  page: import('@playwright/test').Page,
  desiredState: boolean
): Promise<boolean> {
  const toggle = page.getByTestId('notification-toggle');
  const currentState = await toggle.getAttribute('aria-checked');
  const isCurrentlyOn = currentState === 'true';

  if (isCurrentlyOn !== desiredState) {
    await toggle.click();
    // Wait for debounce (1000ms) + API call + some buffer
    await page.waitForTimeout(3000);
    return true;
  }
  return false;
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
    // Navigate to preferences tab and get toggle
    await navigateToPreferencesAndWaitForToggle(page);

    // Ensure notifications are OFF
    await setNotificationState(page, false);

    // Navigate to dashboard to see the notification bell
    await page.goto('/dashboard');
    await verifyAuthSucceeded(page, '/dashboard');

    // Verify notification bell is disabled
    const bellButton = page.getByTestId('notifications-trigger');
    await expect(bellButton).toBeVisible({ timeout: 10000 });
    await expect(bellButton).toBeDisabled({ timeout: 5000 });
  });

  test('E2E-NOTIF-PREF-02: Notification bell enabled when notifications turned on', async ({
    page,
  }) => {
    // Navigate to preferences tab and get toggle
    await navigateToPreferencesAndWaitForToggle(page);

    // Ensure notifications are ON
    await setNotificationState(page, true);

    // Navigate to dashboard to see the notification bell
    await page.goto('/dashboard');
    await verifyAuthSucceeded(page, '/dashboard');

    // Verify notification bell is enabled
    const bellButton = page.getByTestId('notifications-trigger');
    await expect(bellButton).toBeVisible({ timeout: 10000 });
    await expect(bellButton).toBeEnabled({ timeout: 5000 });
  });

  test('E2E-NOTIF-PREF-03: Notification bell state updates after toggling preference', async ({
    page,
  }) => {
    // Navigate to preferences tab
    await navigateToPreferencesAndWaitForToggle(page);

    // First ensure notifications are ON
    await setNotificationState(page, true);

    // Go to dashboard and verify bell is enabled
    await page.goto('/dashboard');
    await verifyAuthSucceeded(page, '/dashboard');
    let bellButton = page.getByTestId('notifications-trigger');
    await expect(bellButton).toBeVisible({ timeout: 10000 });
    await expect(bellButton).toBeEnabled({ timeout: 5000 });

    // Go back to profile and turn notifications OFF
    await page.goto('/profile');
    await verifyAuthSucceeded(page, '/profile');
    await expect(page.getByTestId('profile-page')).toBeVisible({ timeout: 15000 });

    // Navigate to preferences and turn off
    await navigateToPreferencesAndWaitForToggle(page);
    await setNotificationState(page, false);

    // Go to dashboard and verify bell is now disabled
    await page.goto('/dashboard');
    await verifyAuthSucceeded(page, '/dashboard');
    bellButton = page.getByTestId('notifications-trigger');
    await expect(bellButton).toBeVisible({ timeout: 10000 });
    await expect(bellButton).toBeDisabled({ timeout: 5000 });
  });
});
