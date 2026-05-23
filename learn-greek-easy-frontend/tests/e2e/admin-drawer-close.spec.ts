/**
 * E2E Tests: Admin Drawer Close-X regression (P0)
 *
 * Verifies that the custom close X (button.drawer-close, aria-label "Close")
 * is present and closes each admin SidePanel drawer. Parametrized across
 * the drawers that can be opened without special seeded data.
 *
 * Covered drawers:
 *   - feedback   → FeedbackDrawer (requires seeded feedback card)
 *   - changelog  → ChangelogEditorDrawer (compose mode, no seed needed)
 *   - announcements → AnnouncementComposeDrawer (compose mode, no seed needed)
 *
 * Decks and Situations drawers require a seeded row to open — those are
 * tested via skip with explanatory comments.
 *
 * Auth: admin storageState (e2e_admin@test.com via auth.setup.ts).
 * Does NOT start a local server — runs against CI preview environment.
 */

import { expect, test } from '@playwright/test';

import { STORAGE_STATE } from '../../playwright.config';
import { navigateToAdminTab } from './helpers/admin-helpers';
import { verifyAuthSucceeded } from './helpers/auth-helpers';

test.use({ storageState: STORAGE_STATE.ADMIN });

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Assert that [data-side-panel] is hidden (not attached or not visible). */
async function assertDrawerClosed(page: import('@playwright/test').Page) {
  // The SidePanel unmounts its portal when open=false, so the element
  // either disappears from the DOM or has data-state="closed".
  const panel = page.locator('[data-side-panel]');
  await expect(panel).toBeHidden({ timeout: 5_000 });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Admin Drawer Close-X regression', () => {
  // ── Changelog compose drawer (no seed required) ──────────────────────────

  test('changelog compose drawer: close X hides the panel', async ({ page }) => {
    await navigateToAdminTab(page, 'changelog');
    await verifyAuthSucceeded(page, '/admin?tab=changelog');
    await expect(page.getByTestId('changelog-tab')).toBeVisible({ timeout: 15_000 });

    // Open the compose drawer via "New entry" button
    await page.getByRole('button', { name: /new entry/i }).click();
    const drawer = page.getByTestId('changelog-editor-drawer');
    await expect(drawer).toBeVisible({ timeout: 5_000 });

    // The CloseButton has aria-label="Close" and class "drawer-close"
    const closeBtn = drawer.getByRole('button', { name: 'Close' });
    await expect(closeBtn).toBeVisible();

    await closeBtn.click();

    await assertDrawerClosed(page);
  });

  // ── Announcements compose drawer (no seed required) ──────────────────────

  test('announcements compose drawer: close X hides the panel', async ({ page }) => {
    await navigateToAdminTab(page, 'announcements');
    await verifyAuthSucceeded(page, '/admin?tab=announcements');
    await expect(page.getByTestId('admin-page')).toBeVisible({ timeout: 15_000 });

    // Open the compose drawer — look for a "New" / "Compose" / "+" button
    await page.getByRole('button', { name: /new announcement|compose/i }).click();
    const drawer = page.getByTestId('announcement-compose-drawer');
    await expect(drawer).toBeVisible({ timeout: 5_000 });

    const closeBtn = drawer.getByRole('button', { name: 'Close' });
    await expect(closeBtn).toBeVisible();

    await closeBtn.click();

    await assertDrawerClosed(page);
  });

  // ── Feedback drawer (requires seeded feedback card) ───────────────────────

  test('feedback drawer: close X hides the panel', async ({ page }) => {
    await navigateToAdminTab(page, 'feedback');
    await verifyAuthSucceeded(page, '/admin?tab=feedback');
    await expect(page.getByTestId('admin-page')).toBeVisible({ timeout: 15_000 });

    const firstCard = page.locator('[data-testid="admin-feedback-card"]').first();
    const hasCard = await firstCard.isVisible({ timeout: 8_000 }).catch(() => false);

    if (!hasCard) {
      test.skip();
      return;
    }

    await firstCard.getByTestId('admin-feedback-respond-button').click();
    const drawer = page.getByTestId('feedback-drawer');
    await expect(drawer).toBeVisible({ timeout: 5_000 });

    const closeBtn = drawer.getByRole('button', { name: 'Close' });
    await expect(closeBtn).toBeVisible();

    await closeBtn.click();

    await assertDrawerClosed(page);
  });

  // ── Decks drawer (skipped — requires seeded deck row) ────────────────────

  test.skip('decks drawer: close X hides the panel — requires seeded data', async () => {
    // To enable: seed a deck, click its row to open the DeckDrawer,
    // then assert button.drawer-close closes [data-side-panel].
  });

  // ── Situations drawer (skipped — requires seeded situation row) ───────────

  test.skip('situations drawer: close X hides the panel — requires seeded data', async () => {
    // To enable: seed a situation, click its row to open the SituationDrawer,
    // then assert button.drawer-close closes [data-side-panel].
  });
});
