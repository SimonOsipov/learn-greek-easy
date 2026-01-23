/**
 * E2E Tests: Culture News Article Analysis
 *
 * Tests the AI-powered article discovery feature including:
 * - Viewing completed analysis with discovered articles
 * - Viewing empty analysis (no articles found)
 * - Viewing failed analysis with retry option
 * - Viewing pending analysis with loading spinner
 *
 * Uses Playwright's storageState pattern for admin authentication.
 */

import { test, expect } from '@playwright/test';
import { verifyAuthSucceeded, waitForAppReady } from './helpers/auth-helpers';

test.describe('Article Analysis Feature', () => {
  // Use admin storage state (superuser)
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/admin');

    // Fail fast with clear error if auth failed
    await verifyAuthSucceeded(page, '/admin');

    // Wait for app to be ready
    await waitForAppReady(page);

    // Wait for admin tab switcher to load
    await expect(page.getByTestId('admin-tab-switcher')).toBeVisible({ timeout: 15000 });

    // Click on the News tab to show news sources section
    await page.getByTestId('admin-tab-news').click();

    // Wait for news sources section to load
    await expect(page.getByTestId('news-sources-section')).toBeVisible({ timeout: 15000 });

    // Wait for sources to load and expand first source
    const sourceRows = page.locator('[data-testid^="source-row-"]');
    await expect(sourceRows.first()).toBeVisible({ timeout: 20000 });

    // Expand first source to see fetch history
    const firstSourceRow = sourceRows.first();
    const accordionTrigger = firstSourceRow.locator('[data-radix-collection-item]');
    await accordionTrigger.click();

    // Wait for fetch history table to load
    const historyTable = page.getByTestId('fetch-history-table');
    await expect(historyTable.or(page.getByTestId('fetch-history-empty'))).toBeVisible({
      timeout: 15000,
    });
  });

  // =============================================================================
  // View Articles Tests
  // =============================================================================

  test('E2E-ANALYSIS-01: Displays completed analysis with discovered articles', async ({
    page,
  }) => {
    // Find history table
    const historyTable = page.getByTestId('fetch-history-table');
    if (!(await historyTable.isVisible())) {
      test.skip(true, 'No fetch history available');
      return;
    }

    // Find an enabled view articles button (skip disabled/pending ones)
    const viewArticlesBtns = page.locator('[data-testid^="view-articles-"]:not([disabled])');
    if ((await viewArticlesBtns.count()) === 0) {
      test.skip(true, 'No enabled view articles buttons');
      return;
    }

    const viewArticlesBtn = viewArticlesBtns.first();

    // Click to open articles modal
    await viewArticlesBtn.click();

    // Modal should open
    await expect(page.getByTestId('discovered-articles-modal')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('discovered-articles-title')).toBeVisible();

    // Wait for loading to complete - check for various states
    // Could be: loading, analyzing, failed, empty, or list
    const loadingIndicator = page.getByTestId('discovered-articles-loading');
    const analyzingIndicator = page.getByTestId('discovered-articles-analyzing');

    // Wait for loading/analyzing to disappear (with timeout)
    try {
      await loadingIndicator.waitFor({ state: 'hidden', timeout: 10000 });
    } catch {
      // Loading might not have appeared
    }
    try {
      await analyzingIndicator.waitFor({ state: 'hidden', timeout: 10000 });
    } catch {
      // Analyzing might not appear
    }

    // Check what state we're in
    const articlesList = page.getByTestId('discovered-articles-list');
    const emptyState = page.getByTestId('discovered-articles-empty');
    const failedState = page.getByTestId('discovered-articles-failed');

    // One of these should be visible
    await expect(articlesList.or(emptyState).or(failedState)).toBeVisible({ timeout: 5000 });

    // If we have articles list, verify structure
    if (await articlesList.isVisible()) {
      // Should have at least one article
      const articles = page.locator('[data-testid^="discovered-article-"]');
      await expect(articles.first()).toBeVisible();

      // First article should have title and link
      const firstArticle = articles.first();
      await expect(firstArticle.locator('p.font-medium')).toBeVisible();
      await expect(firstArticle.locator('a[href]')).toBeVisible();
    }

    // Close modal via escape
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('discovered-articles-modal')).not.toBeVisible({ timeout: 3000 });
  });

  test('E2E-ANALYSIS-02: Displays empty analysis state when no articles found', async ({
    page,
  }) => {
    // This test verifies the empty state works correctly
    // The seed data includes an entry with analysis_status=completed but discovered_articles=[]

    const historyTable = page.getByTestId('fetch-history-table');
    if (!(await historyTable.isVisible())) {
      test.skip(true, 'No fetch history available');
      return;
    }

    // Get all view articles buttons
    const viewArticlesBtns = page.locator('[data-testid^="view-articles-"]');
    const btnCount = await viewArticlesBtns.count();

    // Try each button looking for the empty state
    let foundEmptyState = false;
    for (let i = 0; i < Math.min(btnCount, 5); i++) {
      const btn = viewArticlesBtns.nth(i);

      // Skip if button is disabled (pending state)
      if (await btn.isDisabled()) {
        continue;
      }

      await btn.click();
      await expect(page.getByTestId('discovered-articles-modal')).toBeVisible({ timeout: 5000 });

      // Wait for loading to complete
      const loadingIndicator = page.getByTestId('discovered-articles-loading');
      try {
        await loadingIndicator.waitFor({ state: 'hidden', timeout: 10000 });
      } catch {
        // Loading might not have appeared
      }

      // Check for empty state
      const emptyState = page.getByTestId('discovered-articles-empty');
      if (await emptyState.isVisible({ timeout: 2000 }).catch(() => false)) {
        foundEmptyState = true;
        // Verify empty state content
        await expect(emptyState).toBeVisible();
        break;
      }

      // Close modal and try next
      await page.keyboard.press('Escape');
      await page
        .getByTestId('discovered-articles-modal')
        .waitFor({ state: 'hidden', timeout: 3000 });
    }

    if (!foundEmptyState) {
      test.skip(true, 'No empty analysis state found in seeded data');
    }
  });

  test('E2E-ANALYSIS-03: Displays failed analysis with retry option', async ({ page }) => {
    const historyTable = page.getByTestId('fetch-history-table');
    if (!(await historyTable.isVisible())) {
      test.skip(true, 'No fetch history available');
      return;
    }

    // Find a button with text-destructive class (indicates failed analysis)
    // Note: Failed analysis buttons have this class for red styling
    const failedBtn = page.locator('[data-testid^="view-articles-"].text-destructive');

    if ((await failedBtn.count()) === 0) {
      test.skip(true, 'No failed analysis in seeded data');
      return;
    }

    // Click to open modal
    await failedBtn.first().click();
    await expect(page.getByTestId('discovered-articles-modal')).toBeVisible({ timeout: 5000 });

    // Wait for loading to complete
    const loadingIndicator = page.getByTestId('discovered-articles-loading');
    try {
      await loadingIndicator.waitFor({ state: 'hidden', timeout: 10000 });
    } catch {
      // Loading might not have appeared
    }

    // Should show failed state
    await expect(page.getByTestId('discovered-articles-failed')).toBeVisible({ timeout: 5000 });

    // Should have retry button
    await expect(page.getByTestId('discovered-articles-retry-btn')).toBeVisible();

    // Close modal
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('discovered-articles-modal')).not.toBeVisible({ timeout: 3000 });
  });

  test('E2E-ANALYSIS-04: Pending analysis shows disabled button with spinner', async ({
    page,
  }) => {
    const historyTable = page.getByTestId('fetch-history-table');
    if (!(await historyTable.isVisible())) {
      test.skip(true, 'No fetch history available');
      return;
    }

    // Find a disabled view articles button (indicates pending analysis)
    // Disabled buttons have a spinning svg element
    const pendingBtn = page.locator('[data-testid^="view-articles-"]:disabled').filter({
      has: page.locator('svg.animate-spin'),
    });

    if ((await pendingBtn.count()) === 0) {
      test.skip(true, 'No pending analysis in seeded data');
      return;
    }

    // Verify the button is disabled
    await expect(pendingBtn.first()).toBeDisabled();

    // Verify spinner is visible (has animate-spin class)
    await expect(pendingBtn.first().locator('svg.animate-spin')).toBeVisible();
  });

  test('E2E-ANALYSIS-05: Article links open in new tab', async ({ page, context }) => {
    const historyTable = page.getByTestId('fetch-history-table');
    if (!(await historyTable.isVisible())) {
      test.skip(true, 'No fetch history available');
      return;
    }

    // Find and click an enabled view articles button
    const viewArticlesBtns = page.locator('[data-testid^="view-articles-"]:not([disabled])');
    if ((await viewArticlesBtns.count()) === 0) {
      test.skip(true, 'No enabled view articles button available');
      return;
    }

    const viewArticlesBtn = viewArticlesBtns.first();

    await viewArticlesBtn.click();
    await expect(page.getByTestId('discovered-articles-modal')).toBeVisible({ timeout: 5000 });

    // Wait for loading to complete
    const loadingIndicator = page.getByTestId('discovered-articles-loading');
    try {
      await loadingIndicator.waitFor({ state: 'hidden', timeout: 10000 });
    } catch {
      // Loading might not have appeared
    }

    // Check if we have articles with links
    const articlesList = page.getByTestId('discovered-articles-list');
    if (!(await articlesList.isVisible({ timeout: 3000 }).catch(() => false))) {
      await page.keyboard.press('Escape');
      test.skip(true, 'No articles list visible');
      return;
    }

    // Verify article links have target="_blank" for new tab
    const articleLink = articlesList.locator('a[href][target="_blank"]').first();
    await expect(articleLink).toBeVisible();

    // Verify it has rel="noopener noreferrer" for security
    await expect(articleLink).toHaveAttribute('rel', /noopener/);

    // Close modal
    await page.keyboard.press('Escape');
  });

  test('E2E-ANALYSIS-06: Modal shows token usage for completed analysis', async ({ page }) => {
    const historyTable = page.getByTestId('fetch-history-table');
    if (!(await historyTable.isVisible())) {
      test.skip(true, 'No fetch history available');
      return;
    }

    // Find and click an enabled view articles button
    const viewArticlesBtns = page.locator('[data-testid^="view-articles-"]:not([disabled])');
    if ((await viewArticlesBtns.count()) === 0) {
      test.skip(true, 'No enabled view articles button available');
      return;
    }

    const viewArticlesBtn = viewArticlesBtns.first();

    await viewArticlesBtn.click();
    await expect(page.getByTestId('discovered-articles-modal')).toBeVisible({ timeout: 5000 });

    // Wait for loading to complete
    const loadingIndicator = page.getByTestId('discovered-articles-loading');
    try {
      await loadingIndicator.waitFor({ state: 'hidden', timeout: 10000 });
    } catch {
      // Loading might not have appeared
    }

    // Check if we have articles list (token usage only shown with articles)
    const articlesList = page.getByTestId('discovered-articles-list');
    if (await articlesList.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Verify token usage is displayed (format: "X,XXX tokens")
      const tokenText = page.getByText(/\d{1,3}(,\d{3})*\s+tokens/i);
      await expect(tokenText).toBeVisible();
    }

    // Close modal
    await page.keyboard.press('Escape');
  });
});

