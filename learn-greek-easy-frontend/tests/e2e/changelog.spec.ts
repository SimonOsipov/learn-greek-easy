/**
 * E2E Tests: Changelog Feature
 *
 * Tests the changelog/updates page and admin management functionality:
 *
 * User Flow:
 * - Navigation to changelog page
 * - Viewing changelog entries
 * - Pagination controls
 * - Language switching
 * - Empty state display
 *
 * Admin Flow:
 * - Access changelog tab in admin panel
 * - View table with entries
 * - Create new entries with multilingual content
 * - Edit existing entries
 * - Delete entries with confirmation
 * - Form validation
 *
 * Test data is seeded via the /api/v1/test/seed/changelog endpoint.
 * This creates 12 changelog entries with varied tags and dates.
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
 * Seed changelog entries for testing
 * Creates 12 entries with varied tags and dates
 */
async function seedChangelog(request: APIRequestContext): Promise<void> {
  const apiBaseUrl = getApiBaseUrl();
  const response = await request.post(`${apiBaseUrl}/api/v1/test/seed/changelog`);
  if (!response.ok()) {
    throw new Error(`Failed to seed changelog: ${response.status()}`);
  }
}

/**
 * Wait for changelog list to finish loading (user page)
 */
async function waitForChangelogLoaded(page: Page): Promise<void> {
  // Wait for loading skeleton to disappear
  await expect(page.getByTestId('changelog-loading')).toBeHidden({ timeout: 15000 });
  // Verify list is visible
  await expect(page.getByTestId('changelog-list')).toBeVisible({ timeout: 10000 });
}

/**
 * Wait for admin changelog table to load
 */
async function waitForAdminTableLoaded(page: Page): Promise<void> {
  // Wait for table to be visible
  await expect(page.getByTestId('changelog-table')).toBeVisible({ timeout: 15000 });
  // Wait for skeleton loading to disappear (check for at least one row)
  await expect(page.locator('[data-testid^="changelog-row-"]').first()).toBeVisible({
    timeout: 10000,
  });
}

/**
 * Navigate to admin changelog tab
 */
async function navigateToAdminChangelogTab(page: Page): Promise<void> {
  await page.goto('/admin');
  await verifyAuthSucceeded(page, '/admin');

  // Wait for admin page to load
  await expect(page.getByTestId('admin-title')).toBeVisible({ timeout: 15000 });

  // Click on Changelog tab
  const changelogTab = page.getByTestId('admin-tab-changelog');
  await changelogTab.click();

  // Wait for changelog tab content to load
  await expect(page.getByTestId('changelog-tab')).toBeVisible({ timeout: 10000 });
}

// =====================
// User Flow Tests
// =====================

