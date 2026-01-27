/**
 * E2E Tests: News Feed Page
 *
 * Tests the dedicated News Feed Page functionality:
 * - Grid display with 12 items per page
 * - Pagination controls and navigation
 * - Article click opens external link
 * - Questions button navigation
 * - Navigation from dashboard and header menu
 * - Mobile responsive behavior
 *
 * Test data is seeded via the /api/v1/test/seed/news-feed-page endpoint.
 * This creates 25 news items (10 with questions, 15 without).
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
 * Seed news items for the News Feed Page testing
 * Creates 25 items: 10 with questions, 15 without
 */
async function seedNewsFeedPage(request: APIRequestContext): Promise<void> {
  const apiBaseUrl = getApiBaseUrl();
  const response = await request.post(`${apiBaseUrl}/api/v1/test/seed/news-feed-page`);
  if (!response.ok()) {
    throw new Error(`Failed to seed news feed page: ${response.status()}`);
  }
}

/**
 * Wait for news grid to finish loading
 */
async function waitForNewsGridLoaded(page: Page): Promise<void> {
  // Wait for loading skeleton to disappear
  await expect(page.getByTestId('news-grid-loading')).toBeHidden({ timeout: 15000 });
  // Verify grid is visible
  await expect(page.getByTestId('news-grid')).toBeVisible({ timeout: 10000 });
}

// =====================
// Desktop Tests
// =====================

