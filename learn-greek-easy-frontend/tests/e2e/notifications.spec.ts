/**
 * E2E Tests: Notifications System
 *
 * Tests the notification bell, dropdown, mark as read, and clear functionality.
 * Uses deterministic seeded data (3 unread, 2 read notifications for e2e_learner).
 *
 * Seeded Notifications (for e2e_learner@test.com):
 * UNREAD (3):
 *   1. "Achievement Unlocked: First Flame" (1h ago)
 *   2. "Daily Goal Complete!" (3h ago)
 *   3. "Level Up!" (1d ago)
 * READ (2):
 *   4. "Streak at Risk!" (2d ago)
 *   5. "Welcome to Greekly!" (7d ago)
 */

import { test, expect } from '@playwright/test';
import { verifyAuthSucceeded, waitForAppReady, SEED_USERS, loginViaUI } from './helpers/auth-helpers';

// Seeded notification titles for assertions
const SEEDED_NOTIFICATIONS = {
  UNREAD: [
    'Achievement Unlocked: First Flame',
    'Daily Goal Complete!',
    'Level Up!',
  ],
  READ: [
    'Streak at Risk!',
    'Welcome to Greekly!',
  ],
  UNREAD_COUNT: 3,
  TOTAL_COUNT: 5,
};

test.describe('Notifications Bell', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await verifyAuthSucceeded(page, '/');
    await waitForAppReady(page);
  });

  test('E2E-NOTIF-01: Notification bell is visible in header', async ({ page }) => {
    const bellButton = page.locator('button[aria-label*="Notification"]');
    await expect(bellButton).toBeVisible({ timeout: 10000 });
  });

  test('E2E-NOTIF-02: Badge shows correct unread count (3)', async ({ page }) => {
    const bellButton = page.locator('button[aria-label*="Notification"]');
    await expect(bellButton).toBeVisible();

    // Badge should show "3" for the seeded unread notifications
    const badge = bellButton.locator('span').filter({ hasText: /^3$/ });
    await expect(badge).toBeVisible({ timeout: 5000 });
  });

  test('E2E-NOTIF-03: Clicking bell opens notification dropdown', async ({ page }) => {
    const bellButton = page.locator('button[aria-label*="Notification"]');
    await bellButton.click();

    // Verify dropdown opens with "Notifications" header
    await expect(page.getByText('Notifications', { exact: true })).toBeVisible({ timeout: 5000 });
  });

  test('E2E-NOTIF-04: Clicking outside closes dropdown', async ({ page }) => {
    const bellButton = page.locator('button[aria-label*="Notification"]');
    await bellButton.click();
    await expect(page.getByText('Notifications', { exact: true })).toBeVisible();

    // Press escape to close
    await page.keyboard.press('Escape');

    // Dropdown should close
    await page.waitForTimeout(500);
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
    await expect(page.getByText('Notifications', { exact: true })).toBeVisible();
  });

  test('E2E-NOTIF-05: Dropdown shows all seeded notification titles', async ({ page }) => {
    // Wait for content to load
    await page.waitForTimeout(500);

    // Scope assertions to dropdown menu to avoid matching toasts/SR-only elements
    const dropdownMenu = page.locator('[role="menu"]');

    // Verify all 5 seeded notification titles are visible in dropdown
    const allTitles = [...SEEDED_NOTIFICATIONS.UNREAD, ...SEEDED_NOTIFICATIONS.READ];
    for (const title of allTitles) {
      await expect(dropdownMenu.getByText(title)).toBeVisible({ timeout: 5000 });
    }
  });

  test('E2E-NOTIF-06: Header shows "3 new" indicator', async ({ page }) => {
    // Wait for content to load
    await page.waitForTimeout(500);

    // Scope to dropdown menu to ensure we check the dropdown header badge
    const dropdownMenu = page.locator('[role="menu"]');

    // Should show "3 new" in the dropdown header
    await expect(dropdownMenu.getByText('3 new')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Notifications Actions (Fresh Login)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('E2E-NOTIF-07: Mark all as read clears unread badge', async ({ page }) => {
    // Login as learner with seeded notifications
    await loginViaUI(page, SEED_USERS.LEARNER);
    await page.goto('/');
    await waitForAppReady(page);

    const bellButton = page.locator('button[aria-label*="Notification"]');
    await expect(bellButton).toBeVisible();

    // Verify badge shows "3" initially
    const badge = bellButton.locator('span').filter({ hasText: /^3$/ });
    await expect(badge).toBeVisible({ timeout: 5000 });

    // Open dropdown
    await bellButton.click();
    await expect(page.getByText('Notifications', { exact: true })).toBeVisible();

    // Click "Mark all as read" button
    const markAllButton = page.locator('button[aria-label*="Mark all as read"]');
    await expect(markAllButton).toBeVisible();
    await markAllButton.click();

    // Wait for API call to complete
    await page.waitForTimeout(1000);

    // Badge should be gone
    await expect(badge).not.toBeVisible({ timeout: 5000 });

    // "new" indicator in header should be gone
    const newBadge = page.locator('[role="menu"]').getByText(/\d+ new/);
    await expect(newBadge).not.toBeVisible({ timeout: 5000 });
  });

  test('E2E-NOTIF-08: Clear all removes all notifications', async ({ page }) => {
    // Login as learner with seeded notifications
    await loginViaUI(page, SEED_USERS.LEARNER);
    await page.goto('/');
    await waitForAppReady(page);

    const bellButton = page.locator('button[aria-label*="Notification"]');
    await bellButton.click();
    await expect(page.getByText('Notifications', { exact: true })).toBeVisible();

    // Wait for notifications to load
    await page.waitForTimeout(500);

    // Scope assertions to dropdown menu to avoid matching toasts/SR-only elements
    const dropdownMenu = page.locator('[role="menu"]');

    // Verify at least one notification title is visible before clearing
    await expect(dropdownMenu.getByText(SEEDED_NOTIFICATIONS.UNREAD[0])).toBeVisible();

    // Click "Clear all" button
    const clearAllButton = page.locator('button[aria-label*="Clear all"]');
    await expect(clearAllButton).toBeVisible();
    await clearAllButton.click();

    // Wait for API call
    await page.waitForTimeout(1000);

    // Should show empty state
    await expect(dropdownMenu.getByText('No notifications yet')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Notification Empty State', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('E2E-NOTIF-09: User without notifications sees empty state', async ({ page }) => {
    // Login as beginner who has no seeded notifications
    await loginViaUI(page, SEED_USERS.BEGINNER);
    await page.goto('/');
    await waitForAppReady(page);

    const bellButton = page.locator('button[aria-label*="Notification"]');
    await expect(bellButton).toBeVisible();

    // Badge should NOT be visible (no unread notifications)
    const badge = bellButton.locator('span').filter({ hasText: /^\d+$/ });
    await expect(badge).not.toBeVisible();

    // Open dropdown
    await bellButton.click();
    await expect(page.getByText('Notifications', { exact: true })).toBeVisible();

    // Wait for content to load
    await page.waitForTimeout(500);

    // Should show empty state
    await expect(page.getByText('No notifications yet')).toBeVisible({ timeout: 5000 });
  });
});

/**
 * Notification Error State Tests
 *
 * These tests require route interception BEFORE authentication.
 * The NotificationContext fetches immediately when isAuthenticated=true,
 * so we must set up error routes BEFORE logging in.
 */
test.describe('Notification Error State (Fresh Login)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('E2E-NOTIF-10: Error state shows retry button', async ({ page }) => {
    // CRITICAL: Set up route intercept BEFORE authentication
    await page.route('**/api/v1/notifications**', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Internal server error' }),
        });
      } else {
        route.continue();
      }
    });

    // Now login - the intercepted route will catch the initial fetch
    await loginViaUI(page, SEED_USERS.LEARNER);
    await page.goto('/');
    await waitForAppReady(page);

    // Open dropdown - should already be in error state from failed initial fetch
    const bellButton = page.locator('button[aria-label*="Notification"]');
    await bellButton.click();

    // Should show error state with retry button
    await expect(page.getByText('Failed to load notifications')).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: /retry/i })).toBeVisible();
  });
});
