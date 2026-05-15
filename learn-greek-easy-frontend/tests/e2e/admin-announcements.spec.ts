/**
 * E2E Smoke Tests: Admin Announcements Drawer (ANND-10)
 *
 * Validates the ADMIN2-04 drawer-based announcements UI:
 * - Compose drawer opens via New button (URL ?compose=1)
 * - Live preview card updates with typed title + message
 * - Audience gating: non-"all" buttons are aria-disabled with comingSoon tooltip
 * - Cancel with clean form (no dirty guard) closes drawer + clears URL param
 * - Row click opens Details drawer with ?edit=<uuid> URL sync
 * - Inline 404 path: bad UUID renders Alert variant="destructive" with Close button, no Retry
 *
 * Auth: admin storageState (STORAGE_STATE.ADMIN from playwright.config).
 * Does NOT start a local server — runs against CI preview / production-like environment.
 *
 * V1 spec (tests/e2e/announcements.spec.ts) has been deleted — its modal-based selectors
 * (announcement-create-modal, announcement-preview-modal, preview-send-button,
 * view-detail-<id>, detail-*) no longer exist after the drawer rewrite.
 */

import { test, expect } from '@playwright/test';

import { STORAGE_STATE } from '../../playwright.config';

// ─── Auth ────────────────────────────────────────────────────────────────────

test.use({ storageState: STORAGE_STATE.ADMIN });

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getApiBaseUrl(): string {
  return process.env.E2E_API_URL || process.env.VITE_API_URL || 'http://localhost:8000';
}

async function seedAnnouncements(
  request: import('@playwright/test').APIRequestContext
): Promise<void> {
  const apiBaseUrl = getApiBaseUrl();
  const response = await request.post(`${apiBaseUrl}/api/v1/test/seed/announcements`);
  if (!response.ok()) {
    console.warn(`[ANND-10] Announcement seeding returned ${response.status()} — tests may use existing data`);
  }
}

// ─── Test suite ───────────────────────────────────────────────────────────────

// Run serially so seed / URL state doesn't cross-contaminate between cases.
test.describe.configure({ mode: 'serial' });

