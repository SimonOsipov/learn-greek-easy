/**
 * Admin News Sources - Visual Regression Tests
 *
 * Visual regression tests for the news sources admin feature.
 * Uses Chromatic for visual snapshots and comparison.
 *
 * These tests capture:
 * - News sources section (table view)
 * - Add source dialog (empty)
 * - Edit source dialog (with data)
 * - Delete confirmation dialog
 * - Empty state
 * - Validation error state
 */

import { test, expect } from '@chromatic-com/playwright';
import {
  takeSnapshot,
  loginForVisualTest,
  waitForPageReady,
} from './helpers/visual-helpers';

test.describe('Admin News Sources - Visual Tests', () => {
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

    // Navigate to admin page
    await page.goto('/admin');
    await waitForPageReady(page);

    // Scroll to news sources section
    const sourcesSection = page.getByTestId('news-sources-section');
    await sourcesSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500); // Allow animations to settle
  });

  test('News Sources Section - Table View', async ({ page }, testInfo) => {
    // Wait for sources section to load
    await expect(page.getByTestId('news-sources-section')).toBeVisible();

    // Take snapshot of the sources section
    const sourcesSection = page.getByTestId('news-sources-section');
    await expect(sourcesSection).toBeVisible();

    await takeSnapshot(page, 'News Sources Section', testInfo);
  });

  test('Add Source Dialog - Empty', async ({ page }, testInfo) => {
    // Open add source dialog
    await page.getByTestId('sources-add-btn').click();

    // Wait for dialog to be visible
    await expect(page.getByTestId('source-form-dialog')).toBeVisible();
    await page.waitForTimeout(300); // Allow dialog animation

    await takeSnapshot(page, 'Add Source Dialog', testInfo);
  });

  test('Add Source Dialog - Filled Form', async ({ page }, testInfo) => {
    // Open add source dialog
    await page.getByTestId('sources-add-btn').click();
    await expect(page.getByTestId('source-form-dialog')).toBeVisible();

    // Fill in the form
    await page.getByTestId('source-name-input').fill('Example News Source');
    await page.getByTestId('source-url-input').fill('https://example-news.com');

    await page.waitForTimeout(300);
    await takeSnapshot(page, 'Add Source Dialog - Filled', testInfo);
  });

  test('Add Source Dialog - Validation Errors', async ({ page }, testInfo) => {
    // Open add source dialog
    await page.getByTestId('sources-add-btn').click();
    await expect(page.getByTestId('source-form-dialog')).toBeVisible();

    // Enter invalid URL to trigger validation
    await page.getByTestId('source-url-input').fill('not-a-valid-url');

    // Submit to trigger all validation errors
    await page.getByTestId('source-form-submit').click();

    await page.waitForTimeout(300);
    await takeSnapshot(page, 'Add Source Dialog - Validation Errors', testInfo);
  });

  test('Edit Source Dialog - With Data', async ({ page }, testInfo) => {
    // Wait for table to load
    await expect(page.getByTestId('sources-table').or(page.getByTestId('sources-empty-state'))).toBeVisible({
      timeout: 10000,
    });

    // Check if table has data
    const hasTable = await page.getByTestId('sources-table').isVisible();
    if (!hasTable) {
      // Skip if no data - this visual test requires seeded data
      test.skip();
      return;
    }

    // Click edit on first source
    const firstRow = page.locator('[data-testid^="source-row-"]').first();
    await firstRow.locator('[data-testid^="edit-source-"]').click();

    // Wait for dialog to be visible with pre-filled data
    await expect(page.getByTestId('source-form-dialog')).toBeVisible();
    await page.waitForTimeout(300);

    await takeSnapshot(page, 'Edit Source Dialog - With Data', testInfo);
  });

  test('Delete Source Dialog', async ({ page }, testInfo) => {
    // Wait for table to load
    await expect(page.getByTestId('sources-table').or(page.getByTestId('sources-empty-state'))).toBeVisible({
      timeout: 10000,
    });

    // Check if table has data
    const hasTable = await page.getByTestId('sources-table').isVisible();
    if (!hasTable) {
      // Skip if no data - this visual test requires seeded data
      test.skip();
      return;
    }

    // Click delete on first source
    const firstRow = page.locator('[data-testid^="source-row-"]').first();
    await firstRow.locator('[data-testid^="delete-source-"]').click();

    // Wait for delete confirmation dialog
    await expect(page.getByTestId('source-delete-dialog')).toBeVisible();
    await page.waitForTimeout(300);

    await takeSnapshot(page, 'Delete Source Dialog', testInfo);
  });

  test('News Sources - Empty State', async ({ page }, testInfo) => {
    // For this test, we mock an empty state by navigating before data loads
    // Or we can check if empty state is naturally visible

    // First, try to see if empty state is visible (depends on data)
    const emptyState = page.getByTestId('sources-empty-state');
    const table = page.getByTestId('sources-table');

    // Wait for either state
    await expect(emptyState.or(table)).toBeVisible({ timeout: 10000 });

    // If we got the table, we can't capture empty state naturally
    const hasEmptyState = await emptyState.isVisible();

    if (hasEmptyState) {
      await takeSnapshot(page, 'News Sources - Empty State', testInfo);
    } else {
      // Skip - empty state requires no seeded data
      test.skip();
    }
  });

  test('News Sources - Loading State', async ({ page }, testInfo) => {
    // Navigate fresh to capture loading state
    await page.goto('/admin');

    // Try to capture loading skeleton before data loads
    const loadingState = page.getByTestId('sources-loading');

    // Loading state is transient, may not be visible
    try {
      await expect(loadingState).toBeVisible({ timeout: 2000 });
      await takeSnapshot(page, 'News Sources - Loading State', testInfo);
    } catch {
      // Loading was too fast to capture - skip this test
      test.skip();
    }
  });
});

test.describe('Admin News Sources - Responsive Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginForVisualTest(page);

    await page.evaluate(() => {
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        const authState = JSON.parse(authStorage);
        authState.state.user.role = 'admin';
        localStorage.setItem('auth-storage', JSON.stringify(authState));
      }
    });

    await page.goto('/admin');
    await waitForPageReady(page);
  });

  test('News Sources Section - Mobile View', async ({ page }, testInfo) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);

    // Scroll to sources section
    const sourcesSection = page.getByTestId('news-sources-section');
    await sourcesSection.scrollIntoViewIfNeeded();

    await takeSnapshot(page, 'News Sources Section - Mobile', testInfo);
  });

  test('News Sources Section - Tablet View', async ({ page }, testInfo) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500);

    // Scroll to sources section
    const sourcesSection = page.getByTestId('news-sources-section');
    await sourcesSection.scrollIntoViewIfNeeded();

    await takeSnapshot(page, 'News Sources Section - Tablet', testInfo);
  });
});
