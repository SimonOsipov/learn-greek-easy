/**
 * E2E Tests: Admin News Sources Management
 *
 * Tests the admin panel news sources feature including:
 * - Section display with seeded data
 * - CRUD operations (Create, Read, Update, Delete)
 * - Form validation
 * - Pagination and refresh
 *
 * Uses Playwright's storageState pattern for admin authentication.
 */

import { test, expect } from '@playwright/test';
import { verifyAuthSucceeded, waitForAppReady } from './helpers/auth-helpers';

test.describe('Admin News Sources', () => {
  // Use admin storage state (superuser)
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/admin');

    // Fail fast with clear error if auth failed
    await verifyAuthSucceeded(page, '/admin');

    // Wait for app to be ready
    await waitForAppReady(page);

    // Wait for culture tabs to load
    await expect(page.getByTestId('culture-admin-tabs')).toBeVisible({ timeout: 15000 });

    // Click on the News tab to show news sources section
    await page.getByTestId('culture-tab-news').click();

    // Wait for news sources section to load
    await expect(page.getByTestId('news-sources-section')).toBeVisible({ timeout: 15000 });
  });

  // =============================================================================
  // Section Display Tests
  // =============================================================================

  test('E2E-SOURCES-01: News sources section displays correctly', async ({ page }) => {
    // Verify section title is visible
    await expect(page.getByTestId('sources-section-title')).toBeVisible();
    await expect(page.getByTestId('sources-section-title')).toHaveText('News Sources');

    // Verify section description
    await expect(page.getByTestId('sources-section-description')).toBeVisible();

    // Verify add button is visible
    await expect(page.getByTestId('sources-add-btn')).toBeVisible();

    // Verify refresh button is visible
    await expect(page.getByTestId('sources-refresh-btn')).toBeVisible();
  });

  test('E2E-SOURCES-02: Displays seeded news sources in list', async ({ page }) => {
    // Wait for source rows to be visible (Accordion items)
    const sourceRows = page.locator('[data-testid^="source-row-"]');
    await expect(sourceRows.first()).toBeVisible({ timeout: 10000 });

    // Verify seeded sources appear (from seed_news_sources)
    await expect(page.getByText('Greek Reporter')).toBeVisible();
    await expect(page.getByText('Kathimerini English')).toBeVisible();

    // Verify inactive source is displayed
    await expect(page.getByText('Inactive Test Source')).toBeVisible();
  });

  test('E2E-SOURCES-03: Displays active and inactive status badges', async ({ page }) => {
    // Wait for source rows to be visible
    const sourceRows = page.locator('[data-testid^="source-row-"]');
    await expect(sourceRows.first()).toBeVisible({ timeout: 10000 });

    // Should have Active badges
    const activeBadges = page.getByText('Active', { exact: true });
    await expect(activeBadges.first()).toBeVisible();

    // Should have at least one Inactive badge (from seeded data)
    const inactiveBadge = page.getByText('Inactive', { exact: true });
    await expect(inactiveBadge).toBeVisible();
  });

  // =============================================================================
  // Create Source Tests
  // =============================================================================

  test('E2E-SOURCES-04: Add source dialog opens and closes', async ({ page }) => {
    // Click add button
    await page.getByTestId('sources-add-btn').click();

    // Verify dialog opened
    const dialog = page.getByTestId('source-form-dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Verify form elements
    await expect(page.getByTestId('source-name-input')).toBeVisible();
    await expect(page.getByTestId('source-url-input')).toBeVisible();
    await expect(page.getByTestId('source-active-switch')).toBeVisible();
    await expect(page.getByTestId('source-form-submit')).toBeVisible();
    await expect(page.getByTestId('source-form-cancel')).toBeVisible();

    // Click cancel to close
    await page.getByTestId('source-form-cancel').click();

    // Verify dialog closed
    await expect(dialog).not.toBeVisible({ timeout: 3000 });
  });

  test('E2E-SOURCES-05: Can add a new source successfully', async ({ page }) => {
    const uniqueName = `Test Source ${Date.now()}`;
    const uniqueUrl = `https://test-source-${Date.now()}.example.com`;

    // Click add button
    await page.getByTestId('sources-add-btn').click();
    await expect(page.getByTestId('source-form-dialog')).toBeVisible();

    // Fill form
    await page.getByTestId('source-name-input').fill(uniqueName);
    await page.getByTestId('source-url-input').fill(uniqueUrl);

    // Submit
    await page.getByTestId('source-form-submit').click();

    // Verify dialog closes
    await expect(page.getByTestId('source-form-dialog')).not.toBeVisible({ timeout: 10000 });

    // Verify source appears in table
    await expect(page.getByText(uniqueName)).toBeVisible({ timeout: 10000 });
  });

  // =============================================================================
  // Validation Tests
  // =============================================================================

  test('E2E-SOURCES-06: Shows validation error for empty name', async ({ page }) => {
    await page.getByTestId('sources-add-btn').click();
    await expect(page.getByTestId('source-form-dialog')).toBeVisible();

    // Fill only URL, leave name empty
    await page.getByTestId('source-url-input').fill('https://example.com');

    // Try to submit
    await page.getByTestId('source-form-submit').click();

    // Verify validation error - form should still be visible
    await expect(page.getByTestId('source-form-dialog')).toBeVisible();
    await expect(page.getByText(/name is required/i)).toBeVisible();
  });

  test('E2E-SOURCES-07: Shows validation error for invalid URL', async ({ page }) => {
    await page.getByTestId('sources-add-btn').click();
    await expect(page.getByTestId('source-form-dialog')).toBeVisible();

    // Fill name and invalid URL
    await page.getByTestId('source-name-input').fill('Test Source');
    await page.getByTestId('source-url-input').fill('not-a-valid-url');

    // Try to submit
    await page.getByTestId('source-form-submit').click();

    // Verify validation error
    await expect(page.getByTestId('source-form-dialog')).toBeVisible();
    await expect(page.getByText(/please enter a valid url/i)).toBeVisible();
  });

  test('E2E-SOURCES-08: Shows error for duplicate URL', async ({ page }) => {
    // Wait for add button to be ready and click
    const addBtn = page.getByTestId('sources-add-btn');
    await expect(addBtn).toBeEnabled();
    await addBtn.click();

    // Wait for dialog with increased timeout for WebKit
    const dialog = page.getByTestId('source-form-dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // Try to add existing URL (from seeded data)
    const nameInput = page.getByTestId('source-name-input');
    const urlInput = page.getByTestId('source-url-input');
    await expect(nameInput).toBeVisible();
    await nameInput.fill('Duplicate Test');
    await urlInput.fill('https://greekreporter.com');

    // Submit and wait for API response
    await page.getByTestId('source-form-submit').click();

    // Verify duplicate error message appears (form stays open with error)
    await expect(page.getByText(/already registered/i)).toBeVisible({ timeout: 15000 });

    // Dialog should still be visible (not closed on error)
    await expect(dialog).toBeVisible();
  });

  // =============================================================================
  // Edit Source Tests
  // =============================================================================

  test('E2E-SOURCES-09: Can edit an existing source', async ({ page }) => {
    // Wait for table
    const sourceRows = page.locator('[data-testid^="source-row-"]');
    await expect(sourceRows.first()).toBeVisible({ timeout: 10000 });

    // Find and click edit button for first source
    const firstRow = page.locator('[data-testid^="source-row-"]').first();
    await firstRow.locator('[data-testid^="edit-source-"]').click();

    // Verify dialog opens
    await expect(page.getByTestId('source-form-dialog')).toBeVisible();

    // Verify form is pre-filled (name field should have value)
    const nameInput = page.getByTestId('source-name-input');
    await expect(nameInput).not.toHaveValue('');

    // Update name with unique suffix
    const currentName = await nameInput.inputValue();
    await nameInput.clear();
    await nameInput.fill(`${currentName} Updated`);

    // Submit
    await page.getByTestId('source-form-submit').click();

    // Verify dialog closes
    await expect(page.getByTestId('source-form-dialog')).not.toBeVisible({ timeout: 10000 });

    // Verify updated name appears
    await expect(page.getByText(`${currentName} Updated`)).toBeVisible({ timeout: 10000 });
  });

  test('E2E-SOURCES-10: Can toggle source active status', async ({ page }) => {
    const sourceRows = page.locator('[data-testid^="source-row-"]');
    await expect(sourceRows.first()).toBeVisible({ timeout: 10000 });

    // Find and click edit button for first source
    const firstRow = page.locator('[data-testid^="source-row-"]').first();
    await firstRow.locator('[data-testid^="edit-source-"]').click();

    // Verify dialog opens
    await expect(page.getByTestId('source-form-dialog')).toBeVisible();

    // Toggle active switch
    const activeSwitch = page.getByTestId('source-active-switch');
    await activeSwitch.click();

    // Submit
    await page.getByTestId('source-form-submit').click();

    // Verify dialog closes
    await expect(page.getByTestId('source-form-dialog')).not.toBeVisible({ timeout: 10000 });

    // Page should reload and still function
    await expect(page.locator('[data-testid^="source-row-"]').first()).toBeVisible();
  });

  // =============================================================================
  // Delete Source Tests
  // =============================================================================

  test('E2E-SOURCES-11: Can delete a source', async ({ page }) => {
    const sourceRows = page.locator('[data-testid^="source-row-"]');
    await expect(sourceRows.first()).toBeVisible({ timeout: 10000 });

    // Get initial source count
    const sourcesBefore = await page.locator('[data-testid^="source-row-"]').count();

    // Find and click delete button for inactive test source (safe to delete)
    const inactiveRow = page.locator('[data-testid^="source-row-"]').filter({
      hasText: 'Inactive Test Source',
    });
    await inactiveRow.locator('[data-testid^="delete-source-"]').click();

    // Verify confirmation dialog shows the source name
    const deleteDialog = page.getByTestId('source-delete-dialog');
    await expect(deleteDialog).toBeVisible();
    await expect(deleteDialog.getByText('Inactive Test Source')).toBeVisible();

    // Confirm deletion
    await page.getByTestId('source-delete-confirm').click();

    // Verify dialog closes
    await expect(deleteDialog).not.toBeVisible({ timeout: 10000 });

    // Verify source count decreased
    await expect(page.locator('[data-testid^="source-row-"]')).toHaveCount(sourcesBefore - 1, {
      timeout: 10000,
    });
  });

  test('E2E-SOURCES-12: Can cancel delete operation', async ({ page }) => {
    const sourceRows = page.locator('[data-testid^="source-row-"]');
    await expect(sourceRows.first()).toBeVisible({ timeout: 10000 });

    // Get initial source count
    const sourcesBefore = await page.locator('[data-testid^="source-row-"]').count();

    // Open delete dialog for first source
    const firstRow = page.locator('[data-testid^="source-row-"]').first();
    await firstRow.locator('[data-testid^="delete-source-"]').click();

    // Verify dialog opened
    await expect(page.getByTestId('source-delete-dialog')).toBeVisible();

    // Cancel deletion
    await page.getByTestId('source-delete-cancel').click();

    // Verify dialog closed
    await expect(page.getByTestId('source-delete-dialog')).not.toBeVisible({ timeout: 3000 });

    // Verify source count unchanged
    await expect(page.locator('[data-testid^="source-row-"]')).toHaveCount(sourcesBefore);
  });

  // =============================================================================
  // UI Interaction Tests
  // =============================================================================

  test('E2E-SOURCES-13: Refresh button reloads data', async ({ page }) => {
    const sourceRows = page.locator('[data-testid^="source-row-"]');
    await expect(sourceRows.first()).toBeVisible({ timeout: 10000 });

    // Click refresh
    await page.getByTestId('sources-refresh-btn').click();

    // Button should show loading state (spinning icon)
    // Data should still be visible after refresh
    await expect(table).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('sources-section-title')).toBeVisible();
  });

  test('E2E-SOURCES-14: Pagination controls visible when data exists', async ({ page }) => {
    const sourcesSection = page.getByTestId('news-sources-section');
    await expect(sourcesSection).toBeVisible({ timeout: 10000 });

    const sourceRows = sourcesSection.locator('[data-testid^="source-row-"]');
    await expect(sourceRows.first()).toBeVisible({ timeout: 10000 });

    // Pagination showing text should be visible (scoped to sources section)
    const paginationText = sourcesSection.getByText(/showing \d+-\d+ of \d+/i);
    await expect(paginationText).toBeVisible();

    // Previous button should exist (may be disabled on first page)
    await expect(page.getByTestId('sources-pagination-prev')).toBeVisible();

    // Next button should exist
    await expect(page.getByTestId('sources-pagination-next')).toBeVisible();
  });
});