test.describe('Admin Announcements Drawer (ANND-10)', () => {
  // ── 1. Compose flow + live preview ─────────────────────────────────────────
  test('ANND-E2E-01: compose drawer opens, fills, and live-preview updates', async ({ page }) => {
    await page.goto('/admin?tab=announcements');

    // Wait for admin shell and tab content
    await expect(page.getByTestId('admin-page')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('announcements-tab')).toBeVisible({ timeout: 10_000 });

    // Click the New announcement button
    await page.getByTestId('announcements-new-button').click();

    // URL should now have compose=1
    await expect(page).toHaveURL(/compose=1/);

    // Compose drawer should be open
    const drawer = page.getByTestId('announcement-compose-drawer');
    await expect(drawer).toBeVisible({ timeout: 5_000 });

    // Fill title and message
    await drawer.getByLabel(/title/i).fill('E2E test title');
    await drawer.getByLabel(/message/i).fill('E2E test message body');

    // Ensure preview is visible — the toggle defaults to ON (showPreview=true in source)
    // If somehow hidden, click the preview toggle to show it
    const previewCard = page.getByTestId('announcement-preview-card');
    if (!(await previewCard.isVisible().catch(() => false))) {
      await drawer.getByTestId('announcement-compose-preview-toggle').click();
    }

    // Preview card should reflect the typed values
    await expect(page.getByTestId('announcement-preview-card-title')).toHaveText('E2E test title');
    await expect(page.getByTestId('announcement-preview-card-message')).toHaveText(
      'E2E test message body'
    );
  });

  // ── 2. Audience gating tooltip ─────────────────────────────────────────────
  test('ANND-E2E-02: non-"all" audience buttons are aria-disabled with comingSoon tooltip', async ({
    page,
  }) => {
    await page.goto('/admin?tab=announcements&compose=1');
    await expect(page.getByTestId('admin-page')).toBeVisible({ timeout: 15_000 });

    const drawer = page.getByTestId('announcement-compose-drawer');
    await expect(drawer).toBeVisible({ timeout: 5_000 });

    // Find a gated audience button — "Premium subscribers" is the first gated segment
    // The component renders aria-disabled="true" on the button element
    const premiumBtn = drawer
      .getByRole('button', { name: /premium/i })
      .or(drawer.locator('button[aria-disabled="true"]').first());

    await expect(premiumBtn.first()).toHaveAttribute('aria-disabled', 'true');

    // Hover to trigger the shadcn Tooltip
    await premiumBtn.first().hover();

    // TooltipContent renders in a portal with role="tooltip" — allow time for it to appear
    const tooltip = page.locator('[role="tooltip"]');
    await expect(tooltip).toBeVisible({ timeout: 3_000 });

    // Should display the comingSoon translation ("Coming soon" in English)
    await expect(tooltip).toContainText(/coming soon/i);
  });

  // ── 3. Cancel close — no dirty guard on clean form ─────────────────────────
  test('ANND-E2E-03: Cancel on clean form closes drawer without dirty-guard dialog', async ({
    page,
  }) => {
    await page.goto('/admin?tab=announcements&compose=1');
    await expect(page.getByTestId('admin-page')).toBeVisible({ timeout: 15_000 });

    const drawer = page.getByTestId('announcement-compose-drawer');
    await expect(drawer).toBeVisible({ timeout: 5_000 });

    // Do NOT type anything — form is clean (isDirty=false)

    // Click Cancel
    await page.getByTestId('announcement-compose-cancel-button').click();

    // The dirty-guard ConfirmDialog must NOT appear (form is clean)
    // ConfirmDialog uses shadcn Dialog which renders role="dialog"
    // We wait a tick then assert it is absent
    await page.waitForTimeout(300);
    await expect(page.locator('[role="dialog"]')).toHaveCount(0);

    // URL should no longer have compose=1
    await expect(page).not.toHaveURL(/compose=1/);
  });

  // ── 4. Row click → Details drawer ──────────────────────────────────────────
  test('ANND-E2E-04: row click opens Details drawer with ?edit=<uuid> URL sync', async ({
    page,
    request,
  }) => {
    // Seed so the history table has at least one row
    await seedAnnouncements(request);

    await page.goto('/admin?tab=announcements');
    await expect(page.getByTestId('admin-page')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('announcements-tab')).toBeVisible({ timeout: 10_000 });

    // Wait for at least one announcement row
    const firstRow = page.locator('[data-testid^="announcement-row-"]').first();
    await expect(firstRow).toBeVisible({ timeout: 10_000 });

    // Extract the UUID from the testid suffix
    const testId = await firstRow.getAttribute('data-testid');
    const announcementId = testId?.replace('announcement-row-', '') ?? '';
    expect(announcementId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );

    // Click the row (not the trash button — click the title column area)
    const titleCol = firstRow.locator('.an-title-col');
    await titleCol.click();

    // URL should now contain the edit param
    await expect(page).toHaveURL(new RegExp(`edit=${announcementId}`));

    // Details drawer should be visible
    await expect(page.getByTestId('announcement-details-drawer')).toBeVisible({ timeout: 5_000 });
  });

  // ── 5. Inline 404 path via bad UUID ────────────────────────────────────────
  test('ANND-E2E-05: ?edit=<zero-UUID> shows inline destructive Alert with Close, no Retry', async ({
    page,
  }) => {
    const zeroUUID = '00000000-0000-0000-0000-000000000000';
    await page.goto(`/admin?tab=announcements&edit=${zeroUUID}`);
    await expect(page.getByTestId('admin-page')).toBeVisible({ timeout: 15_000 });

    // Details drawer should open (announcementId is non-null)
    const detailsDrawer = page.getByTestId('announcement-details-drawer');
    await expect(detailsDrawer).toBeVisible({ timeout: 5_000 });

    // Wait for the fetch to complete and render the error state
    // The store sets `error` after the 404 API call resolves
    const alert = detailsDrawer.locator('[role="alert"]');
    await expect(alert).toBeVisible({ timeout: 10_000 });

    // The alert should be the destructive variant — check it contains some error text
    // (exact message comes from the API, just assert non-empty)
    await expect(alert).not.toBeEmpty();

    // Close button should be present inside the drawer footer
    const closeButton = page.getByTestId('announcement-details-close-button');
    await expect(closeButton).toBeVisible();

    // NO Retry button should exist
    await expect(page.getByRole('button', { name: /retry/i })).toHaveCount(0);

    // Click Close and assert drawer closes + ?edit= removed from URL
    await closeButton.click();

    await expect(page).not.toHaveURL(/edit=/);
    await expect(detailsDrawer).not.toBeVisible({ timeout: 3_000 });
  });
});
