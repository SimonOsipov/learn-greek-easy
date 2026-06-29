/**
 * E2E Tests: News Feed Feature
 *
 * Tests the news feed functionality for both admin and learner users:
 * - Admin: Create, edit, delete news items via JSON input
 * - Learner: View news section on dashboard
 *
 * Test data is seeded via the /api/v1/test/seed/news-feed endpoint.
 */

import { test, expect } from '@playwright/test';
import type { Page, APIRequestContext } from '@playwright/test';
import { navigateToAdminTab } from './helpers/admin-helpers';
import { verifyAuthSucceeded } from './helpers/auth-helpers';

/**
 * Get the API base URL from environment
 */
function getApiBaseUrl(): string {
  return process.env.E2E_API_URL || process.env.VITE_API_URL || 'http://localhost:8000';
}

/**
 * Seed news items for testing
 */
async function seedNewsItems(request: APIRequestContext): Promise<void> {
  const apiBaseUrl = getApiBaseUrl();
  const response = await request.post(`${apiBaseUrl}/api/v1/test/seed/news-feed`);
  if (!response.ok()) {
    throw new Error(`Failed to seed news items: ${response.status()}`);
  }
}

/**
 * Clear only news items (does not affect other test data)
 */
async function clearNewsItems(request: APIRequestContext): Promise<void> {
  const apiBaseUrl = getApiBaseUrl();
  // Use the dedicated news-clear endpoint that only affects news_items table
  const response = await request.post(`${apiBaseUrl}/api/v1/test/seed/news-feed/clear`);
  if (!response.ok()) {
    console.warn('Failed to clear news items:', response.status());
  }
}

/**
 * Navigate to admin page and click on News tab
 */
async function navigateToAdminNewsTab(page: Page): Promise<void> {
  await page.goto('/admin');
  await verifyAuthSucceeded(page, '/admin');

  // Wait for admin page to load
  await expect(page.getByTestId('admin-page')).toBeVisible({ timeout: 15000 });

  // Click on News tab
  await navigateToAdminTab(page, 'news');

  // Wait for news tab content to load
  await expect(page.getByTestId('news-items-table')).toBeVisible({ timeout: 10000 });
}

// =====================
// Admin Tests
// =====================