test.describe('News Feed Page - Desktop Tests', () => {
  // Use learner authentication
  test.use({ storageState: 'playwright/.auth/learner.json' });

  test.beforeEach(async ({ request }) => {
    // Seed news items before each test
    await seedNewsFeedPage(request);
  });

  test('NEWSFEED-PAGE-01: Page loads with articles - 12 cards on page 1, Previous disabled', async ({
    page,
  }) => {
    await page.goto('/news');
    await verifyAuthSucceeded(page, '/news');

    // Wait for page to load
    await expect(page.getByTestId('news-page')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('news-page-title')).toBeVisible();

    // Wait for grid to load
    await waitForNewsGridLoaded(page);

    // Verify we have 12 cards on page 1
    const newsCards = page.locator('[data-testid^="news-card-"]');
    await expect(newsCards).toHaveCount(12);

    // Verify Previous button is disabled on page 1
    const prevButton = page.getByTestId('news-pagination-prev');
    await expect(prevButton).toBeDisabled();

    // Verify Next button is enabled (we have more pages)
    const nextButton = page.getByTestId('news-pagination-next');
    await expect(nextButton).toBeEnabled();
  });

  test('NEWSFEED-PAGE-02: Pagination displays correctly - shows "Showing 1-12 of N"', async ({
    page,
  }) => {
    await page.goto('/news');
    await verifyAuthSucceeded(page, '/news');

    await waitForNewsGridLoaded(page);

    // Check the "Showing X-Y of Z" text format
    const showingText = page.getByTestId('news-pagination-showing');
    await expect(showingText).toBeVisible();
    // First page always shows 1-12 (12 items per page)
    await expect(showingText).toContainText('1-12');
    // Verify format includes "of" and "articles"
    const text = await showingText.textContent();
    expect(text).toMatch(/Showing 1-12 of \d+ articles/);
  });

  test('NEWSFEED-PAGE-03: Navigate to next page - click Next, verify page 2 content', async ({
    page,
  }) => {
    await page.goto('/news');
    await verifyAuthSucceeded(page, '/news');

    await waitForNewsGridLoaded(page);

    // Click Next button
    const nextButton = page.getByTestId('news-pagination-next');
    await nextButton.click();

    // Wait for page 2 to load
    await waitForNewsGridLoaded(page);

    // Verify page 2 shows items 13-24
    const showingText = page.getByTestId('news-pagination-showing');
    await expect(showingText).toContainText('13-24');

    // Verify page 2 button is active
    const page2Button = page.getByTestId('news-pagination-page-2');
    await expect(page2Button).toHaveAttribute('aria-current', 'page');

    // Verify Previous is now enabled
    const prevButton = page.getByTestId('news-pagination-prev');
    await expect(prevButton).toBeEnabled();
  });

  test('NEWSFEED-PAGE-04: Navigate to last page - verify Next disabled, 12 or fewer cards', async ({
    page,
  }) => {
    await page.goto('/news');
    await verifyAuthSucceeded(page, '/news');

    await waitForNewsGridLoaded(page);

    // Get total count from pagination text to determine last page
    const showingText = page.getByTestId('news-pagination-showing');
    const text = await showingText.textContent();
    const match = text?.match(/of (\d+)/);
    const totalItems = match ? parseInt(match[1], 10) : 0;
    const totalPages = Math.ceil(totalItems / 12);

    // Navigate to last page using Next button repeatedly
    for (let i = 1; i < totalPages; i++) {
      const nextButton = page.getByTestId('news-pagination-next');
      await nextButton.click();
      await waitForNewsGridLoaded(page);
    }

    // Verify Next button is disabled on last page
    const nextButton = page.getByTestId('news-pagination-next');
    await expect(nextButton).toBeDisabled();

    // Verify last page has 12 or fewer cards (remainder)
    const newsCards = page.locator('[data-testid^="news-card-"]');
    const cardCount = await newsCards.count();
    expect(cardCount).toBeGreaterThan(0);
    expect(cardCount).toBeLessThanOrEqual(12);
  });

  test('NEWSFEED-PAGE-05: Click page number directly - click page 2', async ({ page }) => {
    await page.goto('/news');
    await verifyAuthSucceeded(page, '/news');

    await waitForNewsGridLoaded(page);

    // Click page 2 button
    const page2Button = page.getByTestId('news-pagination-page-2');
    await page2Button.click();

    // Wait for page 2 to load
    await waitForNewsGridLoaded(page);

    // Verify page 2 is active
    await expect(page2Button).toHaveAttribute('aria-current', 'page');

    // Verify showing text
    const showingText = page.getByTestId('news-pagination-showing');
    await expect(showingText).toContainText('13-24');
  });

  test('NEWSFEED-PAGE-06: Click article opens detail - verify href attribute exists', async ({
    page,
  }) => {
    await page.goto('/news');
    await verifyAuthSucceeded(page, '/news');

    await waitForNewsGridLoaded(page);

    // Get first news card
    const firstCard = page.locator('[data-testid^="news-card-"]').first();
    await expect(firstCard).toBeVisible();

    // Verify it has an href attribute (external link)
    const href = await firstCard.getAttribute('href');
    expect(href).toBeTruthy();
    expect(href).toMatch(/^https?:\/\//); // Should be a valid URL

    // Verify target="_blank" for external links
    const target = await firstCard.getAttribute('target');
    expect(target).toBe('_blank');
  });

  test('NEWSFEED-PAGE-07: Click questions button - navigate to practice page', async ({
    page,
  }) => {
    await page.goto('/news');
    await verifyAuthSucceeded(page, '/news');

    await waitForNewsGridLoaded(page);

    // Find a news card with questions button (first 10 items have questions)
    // The questions button has data-testid="news-questions-button-{id}"
    const questionsButton = page.locator('[data-testid^="news-questions-button-"]').first();
    await expect(questionsButton).toBeVisible({ timeout: 10000 });

    // Click the questions button
    await questionsButton.click();

    // Verify navigation to practice page
    await page.waitForURL(/\/culture\/.*\/practice/, { timeout: 10000 });
    expect(page.url()).toMatch(/\/culture\/.*\/practice/);
  });
});

// =====================
// Navigation Tests
// =====================

test.describe('News Feed Page - Navigation Tests', () => {
  test.use({ storageState: 'playwright/.auth/learner.json' });

  test.beforeEach(async ({ request }) => {
    await seedNewsFeedPage(request);
  });

  test('NEWSFEED-PAGE-08: Navigate from dashboard "See all" link', async ({ page }) => {
    // Go to dashboard first
    await page.goto('/dashboard');
    await verifyAuthSucceeded(page, '/dashboard');

    // Wait for dashboard to load
    await expect(page.getByTestId('dashboard')).toBeVisible({ timeout: 15000 });

    // Wait for news section to appear
    const newsSection = page.getByTestId('news-section');
    await expect(newsSection).toBeVisible({ timeout: 15000 });

    // Wait for news section loading to complete
    const loadingState = page.getByTestId('news-section-loading');
    await expect(loadingState).toBeHidden({ timeout: 10000 });

    // Click "See all" link
    const seeAllLink = page.getByTestId('news-section-see-all');
    await expect(seeAllLink).toBeVisible();
    await seeAllLink.click();

    // Verify navigation to /news page
    await page.waitForURL('/news', { timeout: 10000 });
    await expect(page.getByTestId('news-page')).toBeVisible({ timeout: 10000 });
  });

  test('NEWSFEED-PAGE-09: Access from Practice dropdown menu', async ({ page }) => {
    // Go to dashboard first
    await page.goto('/dashboard');
    await verifyAuthSucceeded(page, '/dashboard');

    // Wait for page to be ready
    await expect(page.getByTestId('dashboard')).toBeVisible({ timeout: 15000 });

    // Click Practice dropdown trigger (desktop nav)
    const practiceDropdown = page.getByTestId('practice-dropdown-trigger');
    await expect(practiceDropdown).toBeVisible();
    await practiceDropdown.click();

    // Click "News Feed" option in dropdown
    const newsFeedOption = page.getByRole('menuitem', { name: /news feed/i });
    await expect(newsFeedOption).toBeVisible({ timeout: 5000 });
    await newsFeedOption.click();

    // Verify navigation to /news page
    await page.waitForURL('/news', { timeout: 10000 });
    await expect(page.getByTestId('news-page')).toBeVisible({ timeout: 10000 });
  });
});

// =====================
// Mobile Tests
// =====================

test.describe('News Feed Page - Mobile Tests', () => {
  test.use({ storageState: 'playwright/.auth/learner.json' });

  test.beforeEach(async ({ request }) => {
    await seedNewsFeedPage(request);
  });

  test('NEWSFEED-PAGE-10: Mobile pagination shows simplified controls (viewport 375x667)', async ({
    page,
  }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/news');
    await verifyAuthSucceeded(page, '/news');

    await waitForNewsGridLoaded(page);

    // Mobile pagination controls should be visible
    const prevMobile = page.getByTestId('news-pagination-prev-mobile');
    const nextMobile = page.getByTestId('news-pagination-next-mobile');
    await expect(prevMobile).toBeVisible();
    await expect(nextMobile).toBeVisible();

    // Desktop page numbers should be hidden on mobile
    const page2Button = page.getByTestId('news-pagination-page-2');
    await expect(page2Button).toBeHidden();

    // Verify Previous mobile is disabled on page 1
    await expect(prevMobile).toBeDisabled();

    // Verify Next mobile is enabled
    await expect(nextMobile).toBeEnabled();

    // Click Next mobile button
    await nextMobile.click();

    // Wait for page 2 to load
    await waitForNewsGridLoaded(page);

    // Verify Previous mobile is now enabled
    await expect(prevMobile).toBeEnabled();
  });

  test('NEWSFEED-PAGE-11: Mobile grid shows single column', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/news');
    await verifyAuthSucceeded(page, '/news');

    await waitForNewsGridLoaded(page);

    // Verify grid is visible
    const newsGrid = page.getByTestId('news-grid');
    await expect(newsGrid).toBeVisible();

    // Get the grid's computed style to verify single column
    // grid-cols-1 class means 1 column on mobile
    const gridClasses = await newsGrid.getAttribute('class');
    expect(gridClasses).toContain('grid-cols-1');

    // Verify news cards are displayed
    const newsCards = page.locator('[data-testid^="news-card-"]');
    const cardCount = await newsCards.count();
    expect(cardCount).toBe(12); // 12 items on first page
  });
});