test.describe('Changelog - User Flow', () => {
  // Use learner authentication
  test.use({ storageState: 'playwright/.auth/learner.json' });

  test.beforeEach(async ({ request }) => {
    // Seed changelog data before each test
    await seedChangelog(request);
  });

  test('CHANGELOG-E2E-01: Page loads with entries - displays 5 cards on page 1', async ({
    page,
  }) => {
    await page.goto('/changelog');
    await verifyAuthSucceeded(page, '/changelog');

    // Wait for page to load
    await expect(page.getByTestId('changelog-page')).toBeVisible({ timeout: 15000 });

    // Wait for changelog to load
    await waitForChangelogLoaded(page);

    // Verify we have 5 cards on page 1 (pageSize is 5)
    const cards = page.locator('[data-testid="changelog-list"] > div');
    await expect(cards).toHaveCount(5);

    // Verify cards have titles and dates
    const firstCard = page.getByTestId('changelog-card').first();
    await expect(firstCard).toBeVisible();
    await expect(firstCard.locator('time')).toBeVisible(); // Date
  });

  test('CHANGELOG-E2E-02: Pagination displays correctly', async ({ page }) => {
    await page.goto('/changelog');
    await verifyAuthSucceeded(page, '/changelog');

    await waitForChangelogLoaded(page);

    // Check the "Showing X-Y of Z" text format
    const showingText = page.getByTestId('changelog-pagination-showing');
    await expect(showingText).toBeVisible();
    // First page shows 1-5 (5 items per page)
    await expect(showingText).toContainText('1-5');

    // Verify format includes "of" and total count
    const text = await showingText.textContent();
    expect(text).toMatch(/1-5.*of.*12/);
  });

  test('CHANGELOG-E2E-03: Navigate to next page - click Next, verify page 2 content', async ({
    page,
  }) => {
    await page.goto('/changelog');
    await verifyAuthSucceeded(page, '/changelog');

    await waitForChangelogLoaded(page);

    // Click Next button (desktop view)
    const nextButton = page.getByTestId('changelog-pagination-next');
    await nextButton.click();

    // Wait for page 2 to load
    await waitForChangelogLoaded(page);

    // Verify page 2 shows items 6-10
    const showingText = page.getByTestId('changelog-pagination-showing');
    await expect(showingText).toContainText('6-10');

    // Verify page 2 button is active
    const page2Button = page.getByTestId('changelog-pagination-page-2');
    await expect(page2Button).toHaveAttribute('aria-current', 'page');

    // Verify Previous is now enabled
    const prevButton = page.getByTestId('changelog-pagination-prev');
    await expect(prevButton).toBeEnabled();
  });

  test('CHANGELOG-E2E-04: Navigate to last page - verify Next disabled', async ({ page }) => {
    await page.goto('/changelog');
    await verifyAuthSucceeded(page, '/changelog');

    await waitForChangelogLoaded(page);

    // With 12 items and 5 per page, last page is 3
    // Click page 3 button directly
    const page3Button = page.getByTestId('changelog-pagination-page-3');
    await page3Button.click();

    // Wait for page 3 to load
    await waitForChangelogLoaded(page);

    // Verify showing 11-12 of 12
    const showingText = page.getByTestId('changelog-pagination-showing');
    await expect(showingText).toContainText('11-12');

    // Verify Next button is disabled on last page
    const nextButton = page.getByTestId('changelog-pagination-next');
    await expect(nextButton).toBeDisabled();

    // Verify last page has 2 cards (12 items, 5+5+2)
    const cards = page.locator('[data-testid="changelog-list"] > div');
    await expect(cards).toHaveCount(2);
  });

  test('CHANGELOG-E2E-05: Navigate via Feedback dropdown menu', async ({ page }) => {
    // Go to dashboard first
    await page.goto('/dashboard');
    await verifyAuthSucceeded(page, '/dashboard');

    // Wait for page to be ready
    await expect(page.getByTestId('dashboard')).toBeVisible({ timeout: 15000 });

    // Click Feedback dropdown trigger (desktop nav)
    const feedbackDropdown = page.getByTestId('feedback-dropdown-trigger');
    await expect(feedbackDropdown).toBeVisible();
    await feedbackDropdown.click();

    // Click "New Features & Changes" option in dropdown
    const changelogOption = page.getByRole('menuitem', { name: /new features|changes/i });
    await expect(changelogOption).toBeVisible({ timeout: 5000 });
    await changelogOption.click();

    // Verify navigation to /changelog page
    await page.waitForURL('/changelog', { timeout: 10000 });
    await expect(page.getByTestId('changelog-page')).toBeVisible({ timeout: 10000 });
  });
});

// =====================
// Empty State Tests (User)
// =====================

test.describe('Changelog - Empty State', () => {
  test.use({ storageState: 'playwright/.auth/learner.json' });

  // Note: We don't seed data for this test to test empty state
  // In a real scenario, we would need a way to clear the changelog
  // For now, we skip this test or make it conditional

  test.skip('CHANGELOG-E2E-06: Shows empty state when no entries', async ({ page }) => {
    // This test requires clearing changelog data first
    // Skip for now as clearing endpoint doesn't exist
    await page.goto('/changelog');
    await verifyAuthSucceeded(page, '/changelog');

    // If empty, should show empty state message
    const emptyState = page.getByRole('status', { name: /no updates/i });
    await expect(emptyState).toBeVisible();
  });
});

// =====================
// Admin Flow Tests
// =====================

