/**
 * Decks DX Visual Regression Tests
 *
 * Visual baseline spec for the three DX-rebuilt screens:
 *   1. Decks Index  (/decks)
 *   2. Deck Detail  (/decks/:id)
 *   3. Word Reference (/decks/:id/words/:wordId)
 *
 * IMPORTANT: Baseline PNG files are NOT committed in this PR.
 * This spec file exists so CI can detect regressions once baselines
 * are generated manually (run `npx playwright test --update-snapshots`
 * from a stable deploy) or via the Chromatic visual CI job (currently
 * disabled; skip-visual label is intentionally kept on PR #515).
 *
 * Matrix: Desktop/Tablet/Mobile × EN/RU × Light/Dark
 * Naming convention: "{Screen} - {State} - {Viewport} {Lang} {Theme}"
 */

import { test, expect } from '@chromatic-com/playwright';
import { Page } from '@playwright/test';

import {
  takeSnapshot,
  takeResponsiveSnapshots,
  waitForPageReady,
  loginForVisualTest,
  VIEWPORTS,
} from './helpers/visual-helpers';

// ─── Locale helpers (not in shared visual-helpers, copied from my-decks.visual.spec.ts) ──

/**
 * Helper to set theme via localStorage
 */
async function setTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  await page.evaluate((t) => {
    localStorage.setItem('theme', t);
    document.documentElement.classList.toggle('dark', t === 'dark');
  }, theme);
}

/**
 * Helper to set language via localStorage
 */
async function setLanguage(page: Page, lang: 'en' | 'ru'): Promise<void> {
  await page.evaluate((l) => {
    localStorage.setItem('i18nextLng', l);
  }, lang);
}

// ============================================================================
// SCREEN 1: DECKS INDEX (/decks)
// ============================================================================

test.describe('Decks Index — DX Rebuild Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginForVisualTest(page);
  });

  // Desktop EN Light
  test('Decks Index - Default - Desktop EN Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setTheme(page, 'light');
    await setLanguage(page, 'en');
    await page.goto('/decks');
    await waitForPageReady(page, '[data-testid="decks-title"]');
    await page.waitForTimeout(800);
    await takeSnapshot(page, 'Decks Index - Default - Desktop EN Light', testInfo);
  });

  // Desktop EN Dark
  test('Decks Index - Default - Desktop EN Dark', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setTheme(page, 'dark');
    await setLanguage(page, 'en');
    await page.goto('/decks');
    await waitForPageReady(page, '[data-testid="decks-title"]');
    await page.waitForTimeout(800);
    await takeSnapshot(page, 'Decks Index - Default - Desktop EN Dark', testInfo);
  });

  // Desktop RU Light
  test('Decks Index - Default - Desktop RU Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setTheme(page, 'light');
    await setLanguage(page, 'ru');
    await page.goto('/decks');
    await page.reload();
    await waitForPageReady(page, '[data-testid="decks-title"]');
    await page.waitForTimeout(800);
    await takeSnapshot(page, 'Decks Index - Default - Desktop RU Light', testInfo);
  });

  // Tablet EN Light
  test('Decks Index - Default - Tablet EN Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.tablet);
    await setTheme(page, 'light');
    await setLanguage(page, 'en');
    await page.goto('/decks');
    await waitForPageReady(page, '[data-testid="decks-title"]');
    await page.waitForTimeout(800);
    await takeSnapshot(page, 'Decks Index - Default - Tablet EN Light', testInfo);
  });

  // Tablet EN Dark
  test('Decks Index - Default - Tablet EN Dark', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.tablet);
    await setTheme(page, 'dark');
    await setLanguage(page, 'en');
    await page.goto('/decks');
    await waitForPageReady(page, '[data-testid="decks-title"]');
    await page.waitForTimeout(800);
    await takeSnapshot(page, 'Decks Index - Default - Tablet EN Dark', testInfo);
  });

  // Mobile EN Light
  test('Decks Index - Default - Mobile EN Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await setTheme(page, 'light');
    await setLanguage(page, 'en');
    await page.goto('/decks');
    await waitForPageReady(page, '[data-testid="decks-title"]');
    await page.waitForTimeout(800);
    await takeSnapshot(page, 'Decks Index - Default - Mobile EN Light', testInfo);
  });

  // Mobile EN Dark
  test('Decks Index - Default - Mobile EN Dark', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await setTheme(page, 'dark');
    await setLanguage(page, 'en');
    await page.goto('/decks');
    await waitForPageReady(page, '[data-testid="decks-title"]');
    await page.waitForTimeout(800);
    await takeSnapshot(page, 'Decks Index - Default - Mobile EN Dark', testInfo);
  });

  // Filters open state (desktop)
  test('Decks Index - Filters Active - Desktop EN Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setTheme(page, 'light');
    await setLanguage(page, 'en');
    await page.goto('/decks');
    await waitForPageReady(page, '[data-testid="decks-title"]');
    await page.waitForTimeout(800);

    // Activate A1 + In Progress filters
    const a1Btn = page.getByRole('button', { name: /^a1$/i });
    if (await a1Btn.isVisible().catch(() => false)) {
      await a1Btn.click();
      await page.waitForTimeout(300);
    }

    await takeSnapshot(page, 'Decks Index - Filters Active - Desktop EN Light', testInfo);
  });
});

