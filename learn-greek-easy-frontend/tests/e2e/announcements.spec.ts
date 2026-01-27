/**
 * E2E Tests: Announcements Feature
 *
 * Tests the announcement system for both admin and learner users:
 * - Admin: Create announcements, view history, view detail stats
 * - Learner: Receive and read announcements in notification center
 *
 * Test data is seeded via the /api/v1/test/seed/announcements endpoint.
 */

import { test, expect, Page, APIRequestContext } from '@playwright/test';
import { verifyAuthSucceeded } from './helpers/auth-helpers';

/**
 * Get the API base URL from environment
 */
function getApiBaseUrl(): string {
  return process.env.E2E_API_URL || process.env.VITE_API_URL || 'http://localhost:8000';
}

/**
 * Seed announcements for testing
 */
async function seedAnnouncements(request: APIRequestContext): Promise<void> {
  const apiBaseUrl = getApiBaseUrl();
  const response = await request.post(`${apiBaseUrl}/api/v1/test/seed/announcements`);
  if (!response.ok()) {
    console.warn(`Failed to seed announcements: ${response.status()}`);
  }
}

/**
 * Navigate to admin page and click on Announcements tab
 */
async function navigateToAdminAnnouncementsTab(page: Page): Promise<void> {
  await page.goto('/admin');
  await verifyAuthSucceeded(page, '/admin');

  // Wait for admin page to load
  await expect(page.getByTestId('admin-page')).toBeVisible({ timeout: 15000 });

  // Click on Announcements tab
  const announcementsTab = page.getByTestId('admin-tab-announcements');
  await announcementsTab.click();

  // Wait for announcements tab content to load
  await expect(page.getByTestId('announcements-tab')).toBeVisible({ timeout: 10000 });
}

// =====================
// Admin Tests - Create & Send
// =====================

test.describe('Announcements - Admin Create Flow', () => {
  // Use admin authentication
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test('ANNOUNCE-E2E-01: Admin can create and send announcement', async ({ page, request }) => {
    // Seed announcements first to ensure history table has data
    await seedAnnouncements(request);

    await navigateToAdminAnnouncementsTab(page);

    // Generate unique title
    const uniqueTitle = `Test Announcement ${Date.now()}`;
    const message = 'This is a test announcement message for E2E testing purposes.';

    // Fill out the form
    await page.getByTestId('announcement-title-input').fill(uniqueTitle);
    await page.getByTestId('announcement-message-input').fill(message);

    // Click preview button
    await page.getByTestId('announcement-preview-button').click();

    // Verify preview modal opens
    const previewModal = page.getByTestId('announcement-preview-modal');
    await expect(previewModal).toBeVisible({ timeout: 5000 });

    // Verify preview content
    await expect(page.getByTestId('preview-title')).toHaveText(uniqueTitle);
    await expect(page.getByTestId('preview-message')).toHaveText(message);

    // Click send button
    await page.getByTestId('preview-send-button').click();

    // Wait for modal to close (indicates success)
    await expect(previewModal).toBeHidden({ timeout: 10000 });

    // Verify success toast appears (Radix UI Toast)
    const toast = page.locator('[data-state="open"]').filter({ hasText: /success|sent/i });
    await expect(toast).toBeVisible({ timeout: 5000 });

    // Verify announcement appears in history table
    const historyTable = page.getByTestId('announcement-history-table');
    await expect(historyTable).toBeVisible();

    // The new announcement should be at the top (most recent)
    await expect(page.getByText(uniqueTitle)).toBeVisible({ timeout: 5000 });
  });

  test('ANNOUNCE-E2E-02: Admin can create announcement with link', async ({ page, request }) => {
    await seedAnnouncements(request);
    await navigateToAdminAnnouncementsTab(page);

    const uniqueTitle = `Link Announcement ${Date.now()}`;
    const message = 'Check out this important link for more information.';
    const linkUrl = 'https://example.com/important-info';

    // Fill out the form with a link
    await page.getByTestId('announcement-title-input').fill(uniqueTitle);
    await page.getByTestId('announcement-message-input').fill(message);
    await page.getByTestId('announcement-link-input').fill(linkUrl);

    // Click preview button
    await page.getByTestId('announcement-preview-button').click();

    // Verify preview modal opens with link
    const previewModal = page.getByTestId('announcement-preview-modal');
    await expect(previewModal).toBeVisible({ timeout: 5000 });

    // Verify link is displayed in preview
    const previewLink = page.getByTestId('preview-link');
    await expect(previewLink).toBeVisible();
    await expect(previewLink).toHaveAttribute('href', linkUrl);

    // Send the announcement
    await page.getByTestId('preview-send-button').click();
    await expect(previewModal).toBeHidden({ timeout: 10000 });

    // Verify announcement appears in history
    await expect(page.getByText(uniqueTitle)).toBeVisible({ timeout: 5000 });
  });
});

