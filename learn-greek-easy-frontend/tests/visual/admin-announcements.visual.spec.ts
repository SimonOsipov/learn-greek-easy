/**
 * Admin Announcements - Visual Regression Tests
 *
 * Visual regression tests for the announcement management feature.
 * Uses Chromatic for visual snapshots and comparison.
 *
 * These tests capture 8 scenarios:
 * 1. Create form empty state
 * 2. History list empty state
 * 3. History list with data
 * 4. Preview modal
 * 5. Confirmation dialog (same as preview modal - contains warning)
 * 6. Form filled state (alternative to success toast)
 * 7. Detail modal with stats
 * 8. Announcement in notification center (learner view)
 */

import { test, expect } from '@chromatic-com/playwright';
import {
  takeSnapshot,
  loginForVisualTest,
  waitForPageReady,
  VIEWPORTS,
} from './helpers/visual-helpers';

// ============================================================================
// MOCK DATA
// ============================================================================

const mockAnnouncements = [
  {
    id: 'ann-001',
    title: 'Welcome to Learn Greek Easy v2.0',
    message:
      'We are excited to announce the release of version 2.0 with new features including improved flashcards, better progress tracking, and more!',
    link_url: 'https://learngreekeasy.com/blog/v2-release',
    created_at: '2026-01-25T10:30:00Z',
    total_recipients: 1500,
    read_count: 850,
    creator: {
      id: 'admin-1',
      display_name: 'Admin User',
    },
  },
  {
    id: 'ann-002',
    title: 'Scheduled Maintenance - January 30',
    message:
      'We will be performing scheduled maintenance on January 30th from 2:00 AM to 4:00 AM UTC. The service may be briefly unavailable during this time.',
    link_url: null,
    created_at: '2026-01-20T14:00:00Z',
    total_recipients: 1450,
    read_count: 1200,
    creator: {
      id: 'admin-1',
      display_name: 'Admin User',
    },
  },
  {
    id: 'ann-003',
    title: 'New Greek Grammar Section Available',
    message:
      'Check out our brand new grammar section with comprehensive lessons on verb conjugation, noun declension, and more!',
    link_url: 'https://learngreekeasy.com/grammar',
    created_at: '2026-01-15T09:00:00Z',
    total_recipients: 1400,
    read_count: 980,
    creator: {
      id: 'admin-2',
      display_name: 'Content Manager',
    },
  },
];

const mockAnnouncementDetail = {
  id: 'ann-001',
  title: 'Welcome to Learn Greek Easy v2.0',
  message:
    'We are excited to announce the release of version 2.0 with new features including improved flashcards, better progress tracking, and more!\n\nKey highlights:\n- New spaced repetition algorithm\n- Improved progress dashboard\n- Mobile app improvements\n\nThank you for being part of our community!',
  link_url: 'https://learngreekeasy.com/blog/v2-release',
  created_at: '2026-01-25T10:30:00Z',
  total_recipients: 1500,
  read_count: 850,
  read_percentage: 56.67,
  creator: {
    id: 'admin-1',
    display_name: 'Admin User',
  },
};

const mockNotifications = [
  {
    id: 'notif-001',
    type: 'admin_announcement',
    title: 'Welcome to Learn Greek Easy v2.0',
    message: 'We are excited to announce the release of version 2.0...',
    icon: 'megaphone',
    action_url: 'https://learngreekeasy.com/blog/v2-release',
    extra_data: { announcement_id: 'ann-001' },
    read: false,
    read_at: null,
    created_at: '2026-01-25T10:30:00Z',
  },
  {
    id: 'notif-002',
    type: 'daily_goal_complete',
    title: 'Daily Goal Complete!',
    message: 'You have completed your daily learning goal.',
    icon: 'check-circle',
    action_url: '/statistics',
    extra_data: null,
    read: true,
    read_at: '2026-01-25T12:00:00Z',
    created_at: '2026-01-25T11:30:00Z',
  },
];

// ============================================================================
// ADMIN ANNOUNCEMENT VISUAL TESTS
// ============================================================================

