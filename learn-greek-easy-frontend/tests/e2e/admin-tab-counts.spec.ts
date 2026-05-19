/**
 * E2E Regression: Admin Tab Badge Counts (ATBC-10)
 *
 * Regression test for the false-zero badge bug reported in ADMIN2-18:
 * On a fresh load of /admin?tab=changelog, sibling tab badges (Announcements,
 * Feedback, Card errors, Changelog) displayed 0 even when rows existed in the
 * database. The bug was caused by reading counts from per-tab paginated stores
 * that were not loaded yet. The fix: a single /admin/tab-counts aggregate
 * endpoint called once on mount.
 *
 * This spec:
 * 1. Seeds ≥1 row for: announcements, changelog, feedback, card errors.
 * 2. Navigates to /admin?tab=changelog (the exact repro URL).
 * 3. Asserts that the badge on each seeded tab reads ≥ 1 WITHOUT clicking
 *    any other tab — proving the false-zero bug is gone.
 *
 * Badge DOM selector: `.va-tab-n` (the count span inside each .va-tab button,
 * as defined in section-tabs.tsx line 36). No data-testid exists on the badge
 * element — using the class selector is consistent with section-tabs.test.tsx.
 *
 * Auth: admin storageState (STORAGE_STATE.ADMIN from playwright.config).
 * Seed: uses /api/v1/test/seed/* endpoints (TEST_SEED_ENABLED required).
 *       Seed failures warn rather than fail — the test uses whatever data exists.
 */

import { test, expect } from '@playwright/test';

import { STORAGE_STATE } from '../../playwright.config';

test.use({ storageState: STORAGE_STATE.ADMIN });

// ---------------------------------------------------------------------------
// Helper: resolve the API base URL from env vars (mirrors admin-announcements.spec.ts)
// ---------------------------------------------------------------------------

function getApiBaseUrl(): string {
  return process.env.E2E_API_URL || process.env.VITE_API_URL || 'http://localhost:8000';
}

async function trySeed(
  request: import('@playwright/test').APIRequestContext,
  path: string,
  label: string
): Promise<void> {
  const apiBaseUrl = getApiBaseUrl();
  const response = await request.post(`${apiBaseUrl}/api/v1/test/seed/${path}`);
  if (!response.ok()) {
    console.warn(`[ATBC-10] Seed "${label}" returned ${response.status()} — test uses existing data`);
  }
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe('Admin tab badge counts — regression for false-zero bug (ATBC-10)', () => {
  test(
    'renders correct sibling tab counts on first load of /admin?tab=changelog',
    async ({ page, request }) => {
      // ── 1. Seed ≥1 row for each tab we assert on ─────────────────────────
      // Announcements requires test users (run /seed/all or /seed/users first in CI).
      // Feedback and card-error also require e2e_learner@test.com to exist.
      // Warn on failure rather than hard-fail, so CI with partial seed still runs.
      await trySeed(request, 'announcements', 'announcements');
      await trySeed(request, 'changelog', 'changelog');
      await trySeed(request, 'feedback', 'feedback');
      await trySeed(request, 'card-error', 'card-error');

      // ── 2. Navigate to the repro URL (changelog tab, NOT the default tab) ──
      await page.goto('/admin?tab=changelog');

      // Wait for the admin shell to render.
      await expect(page.getByTestId('admin-page')).toBeVisible({ timeout: 15_000 });

      // Wait for the tablist to be visible — SectionTabs renders immediately.
      const tablist = page.locator('[role="tablist"]');
      await expect(tablist).toBeVisible({ timeout: 10_000 });

      // Wait for the /admin/tab-counts fetch to complete by polling until
      // the changelog badge (which we seeded) is > 0.  This avoids asserting
      // before the Zustand fetchCounts resolves.
      const changelogTab = tablist.locator('[role="tab"]').filter({ hasText: 'Changelog' });
      await expect(changelogTab.locator('.va-tab-n')).not.toHaveText('0', { timeout: 15_000 });

      // ── 3. Assert badge counts for all seeded tabs — NO tab clicks ─────────
      // Regression: before the fix these all showed "0" on first render.

      const announcementsTab = tablist
        .locator('[role="tab"]')
        .filter({ hasText: 'Announcements' });
      const feedbackTab = tablist.locator('[role="tab"]').filter({ hasText: 'Feedback' });
      // The errors tab label is "Card errors" (en/admin.json key errors).
      const errorsTab = tablist.locator('[role="tab"]').filter({ hasText: 'Card errors' });

      const changelogBadge = changelogTab.locator('.va-tab-n');
      const announcementsBadge = announcementsTab.locator('.va-tab-n');
      const feedbackBadge = feedbackTab.locator('.va-tab-n');
      const errorsBadge = errorsTab.locator('.va-tab-n');

      // Each badge text must parse to a positive integer (≥ 1).
      for (const [label, badge] of [
        ['Changelog', changelogBadge],
        ['Announcements', announcementsBadge],
        ['Feedback', feedbackBadge],
        ['Card errors', errorsBadge],
      ] as const) {
        const text = await badge.textContent();
        const n = parseInt(text ?? '0', 10);
        expect(n, `${label} badge should be ≥ 1 but got ${n}`).toBeGreaterThanOrEqual(1);
      }
    }
  );
});
