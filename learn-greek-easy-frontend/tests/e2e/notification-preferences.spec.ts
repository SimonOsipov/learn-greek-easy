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
 *
 * Simple, robust approach:
 * 1. Click toggle if needed
 * 2. Wait for aria-checked to change
 * 3. Wait generous timeout (5s) after debounce for DB to commit
 */
async function setNotificationState(
  page: import('@playwright/test').Page,
  desiredState: boolean
): Promise<boolean> {
  const toggle = page.getByTestId('notification-toggle');

  // Wait for toggle to have a stable aria-checked attribute
  await expect(toggle).toHaveAttribute('aria-checked', /.+/, { timeout: 5000 });

  const currentState = await toggle.getAttribute('aria-checked');
  const isCurrentlyOn = currentState === 'true';

  if (isCurrentlyOn !== desiredState) {
    // Click the toggle
    await toggle.click();

    // Wait for the toggle's aria-checked attribute to update
    const expectedState = desiredState ? 'true' : 'false';
    await expect(toggle).toHaveAttribute('aria-checked', expectedState, { timeout: 5000 });

    // Wait generous timeout for debounce (1s) + API call + DB commit
    // This handles read-after-write consistency issues
    await page.waitForTimeout(5000);

    return true;
  }
  return false;
}

/**
 * Helper to wait for notification bell to reach expected state after navigation.
 *
 * Uses Playwright's built-in assertion retries for cleaner, more reliable tests.
 */
async function waitForBellState(
  page: import('@playwright/test').Page,
  expectedEnabled: boolean
): Promise<void> {
  const bellButton = page.getByTestId('notifications-trigger');
  await expect(bellButton).toBeVisible({ timeout: 15000 });

  if (expectedEnabled) {
    await expect(bellButton).toBeEnabled({ timeout: 10000 });
  } else {
    await expect(bellButton).toBeDisabled({ timeout: 10000 });
  }
}

test.describe('Notification Preferences', () => {
  test.beforeEach(async ({ page }) => {
    // Use domcontentloaded to avoid hanging on long-running API calls
    await page.goto('/profile', { waitUntil: 'domcontentloaded' });
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

    // Navigate to dashboard - use domcontentloaded to avoid hanging
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await verifyAuthSucceeded(page, '/dashboard');

    // Wait for the bell to reach the expected disabled state
    await waitForBellState(page, false);
  });

  test('E2E-NOTIF-PREF-02: Notification bell enabled when notifications turned on', async ({
    page,
  }) => {
    // Navigate to preferences tab and get toggle
    await navigateToPreferencesAndWaitForToggle(page);

    // Ensure notifications are ON
    await setNotificationState(page, true);

    // Navigate to dashboard - use domcontentloaded to avoid hanging
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await verifyAuthSucceeded(page, '/dashboard');

    // Wait for the bell to reach the expected enabled state
    await waitForBellState(page, true);
  });

  test('E2E-NOTIF-PREF-03: Notification bell state updates after toggling preference', async ({
    page,
  }) => {
    // Navigate to preferences tab
    await navigateToPreferencesAndWaitForToggle(page);

    // First ensure notifications are ON
    await setNotificationState(page, true);

    // Go to dashboard and verify bell is enabled
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await verifyAuthSucceeded(page, '/dashboard');
    await waitForBellState(page, true);

    // Go back to profile and turn notifications OFF
    await page.goto('/profile', { waitUntil: 'domcontentloaded' });
    await verifyAuthSucceeded(page, '/profile');
    await expect(page.getByTestId('profile-page')).toBeVisible({ timeout: 15000 });

    // Navigate to preferences and turn off
    await navigateToPreferencesAndWaitForToggle(page);
    await setNotificationState(page, false);

    // Go to dashboard and verify bell is now disabled
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await verifyAuthSucceeded(page, '/dashboard');
    await waitForBellState(page, false);
  });
});
