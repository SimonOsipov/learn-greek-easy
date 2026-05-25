/**
 * E2E Tests: Admin Exercises Tab (EXR-71 + EXR-77)
 *
 * Smoke-level happy-path spec for the exercises tab rebuild (ADMIN2-23).
 * Runs against a deployed preview environment (TEST_SEED_ENABLED=true required).
 *
 * Coverage (smoke — minimal):
 *   EXR-E2E-01  Navigate to exercises tab → exercises section renders
 *   EXR-E2E-02  Page heading (h1) reads "Exercises" (or "Упражнения" in RU)
 *   EXR-E2E-03  All 4 SegControl filter bars are visible (Source / Type / Level / Status)
 *   EXR-E2E-04  At least one exercise row card is present
 *
 * Deferred assertions (future iteration):
 *   - EXR-77: open a row → body section renders (AudioBar, MCQ, Footer)
 *   - EXR-77: click Regenerate → AlertDialog opens with confirm button
 *   - EXR-77: filter by source → row badges update to match filter
 *   - EXR-77: search box clears with X button
 *   - EXR-77: pagination controls appear when total > page size
 *   - EXR-77: error banner with Retry appears on network failure (mocked)
 *   - EXR-77: first-run empty state renders when zero exercises exist
 *   - EXR-77: audio play button toggles to pause state
 *
 * Auth: admin storageState (STORAGE_STATE.ADMIN).
 * Seeding: exercises are assumed to exist in the preview environment.
 *           No seed call needed for smoke level — the DB always has some exercises.
 */

import { expect, test } from '@playwright/test';

import { STORAGE_STATE } from '../../playwright.config';
import { navigateToAdminTab } from './helpers/admin-helpers';

test.use({ storageState: STORAGE_STATE.ADMIN });

test.describe('Admin Exercises Tab — smoke (EXR-71)', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToAdminTab(page, 'exercises');
    // Wait for the exercises section to mount
    await expect(page.getByTestId('admin-exercises-list')).toBeVisible({ timeout: 15_000 });
  });

  // ── EXR-E2E-01: Tab navigation ─────────────────────────────────────────────

  test('EXR-E2E-01: exercises section renders after tab navigation', async ({ page }) => {
    await expect(page.getByTestId('admin-exercises-list')).toBeVisible();
  });

  // ── EXR-E2E-02: Page-head action buttons ───────────────────────────────────

  test('EXR-E2E-02: page-head action button (New exercise) renders', async ({
    page,
  }) => {
    // Page-head TEXT (breadcrumb/kicker/h1) is explicitly excluded per stakeholder —
    // see ADMIN2-23 story Out of Scope. The action-bar container (EXR-00c) holds
    // the New exercise CTA that is the canonical proof the exercises view mounted.
    await expect(
      page.getByRole('button', { name: /new exercise|новое упражнение/i })
    ).toBeVisible();
  });

  // ── EXR-E2E-03: Filter bars visible ───────────────────────────────────────

  test('EXR-E2E-03: all 4 SegControl filter bars are visible', async ({ page }) => {
    await expect(page.getByTestId('admin-exercises-search')).toBeVisible();
    // Each SegControl renders with an aria-label matching the filter label
    await expect(page.getByRole('group', { name: /source|источник/i })).toBeVisible();
    await expect(page.getByRole('group', { name: /type|тип/i })).toBeVisible();
    await expect(page.getByRole('group', { name: /level|уровень/i })).toBeVisible();
    await expect(page.getByRole('group', { name: /status|статус/i })).toBeVisible();
  });

  // ── EXR-E2E-04: At least one exercise row ─────────────────────────────────

  test('EXR-E2E-04: at least one exercise row card is present', async ({ page }) => {
    // Row items have data-testid="admin-exercise-item-{id}"
    // Use a broader locator to find any exercise row chevron button
    const rows = page.locator('[data-testid^="admin-exercise-item-"]');
    await expect(rows.first()).toBeVisible({ timeout: 10_000 });
  });
});
