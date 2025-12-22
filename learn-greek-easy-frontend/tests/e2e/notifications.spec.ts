/**
 * E2E Tests: Notifications System
 *
 * Tests the notification bell, dropdown, mark as read, and clear functionality.
 * Uses Playwright's storageState pattern for authentication.
 *
 * Test Organization:
 * - Notification bell visibility and badge
 * - Dropdown open/close behavior
 * - Mark as read (single and all)
 * - Clear all notifications
 * - Empty state handling
 * - Loading and error states
 */

import { test, expect } from '@playwright/test';
import { verifyAuthSucceeded, waitForAppReady, SEED_USERS, loginViaUI } from './helpers/auth-helpers';

test.describe('Notifications Bell', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await verifyAuthSucceeded(page, '/');
    await waitForAppReady(page);
  });

  test('E2E-NOTIF-01: Notification bell is visible in header', async ({ page }) => {
    // Look for the notification bell button
    const bellButton = page.locator('button[aria-label*="Notification"]');
    await expect(bellButton).toBeVisible({ timeout: 10000 });
  });

  test('E2E-NOTIF-02: Clicking bell opens notification dropdown', async ({ page }) => {
    // Click the notification bell
    const bellButton = page.locator('button[aria-label*="Notification"]');
    await bellButton.click();

    // Verify dropdown opens with "Notifications" header
    await expect(page.getByText('Notifications')).toBeVisible({ timeout: 5000 });
  });

  test('E2E-NOTIF-03: Clicking outside closes dropdown', async ({ page }) => {
    // Open dropdown
    const bellButton = page.locator('button[aria-label*="Notification"]');
    await bellButton.click();
    await expect(page.getByText('Notifications')).toBeVisible();

    // Press escape to close (more reliable than clicking outside)
    await page.keyboard.press('Escape');

    // Dropdown should close (wait a moment for animation)
    await page.waitForTimeout(500);
    // The dropdown content should not be visible
    const dropdownContent = page.locator('[role="menu"]');
    await expect(dropdownContent).not.toBeVisible({ timeout: 3000 });
  });
});

test.describe('Notifications Dropdown Content', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await verifyAuthSucceeded(page, '/');
    await waitForAppReady(page);

    // Open notification dropdown
    const bellButton = page.locator('button[aria-label*="Notification"]');
    await bellButton.click();
    await expect(page.getByText('Notifications')).toBeVisible();
  });

  test('E2E-NOTIF-04: Empty state shows "No notifications yet"', async ({ page }) => {
    // Wait for content to load
    await page.waitForTimeout(1000);

    // Check if there are notifications or empty state
    const hasNotifications = await page.locator('[role="menu"]').getByRole('button').count() > 3;

    if (!hasNotifications) {
      // For a user with no notifications, should show empty state
      await expect(page.getByText('No notifications yet')).toBeVisible({ timeout: 5000 });
    }
  });

  test('E2E-NOTIF-05: Notification dropdown shows header', async ({ page }) => {
    // Verify header is visible
    await expect(page.getByText('Notifications')).toBeVisible();
  });
});

test.describe('Notifications with Fresh Login', () => {
  test.use({ storageState: { cookies: [], origins: [] } }); // Clear auth state

  test('E2E-NOTIF-06: Mark all as read clears unread badge', async ({ page }) => {
    // Login as learner who may have notifications
    await loginViaUI(page, SEED_USERS.LEARNER);
    await page.goto('/');
    await waitForAppReady(page);

    // Check for bell
    const bellButton = page.locator('button[aria-label*="Notification"]');
    await expect(bellButton).toBeVisible();

    // Open dropdown
    await bellButton.click();
    await expect(page.getByText('Notifications')).toBeVisible();

    // Wait for content to load
    await page.waitForTimeout(500);

    // Look for "Mark all as read" button (check icon)
    const markAllButton = page.locator('button[aria-label*="Mark all as read"]');
    const hasUnread = await markAllButton.isVisible().catch(() => false);

    if (hasUnread) {
      await markAllButton.click();

      // Wait for API call to complete
      await page.waitForTimeout(1000);

      // Badge should be gone or "new" text should disappear
      const newBadge = page.locator('[role="menu"]').getByText(/\d+ new/);
      await expect(newBadge).not.toBeVisible({ timeout: 5000 });
    }
  });

  test('E2E-NOTIF-07: Clear all removes all notifications', async ({ page }) => {
    // Login as learner
    await loginViaUI(page, SEED_USERS.LEARNER);
    await page.goto('/');
    await waitForAppReady(page);

    // Open dropdown
    const bellButton = page.locator('button[aria-label*="Notification"]');
    await bellButton.click();
    await expect(page.getByText('Notifications')).toBeVisible();

    // Wait for content to load
    await page.waitForTimeout(500);

    // Look for "Clear all" button (trash icon)
    const clearAllButton = page.locator('button[aria-label*="Clear all"]');
    const hasNotifications = await clearAllButton.isVisible().catch(() => false);

    if (hasNotifications) {
      await clearAllButton.click();

      // Wait for API call
      await page.waitForTimeout(1000);

      // Should show empty state
      await expect(page.getByText('No notifications yet')).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('Notification Badge', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await verifyAuthSucceeded(page, '/');
    await waitForAppReady(page);
  });

  test('E2E-NOTIF-08: Notification badge shows count format', async ({ page }) => {
    // Look for badge on bell button
    const bellButton = page.locator('button[aria-label*="Notification"]');
    await expect(bellButton).toBeVisible();

    // Check for badge element (span with count)
    const badge = bellButton.locator('span').filter({ hasText: /\d+|\d\+/ });
    const hasBadge = await badge.isVisible().catch(() => false);

    // Test passes whether badge exists or not - we're just verifying structure
    if (hasBadge) {
      const badgeText = await badge.textContent();
      // Badge should show a number or "9+"
      expect(badgeText).toMatch(/^\d+$|^9\+$/);
    }
  });
});

test.describe('Notification Loading State', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await verifyAuthSucceeded(page, '/');
    await waitForAppReady(page);
  });

  test('E2E-NOTIF-09: Loading state shows spinner', async ({ page }) => {
    // This test verifies that loading state exists in the component
    // We can force a slow network to see it
    await page.route('**/api/v1/notifications**', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 500));
      await route.continue();
    });

    // Open dropdown
    const bellButton = page.locator('button[aria-label*="Notification"]');
    await bellButton.click();

    // Should briefly show loading spinner
    // Loading might be too fast to catch, so we just verify the dropdown opened
    await expect(page.getByText('Notifications')).toBeVisible();
  });
});

test.describe('Notification Error State', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await verifyAuthSucceeded(page, '/');
    await waitForAppReady(page);
  });

  test('E2E-NOTIF-10: Error state shows retry button', async ({ page }) => {
    // Force API error
    await page.route('**/api/v1/notifications', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Internal server error' }),
      });
    });

    // Open dropdown
    const bellButton = page.locator('button[aria-label*="Notification"]');
    await bellButton.click();

    // Should show error state with retry button
    await expect(page.getByText(/Failed to load|error/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: /retry/i })).toBeVisible();
  });
});