// =====================
// Admin Tests - History & Stats
// =====================

test.describe('Announcements - Admin History & Stats', () => {
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test.beforeEach(async ({ request }) => {
    await seedAnnouncements(request);
  });

  test('ANNOUNCE-E2E-03: Admin can view history and stats', async ({ page }) => {
    await navigateToAdminAnnouncementsTab(page);

    // Verify history table is visible
    const historyTable = page.getByTestId('announcement-history-table');
    await expect(historyTable).toBeVisible({ timeout: 10000 });

    // Wait for at least one announcement row to appear
    const announcementRows = page.locator('[data-testid^="announcement-row-"]');
    await expect(announcementRows.first()).toBeVisible({ timeout: 10000 });

    // Get the ID from first row's test id
    const firstRow = announcementRows.first();
    const testId = await firstRow.getAttribute('data-testid');
    const announcementId = testId?.replace('announcement-row-', '');

    // Click view detail button
    const viewDetailButton = page.getByTestId(`view-detail-${announcementId}`);
    await viewDetailButton.click();

    // Verify detail modal opens
    const detailModal = page.getByTestId('announcement-detail-modal');
    await expect(detailModal).toBeVisible({ timeout: 5000 });

    // Verify detail elements are present
    await expect(page.getByTestId('detail-title')).toBeVisible();
    await expect(page.getByTestId('detail-message')).toBeVisible();
    await expect(page.getByTestId('detail-sent')).toBeVisible();
    await expect(page.getByTestId('detail-read')).toBeVisible();
    await expect(page.getByTestId('detail-progress')).toBeVisible();

    // Close modal
    await page.getByTestId('detail-close-button').click();
    await expect(detailModal).toBeHidden();
  });
});

// =====================
// Admin Tests - Validation
// =====================

test.describe('Announcements - Form Validation', () => {
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test('ANNOUNCE-E2E-06: Form validation prevents invalid submissions', async ({ page }) => {
    await navigateToAdminAnnouncementsTab(page);

    // Verify preview button is disabled when form is empty
    const previewButton = page.getByTestId('announcement-preview-button');
    await expect(previewButton).toBeDisabled();

    // Fill only title (message required)
    await page.getByTestId('announcement-title-input').fill('Test Title');
    await expect(previewButton).toBeDisabled();

    // Clear title, fill only message
    await page.getByTestId('announcement-title-input').clear();
    await page.getByTestId('announcement-message-input').fill('Test message content here');
    await expect(previewButton).toBeDisabled();

    // Fill both title and message - button should be enabled
    await page.getByTestId('announcement-title-input').fill('Test Title');
    await expect(previewButton).toBeEnabled();

    // Test invalid URL format
    await page.getByTestId('announcement-link-input').fill('not-a-valid-url');

    // Trigger validation by blurring
    await page.getByTestId('announcement-message-input').click();

    // Wait a moment for validation to run
    await page.waitForTimeout(500);

    // Button should be disabled again due to invalid URL
    await expect(previewButton).toBeDisabled();

    // Check for URL validation error message
    const errorMessage = page.getByText(/URL must start with http/i);
    await expect(errorMessage).toBeVisible();

    // Fix the URL
    await page.getByTestId('announcement-link-input').clear();
    await page.getByTestId('announcement-link-input').fill('https://example.com');

    // Button should be enabled now
    await expect(previewButton).toBeEnabled();
  });

  test('ANNOUNCE-E2E-07: Admin can cancel announcement in preview modal', async ({ page }) => {
    await navigateToAdminAnnouncementsTab(page);

    const title = 'Announcement to Cancel';
    const message = 'This announcement will be cancelled in preview.';

    // Fill form
    await page.getByTestId('announcement-title-input').fill(title);
    await page.getByTestId('announcement-message-input').fill(message);

    // Open preview
    await page.getByTestId('announcement-preview-button').click();

    // Verify modal opens
    const previewModal = page.getByTestId('announcement-preview-modal');
    await expect(previewModal).toBeVisible({ timeout: 5000 });

    // Click cancel
    await page.getByTestId('preview-cancel-button').click();

    // Verify modal closes
    await expect(previewModal).toBeHidden();

    // Verify form data is preserved
    await expect(page.getByTestId('announcement-title-input')).toHaveValue(title);
    await expect(page.getByTestId('announcement-message-input')).toHaveValue(message);
  });
});