test.describe('Changelog - Admin Access', () => {
  // Use admin authentication
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test.beforeEach(async ({ request }) => {
    await seedChangelog(request);
  });

  test('CHANGELOG-E2E-07: Admin can access changelog tab', async ({ page }) => {
    await navigateToAdminChangelogTab(page);

    // Should show changelog management
    await expect(page.getByTestId('changelog-tab')).toBeVisible();
    await expect(page.getByTestId('changelog-add-button')).toBeVisible();
  });

  test('CHANGELOG-E2E-08: Admin can view changelog table', async ({ page }) => {
    await navigateToAdminChangelogTab(page);

    await waitForAdminTableLoaded(page);

    // Table should have entries (admin page shows 10 per page)
    const rows = page.locator('[data-testid^="changelog-row-"]');
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);
    expect(rowCount).toBeLessThanOrEqual(10);

    // Verify table structure
    await expect(page.locator('th:has-text("Title")')).toBeVisible();
    await expect(page.locator('th:has-text("Date")')).toBeVisible();
    await expect(page.locator('th:has-text("Tag")')).toBeVisible();
    await expect(page.locator('th:has-text("Actions")')).toBeVisible();
  });
});

// =====================
// Admin CRUD Tests
// =====================

test.describe('Changelog - Admin CRUD Operations', () => {
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test.beforeEach(async ({ request }) => {
    await seedChangelog(request);
  });

  test('CHANGELOG-E2E-09: Admin can create new changelog entry', async ({ page }) => {
    await navigateToAdminChangelogTab(page);

    // Click add new button
    await page.getByTestId('changelog-add-button').click();

    // Modal should open with "Create Changelog Entry" title
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Create Changelog Entry')).toBeVisible();

    // Fill English tab (default)
    await page.getByTestId('changelog-title-input-en').fill('E2E Test Entry');
    await page.getByTestId('changelog-content-input-en').fill('This is a test entry created by E2E tests.');

    // Switch to Greek tab and fill
    await page.getByTestId('changelog-lang-tab-el').click();
    await page.getByTestId('changelog-title-input-el').fill('E2E Test Entry (Greek)');
    await page.getByTestId('changelog-content-input-el').fill('Content in Greek for testing.');

    // Switch to Russian tab and fill
    await page.getByTestId('changelog-lang-tab-ru').click();
    await page.getByTestId('changelog-title-input-ru').fill('E2E Test Entry (Russian)');
    await page.getByTestId('changelog-content-input-ru').fill('Content in Russian for testing.');

    // Select tag (already defaults to new_feature)
    await page.getByTestId('changelog-tag-select').click();
    await page.getByRole('option', { name: /bug fix/i }).click();

    // Save
    await page.getByTestId('changelog-form-submit').click();

    // Wait for modal to close
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10000 });

    // Toast should appear
    const toast = page.locator('[data-state="open"]').filter({ hasText: /created/i });
    await expect(toast).toBeVisible({ timeout: 5000 });

    // Entry should appear in table
    await expect(page.locator('td:has-text("E2E Test Entry")')).toBeVisible({ timeout: 5000 });
  });

  test('CHANGELOG-E2E-10: Admin can edit changelog entry', async ({ page }) => {
    await navigateToAdminChangelogTab(page);

    await waitForAdminTableLoaded(page);

    // Click edit on first entry
    const firstEditButton = page.locator('[data-testid^="edit-changelog-"]').first();
    await firstEditButton.click();

    // Modal should show edit title
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Edit Changelog Entry')).toBeVisible();

    // Modify title
    const titleInput = page.getByTestId('changelog-title-input-en');
    await titleInput.clear();
    await titleInput.fill('Modified E2E Title');

    // Save
    await page.getByTestId('changelog-form-submit').click();

    // Wait for modal to close
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10000 });

    // Toast should appear
    const toast = page.locator('[data-state="open"]').filter({ hasText: /updated/i });
    await expect(toast).toBeVisible({ timeout: 5000 });

    // Modified title should appear in table
    await expect(page.locator('td:has-text("Modified E2E Title")')).toBeVisible({ timeout: 5000 });
  });

  test('CHANGELOG-E2E-11: Admin can delete changelog entry', async ({ page }) => {
    await navigateToAdminChangelogTab(page);

    await waitForAdminTableLoaded(page);

    // Get first entry title for verification
    const firstRow = page.locator('[data-testid^="changelog-row-"]').first();
    const firstTitle = await firstRow.locator('td').first().textContent();

    // Click delete on first entry
    const firstDeleteButton = page.locator('[data-testid^="delete-changelog-"]').first();
    await firstDeleteButton.click();

    // Confirmation dialog should appear
    await expect(page.getByTestId('changelog-delete-dialog')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(firstTitle || '')).toBeVisible();

    // Confirm delete
    await page.getByTestId('changelog-delete-confirm').click();

    // Wait for dialog to close
    await expect(page.getByTestId('changelog-delete-dialog')).toBeHidden({ timeout: 10000 });

    // Toast should appear
    const toast = page.locator('[data-state="open"]').filter({ hasText: /deleted/i });
    await expect(toast).toBeVisible({ timeout: 5000 });
  });
});

