/**
 * Culture Streak Tile — E2E Tests (STRK-08, functional only)
 *
 * Verifies that the Streak metric in CultureMetricStrip is wired to real
 * backend data (dashboard.streak.culture_current_streak) after STRK-06.
 *
 * Auth: pre-authenticated learner via playwright.config.ts storageState.
 * NOTE: Do NOT add beforeEach seed calls — re-seeding would invalidate cached auth tokens.
 *
 * Visual snapshot assertion is deferred (no visual-baseline infra in this repo;
 * team norm is manual dev-preview verification).
 */

import { test, expect } from '@playwright/test';

test.describe('Culture page — Streak metric tile', () => {
  test('streak tile is wired: shows numeric value, days suffix, and no unwired-dot', async ({
    page,
  }) => {
    await page.goto('/culture');

    const strip = page.getByTestId('culture-metric-strip');
    await expect(strip).toBeVisible({ timeout: 15000 });

    // Locate the Streak tile by its label text (not by index — index may shift).
    const streakTile = strip
      .locator('.dx-metric')
      .filter({ has: page.getByText('Streak', { exact: true }) });

    await expect(streakTile).toHaveCount(1);

    // Value region renders a number (may be 0 — seed dates are not guaranteed consecutive).
    await expect(streakTile.locator('.dx-metric-v')).toContainText(/\d+/);

    // "days" suffix is rendered in the <small> element.
    await expect(streakTile.locator('.dx-metric-v small')).toHaveText(/days/i);

    // The tile is wired — must NOT contain an unwired-dot indicator.
    await expect(streakTile.getByTestId('unwired-dot')).toHaveCount(0);
  });

  test('this-week tile is still unwired (sanity: test discriminates wired vs unwired)', async ({
    page,
  }) => {
    await page.goto('/culture');

    const strip = page.getByTestId('culture-metric-strip');
    await expect(strip).toBeVisible({ timeout: 15000 });

    // The "This week" tile has unwired: true in CulturePage metrics config.
    const thisWeekTile = strip
      .locator('.dx-metric')
      .filter({ has: page.getByText('This week', { exact: true }) });

    await expect(thisWeekTile).toHaveCount(1);
    await expect(thisWeekTile.getByTestId('unwired-dot')).toHaveCount(1);
  });
});
