/**
 * E2E Tests: News Feed Feature
 *
 * Tests the news feed functionality for both admin and learner users:
 * - Admin: Create, edit, delete news items via JSON input
 * - Learner: View news section on dashboard
 *
 * Test data is seeded via the /api/v1/test/seed/news-feed endpoint.
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
 * Clear news items by truncating (via seed/all which clears everything)
 * We use a targeted approach by just not seeding news or clearing via API if available
 */
async function clearNewsItems(request: APIRequestContext): Promise<void> {
  const apiBaseUrl = getApiBaseUrl();
  // Truncate tables to clear all data including news items
  const response = await request.post(`${apiBaseUrl}/api/v1/test/seed/truncate`);
  if (!response.ok()) {
    console.warn('Failed to truncate tables:', response.status());
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
  const newsTab = page.getByRole('button', { name: /news/i });
  await newsTab.click();

  // Wait for news tab content to load
  await expect(page.getByTestId('news-create-card')).toBeVisible({ timeout: 10000 });
}

// =====================
// Admin Tests
// =====================

test.describe('News Feed - Admin Tests', () => {
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

    // Enter invalid JSON
    const jsonInput = page.getByTestId('news-json-input');
    await jsonInput.fill('{ invalid json }');

    // Click submit
    const submitButton = page.getByTestId('news-submit-button');
    await submitButton.click();

    // Should show error toast
    const toast = page.locator('[data-testid="toast"]').or(page.locator('[role="alert"]'));
    await expect(toast).toBeVisible({ timeout: 5000 });
  });

  test('NEWSFEED-03: Create news item shows error for missing required fields', async ({
    page,
  }) => {
    await navigateToAdminNewsTab(page);

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

    // Should show error toast about missing fields
    const toast = page.locator('[data-testid="toast"]').or(page.locator('[role="alert"]'));
    await expect(toast).toBeVisible({ timeout: 5000 });
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

    // Cancel should close modal
    await page.getByTestId('news-edit-cancel').click();
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

  test('NEWSFEED-06: Delete news item confirms deletion', async ({ page }) => {
    await navigateToAdminNewsTab(page);

    // Wait for table to load
    const newsRows = page.locator('[data-testid^="news-item-row-"]');
    await expect(newsRows.first()).toBeVisible({ timeout: 10000 });

    // Get initial count
    const initialCount = await newsRows.count();

    // Click delete on first item
    const deleteButton = page.locator('[data-testid^="delete-news-"]').first();
    await deleteButton.click();

    // Dialog should open
    const dialog = page.getByTestId('news-delete-dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Confirm deletion
    await page.getByTestId('news-delete-confirm').click();

    // Dialog should close
    await expect(dialog).toBeHidden({ timeout: 5000 });

    // Wait for table to update (either fewer rows or empty state)
    await page.waitForTimeout(1000); // Allow time for refresh

    // Either we have fewer rows or the empty state appears
    const newCount = await newsRows.count();
    const emptyState = page.getByTestId('news-table-empty');
    const hasEmpty = await emptyState.isVisible().catch(() => false);

    expect(newCount < initialCount || hasEmpty).toBe(true);
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

  test('NEWSFEED-10: News section displays on dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await verifyAuthSucceeded(page, '/dashboard');

    // Wait for dashboard to load
    await expect(page.getByTestId('dashboard')).toBeVisible({ timeout: 15000 });

    // News section should be visible
    const newsSection = page.getByTestId('news-section');
    await expect(newsSection).toBeVisible({ timeout: 10000 });
  });

  test('NEWSFEED-11: News section displays up to 3 items', async ({ page }) => {
    await page.goto('/dashboard');
    await verifyAuthSucceeded(page, '/dashboard');

    // Wait for news section
    const newsSection = page.getByTestId('news-section');
    await expect(newsSection).toBeVisible({ timeout: 15000 });

    // Wait for cards to load (not loading state)
    const loadingState = page.getByTestId('news-section-loading');
    await expect(loadingState).toBeHidden({ timeout: 10000 });

    // Count news cards
    const newsCards = page.locator('[data-testid^="news-card-"]');
    const cardCount = await newsCards.count();

    // Should have 1-3 cards (max 3 displayed on dashboard)
    expect(cardCount).toBeGreaterThanOrEqual(1);
    expect(cardCount).toBeLessThanOrEqual(3);
  });

  test('NEWSFEED-12: News card link has correct attributes', async ({ page }) => {
    await page.goto('/dashboard');
    await verifyAuthSucceeded(page, '/dashboard');

    // Wait for news section
    const newsSection = page.getByTestId('news-section');
    await expect(newsSection).toBeVisible({ timeout: 15000 });

    // Wait for loading to complete
    const loadingState = page.getByTestId('news-section-loading');
    await expect(loadingState).toBeHidden({ timeout: 10000 });

    // Get first news card
    const firstCard = page.locator('[data-testid^="news-card-"]').first();
    await expect(firstCard).toBeVisible();

    // Verify it's a link with correct attributes
    const href = await firstCard.getAttribute('href');
    const target = await firstCard.getAttribute('target');

    expect(href).toBeTruthy();
    expect(href).toMatch(/^https?:\/\//); // Should be a valid URL
    expect(target).toBe('_blank'); // Should open in new tab
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

  test('NEWSFEED-30: News section displays correctly on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/dashboard');
    await verifyAuthSucceeded(page, '/dashboard');

    // Wait for dashboard to load
    await expect(page.getByTestId('dashboard')).toBeVisible({ timeout: 15000 });

    // News section should be visible
    const newsSection = page.getByTestId('news-section');
    await expect(newsSection).toBeVisible({ timeout: 10000 });

    // Wait for loading to complete
    const loadingState = page.getByTestId('news-section-loading');
    await expect(loadingState).toBeHidden({ timeout: 10000 });

    // Cards should be displayed (single column on mobile)
    const newsCards = page.locator('[data-testid^="news-card-"]');
    await expect(newsCards.first()).toBeVisible();
  });
});