test.describe('Admin News Sources - Empty State', () => {
  // Use admin storage state
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test('E2E-SOURCES-15: Shows empty state when no sources exist', async ({ page }) => {
    // Navigate to admin page
    await page.goto('/admin');
    await verifyAuthSucceeded(page, '/admin');
    await waitForAppReady(page);

    // Wait for culture tabs to load
    await expect(page.getByTestId('culture-admin-tabs')).toBeVisible({ timeout: 15000 });

    // Click on the News tab to show news sources section
    await page.getByTestId('culture-tab-news').click();

    // Wait for sources section to load
    await expect(page.getByTestId('news-sources-section')).toBeVisible({ timeout: 15000 });

    // Check what state we're in
    const sourceRows = page.locator('[data-testid^="source-row-"]');
    const emptyState = page.getByTestId('sources-empty-state');

    // Wait for either source rows or empty state to appear
    await expect(sourceRows.first().or(emptyState)).toBeVisible({ timeout: 10000 });

    // If we got source rows with data (seeded), delete all sources to reach empty state
    const hasSources = await sourceRows.first().isVisible();
    if (hasSources) {
      // Delete sources one by one until we reach empty state
      while (await page.locator('[data-testid^="source-row-"]').count() > 0) {
        // Click delete on first source
        const firstRow = page.locator('[data-testid^="source-row-"]').first();
        await firstRow.locator('[data-testid^="delete-source-"]').click();

        // Confirm deletion
        await expect(page.getByTestId('source-delete-dialog')).toBeVisible();
        await page.getByTestId('source-delete-confirm').click();

        // Wait for dialog to close
        await expect(page.getByTestId('source-delete-dialog')).not.toBeVisible({ timeout: 5000 });

        // Small wait for table to update
        await page.waitForTimeout(500);
      }
    }

    // Now we should see empty state
    await expect(page.getByTestId('sources-empty-state')).toBeVisible({ timeout: 10000 });
  });
});