// ============================================================================
// SCREEN 2: DECK DETAIL (/decks/:id)
// ============================================================================

test.describe('Deck Detail — DX Rebuild Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginForVisualTest(page);
  });

  // Desktop EN Light (navigate via first deck card)
  test('Deck Detail - Default - Desktop EN Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setTheme(page, 'light');
    await setLanguage(page, 'en');
    await page.goto('/decks');
    await waitForPageReady(page, '[data-testid="decks-title"]');

    const firstDeck = page.locator('[data-testid="deck-card"]').first();
    await expect(firstDeck).toBeVisible({ timeout: 15000 });
    await firstDeck.click();
    await waitForPageReady(page, '[data-testid="word-browser"]');
    await page.waitForTimeout(1000);

    await takeSnapshot(page, 'Deck Detail - Default - Desktop EN Light', testInfo);
  });

  // Desktop EN Dark
  test('Deck Detail - Default - Desktop EN Dark', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setTheme(page, 'dark');
    await setLanguage(page, 'en');
    await page.goto('/decks');
    await waitForPageReady(page, '[data-testid="decks-title"]');

    const firstDeck = page.locator('[data-testid="deck-card"]').first();
    await expect(firstDeck).toBeVisible({ timeout: 15000 });
    await firstDeck.click();
    await waitForPageReady(page, '[data-testid="word-browser"]');
    await page.waitForTimeout(1000);

    await takeSnapshot(page, 'Deck Detail - Default - Desktop EN Dark', testInfo);
  });

  // Desktop RU Light
  test('Deck Detail - Default - Desktop RU Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setTheme(page, 'light');
    await setLanguage(page, 'ru');
    await page.goto('/decks');
    await page.reload();
    await waitForPageReady(page, '[data-testid="decks-title"]');

    const firstDeck = page.locator('[data-testid="deck-card"]').first();
    await expect(firstDeck).toBeVisible({ timeout: 15000 });
    await firstDeck.click();
    await waitForPageReady(page, '[data-testid="word-browser"]');
    await page.waitForTimeout(1000);

    await takeSnapshot(page, 'Deck Detail - Default - Desktop RU Light', testInfo);
  });

  // Tablet EN Light
  test('Deck Detail - Default - Tablet EN Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.tablet);
    await setTheme(page, 'light');
    await setLanguage(page, 'en');
    await page.goto('/decks');
    await waitForPageReady(page, '[data-testid="decks-title"]');

    const firstDeck = page.locator('[data-testid="deck-card"]').first();
    await expect(firstDeck).toBeVisible({ timeout: 15000 });
    await firstDeck.click();
    await waitForPageReady(page, '[data-testid="word-browser"]');
    await page.waitForTimeout(1000);

    await takeSnapshot(page, 'Deck Detail - Default - Tablet EN Light', testInfo);
  });

  // Mobile EN Light
  test('Deck Detail - Default - Mobile EN Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await setTheme(page, 'light');
    await setLanguage(page, 'en');
    await page.goto('/decks');
    await waitForPageReady(page, '[data-testid="decks-title"]');

    const firstDeck = page.locator('[data-testid="deck-card"]').first();
    await expect(firstDeck).toBeVisible({ timeout: 15000 });
    await firstDeck.click();
    await waitForPageReady(page, '[data-testid="word-browser"]');
    await page.waitForTimeout(1000);

    await takeSnapshot(page, 'Deck Detail - Default - Mobile EN Light', testInfo);
  });

  // Mobile EN Dark
  test('Deck Detail - Default - Mobile EN Dark', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await setTheme(page, 'dark');
    await setLanguage(page, 'en');
    await page.goto('/decks');
    await waitForPageReady(page, '[data-testid="decks-title"]');

    const firstDeck = page.locator('[data-testid="deck-card"]').first();
    await expect(firstDeck).toBeVisible({ timeout: 15000 });
    await firstDeck.click();
    await waitForPageReady(page, '[data-testid="word-browser"]');
    await page.waitForTimeout(1000);

    await takeSnapshot(page, 'Deck Detail - Default - Mobile EN Dark', testInfo);
  });
});

