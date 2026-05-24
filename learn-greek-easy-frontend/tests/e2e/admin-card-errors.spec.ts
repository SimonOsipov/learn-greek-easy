/**
 * E2E Tests: Admin Card Errors (CER-57)
 *
 * Full admin flow for the card error reports feature introduced in ADMIN2-22.
 *
 * Coverage:
 *   CER-E2E-01  Navigate to Errors tab → section title visible
 *   CER-E2E-02  Card row renders with type badge, status badge, description peek
 *   CER-E2E-03  Click row → CardErrorDrawer opens (data-testid="card-error-drawer")
 *   CER-E2E-04  Drawer header: breadcrumb + H2 "Error report"
 *   CER-E2E-05  Review tab default: status grid + admin notes textarea
 *   CER-E2E-06  Switch tabs: The card + Meta
 *   CER-E2E-07  Status change → Save → drawer closes + success toast
 *   CER-E2E-08  Delete flow: delete button → confirm dialog → confirm → drawer closes
 *   CER-E2E-09  CULTURE card row: type badge shows culture label
 *   CER-E2E-10  FIXED row: resolved banner visible in review tab
 *
 * Auth: admin storageState (STORAGE_STATE.ADMIN).
 * Seeding: POST /api/v1/test/seed/card-errors via seedAdminCardErrorsBatch helper.
 *          Requires TEST_SEED_ENABLED=true on the deployed preview backend.
 */

import { expect, test } from '@playwright/test';

import { STORAGE_STATE } from '../../playwright.config';
import { seedAdminCardErrorsBatch, navigateToAdminTab } from './helpers/admin-helpers';

test.use({ storageState: STORAGE_STATE.ADMIN });

// Run serially so seed IDs are stable across tests.
test.describe.configure({ mode: 'serial' });