test.describe('Admin Announcements - Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set up admin authentication for visual tests
    await loginForVisualTest(page);

    // Override role to admin
    await page.evaluate(() => {
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        const authState = JSON.parse(authStorage);
        authState.state.user.role = 'admin';
        localStorage.setItem('auth-storage', JSON.stringify(authState));
      }
    });
  });

  // Scenario 1: Create Form - Empty State
  test('Announcement Create Form - Empty State', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    // Mock announcements list API to return data for history section
    await page.route('**/api/v1/admin/announcements*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: mockAnnouncements,
          total: mockAnnouncements.length,
          page: 1,
          page_size: 10,
          total_pages: 1,
        }),
      });
    });

    await page.goto('/admin');
    await waitForPageReady(page, '[data-testid="admin-page"]');

    // Click Announcements tab
    await page.getByTestId('admin-tab-announcements').click();
    await expect(page.getByTestId('announcements-tab')).toBeVisible();
    await page.waitForTimeout(500);

    // Capture empty form state
    await takeSnapshot(page, 'Announcement Create Form - Empty State', testInfo);
  });

  // Scenario 2: History List - Empty State
  test('Announcement History - Empty State', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    // Mock API to return empty list
    await page.route('**/api/v1/admin/announcements*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [],
          total: 0,
          page: 1,
          page_size: 10,
          total_pages: 0,
        }),
      });
    });

    await page.goto('/admin');
    await waitForPageReady(page, '[data-testid="admin-page"]');

    // Click Announcements tab
    await page.getByTestId('admin-tab-announcements').click();
    await expect(page.getByTestId('announcements-tab')).toBeVisible();
    await page.waitForTimeout(500);

    // Scroll to history table
    const historyTable = page.getByTestId('announcement-history-table');
    await historyTable.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    await takeSnapshot(page, 'Announcement History - Empty State', testInfo);
  });

  // Scenario 3: History List - With Data
  test('Announcement History - Populated', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    // Mock API to return announcements
    await page.route('**/api/v1/admin/announcements*', (route) => {
      const url = route.request().url();

      // Check if this is a detail request (has UUID at end)
      if (url.match(/\/announcements\/[a-f0-9-]+$/)) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockAnnouncementDetail),
        });
        return;
      }

      // List request
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: mockAnnouncements,
          total: mockAnnouncements.length,
          page: 1,
          page_size: 10,
          total_pages: 1,
        }),
      });
    });

    await page.goto('/admin');
    await waitForPageReady(page, '[data-testid="admin-page"]');

    // Click Announcements tab
    await page.getByTestId('admin-tab-announcements').click();
    await expect(page.getByTestId('announcements-tab')).toBeVisible();
    await page.waitForTimeout(500);

    // Scroll to history table
    const historyTable = page.getByTestId('announcement-history-table');
    await historyTable.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    await takeSnapshot(page, 'Announcement History - Populated', testInfo);
  });

  // Scenario 4: Preview Modal
  test('Announcement Preview Modal', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    // Mock API for announcements
    await page.route('**/api/v1/admin/announcements*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: mockAnnouncements,
          total: mockAnnouncements.length,
          page: 1,
          page_size: 10,
          total_pages: 1,
        }),
      });
    });

    await page.goto('/admin');
    await waitForPageReady(page, '[data-testid="admin-page"]');

    // Click Announcements tab
    await page.getByTestId('admin-tab-announcements').click();
    await expect(page.getByTestId('announcements-tab')).toBeVisible();
    await page.waitForTimeout(300);

    // Fill the form
    await page.getByTestId('announcement-title-input').fill('Important Platform Update');
    await page
      .getByTestId('announcement-message-input')
      .fill(
        'We are excited to announce significant improvements to our platform. This update includes enhanced performance, new learning features, and improved user experience.\n\nThank you for your continued support!'
      );
    await page.getByTestId('announcement-link-input').fill('https://learngreekeasy.com/updates');

    // Click preview button
    await page.getByTestId('announcement-preview-button').click();

    // Wait for modal to open
    await expect(page.getByTestId('announcement-preview-modal')).toBeVisible();
    await page.waitForTimeout(300);

    await takeSnapshot(page, 'Announcement Preview Modal', testInfo);
  });

  // Scenario 5: Confirmation Dialog (same as preview - it includes warning)
  test('Announcement Confirmation Dialog', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    // Mock API for announcements
    await page.route('**/api/v1/admin/announcements*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [],
          total: 0,
          page: 1,
          page_size: 10,
          total_pages: 0,
        }),
      });
    });

    await page.goto('/admin');
    await waitForPageReady(page, '[data-testid="admin-page"]');

    // Click Announcements tab
    await page.getByTestId('admin-tab-announcements').click();
    await expect(page.getByTestId('announcements-tab')).toBeVisible();
    await page.waitForTimeout(300);

    // Fill form with different content
    await page.getByTestId('announcement-title-input').fill('Scheduled Maintenance Notice');
    await page
      .getByTestId('announcement-message-input')
      .fill(
        'We will be performing scheduled maintenance on February 1st from 02:00 to 04:00 UTC. During this time, the platform may be temporarily unavailable.\n\nWe apologize for any inconvenience.'
      );

    // Click preview button
    await page.getByTestId('announcement-preview-button').click();

    // Wait for modal to open
    await expect(page.getByTestId('announcement-preview-modal')).toBeVisible();
    await page.waitForTimeout(300);

    await takeSnapshot(page, 'Announcement Confirmation Dialog', testInfo);
  });

  // Scenario 6: Form Filled State (alternative to capturing transient success toast)
  test('Announcement Form - Filled State', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    // Mock API for announcements
    await page.route('**/api/v1/admin/announcements*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: mockAnnouncements,
          total: mockAnnouncements.length,
          page: 1,
          page_size: 10,
          total_pages: 1,
        }),
      });
    });

    await page.goto('/admin');
    await waitForPageReady(page, '[data-testid="admin-page"]');

    // Click Announcements tab
    await page.getByTestId('admin-tab-announcements').click();
    await expect(page.getByTestId('announcements-tab')).toBeVisible();
    await page.waitForTimeout(300);

    // Fill form completely with various content showing character counters
    const longMessage =
      'This is a detailed announcement message that showcases the character counter feature. As you can see, the counter updates in real-time as you type, providing visual feedback about how much space remains. This helps administrators craft concise yet informative announcements for all users.';
    await page.getByTestId('announcement-title-input').fill('New Feature: Enhanced Grammar Lessons');
    await page.getByTestId('announcement-message-input').fill(longMessage);
    await page.getByTestId('announcement-link-input').fill('https://learngreekeasy.com/grammar/new');

    await page.waitForTimeout(300);

    await takeSnapshot(page, 'Announcement Form - Filled State', testInfo);
  });

  // Scenario 7: Detail Modal
  test('Announcement Detail Modal', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    // Mock API for announcements
    await page.route('**/api/v1/admin/announcements*', (route) => {
      const url = route.request().url();

      // Check if this is a detail request
      if (url.match(/\/announcements\/[a-f0-9-]+$/)) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockAnnouncementDetail),
        });
        return;
      }

      // List request
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: mockAnnouncements,
          total: mockAnnouncements.length,
          page: 1,
          page_size: 10,
          total_pages: 1,
        }),
      });
    });

    await page.goto('/admin');
    await waitForPageReady(page, '[data-testid="admin-page"]');

    // Click Announcements tab
    await page.getByTestId('admin-tab-announcements').click();
    await expect(page.getByTestId('announcements-tab')).toBeVisible();
    await page.waitForTimeout(500);

    // Scroll to history table and wait for it to load
    const historyTable = page.getByTestId('announcement-history-table');
    await historyTable.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    // Click view detail on first row
    await page.getByTestId('view-detail-ann-001').click();

    // Wait for detail modal to open
    await expect(page.getByTestId('announcement-detail-modal')).toBeVisible();
    await page.waitForTimeout(300);

    await takeSnapshot(page, 'Announcement Detail Modal', testInfo);
  });
});

// ============================================================================
// LEARNER NOTIFICATION CENTER VISUAL TESTS
// ============================================================================

test.describe('Announcement in Notification Center - Visual Tests', () => {
  // Scenario 8: Announcement in Notification Center (Learner View)
  test('Announcement in Notification Center', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    // Set up standard learner authentication (NOT admin)
    await loginForVisualTest(page);

    // Mock notifications API to include announcement
    await page.route('**/api/v1/notifications*', (route) => {
      const url = route.request().url();

      // Unread count
      if (url.includes('unread-count')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ count: 1 }),
        });
        return;
      }

      // Notifications list
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          notifications: mockNotifications,
          unread_count: 1,
          total_count: mockNotifications.length,
          has_more: false,
        }),
      });
    });

    await page.goto('/dashboard');
    await waitForPageReady(page);

    // Click notifications trigger to open dropdown
    await page.getByTestId('notifications-trigger').click();

    // Wait for dropdown to open and notifications to load
    await expect(page.getByTestId('notification-item-notif-001')).toBeVisible();
    await page.waitForTimeout(300);

    await takeSnapshot(page, 'Announcement in Notification Center', testInfo);
  });
});
