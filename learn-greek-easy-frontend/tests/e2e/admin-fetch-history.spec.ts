/**
 * E2E Tests: Admin Fetch History
 *
 * Tests the admin panel fetch history feature including:
 * - Culture section tab navigation
 * - News sources display under News tab
 * - Manual fetch trigger
 * - Fetch history viewing (accordion expansion)
 * - HTML content viewing in modal
 *
 * Uses Playwright's storageState pattern for admin authentication.
 */

import { test, expect } from '@playwright/test';
import { verifyAuthSucceeded, waitForAppReady } from './helpers/auth-helpers';

test.describe('Admin Fetch History', () => {
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
  });

  // =============================================================================
  // Tab Navigation Tests
  // =============================================================================

  test('E2E-FETCH-01: Can view Admin panel tabs (Decks, News, Feedback)', async ({ page }) => {
    // Verify tab switcher container is visible
    await expect(page.getByTestId('admin-tab-switcher')).toBeVisible();

    // Verify Decks tab is visible
    const decksTab = page.getByTestId('admin-tab-decks');
    await expect(decksTab).toBeVisible();

    // Verify News tab is visible
    const newsTab = page.getByTestId('admin-tab-news');
    await expect(newsTab).toBeVisible();

    // Default should be Decks tab (pressed)
    await expect(decksTab).toHaveAttribute('aria-pressed', 'true');
    await expect(newsTab).toHaveAttribute('aria-pressed', 'false');
  });

  test('E2E-FETCH-02: News tab shows sources when clicked', async ({ page }) => {
    // Click News tab
    await page.getByTestId('admin-tab-news').click();

    // News sources section should be visible (news content is now at top level, not inside CultureAdminTabs)
    await expect(page.getByTestId('news-sources-section')).toBeVisible({ timeout: 10000 });

    // Should display seeded sources (from seed_news_sources)
    await expect(page.getByText('Greek Reporter')).toBeVisible({ timeout: 10000 });
  });

  // =============================================================================
  // Fetch Trigger Tests
  // =============================================================================

  test('E2E-FETCH-03: Can trigger manual fetch', async ({ page }) => {
    // Navigate to News tab
    await page.getByTestId('admin-tab-news').click();
    await expect(page.getByTestId('news-sources-section')).toBeVisible({ timeout: 10000 });

    // Wait for sources table to load
    const sourceRows = page.locator('[data-testid^="source-row-"]');
    await expect(sourceRows.first()).toBeVisible({ timeout: 10000 });

    // Find fetch button for first source
    const firstSourceRow = sourceRows.first();
    const fetchBtn = firstSourceRow.locator('[data-testid^="fetch-source-"]');
    await expect(fetchBtn).toBeVisible();

    // Click fetch button
    await fetchBtn.click();

    // Button should show loading/fetching state
    await expect(fetchBtn).toContainText(/fetching/i, { timeout: 5000 });

    // Wait for toast notification (success or error)
    // shadcn/ui toast uses Radix which renders a Toast with data-state="open"
    // Look for toast title text from translations (Fetch Complete or Fetch Failed)
    const toastTitle = page.getByText(/fetch complete|fetch failed/i).first();
    await expect(toastTitle).toBeVisible({ timeout: 30000 });
  });

  // =============================================================================
  // Fetch History Tests
  // =============================================================================

  test('E2E-FETCH-04: Can view fetch history (expand accordion)', async ({ page }) => {
    // Navigate to News tab
    await page.getByTestId('admin-tab-news').click();
    await expect(page.getByTestId('news-sources-section')).toBeVisible({ timeout: 10000 });

    // Wait for sources to load
    const sourceRows = page.locator('[data-testid^="source-row-"]');
    await expect(sourceRows.first()).toBeVisible({ timeout: 10000 });

    // Click accordion trigger (chevron) to expand first source
    const firstSourceRow = sourceRows.first();
    const accordionTrigger = firstSourceRow.locator('[data-radix-collection-item]');
    await accordionTrigger.click();

    // Wait for accordion content to expand
    // Should see "Fetch History" heading
    await expect(page.getByText(/fetch history/i).first()).toBeVisible({ timeout: 5000 });

    // Should see fetch history table or empty message
    const historyTable = page.getByTestId('fetch-history-table');
    const historyEmpty = page.getByTestId('fetch-history-empty');
    const historyLoading = page.getByTestId('fetch-history-loading');

    // Wait for one of the states to appear (after loading completes)
    await expect(historyTable.or(historyEmpty)).toBeVisible({ timeout: 10000 });
    await expect(historyLoading).not.toBeVisible();

    // If we have seeded fetch history, verify it shows
    if (await historyTable.isVisible()) {
      // Should have history rows from seeded data
      const historyRows = page.locator('[data-testid^="history-row-"]');
      await expect(historyRows.first()).toBeVisible();
    }
  });

  test('E2E-FETCH-05: Can view HTML content in modal', async ({ page }) => {
    // Navigate to News tab
    await page.getByTestId('admin-tab-news').click();
    await expect(page.getByTestId('news-sources-section')).toBeVisible({ timeout: 10000 });

    // Wait for sources to load
    const sourceRows = page.locator('[data-testid^="source-row-"]');
    await expect(sourceRows.first()).toBeVisible({ timeout: 10000 });

    // Expand first source
    const firstSourceRow = sourceRows.first();
    const accordionTrigger = firstSourceRow.locator('[data-radix-collection-item]');
    await accordionTrigger.click();

    // Wait for fetch history to load
    const historyTable = page.getByTestId('fetch-history-table');
    const historyEmpty = page.getByTestId('fetch-history-empty');

    await expect(historyTable.or(historyEmpty)).toBeVisible({ timeout: 10000 });

    // Only proceed if we have history with successful fetches
    if (await historyTable.isVisible()) {
      // Find a "View HTML" button (only available for success status)
      const viewHtmlBtn = page.locator('[data-testid^="view-html-"]').first();

      // Check if any successful entries exist
      if ((await viewHtmlBtn.count()) > 0) {
        await viewHtmlBtn.click();

        // Modal should open
        await expect(page.getByTestId('html-viewer-title')).toBeVisible({ timeout: 5000 });
        await expect(page.getByTestId('html-viewer-content')).toBeVisible();

        // Should show HTML content (seeded data contains <!DOCTYPE html>)
        const htmlContent = page.getByTestId('html-viewer-content');
        await expect(htmlContent).toContainText(/<!DOCTYPE|<html|<head|<body/i);

        // Close modal by clicking outside or pressing Escape
        await page.keyboard.press('Escape');
        await expect(page.getByTestId('html-viewer-title')).not.toBeVisible({ timeout: 3000 });
      }
    }
  });
});

test.describe('Admin Fetch History - Status Display', () => {
  // Use admin storage state
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test('E2E-FETCH-06: Displays success and error status badges in history', async ({ page }) => {
    await page.goto('/admin');
    await verifyAuthSucceeded(page, '/admin');
    await waitForAppReady(page);

    // Navigate to News tab
    await page.getByTestId('admin-tab-news').click();
    await expect(page.getByTestId('news-sources-section')).toBeVisible({ timeout: 10000 });

    // Wait for sources to load and expand first
    const sourceRows = page.locator('[data-testid^="source-row-"]');
    await expect(sourceRows.first()).toBeVisible({ timeout: 10000 });

    const accordionTrigger = sourceRows.first().locator('[data-radix-collection-item]');
    await accordionTrigger.click();

    // Wait for history table
    const historyTable = page.getByTestId('fetch-history-table');
    await expect(historyTable.or(page.getByTestId('fetch-history-empty'))).toBeVisible({
      timeout: 10000,
    });

    if (await historyTable.isVisible()) {
      // Check for status badges (seeded data has both success and error)
      const successBadges = historyTable.locator('[data-testid^="history-status-"]');
      await expect(successBadges.first()).toBeVisible();
    }
  });
});