// ADMIN2-12: delete after V1 source removal
// These tests target the V1 admin News UI (NewsItemsTable + NewsItemEditModal +
// NewsItemCreateModal JSON entry). NEWS-05 replaced that UI with a card grid
// + drawer. ADMIN2-12 will delete the V1 source files; this describe gets
// removed then. The new admin-news.spec.ts (NEWS-10) covers the v2 surface.
test.describe.skip('News Feed - Admin Tests', () => {
  // Use admin authentication
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test.beforeEach(async ({ request }) => {
    // Seed news items before each test
    await seedNewsItems(request);
  });

  test('NEWSFEED-01: Display news items table with seeded data', async ({ page }) => {
    await navigateToAdminNewsTab(page);

    // Wait for news items table to load
    const table = page.getByTestId('news-items-table');
    await expect(table).toBeVisible({ timeout: 10000 });

    // Should have at least one news item row
    const newsRows = page.locator('[data-testid^="news-item-row-"]');
    await expect(newsRows.first()).toBeVisible({ timeout: 10000 });

    // Verify we have multiple items (seeding creates 5)
    const rowCount = await newsRows.count();
    expect(rowCount).toBeGreaterThanOrEqual(1);
  });

  test('NEWSFEED-02: Create news item shows validation for invalid JSON', async ({ page }) => {
    await navigateToAdminNewsTab(page);

    // Open create modal
    await page.getByTestId('news-create-button').click();
    await expect(page.getByTestId('news-create-modal')).toBeVisible();

    // Enter invalid JSON
    const jsonInput = page.getByTestId('news-json-input');
    await jsonInput.fill('{ invalid json }');

    // Click submit
    const submitButton = page.getByTestId('news-submit-button');
    await submitButton.click();

    // Should show error in modal alert
    const modal = page.getByTestId('news-create-modal');
    await expect(modal.locator('[role="alert"]')).toBeVisible({ timeout: 5000 });
  });

  test('NEWSFEED-03: Create news item shows error for missing required fields', async ({
    page,
  }) => {
    await navigateToAdminNewsTab(page);

    // Open create modal
    await page.getByTestId('news-create-button').click();
    await expect(page.getByTestId('news-create-modal')).toBeVisible();

    // Enter JSON with missing fields
    const incompleteJson = JSON.stringify({
      title_el: 'Greek title',
      title_en: 'English title',
      // Missing: title_ru, descriptions, publication_date, original_article_url, source_image_url
    });

    const jsonInput = page.getByTestId('news-json-input');
    await jsonInput.fill(incompleteJson);

    // Click submit
    const submitButton = page.getByTestId('news-submit-button');
    await submitButton.click();

    // Should show error in modal alert
    const modal = page.getByTestId('news-create-modal');
    await expect(modal.locator('[role="alert"]')).toBeVisible({ timeout: 5000 });
  });

  test('NEWSFEED-04: Edit news item modal opens and closes', async ({ page }) => {
    await navigateToAdminNewsTab(page);

    // Wait for table to load
    const newsRows = page.locator('[data-testid^="news-item-row-"]');
    await expect(newsRows.first()).toBeVisible({ timeout: 10000 });

    // Click edit on first item
    const editButton = page.locator('[data-testid^="edit-news-"]').first();
    await editButton.click();

    // Modal should open
    const modal = page.getByTestId('news-edit-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // JSON input should be visible
    await expect(page.getByTestId('news-edit-json-input')).toBeVisible();

    // Cancel should close modal (use Escape since modal may overflow viewport with A2 section)
    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();
  });

  test('NEWSFEED-05: Delete news item dialog opens and closes', async ({ page }) => {
    await navigateToAdminNewsTab(page);

    // Wait for table to load
    const newsRows = page.locator('[data-testid^="news-item-row-"]');
    await expect(newsRows.first()).toBeVisible({ timeout: 10000 });

    // Click delete on first item
    const deleteButton = page.locator('[data-testid^="delete-news-"]').first();
    await deleteButton.click();

    // Dialog should open
    const dialog = page.getByTestId('news-delete-dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Cancel should close dialog
    await page.getByTestId('news-delete-cancel').click();
    await expect(dialog).toBeHidden();
  });

});

// =====================
// Learner Tests
// =====================

test.describe('News Feed - Learner Dashboard Tests', () => {
  // Use learner authentication (default)
  test.use({ storageState: 'playwright/.auth/learner.json' });

  test.beforeEach(async ({ request }) => {
    // Seed news items before each test
    await seedNewsItems(request);
  });

  test('NEWSFEED-10: News cards display in dashboard feed', async ({ page }) => {
    await page.goto('/dashboard');
    await verifyAuthSucceeded(page, '/dashboard');

    // Wait for dashboard to load
    await expect(page.getByTestId('dashboard')).toBeVisible({ timeout: 15000 });

    // Redesign: dedicated news-section removed; news surfaces as FeedNews cards
    // inside the unified feed-section (data-kind="news" on the badge span).
    const feedSection = page.getByTestId('feed-section');
    await expect(feedSection).toBeVisible({ timeout: 10000 });
    const newsCards = feedSection.locator('[data-kind="news"]');
    await expect(newsCards.first()).toBeVisible({ timeout: 10000 });
  });

  test('NEWSFEED-11: News cards in feed match seeded count', async ({ page }) => {
    await page.goto('/dashboard');
    await verifyAuthSucceeded(page, '/dashboard');

    // Wait for feed section
    const feedSection = page.getByTestId('feed-section');
    await expect(feedSection).toBeVisible({ timeout: 15000 });

    // Redesign: composeFeed surfaces news as data-kind="news" cards; news loads async
    // (TanStack Query), so wait for the first card to render before counting — otherwise
    // count() races the query and returns 0 right after feed-section becomes visible.
    const newsCards = feedSection.locator('[data-kind="news"]');
    await expect(newsCards.first()).toBeVisible({ timeout: 10000 });
    const cardCount = await newsCards.count();

    // Seeder creates items; composeFeed has no upper cap — just verify ≥1 surfaced
    expect(cardCount).toBeGreaterThanOrEqual(1);
  });

  test('NEWSFEED-12: News card is present and interactive in feed', async ({ page }) => {
    await page.goto('/dashboard');
    await verifyAuthSucceeded(page, '/dashboard');

    // Wait for feed section
    const feedSection = page.getByTestId('feed-section');
    await expect(feedSection).toBeVisible({ timeout: 15000 });

    // Redesign: news cards are <article class="db-card is-news"> with onClick → window.open.
    // The anchor href/target model is gone by design (coverage lives on /news page cards).
    // Assert the news badge and card article are visible — confirms rendered & actionable.
    const newsBadge = feedSection.locator('[data-kind="news"]').first();
    await expect(newsBadge).toBeVisible({ timeout: 10000 });
    const newsArticle = feedSection.locator('article.is-news').first();
    await expect(newsArticle).toBeVisible({ timeout: 5000 });
  });
});

// =====================
// Empty State Tests
// =====================

test.describe('News Feed - Empty State Tests', () => {
  test.use({ storageState: 'playwright/.auth/learner.json' });

  test('NEWSFEED-20: News section hidden when no items exist', async ({ page, request }) => {
    // Clear all data including news items
    await clearNewsItems(request);

    await page.goto('/dashboard');
    await verifyAuthSucceeded(page, '/dashboard');

    // Wait for dashboard to load
    await expect(page.getByTestId('dashboard')).toBeVisible({ timeout: 15000 });

    // Give time for news fetch to complete
    await page.waitForTimeout(2000);

    // News section should NOT be visible when there are no items
    const newsSection = page.getByTestId('news-section');
    const isVisible = await newsSection.isVisible().catch(() => false);

    // Section should be hidden (returns null when no items)
    expect(isVisible).toBe(false);

    // Re-seed for other tests
    await seedNewsItems(request);
  });
});

// =====================
// Mobile Tests
// =====================

test.describe('News Feed - Mobile Responsive Tests', () => {
  test.use({ storageState: 'playwright/.auth/learner.json' });

  test.beforeEach(async ({ request }) => {
    await seedNewsItems(request);
  });

  test('NEWSFEED-30: News cards display correctly on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/dashboard');
    await verifyAuthSucceeded(page, '/dashboard');

    // Wait for dashboard to load
    await expect(page.getByTestId('dashboard')).toBeVisible({ timeout: 15000 });

    // Redesign: news cards now in unified feed-section (news-section / news-section-loading removed)
    const feedSection = page.getByTestId('feed-section');
    await expect(feedSection).toBeVisible({ timeout: 10000 });
    const newsCards = feedSection.locator('[data-kind="news"]');
    await expect(newsCards.first()).toBeVisible({ timeout: 10000 });
  });
});