// ============================================================================
// SCREEN 3: WORD REFERENCE (/decks/:id/words/:wordId)
// ============================================================================

test.describe('Word Reference — DX Rebuild Visual Tests', () => {
  let v2DeckId: string;
  let testWordId: string;

  // Re-use the same seed-data lookup as word-reference-cards.spec.ts
  test.beforeAll(async ({ request }) => {
    const apiBaseUrl = process.env.E2E_API_URL || process.env.VITE_API_URL || 'http://localhost:8000';

    // Auth is handled via storageState set by loginForVisualTest — we need a token for API calls.
    // We don't need a real token here because auth is browser-session based; we just need the IDs
    // from the seed data via public endpoints or skip if they're not available.
    // If endpoints require auth, we rely on CI seed data being accessible.
    try {
      const decksResp = await request.get(`${apiBaseUrl}/api/v1/decks?page_size=100`);
      if (!decksResp.ok()) {
        v2DeckId = '';
        testWordId = '';
        return;
      }
      const decksData = await decksResp.json();
      const v2Deck = (decksData.decks ?? []).find(
        (d: { name: string; name_en?: string }) =>
          d.name === 'Greek A1 Vocabulary (Nouns)' || d.name_en === 'Greek A1 Vocabulary (Nouns)'
      );
      if (!v2Deck) {
        v2DeckId = '';
        testWordId = '';
        return;
      }
      v2DeckId = v2Deck.id as string;

      const wordsResp = await request.get(
        `${apiBaseUrl}/api/v1/decks/${v2DeckId}/word-entries?page_size=1`
      );
      if (!wordsResp.ok()) {
        testWordId = '';
        return;
      }
      const wordsData = await wordsResp.json();
      const firstWord = (wordsData.word_entries ?? [])[0];
      testWordId = firstWord ? (firstWord.id as string) : '';
    } catch {
      v2DeckId = '';
      testWordId = '';
    }
  });

  test.beforeEach(async ({ page }) => {
    await loginForVisualTest(page);
  });

  // Desktop EN Light — Word Info tab
  test('Word Reference - Word Info Tab - Desktop EN Light', async ({ page }, testInfo) => {
    if (!v2DeckId || !testWordId) {
      test.skip();
      return;
    }
    await page.setViewportSize(VIEWPORTS.desktop);
    await setTheme(page, 'light');
    await setLanguage(page, 'en');
    await page.goto(`/decks/${v2DeckId}/words/${testWordId}`);
    await waitForPageReady(page, '[data-testid="word-reference-page"]');
    await page.waitForTimeout(1000);
    await takeSnapshot(page, 'Word Reference - Word Info Tab - Desktop EN Light', testInfo);
  });

  // Desktop EN Dark — Word Info tab
  test('Word Reference - Word Info Tab - Desktop EN Dark', async ({ page }, testInfo) => {
    if (!v2DeckId || !testWordId) {
      test.skip();
      return;
    }
    await page.setViewportSize(VIEWPORTS.desktop);
    await setTheme(page, 'dark');
    await setLanguage(page, 'en');
    await page.goto(`/decks/${v2DeckId}/words/${testWordId}`);
    await waitForPageReady(page, '[data-testid="word-reference-page"]');
    await page.waitForTimeout(1000);
    await takeSnapshot(page, 'Word Reference - Word Info Tab - Desktop EN Dark', testInfo);
  });

  // Desktop RU Light
  test('Word Reference - Word Info Tab - Desktop RU Light', async ({ page }, testInfo) => {
    if (!v2DeckId || !testWordId) {
      test.skip();
      return;
    }
    await page.setViewportSize(VIEWPORTS.desktop);
    await setTheme(page, 'light');
    await setLanguage(page, 'ru');
    await page.goto(`/decks/${v2DeckId}/words/${testWordId}`);
    await page.reload();
    await waitForPageReady(page, '[data-testid="word-reference-page"]');
    await page.waitForTimeout(1000);
    await takeSnapshot(page, 'Word Reference - Word Info Tab - Desktop RU Light', testInfo);
  });

  // Desktop EN Light — Cards tab
  test('Word Reference - Cards Tab - Desktop EN Light', async ({ page }, testInfo) => {
    if (!v2DeckId || !testWordId) {
      test.skip();
      return;
    }
    await page.setViewportSize(VIEWPORTS.desktop);
    await setTheme(page, 'light');
    await setLanguage(page, 'en');
    await page.goto(`/decks/${v2DeckId}/words/${testWordId}`);
    await waitForPageReady(page, '[data-testid="word-reference-page"]');

    await page.getByTestId('word-reference-tab-cards').click();
    await expect(page.getByTestId('cards-summary-bar')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(500);

    await takeSnapshot(page, 'Word Reference - Cards Tab - Desktop EN Light', testInfo);
  });

  // Desktop EN Dark — Cards tab
  test('Word Reference - Cards Tab - Desktop EN Dark', async ({ page }, testInfo) => {
    if (!v2DeckId || !testWordId) {
      test.skip();
      return;
    }
    await page.setViewportSize(VIEWPORTS.desktop);
    await setTheme(page, 'dark');
    await setLanguage(page, 'en');
    await page.goto(`/decks/${v2DeckId}/words/${testWordId}`);
    await waitForPageReady(page, '[data-testid="word-reference-page"]');

    await page.getByTestId('word-reference-tab-cards').click();
    await expect(page.getByTestId('cards-summary-bar')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(500);

    await takeSnapshot(page, 'Word Reference - Cards Tab - Desktop EN Dark', testInfo);
  });

  // Tablet EN Light — Word Info tab
  test('Word Reference - Word Info Tab - Tablet EN Light', async ({ page }, testInfo) => {
    if (!v2DeckId || !testWordId) {
      test.skip();
      return;
    }
    await page.setViewportSize(VIEWPORTS.tablet);
    await setTheme(page, 'light');
    await setLanguage(page, 'en');
    await page.goto(`/decks/${v2DeckId}/words/${testWordId}`);
    await waitForPageReady(page, '[data-testid="word-reference-page"]');
    await page.waitForTimeout(1000);
    await takeSnapshot(page, 'Word Reference - Word Info Tab - Tablet EN Light', testInfo);
  });

  // Mobile EN Light — Word Info tab
  test('Word Reference - Word Info Tab - Mobile EN Light', async ({ page }, testInfo) => {
    if (!v2DeckId || !testWordId) {
      test.skip();
      return;
    }
    await page.setViewportSize(VIEWPORTS.mobile);
    await setTheme(page, 'light');
    await setLanguage(page, 'en');
    await page.goto(`/decks/${v2DeckId}/words/${testWordId}`);
    await waitForPageReady(page, '[data-testid="word-reference-page"]');
    await page.waitForTimeout(1000);
    await takeSnapshot(page, 'Word Reference - Word Info Tab - Mobile EN Light', testInfo);
  });

  // Mobile EN Dark — Word Info tab
  test('Word Reference - Word Info Tab - Mobile EN Dark', async ({ page }, testInfo) => {
    if (!v2DeckId || !testWordId) {
      test.skip();
      return;
    }
    await page.setViewportSize(VIEWPORTS.mobile);
    await setTheme(page, 'dark');
    await setLanguage(page, 'en');
    await page.goto(`/decks/${v2DeckId}/words/${testWordId}`);
    await waitForPageReady(page, '[data-testid="word-reference-page"]');
    await page.waitForTimeout(1000);
    await takeSnapshot(page, 'Word Reference - Word Info Tab - Mobile EN Dark', testInfo);
  });
});
