/**
 * E2E Tests: Admin Feedback Drawer (FBDR-11)
 *
 * Covers the golden path of the FeedbackDrawer introduced in ADMIN2-05:
 *   1. Navigate to /admin?tab=feedback
 *   2. Open drawer by clicking a feedback card
 *   3. Switch between Reply / Meta inner tabs (URL syncs to ?inner=)
 *   4. Type a response with live char counter
 *   5. Save & notify — drawer closes, success toast appears, list refetches
 *
 * Also tests:
 *   - Malformed deep-link: ?inner=meta without ?edit must NOT open the drawer.
 *   - Close-X reverts ?edit URL param (B2).
 *   - Half-screen drawer width assertion (B3).
 *
 * Auth: admin storageState (e2e_admin@test.com via auth.setup.ts).
 * Seeding: feedback rows created by /seed/all step 7 on the dev preview.
 * Does NOT start a local server — runs against CI preview environment.
 */

import { expect, test } from '@playwright/test';

import { STORAGE_STATE } from '../../playwright.config';
import { verifyAuthSucceeded } from './helpers/auth-helpers';
import { navigateToAdminTab } from './helpers/admin-helpers';

test.use({ storageState: STORAGE_STATE.ADMIN });

test.describe('Admin Feedback Drawer (FBDR-11)', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToAdminTab(page, 'feedback');
    await verifyAuthSucceeded(page, '/admin?tab=feedback');
    // Wait for the feedback list to load (cards or empty state)
    await expect(page.getByTestId('admin-page')).toBeVisible({ timeout: 15_000 });
  });

  // ── Test 1: Golden path ──────────────────────────────────────────────────────

  test('golden path: open drawer, switch tabs, type + canned chip + save', async ({ page }) => {
    // AC #1 — 3 stat cards visible (stat-grid exists with content)
    const statGrid = page.locator('.stat-grid');
    await expect(statGrid).toBeVisible({ timeout: 10_000 });

    // Wait for at least one feedback card to be loaded (seeded data required)
    const firstCard = page.locator('[data-testid="admin-feedback-card"]').first();
    await expect(firstCard).toBeVisible({ timeout: 10_000 });

    // AC #2 — click the card → drawer opens
    await firstCard.click();

    const drawer = page.getByTestId('feedback-drawer');
    await expect(drawer).toBeVisible({ timeout: 5_000 });

    // URL should reflect the open drawer with edit + inner=reply
    await expect(page).toHaveURL(/[?&]edit=[0-9a-f-]+/);
    await expect(page).toHaveURL(/[?&]inner=reply/);

    // AC #3 — switch to Meta tab; URL updates
    await drawer.getByTestId('feedback-drawer-tab-meta').click();
    await expect(page).toHaveURL(/[?&]inner=meta/);

    // Switch back to Reply tab; URL updates
    await drawer.getByTestId('feedback-drawer-tab-reply').click();
    await expect(page).toHaveURL(/[?&]inner=reply/);

    // AC #4 — type in textarea, char counter increments
    const textarea = drawer.getByTestId('feedback-drawer-textarea');
    await expect(textarea).toBeVisible();
    await textarea.fill('Testing the response.');
    const counter = drawer.getByTestId('feedback-drawer-char-counter');
    await expect(counter).toContainText('21/500');

    // AC #5 — click Save & notify → drawer closes + toast appears
    await drawer.getByRole('button', { name: /save & notify/i }).click();

    // Drawer should close
    await expect(drawer).toBeHidden({ timeout: 8_000 });

    // Success toast: "Reply saved" is the toast title in ReplyTab.handleSave.
    // Use the visible ToastTitle's data-testid (renders immediately) rather than
    // Radix's internal ToastAnnounce [role="status"] element which is rendered
    // via a useEffect ref-callback cycle and can lag on webkit.
    const toastTitle = page.getByTestId('toast-title').filter({ hasText: /reply saved/i });
    await expect(toastTitle).toBeVisible({ timeout: 5_000 });

    // AC #7 — list refetches; the saved card should now show the admin response quote
    // The blockquote renders when admin_response is non-empty (data-testid="admin-feedback-response")
    await expect(firstCard.getByTestId('admin-feedback-response')).toBeVisible({ timeout: 8_000 });
  });

  // ── Test 2: Close-X reverts ?edit URL param (B2) ────────────────────────────

  test('B2: close-X clears ?edit param from URL', async ({ page }) => {
    const firstCard = page.locator('[data-testid="admin-feedback-card"]').first();
    await expect(firstCard).toBeVisible({ timeout: 10_000 });

    // Open the drawer
    await firstCard.click();
    const drawer = page.getByTestId('feedback-drawer');
    await expect(drawer).toBeVisible({ timeout: 5_000 });

    // URL should contain ?edit=<id>
    await expect(page).toHaveURL(/[?&]edit=[0-9a-f-]+/);

    // Click the close X button
    const closeBtn = drawer.getByRole('button', { name: 'Close' });
    await closeBtn.click();

    // Drawer should close
    await expect(drawer).toBeHidden({ timeout: 5_000 });

    // URL should no longer contain edit=
    await expect(page).not.toHaveURL(/[?&]edit=/);
  });

  // ── Test 3: Half-screen drawer width guard (B3) ──────────────────────────────

  test('B3: feedback drawer width is within drawer-size-half clamp (560–720px)', async ({
    page,
  }) => {
    // Set viewport to 1440×900
    await page.setViewportSize({ width: 1440, height: 900 });

    const firstCard = page.locator('[data-testid="admin-feedback-card"]').first();
    await expect(firstCard).toBeVisible({ timeout: 10_000 });

    await firstCard.click();
    const drawer = page.getByTestId('feedback-drawer');
    await expect(drawer).toBeVisible({ timeout: 5_000 });

    // [data-side-panel] is the DialogPrimitive.Content element that holds the panel
    const panel = page.locator('[data-side-panel]');
    const box = await panel.boundingBox();
    expect(box, 'Panel bounding box should exist').not.toBeNull();

    // drawer-size-half: width = 50vw, min-width 560px, max-width 720px
    // At 1440px viewport: 50vw = 720px → clamped to 720px.
    // Upper bound allows +2px tolerance for Firefox subpixel rendering /
    // scrollbar-width inclusion in getBoundingClientRect (cross-browser difference).
    expect(box!.width).toBeGreaterThanOrEqual(560);
    expect(box!.width).toBeLessThanOrEqual(722);
  });

  // ── Test 4: Malformed deep-link ──────────────────────────────────────────────

  test('malformed deep-link: ?inner=meta without ?edit keeps drawer closed', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // Navigate directly to the malformed URL (?inner=meta but no ?edit)
    await page.goto('/admin?tab=feedback&inner=meta');
    await verifyAuthSucceeded(page, '/admin?tab=feedback');

    // Wait for admin page to render
    await expect(page.getByTestId('admin-page')).toBeVisible({ timeout: 15_000 });

    // AC #8 — drawer must NOT open (store silently ignores ?inner without ?edit)
    await expect(page.getByTestId('feedback-drawer')).toBeHidden();

    // No app-level console errors (filter known noisy third-party noise)
    const appErrors = consoleErrors.filter(
      (e) =>
        !e.includes('posthog') &&
        !e.includes('PostHog') &&
        !e.includes('Failed to load resource') &&
        !e.includes('ERR_BLOCKED_BY_CLIENT') &&
        !e.includes('Failed to preconnect') &&
        !e.includes('sentry.io') &&
        !e.includes('ingest.us.sentry.io')
    );
    expect(appErrors).toEqual([]);
  });
});
