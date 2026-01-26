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
 * Uses a simple, robust approach:
 * 1. Wait for the toggle's aria-checked attribute to match the desired state (confirms UI update)
 * 2. Wait a generous fixed delay to allow debounce (1s) + API call to complete
 * 3. Verify the saving indicator is hidden (confirms frontend state is stable)
 *
 * This avoids race conditions with waitForResponse where the response might arrive
 * before the listener is fully set up.
 */
async function setNotificationState(
  page: import('@playwright/test').Page,
  desiredState: boolean
): Promise<boolean> {
  const toggle = page.getByTestId('notification-toggle');

  // Wait for the toggle to have a stable aria-checked attribute
  // This ensures the toggle has fully loaded with the correct state
  await expect(toggle).toHaveAttribute('aria-checked', /.+/, { timeout: 5000 });

  const currentState = await toggle.getAttribute('aria-checked');
  const isCurrentlyOn = currentState === 'true';

  if (isCurrentlyOn !== desiredState) {
    // Click the toggle
    await toggle.click();

    // Wait for the toggle's aria-checked attribute to update to the desired state
    // This confirms the UI has updated after the click
    const expectedState = desiredState ? 'true' : 'false';
    await expect(toggle).toHaveAttribute('aria-checked', expectedState, { timeout: 5000 });

    // Wait a generous delay to allow debounce (1s) + API call to complete
    // This is simpler and more reliable than trying to intercept network requests
    await page.waitForTimeout(3000);

    // Verify saving indicator is hidden (confirms frontend state is stable)
    const savingIndicator = page.getByTestId('preferences-saving');
    await expect(savingIndicator).toBeHidden({ timeout: 5000 });

    return true;
  }
  return false;
}

/**
 * Helper to wait for notification bell to reach expected state after navigation.
 *
 * After navigation, checkAuth() is called which fetches fresh profile from backend.
 * The bell's disabled state depends on the user.preferences.notifications value
 * from that response. We use waitForFunction to poll until the state matches,
 * which handles any async state propagation.
 */
async function waitForBellState(
  page: import('@playwright/test').Page,
  expectedEnabled: boolean
): Promise<void> {
  const bellButton = page.getByTestId('notifications-trigger');
  await expect(bellButton).toBeVisible({ timeout: 10000 });

  // Use waitForFunction to poll until the bell's disabled state matches expectation.
  // This handles the race condition where checkAuth() response may not have
  // propagated to the UI yet.
  await page.waitForFunction(
    ({ selector, shouldBeEnabled }) => {
      const button = document.querySelector(selector) as HTMLButtonElement | null;
      if (!button) return false;
      const isCurrentlyEnabled = !button.disabled;
      return isCurrentlyEnabled === shouldBeEnabled;
    },
    { selector: '[data-testid="notifications-trigger"]', shouldBeEnabled: expectedEnabled },
    { timeout: 15000, polling: 100 }
  );

  // Final assertion for test clarity
  if (expectedEnabled) {
    await expect(bellButton).toBeEnabled();
  } else {
    await expect(bellButton).toBeDisabled();
  }
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

    // Ensure notifications are OFF - waits for PATCH response to confirm save
    await setNotificationState(page, false);

    // Navigate to dashboard to see the notification bell
    await page.goto('/dashboard');
    await verifyAuthSucceeded(page, '/dashboard');

    // Wait for the bell to reach the expected disabled state
    // This handles the async state propagation from checkAuth()
    await waitForBellState(page, false);
  });

  test('E2E-NOTIF-PREF-02: Notification bell enabled when notifications turned on', async ({
    page,
  }) => {
    // Navigate to preferences tab and get toggle
    await navigateToPreferencesAndWaitForToggle(page);

    // Ensure notifications are ON - waits for PATCH response to confirm save
    await setNotificationState(page, true);

    // Navigate to dashboard to see the notification bell
    await page.goto('/dashboard');
    await verifyAuthSucceeded(page, '/dashboard');

    // Wait for the bell to reach the expected enabled state
    // This handles the async state propagation from checkAuth()
    await waitForBellState(page, true);
  });

  test('E2E-NOTIF-PREF-03: Notification bell state updates after toggling preference', async ({
    page,
  }) => {
    // Navigate to preferences tab
    await navigateToPreferencesAndWaitForToggle(page);

    // First ensure notifications are ON - waits for PATCH response to confirm save
    await setNotificationState(page, true);

    // Go to dashboard and verify bell is enabled
    await page.goto('/dashboard');
    await verifyAuthSucceeded(page, '/dashboard');

    // Wait for the bell to reach the expected enabled state
    await waitForBellState(page, true);

    // Go back to profile and turn notifications OFF
    await page.goto('/profile');
    await verifyAuthSucceeded(page, '/profile');
    await expect(page.getByTestId('profile-page')).toBeVisible({ timeout: 15000 });

    // Navigate to preferences and turn off - waits for PATCH response to confirm save
    await navigateToPreferencesAndWaitForToggle(page);
    await setNotificationState(page, false);

    // Go to dashboard and verify bell is now disabled
    await page.goto('/dashboard');
    await verifyAuthSucceeded(page, '/dashboard');

    // Wait for the bell to reach the expected disabled state
    await waitForBellState(page, false);
  });
});
