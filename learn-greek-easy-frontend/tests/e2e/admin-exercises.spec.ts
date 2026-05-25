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

  test('EXR-E2E-03: all 5 SegControl filter bars are visible (incl. modality)', async ({ page }) => {
    await expect(page.getByTestId('admin-exercises-search')).toBeVisible();
    // Each SegControl renders with an aria-label matching the filter label
    await expect(page.getByRole('group', { name: /modality|модальность/i })).toBeVisible();
    await expect(page.getByRole('group', { name: /source|источник/i })).toBeVisible();
    await expect(page.getByRole('group', { name: /type|тип/i })).toBeVisible();
    await expect(page.getByRole('group', { name: /level|уровень/i })).toBeVisible();
    await expect(page.getByRole('group', { name: /status|статус/i })).toBeVisible();
  });

  // ── EXR-E2E-03b: Modality URL round-trip ──────────────────────────────────

  test('EXR-E2E-03b: toggle Reading → URL has modality=reading → reload keeps Reading active', async ({ page }) => {
    // Click the Reading button in the modality SegControl
    const modalityGroup = page.getByRole('group', { name: /modality|модальность/i });
    await modalityGroup.getByRole('button', { name: /reading|чтение/i }).click();

    // URL should now contain modality=reading
    await expect(page).toHaveURL(/modality=reading/);

    // Reload the page and verify the SegControl is still on Reading
    await page.reload();
    await expect(page.getByTestId('admin-exercises-list')).toBeVisible({ timeout: 15_000 });

    const readingButton = page
      .getByRole('group', { name: /modality|модальность/i })
      .getByRole('button', { name: /reading|чтение/i });
    await expect(readingButton).toHaveAttribute('aria-pressed', 'true');
  });

  // ── EXR-E2E-04: At least one exercise row ─────────────────────────────────

  test('EXR-E2E-04: at least one exercise row card is present', async ({ page }) => {
    // Row items have data-testid="admin-exercise-item-{id}"
    // Use a broader locator to find any exercise row chevron button
    const rows = page.locator('[data-testid^="admin-exercise-item-"]');
    await expect(rows.first()).toBeVisible({ timeout: 10_000 });
  });
});

// ── ADMIN2-24 polish — dedicated E2E coverage ─────────────────────────────────
//
// These three tests exercise the union of:
//   EXR2-24-01 (catalog-wide stats endpoint)
//   EXR2-24-05 (page-head CTA + drawer store)
//   EXR2-24-08 (modality URL round-trip)
//
// Auth: admin storageState (shared with the smoke suite above).
// Seeding: the preview environment is expected to have exercises already.

test.describe('ADMIN2-24 polish', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToAdminTab(page, 'exercises');
    await expect(page.getByTestId('admin-exercises-list')).toBeVisible({ timeout: 15_000 });
  });

  // ── EXR2-24-E2E-01: page-head CTA opens the SidePanel ────────────────────

  test('EXR2-24-E2E-01: page-head New exercise button opens the side panel', async ({
    page,
  }) => {
    // The PageHead actions slot renders exercise-new-button which triggers
    // the store's openCompose() → ExercisesView SidePanel becomes visible.
    await page.getByTestId('exercise-new-button').click();

    // The SidePanel renders an sr-only <Dialog.Title> with the i18n value
    // "New exercise" (exercises.actions.newExercise). It also renders a
    // visible .drawer-title span with the same text (ExercisesView.tsx:33).
    await expect(
      page.locator('.drawer-title', { hasText: /new exercise|новое упражнение/i })
    ).toBeVisible({ timeout: 5_000 });
  });

  // ── EXR2-24-E2E-02: catalog-wide stats survive pagination ─────────────────
  //
  // NOTE: This test requires at least 2 pages of exercises (> pageSize, typically 20).
  // If only 1 page exists the test is skipped with a diagnostic comment so CI
  // surfaces the skip rather than a spurious failure.

  test('EXR2-24-E2E-02: stats unchanged across pagination', async ({ page }) => {
    // Capture the stat card n-values from page 1.
    // StatCard renders its KPI number in .stat-n; the "Total exercises" card
    // is the first card (tone=blue), "Approved" is the second (tone=green).
    const statN = (tone: string) =>
      page.locator(`.stat-card.tone-${tone} .stat-n`).first();

    const totalText1 = await statN('blue').innerText();
    const approvedText1 = await statN('green').innerText();

    // Check whether the "Next ›" button is enabled — if not, there is only
    // one page and we cannot test pagination. Skip gracefully.
    const nextButton = page.getByTestId('admin-exercises-pagination').getByRole('button', {
      name: /next/i,
    });
    const isDisabled = await nextButton.getAttribute('aria-disabled');
    if (isDisabled === 'true') {
      // Less than a full second page of exercises — seeding required in CI.
      // eslint-disable-next-line no-console
      console.warn(
        '[EXR2-24-E2E-02] Skipped: fewer than one full page of exercises. ' +
          'Seed the preview DB with 20+ exercises to activate this assertion.'
      );
      test.skip();
      return;
    }

    // Navigate to page 2.
    await nextButton.click();
    // Assert the URL advanced to page=2 before checking stat invariance;
    // this ensures a no-op click (broken pagination) doesn't cause a false pass.
    await expect(page).toHaveURL(/[?&]page=2/, { timeout: 10_000 });
    // Wait for the list to re-render on page 2.
    await expect(page.getByTestId('admin-exercises-list')).toBeVisible({ timeout: 10_000 });

    // Stats must be identical — they are catalog-wide (not paged).
    const totalText2 = await statN('blue').innerText();
    const approvedText2 = await statN('green').innerText();

    expect(totalText2).toBe(totalText1);
    expect(approvedText2).toBe(approvedText1);
  });

  // ── EXR2-24-E2E-03: modality persists to URL and survives reload ──────────
  //
  // Equivalent coverage already exists in the smoke suite above as
  // "EXR-E2E-03b: toggle Reading → URL has modality=reading → reload keeps
  // Reading active". That test is the canonical URL round-trip assertion for
  // the modality SegControl. This entry is a named alias pointing to the same
  // behaviour so that EXR2-24-E2E-03 traceability is satisfied without
  // duplicating the assertion logic.
  //
  // If the smoke suite's EXR-E2E-03b test is removed or renamed, add the full
  // modality URL round-trip assertion here (see EXR-E2E-03b source above for
  // the implementation).
  test('EXR2-24-E2E-03: modality SegControl toggle persists in URL searchParams.modality and survives reload', async ({
    page,
  }) => {
    // Click the Reading button in the modality SegControl.
    const modalityGroup = page.getByRole('group', { name: /modality|модальность/i });
    await modalityGroup.getByRole('button', { name: /reading|чтение/i }).click();

    // URL must contain modality=reading.
    await expect(page).toHaveURL(/modality=reading/);

    // After reload the SegControl must still show Reading as selected.
    await page.reload();
    await expect(page.getByTestId('admin-exercises-list')).toBeVisible({ timeout: 15_000 });

    const readingButton = page
      .getByRole('group', { name: /modality|модальность/i })
      .getByRole('button', { name: /reading|чтение/i });
    await expect(readingButton).toHaveAttribute('aria-pressed', 'true');
  });
});