test.describe('Admin Card Errors (CER-57)', () => {
  let reportIds: string[] = [];

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: STORAGE_STATE.ADMIN });
    const page = await ctx.newPage();
    await page.goto('/admin');
    const result = await seedAdminCardErrorsBatch(page);
    reportIds = result.ids;
    await ctx.close();
  });

  test.beforeEach(async ({ page }) => {
    await navigateToAdminTab(page, 'errors');
    // Wait for the errors section to appear
    await expect(page.getByTestId('admin-card-error-section')).toBeVisible({ timeout: 15_000 });
  });

  // ── CER-E2E-01: Tab navigation ──────────────────────────────────────────────

  test('CER-E2E-01: Errors tab renders section with title', async ({ page }) => {
    await expect(page.getByTestId('admin-card-error-title')).toBeVisible();
  });

  // ── CER-E2E-02: Card row anatomy ───────────────────────────────────────────

  test('CER-E2E-02: WORD-PENDING row renders type badge, status badge, description', async ({
    page,
  }) => {
    // First seeded row is WORD-PENDING
    const cards = page.locator('[data-testid="admin-card-error-card"]');
    await expect(cards.first()).toBeVisible({ timeout: 10_000 });

    const firstCard = cards.first();
    // Type badge exists
    await expect(firstCard.locator('[data-testid="card-error-type-badge"]')).toBeVisible();
    // Status badge exists
    await expect(firstCard.locator('[data-testid="card-error-status-badge"]')).toBeVisible();
    // Description peek exists
    await expect(firstCard.locator('[data-testid="card-error-description"]')).toBeVisible();
  });

  // ── CER-E2E-03: Drawer opens on row click ──────────────────────────────────

  test('CER-E2E-03: clicking a card row opens the CardErrorDrawer', async ({ page }) => {
    const firstCard = page.locator('[data-testid="admin-card-error-card"]').first();
    await expect(firstCard).toBeVisible({ timeout: 10_000 });
    await firstCard.click();

    const drawer = page.getByTestId('card-error-drawer');
    await expect(drawer).toBeVisible({ timeout: 5_000 });
  });

  // ── CER-E2E-04: Drawer header chrome ───────────────────────────────────────

  test('CER-E2E-04: drawer header shows breadcrumb and H2 "Error report"', async ({ page }) => {
    const firstCard = page.locator('[data-testid="admin-card-error-card"]').first();
    await expect(firstCard).toBeVisible({ timeout: 10_000 });
    await firstCard.click();

    const drawer = page.getByTestId('card-error-drawer');
    await expect(drawer).toBeVisible({ timeout: 5_000 });

    // Breadcrumb is present (contains a short ID fragment)
    const breadcrumb = page.locator('.drawer-bcrumb');
    await expect(breadcrumb).toBeVisible();

    // H2 title
    await expect(page.locator('h2.drawer-h')).toContainText(/error report/i);
  });

  // ── CER-E2E-05: Review tab defaults ────────────────────────────────────────

  test('CER-E2E-05: Review tab is default; status grid and notes textarea are visible', async ({
    page,
  }) => {
    const firstCard = page.locator('[data-testid="admin-card-error-card"]').first();
    await expect(firstCard).toBeVisible({ timeout: 10_000 });
    await firstCard.click();

    const drawer = page.getByTestId('card-error-drawer');
    await expect(drawer).toBeVisible({ timeout: 5_000 });

    // Review tab panel
    await expect(page.getByTestId('drawer-tab-review')).toBeVisible();

    // Status grid visible inside the review panel
    await expect(page.locator('.admin-status-grid')).toBeVisible();

    // Admin notes textarea
    await expect(page.getByTestId('admin-notes-textarea')).toBeVisible();
  });

  // ── CER-E2E-06: Tab switching ──────────────────────────────────────────────

  test('CER-E2E-06: can switch to The card tab and Meta tab', async ({ page }) => {
    const firstCard = page.locator('[data-testid="admin-card-error-card"]').first();
    await expect(firstCard).toBeVisible({ timeout: 10_000 });
    await firstCard.click();

    const drawer = page.getByTestId('card-error-drawer');
    await expect(drawer).toBeVisible({ timeout: 5_000 });

    // Switch to "The card" tab
    await page.getByTestId('card-error-drawer-tab-theCard').click();
    await expect(page.getByTestId('drawer-tab-theCard')).toBeVisible();

    // Switch to "Meta" tab
    await page.getByTestId('card-error-drawer-tab-meta').click();
    await expect(page.getByTestId('drawer-tab-meta')).toBeVisible();

    // Switch back to Review
    await page.getByTestId('card-error-drawer-tab-review').click();
    await expect(page.getByTestId('drawer-tab-review')).toBeVisible();
  });

  // ── CER-E2E-07: Save flow ──────────────────────────────────────────────────

  test('CER-E2E-07: changing status and saving closes drawer with success toast', async ({
    page,
  }) => {
    // Open a PENDING report (first row)
    const firstCard = page.locator('[data-testid="admin-card-error-card"]').first();
    await expect(firstCard).toBeVisible({ timeout: 10_000 });
    await firstCard.click();

    const drawer = page.getByTestId('card-error-drawer');
    await expect(drawer).toBeVisible({ timeout: 5_000 });

    // Select REVIEWED status in the grid
    const reviewedBtn = page.locator('.admin-status-grid button', { hasText: /reviewed/i });
    await expect(reviewedBtn).toBeVisible({ timeout: 5_000 });
    await reviewedBtn.click();

    // Click Save
    await page.getByTestId('save-button').click();

    // Drawer closes
    await expect(drawer).toBeHidden({ timeout: 8_000 });

    // Toast with success message appears
    const toast = page.locator('[role="status"], [data-state="open"][role="alert"]').first();
    await expect(toast).toBeVisible({ timeout: 5_000 });
  });

  // ── CER-E2E-08: Delete flow ────────────────────────────────────────────────

  test('CER-E2E-08: delete button → confirm dialog → confirm → drawer closes', async ({ page }) => {
    // Open the last seeded row (WORD-DISMISSED — safe to delete in tests)
    const cards = page.locator('[data-testid="admin-card-error-card"]');
    await expect(cards.first()).toBeVisible({ timeout: 10_000 });

    // Click the last card (WORD-DISMISSED is 4th seeded)
    const lastCard = cards.last();
    await lastCard.click();

    const drawer = page.getByTestId('card-error-drawer');
    await expect(drawer).toBeVisible({ timeout: 5_000 });

    // Click the delete (trash) button
    await page.getByTestId('delete-button').click();

    // Confirmation dialog appears
    const confirmBtn = page.getByTestId('delete-confirm-button');
    await expect(confirmBtn).toBeVisible({ timeout: 5_000 });

    // Confirm the deletion
    await confirmBtn.click();

    // Drawer closes after delete
    await expect(drawer).toBeHidden({ timeout: 8_000 });
  });

  // ── CER-E2E-09: CULTURE card row ──────────────────────────────────────────

  test('CER-E2E-09: CULTURE-PENDING row shows a type badge (globe icon area)', async ({ page }) => {
    // Second seeded row is CULTURE-PENDING
    const cards = page.locator('[data-testid="admin-card-error-card"]');
    await expect(cards.first()).toBeVisible({ timeout: 10_000 });

    // There should be at least 2 cards after seeding
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(2);

    // The CULTURE card type badge should exist on the second card
    const secondCard = cards.nth(1);
    await expect(secondCard.locator('[data-testid="card-error-type-badge"]')).toBeVisible();
  });

  // ── CER-E2E-10: Resolved banner ───────────────────────────────────────────

  test('CER-E2E-10: FIXED row shows resolved banner when drawer opens', async ({ page }) => {
    // Third seeded row is WORD-FIXED (has resolved_at set)
    const cards = page.locator('[data-testid="admin-card-error-card"]');
    await expect(cards.first()).toBeVisible({ timeout: 10_000 });

    const count = await cards.count();
    // Need at least 3 rows
    expect(count).toBeGreaterThanOrEqual(3);

    const fixedCard = cards.nth(2);
    await fixedCard.click();

    const drawer = page.getByTestId('card-error-drawer');
    await expect(drawer).toBeVisible({ timeout: 5_000 });

    // Resolved banner should be visible (CER-33)
    await expect(page.getByTestId('resolved-banner')).toBeVisible({ timeout: 5_000 });
  });
});