// =====================
// Admin Validation Tests
// =====================

test.describe('Changelog - Admin Form Validation', () => {
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test('CHANGELOG-E2E-12: Validation prevents empty form submission', async ({ page }) => {
    await navigateToAdminChangelogTab(page);

    // Click add new button
    await page.getByTestId('changelog-add-button').click();

    // Modal should open
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

    // Try to save without filling fields
    await page.getByTestId('changelog-form-submit').click();

    // Validation errors should appear (Title is required)
    await expect(page.getByText('Title is required')).toBeVisible();
  });

  test('CHANGELOG-E2E-13: Admin can cancel form without saving', async ({ page, request }) => {
    await seedChangelog(request);
    await navigateToAdminChangelogTab(page);

    // Click add new button
    await page.getByTestId('changelog-add-button').click();

    // Modal should open
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

    // Fill some data
    await page.getByTestId('changelog-title-input-en').fill('Entry to cancel');

    // Click cancel
    await page.getByTestId('changelog-form-cancel').click();

    // Modal should close
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 5000 });

    // Entry should NOT appear in table
    await expect(page.locator('td:has-text("Entry to cancel")')).not.toBeVisible();
  });

  test('CHANGELOG-E2E-14: Admin can cancel delete without deleting', async ({ page, request }) => {
    await seedChangelog(request);
    await navigateToAdminChangelogTab(page);

    await waitForAdminTableLoaded(page);

    // Get row count before
    const rowCountBefore = await page.locator('[data-testid^="changelog-row-"]').count();

    // Click delete on first entry
    const firstDeleteButton = page.locator('[data-testid^="delete-changelog-"]').first();
    await firstDeleteButton.click();

    // Confirmation dialog should appear
    await expect(page.getByTestId('changelog-delete-dialog')).toBeVisible({ timeout: 5000 });

    // Click cancel
    await page.getByTestId('changelog-delete-cancel').click();

    // Dialog should close
    await expect(page.getByTestId('changelog-delete-dialog')).toBeHidden({ timeout: 5000 });

    // Row count should be unchanged
    const rowCountAfter = await page.locator('[data-testid^="changelog-row-"]').count();
    expect(rowCountAfter).toBe(rowCountBefore);
  });
});

// =====================
// Mobile Tests
// =====================

test.describe('Changelog - Mobile Tests', () => {
  test.use({ storageState: 'playwright/.auth/learner.json' });

  test.beforeEach(async ({ request }) => {
    await seedChangelog(request);
  });

  test('CHANGELOG-E2E-15: Mobile pagination shows simplified controls', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/changelog');
    await verifyAuthSucceeded(page, '/changelog');

    await waitForChangelogLoaded(page);

    // Mobile pagination controls should be visible
    const prevMobile = page.getByTestId('changelog-pagination-prev-mobile');
    const nextMobile = page.getByTestId('changelog-pagination-next-mobile');
    await expect(prevMobile).toBeVisible();
    await expect(nextMobile).toBeVisible();

    // Desktop page numbers should be hidden on mobile
    const page2Button = page.getByTestId('changelog-pagination-page-2');
    await expect(page2Button).toBeHidden();

    // Verify Previous mobile is disabled on page 1
    await expect(prevMobile).toBeDisabled();

    // Verify Next mobile is enabled
    await expect(nextMobile).toBeEnabled();

    // Click Next mobile button
    await nextMobile.click();

    // Wait for page 2 to load
    await waitForChangelogLoaded(page);

    // Verify Previous mobile is now enabled
    await expect(prevMobile).toBeEnabled();
  });
});