test.describe('Article Analysis - Retry Functionality', () => {
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test('E2E-ANALYSIS-07: Can retry failed analysis', async ({ page }) => {
    await page.goto('/admin');
    await verifyAuthSucceeded(page, '/admin');
    await waitForAppReady(page);

    // Navigate to News tab
    await page.getByTestId('admin-tab-news').click();
    await expect(page.getByTestId('news-sources-section')).toBeVisible({ timeout: 15000 });

    // Expand first source
    const sourceRows = page.locator('[data-testid^="source-row-"]');
    await expect(sourceRows.first()).toBeVisible({ timeout: 10000 });
    const accordionTrigger = sourceRows.first().locator('[data-radix-collection-item]');
    await accordionTrigger.click();

    // Wait for history to load
    const historyTable = page.getByTestId('fetch-history-table');
    await expect(historyTable.or(page.getByTestId('fetch-history-empty'))).toBeVisible({
      timeout: 10000,
    });

    if (!(await historyTable.isVisible())) {
      test.skip(true, 'No fetch history available');
      return;
    }

    // Find failed analysis button (has text-destructive class for red styling)
    const failedBtn = page.locator('[data-testid^="view-articles-"].text-destructive');

    if ((await failedBtn.count()) === 0) {
      test.skip(true, 'No failed analysis in seeded data');
      return;
    }

    await failedBtn.first().click();
    await expect(page.getByTestId('discovered-articles-modal')).toBeVisible({ timeout: 5000 });

    // Wait for failed state
    await expect(page.getByTestId('discovered-articles-failed')).toBeVisible({ timeout: 10000 });

    // Click retry button
    const retryBtn = page.getByTestId('discovered-articles-retry-btn');
    await expect(retryBtn).toBeVisible();
    await retryBtn.click();

    // Retry button should show loading state
    await expect(retryBtn.locator('svg.lucide-loader-2')).toBeVisible({ timeout: 5000 });

    // Wait for retry to complete (analyzing state or result)
    // In test environment with mock, this should complete quickly
    const analyzingState = page.getByTestId('discovered-articles-analyzing');
    const articlesList = page.getByTestId('discovered-articles-list');
    const emptyState = page.getByTestId('discovered-articles-empty');
    const failedState = page.getByTestId('discovered-articles-failed');

    // One of these should eventually be visible
    await expect(analyzingState.or(articlesList).or(emptyState).or(failedState)).toBeVisible({
      timeout: 15000,
    });

    // Close modal
    await page.keyboard.press('Escape');
  });
});
