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

    // Find the notification toggle
    const notificationToggle = page.getByTestId('notification-toggle');
    await expect(notificationToggle).toBeVisible();

    // Check if notifications are currently on, and turn them off if so
    const isChecked = await notificationToggle.getAttribute('aria-checked');
    if (isChecked === 'true') {
      await notificationToggle.click();
      // Wait for debounced save
      await page.waitForTimeout(1500);
    }

    // Verify toggle is now off
    await expect(notificationToggle).toHaveAttribute('aria-checked', 'false');

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

    // Find the notification toggle
    const notificationToggle = page.getByTestId('notification-toggle');
    await expect(notificationToggle).toBeVisible();

    // Check if notifications are currently off, and turn them on if so
    const isChecked = await notificationToggle.getAttribute('aria-checked');
    if (isChecked === 'false') {
      await notificationToggle.click();
      // Wait for debounced save
      await page.waitForTimeout(1500);
    }

    // Verify toggle is now on
    await expect(notificationToggle).toHaveAttribute('aria-checked', 'true');

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

    // Find the notification toggle
    const notificationToggle = page.getByTestId('notification-toggle');

    // First ensure notifications are ON
    let isChecked = await notificationToggle.getAttribute('aria-checked');
    if (isChecked === 'false') {
      await notificationToggle.click();
      await page.waitForTimeout(1500);
    }

    // Go to dashboard and verify bell is enabled
    await page.goto('/dashboard');
    await verifyAuthSucceeded(page, '/dashboard');
    let bellButton = page.getByTestId('notifications-trigger');
    await expect(bellButton).toBeEnabled();

    // Go back to profile and turn notifications OFF
    await page.goto('/profile');
    await verifyAuthSucceeded(page, '/profile');
    await expect(page.getByTestId('profile-page')).toBeVisible({ timeout: 15000 });

    await page.getByRole('button', { name: /preferences/i }).click();
    await expect(page.getByTestId('preferences-section')).toBeVisible({ timeout: 10000 });

    const toggleAgain = page.getByTestId('notification-toggle');
    await toggleAgain.click();
    await page.waitForTimeout(1500);

    // Go to dashboard and verify bell is now disabled
    await page.goto('/dashboard');
    await verifyAuthSucceeded(page, '/dashboard');
    bellButton = page.getByTestId('notifications-trigger');
    await expect(bellButton).toBeDisabled();
  });
});
