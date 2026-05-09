/**
 * Decks / Culture IA Split — E2E Tests
 *
 * Covers the four acceptance criteria for IA-01 (DCSPL-07):
 * 1. /decks renders vocabulary-only (no Culture filter button, no culture badges)
 * 2. /culture renders culture decks + mock-exam CTA
 * 3. Mock-exam CTA navigates to /practice/culture-exam
 * 4. Header Decks dropdown has a Culture entry that lands on /culture
 *
 * Auth: pre-authenticated learner via playwright.config.ts storageState (auth.setup.ts).
 * NOTE: Do NOT add beforeEach seed calls — re-seeding would invalidate cached auth tokens.
 */

import { test, expect } from '@playwright/test';

test.describe('Decks / Culture IA split', () => {
  test.describe('/decks renders vocabulary-only', () => {
    test('Culture filter button is gone from /decks', async ({ page }) => {
      await page.goto('/decks');
      await expect(page.locator('[data-testid="deck-card"]').first()).toBeVisible({
        timeout: 15000,
      });
      // Culture button used to live alongside All / Vocabulary; assert it is absent post-split.
      await expect(page.getByRole('button', { name: 'Culture', exact: true })).toHaveCount(0);
    });

    test('at least one deck card renders and /decks heading is visible', async ({ page }) => {
      await page.goto('/decks');
      await expect(page.getByTestId('decks-title')).toBeVisible({ timeout: 15000 });
      await expect(page.locator('[data-testid="deck-card"]').first()).toBeVisible({
        timeout: 15000,
      });
    });
  });

  test.describe('/culture renders culture-only with mock-exam CTA', () => {
    test('at least one deck card is visible on /culture', async ({ page }) => {
      await page.goto('/culture');
      await expect(page.locator('[data-testid="deck-card"]').first()).toBeVisible({
        timeout: 15000,
      });
    });

    test('mock-exam CTA is visible on /culture', async ({ page }) => {
      await page.goto('/culture');
      await expect(page.getByTestId('culture-mock-exam-cta')).toBeVisible({ timeout: 10000 });
    });

    test('mock-exam CTA navigates to /practice/culture-exam', async ({ page }) => {
      await page.goto('/culture');
      const cta = page.getByTestId('culture-mock-exam-cta');
      await expect(cta).toBeVisible({ timeout: 10000 });
      // Click the CTA button/link inside the card
      await cta.getByRole('link', { name: /take mock exam/i }).click();
      await expect(page).toHaveURL(/\/practice\/culture-exam/);
      await expect(page.getByTestId('mock-exam-page')).toBeVisible({ timeout: 15000 });
    });

    test('clicking a culture deck navigates to its detail page', async ({ page }) => {
      // Replaces the "navigate to culture deck detail" coverage from the deleted
      // culture-deck-browsing.spec.ts. Picks a non-premium card to avoid paywall.
      await page.goto('/culture');
      const card = page
        .locator('[data-testid="deck-card"]')
        .filter({ hasNot: page.locator('[aria-label="Premium content"]') })
        .first();
      await expect(card).toBeVisible({ timeout: 15000 });
      await card.click();
      await expect(page).toHaveURL(/\/culture\/decks\//);
      await expect(page.getByTestId('deck-detail')).toBeVisible();
    });
  });

  test.describe('Header Decks dropdown', () => {
    test('contains Culture entry that lands on /culture', async ({ page }) => {
      await page.goto('/dashboard');
      await page.locator('[data-testid="decks-dropdown-trigger"]').click();
      const cultureMenuItem = page.getByRole('menuitem', { name: /^culture$/i });
      await expect(cultureMenuItem).toBeVisible();
      await cultureMenuItem.click();
      await expect(page).toHaveURL(/\/culture$/);
      // Sanity: page rendered (CTA always shows unconditionally).
      await expect(page.getByTestId('culture-mock-exam-cta')).toBeVisible({ timeout: 15000 });
    });
  });
});