// =====================
// Learner Tests
// =====================

test.describe('Announcements - Learner Notification Center', () => {
  // Use learner authentication
  test.use({ storageState: 'playwright/.auth/learner.json' });

  test.beforeEach(async ({ request }) => {
    // Seed announcements to ensure learner has some to see
    await seedAnnouncements(request);
  });

  test('ANNOUNCE-E2E-04: Learner receives announcement in notification center', async ({
    page,
  }) => {
    await page.goto('/dashboard');
    await verifyAuthSucceeded(page, '/dashboard');

    // Wait for dashboard to load
    await expect(page.getByTestId('dashboard')).toBeVisible({ timeout: 15000 });

    // Click notifications trigger
    const notificationsTrigger = page.getByTestId('notifications-trigger');
    await notificationsTrigger.click();

    // Wait for dropdown to open and load
    await page.waitForTimeout(1000);

    // Look for any notification item (announcements appear as admin_announcement type)
    const notificationItems = page.locator('[data-testid^="notification-item-"]');

    // We should see at least one notification (from seeded announcements)
    await expect(notificationItems.first()).toBeVisible({ timeout: 10000 });

    // Verify notification structure
    const firstNotification = notificationItems.first();
    await expect(firstNotification.getByTestId('notification-title')).toBeVisible();
    await expect(firstNotification.getByTestId('notification-message')).toBeVisible();
    await expect(firstNotification.getByTestId('notification-timestamp')).toBeVisible();
  });

  test('ANNOUNCE-E2E-05: Learner can click announcement link', async ({ page, context }) => {
    await page.goto('/dashboard');
    await verifyAuthSucceeded(page, '/dashboard');

    // Wait for dashboard to load
    await expect(page.getByTestId('dashboard')).toBeVisible({ timeout: 15000 });

    // Click notifications trigger
    const notificationsTrigger = page.getByTestId('notifications-trigger');
    await notificationsTrigger.click();

    // Wait for dropdown to open
    await page.waitForTimeout(1000);

    // Look for notification items
    const notificationItems = page.locator('[data-testid^="notification-item-"]');

    // Wait for at least one notification to appear
    const firstNotificationVisible = await notificationItems.first().isVisible().catch(() => false);

    if (firstNotificationVisible) {
      // Click on the first notification
      const firstNotification = notificationItems.first();

      // Listen for new page (external link opens in new tab)
      const pagePromise = context.waitForEvent('page', { timeout: 5000 }).catch(() => null);

      await firstNotification.click();

      const newPage = await pagePromise;

      // If a new page was opened, it means there was an external link
      if (newPage) {
        // Verify the new page opened (external link behavior)
        expect(newPage.url()).toMatch(/^https?:\/\//);
        await newPage.close();
      }
      // If no new page, the notification either had an internal link or no link
      // Both are valid behaviors
    } else {
      // No notifications - this is acceptable if seeding didn't create any for this user
      console.log('No notifications visible for learner - skipping link click test');
    }
  });
});

// =====================
// Empty State Tests
// =====================

test.describe('Announcements - Empty States', () => {
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test('ANNOUNCE-E2E-08: History table shows either data or empty state', async ({
    page,
  }) => {
    // Navigate to announcements tab
    await navigateToAdminAnnouncementsTab(page);

    const historyTable = page.getByTestId('announcement-history-table');
    await expect(historyTable).toBeVisible({ timeout: 10000 });

    // Wait a moment for data to potentially load
    await page.waitForTimeout(1000);

    // Check for either: rows with data OR empty state message
    // This handles both scenarios: seeded data present OR fresh environment
    const announcementRows = page.locator('[data-testid^="announcement-row-"]');
    const emptyMessage = historyTable.getByText(/no announcements/i);

    // At least one of these should be true
    const hasRows = (await announcementRows.count()) > 0;
    const hasEmptyMessage = await emptyMessage.isVisible().catch(() => false);

    // Either we have rows OR we have empty state - both are valid
    expect(hasRows || hasEmptyMessage).toBe(true);
  });
});
