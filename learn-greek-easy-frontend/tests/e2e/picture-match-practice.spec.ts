/**
 * E2E Test: Picture-Match Practice Session (SIT-26)
 *
 * Covers:
 *   - Navigate to the exercise practice session page
 *   - Identify a picture-match card (Type A: select_picture_from_description
 *     or Type B: select_description_from_picture)
 *   - Click an option, assert feedback styling appears
 *   - Assert auto-advance fires (next card renders or session completes)
 *   - Complete session, assert results / session-complete view
 *
 * NOTE: The current seed infrastructure (/api/v1/test/seed/all) creates
 * situations and exercises of the classic select_correct_answer type, but
 * does NOT yet seed picture-match exercises (select_picture_from_description /
 * select_description_from_picture) into the SM-2 queue. Until the seeder is
 * extended, the picture-match-specific sub-tests are skipped.
 *
 * TODO: Extend /api/v1/test/seed/all (or add /api/v1/test/seed/picture-match)
 * to create situations with approved PMATCH exercises + seed them into the
 * learner's SM-2 queue. Once done, remove the skip and wire up the assertions.
 *
 * Pre-authenticated as: e2e_learner@test.com (storageState: learner.json)
 */

import { test, expect, type Page } from '@playwright/test';

const PRACTICE_SESSION_URL = '/practice/exercises/session';

// ──────────────────────────────────────────────
// Helper: navigate to the exercise practice page and wait for a card
// ──────────────────────────────────────────────
async function navigateToExerciseSession(page: Page) {
  await page.goto(PRACTICE_SESSION_URL);
  await page.waitForLoadState('domcontentloaded');
}

test.describe('SIT-26 picture-match practice', () => {
  /**
   * SKIPPED — seeder does not yet produce picture-match queue items.
   *
   * To enable: extend seed_all() or add a dedicated picture-match seed endpoint
   * that creates situations with:
   *   - status=GENERATED picture
   *   - status=AUDIO_READY description
   *   - APPROVED exercises of both PMATCH types
   * and seeds them into the learner's exercise SM-2 queue (new or due).
   */
  test.skip(
    true,
    'TODO: seed infrastructure does not yet queue picture-match exercises — see comment above'
  );

  test('PMATCH-E2E-01: Type A (select_picture_from_description) — answer + advance', async ({ page }) => {
    await navigateToExerciseSession(page);

    // Wait for a picture-from-description card to render
    const spfdRenderer = page.getByTestId('spfd-renderer');
    await expect(spfdRenderer).toBeVisible({ timeout: 15000 });

    // Click the first option
    const firstOption = page.getByTestId('spfd-option-0');
    await expect(firstOption).toBeEnabled();
    await firstOption.click();

    // Feedback: all options disabled, a correct/incorrect border appears
    await expect(firstOption).toBeDisabled({ timeout: 2000 });

    // Auto-advance fires after ~1200ms; next card or session summary renders
    await page.waitForTimeout(1500);
    const nextCardOrSummary =
      spfdRenderer.or(
        page.getByTestId('sdfp-renderer').or(
          page.getByTestId('sca-renderer').or(
            page.locator('[data-testid="session-summary"]')
          )
        )
      );
    await expect(nextCardOrSummary.first()).toBeVisible({ timeout: 5000 });
  });

  test('PMATCH-E2E-02: Type B (select_description_from_picture) — answer + advance', async ({ page }) => {
    await navigateToExerciseSession(page);

    // Wait for a description-from-picture card to render
    const sdfpRenderer = page.getByTestId('sdfp-renderer');
    await expect(sdfpRenderer).toBeVisible({ timeout: 15000 });

    // Click the first option
    const firstOption = page.getByTestId('sdfp-option-0');
    await expect(firstOption).toBeEnabled();
    await firstOption.click();

    // Feedback: options disabled
    await expect(firstOption).toBeDisabled({ timeout: 2000 });

    // Auto-advance
    await page.waitForTimeout(1500);
    const nextCardOrSummary =
      sdfpRenderer.or(
        page.getByTestId('spfd-renderer').or(
          page.getByTestId('sca-renderer').or(
            page.locator('[data-testid="session-summary"]')
          )
        )
      );
    await expect(nextCardOrSummary.first()).toBeVisible({ timeout: 5000 });
  });

  test('PMATCH-E2E-03: Complete session with picture-match items — assert session complete view', async ({ page }) => {
    await navigateToExerciseSession(page);

    // Exhaust the queue by clicking through all exercises
    let iterations = 0;
    const maxIterations = 20; // safety guard

    while (iterations < maxIterations) {
      iterations++;

      // Identify the current card type
      const spfd = page.getByTestId('spfd-renderer');
      const sdfp = page.getByTestId('sdfp-renderer');
      const sca = page.getByTestId('sca-renderer');

      const isSpfd = await spfd.isVisible().catch(() => false);
      const isSdfp = await sdfp.isVisible().catch(() => false);
      const isSca = await sca.isVisible().catch(() => false);

      if (!isSpfd && !isSdfp && !isSca) {
        // Session may have completed
        break;
      }

      // Click the first available option
      if (isSpfd) {
        await page.getByTestId('spfd-option-0').click();
      } else if (isSdfp) {
        await page.getByTestId('sdfp-option-0').click();
      } else {
        await page.getByTestId('sca-option-0').click();
      }

      // Wait for auto-advance
      await page.waitForTimeout(1500);
    }

    // Session complete view should be visible (SessionSummary component)
    // The ExercisePracticePage renders a summary inline (no route change).
    await expect(
      page.getByText(/session complete|practice again/i).first()
    ).toBeVisible({ timeout: 10000 });
  });
});
