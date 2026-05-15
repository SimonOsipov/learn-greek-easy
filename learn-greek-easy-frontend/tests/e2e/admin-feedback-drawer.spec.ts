/**
 * E2E Tests: Admin Feedback Drawer (FBDR-11)
 *
 * Covers the golden path of the FeedbackDrawer introduced in ADMIN2-05:
 *   1. Navigate to /admin?tab=feedback
 *   2. Open drawer from a feedback card's Reply button
 *   3. Switch between Reply / Thread / Meta inner tabs (URL syncs to ?inner=)
 *   4. Type a response with live char counter
 *   5. Click a canned-reply chip (overwrites textarea)
 *   6. Save & notify — drawer closes, success toast appears, list refetches
 *
 * Also tests the malformed deep-link case: ?inner=meta without ?edit must
 * NOT open the drawer and must not log console errors.
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

    // AC #2 — click the Respond button on the first card → drawer opens
    await firstCard.getByTestId('admin-feedback-respond-button').click();

    const drawer = page.getByTestId('feedback-drawer');
    await expect(drawer).toBeVisible({ timeout: 5_000 });

    // URL should reflect the open drawer with edit + inner=reply
    await expect(page).toHaveURL(/[?&]edit=[0-9a-f-]+/);
    await expect(page).toHaveURL(/[?&]inner=reply/);

    // AC #3 — switch to Thread tab; URL updates
    await drawer.getByTestId('feedback-drawer-tab-thread').click();
    await expect(page).toHaveURL(/[?&]inner=thread/);

    // Switch to Meta tab; URL updates
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

    // AC #5 — click the "Thanks — noted" canned reply chip → textarea overwritten
    await drawer.getByRole('button', { name: /thanks.*noted/i }).click();
    await expect(textarea).toHaveValue(/Thanks for the report!/);
    // Ensure the manually typed text was replaced, not appended
    await expect(textarea).not.toHaveValue(/Testing the response\./);

    // AC #6 — click Save & notify → drawer closes + toast appears
    await drawer.getByRole('button', { name: /save & notify/i }).click();

    // Drawer should close
    await expect(drawer).toBeHidden({ timeout: 8_000 });

    // Success toast: shadcn/radix toaster uses role="status" (or li with role toast)
    // "Reply saved" is the toast title in ReplyTab.handleSave
    const toast = page.locator('[role="status"]').filter({ hasText: /reply saved/i });
    await expect(toast).toBeVisible({ timeout: 5_000 });

    // AC #7 — list refetches; the saved card should now show the admin response quote
    // The blockquote renders when admin_response is non-empty (data-testid="admin-feedback-response")
    await expect(firstCard.getByTestId('admin-feedback-response')).toBeVisible({ timeout: 8_000 });
  });

  // ── Test 2: Malformed deep-link ──────────────────────────────────────────────

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
