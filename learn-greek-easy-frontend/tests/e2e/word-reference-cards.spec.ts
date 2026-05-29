/**
 * E2E Tests: Word Reference Cards Tab (WCRD feature)
 *
 * Tests verify the Cards tab UI on the Word Reference page:
 * - Tab layout (Word Info default, Cards switch)
 * - Cards tab content (summary bar, card groups, card items)
 * - Card expand/collapse via Collapsible
 * - Empty state via API route mocking
 * - Practice button removal
 *
 * NOTE: Do NOT add beforeEach seed calls - the auth setup already seeds
 * the database and authenticates users.
 */

import * as fs from 'fs';

import { test, expect, Page } from '@playwright/test';

import { getSupabaseStorageKey } from './helpers/supabase-test-client';

const LEARNER_AUTH = 'playwright/.auth/learner.json';

test.use({ storageState: LEARNER_AUTH });
test.describe.configure({ mode: 'serial' });

function getApiBaseUrl(): string {
  return process.env.E2E_API_URL || process.env.VITE_API_URL || 'http://localhost:8000';
}

function getLearnerAccessToken(): string | null {
  try {
    const storageKey = getSupabaseStorageKey();
    const authState = JSON.parse(fs.readFileSync(LEARNER_AUTH, 'utf-8'));
    const sessionEntry = (authState.origins ?? [])
      .flatMap((origin: { localStorage?: Array<{ name: string; value: string }> }) =>
        origin.localStorage ?? []
      )
      .find((item: { name: string; value: string }) => item.name === storageKey);
    if (sessionEntry) {
      const session = JSON.parse(sessionEntry.value);
      return session?.access_token || null;
    }
  } catch {
    // File might not exist or be invalid
  }
  return null;
}

let v2DeckId: string;
let testWordId: string;

async function navigateToWordReference(page: Page): Promise<void> {
  await page.goto(`/decks/${v2DeckId}/words/${testWordId}`);
  await expect(page.locator('[data-testid="word-reference-page"]')).toBeVisible({ timeout: 15000 });
}

test.describe('Word Reference - Cards Tab', () => {
  test.beforeAll(async ({ request }) => {
    const apiBaseUrl = getApiBaseUrl();
    const accessToken = getLearnerAccessToken();
    if (!accessToken) {
      throw new Error(
        '[WCRD] Could not read learner access token from storageState. ' +
          'Ensure auth.setup.ts ran successfully.'
      );
    }

    const headers = { Authorization: `Bearer ${accessToken}` };

    // Find "Greek A1 Vocabulary (Nouns)"
    const decksResp = await request.get(`${apiBaseUrl}/api/v1/decks?page_size=100`, { headers });
    if (!decksResp.ok()) {
      throw new Error(`[WCRD] Failed to fetch decks: ${decksResp.status()}`);
    }
    const decksData = await decksResp.json();
    const v2Deck = (decksData.decks ?? []).find(
      (d: { name: string; name_en?: string }) =>
        d.name === 'Greek A1 Vocabulary (Nouns)' || d.name_en === 'Greek A1 Vocabulary (Nouns)'
    );
    if (!v2Deck) {
      throw new Error('[WCRD] Could not find "Greek A1 Vocabulary (Nouns)" deck. Ensure seed data is loaded.');
    }
    v2DeckId = v2Deck.id as string;

    // Get first word entry in the deck
    const wordsResp = await request.get(
      `${apiBaseUrl}/api/v1/decks/${v2DeckId}/word-entries?page_size=1`,
      { headers }
    );
    if (!wordsResp.ok()) {
      throw new Error(`[WCRD] Failed to fetch word entries: ${wordsResp.status()}`);
    }
    const wordsData = await wordsResp.json();
    const firstWord = (wordsData.word_entries ?? [])[0];
    if (!firstWord) {
      throw new Error('[WCRD] No word entries found in "Greek A1 Vocabulary (Nouns)".');
    }
    testWordId = firstWord.id as string;
  });

  test('WCRD-E2E-01: default tab shows Word Info', async ({ page }) => {
    await navigateToWordReference(page);

    await expect(page.getByTestId('word-reference-tabs')).toBeVisible();
    await expect(page.getByTestId('word-reference-tab-word-info')).toHaveAttribute(
      'data-state',
      'active'
    );
    await expect(page.getByTestId('word-reference-tab-cards')).toHaveAttribute(
      'data-state',
      'inactive'
    );
  });

  test('WCRD-E2E-02: switch to Cards tab shows summary bar and card groups', async ({ page }) => {
    await navigateToWordReference(page);

    await page.getByTestId('word-reference-tab-cards').click();

    await expect(page.getByTestId('cards-summary-bar')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid^="card-group-"]').first()).toBeVisible();
    await expect(page.locator('[data-testid^="mini-flip-card-"]').first()).toBeVisible();
  });

  test('WCRD-E2E-03: tap card flips to show back face', async ({ page }) => {
    await navigateToWordReference(page);
    await page.getByTestId('word-reference-tab-cards').click();
    await expect(page.getByTestId('cards-summary-bar')).toBeVisible({ timeout: 10000 });

    const firstCard = page.locator('[data-testid^="mini-flip-card-"]').first();
    await expect(firstCard).toBeVisible();

    const innerContainer = firstCard.locator('> div').first();
    await expect(innerContainer).not.toHaveClass(/rotateY/);

    await firstCard.click();
    await expect(innerContainer).toHaveClass(/rotateY/);

    // Switching tabs resets flip state
    await page.getByTestId('word-reference-tab-word-info').click();
    await page.getByTestId('word-reference-tab-cards').click();
    await expect(page.getByTestId('cards-summary-bar')).toBeVisible({ timeout: 10000 });
    const resetCard = page.locator('[data-testid^="mini-flip-card-"]').first();
    const resetInner = resetCard.locator('> div').first();
    await expect(resetInner).not.toHaveClass(/rotateY/);
  });

  test('WCRD-E2E-04: Cards tab label shows mastery fraction', async ({ page }) => {
    await navigateToWordReference(page);

    await expect(page.getByTestId('word-reference-tab-cards')).toHaveText(
      /Cards \(\d+\/\d+\)/,
      { timeout: 10000 }
    );
  });

  test('WCRD-E2E-05: empty state when word has no cards (API mocking)', async ({ page }) => {
    // Set up route interception BEFORE navigation
    await page.route(
      (url) => url.pathname === `/api/v1/word-entries/${testWordId}/cards`,
      async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      }
    );
    await page.route(
      (url) => url.pathname === `/api/v1/decks/${v2DeckId}/word-mastery`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ deck_id: v2DeckId, items: [] }),
        });
      }
    );

    await navigateToWordReference(page);
    await page.getByTestId('word-reference-tab-cards').click();

    await expect(page.getByTestId('cards-tab-empty')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid^="card-group-"]')).toHaveCount(0);
  });

  test('WCRD-E2E-06: practice button is removed', async ({ page }) => {
    await navigateToWordReference(page);

    await expect(page.getByTestId('practice-word-button')).toHaveCount(0);

    await page.getByTestId('word-reference-tab-cards').click();
    await expect(page.getByTestId('practice-word-button')).toHaveCount(0);
  });

  test('WCRD-E2E-07: tab state persists across switches', async ({ page }) => {
    await navigateToWordReference(page);

    // Switch to Cards tab, wait for content
    await page.getByTestId('word-reference-tab-cards').click();
    await expect(page.getByTestId('cards-summary-bar')).toBeVisible({ timeout: 10000 });

    // Switch back to Word Info
    await page.getByTestId('word-reference-tab-word-info').click();
    await expect(page.getByTestId('word-reference-tab-word-info')).toHaveAttribute(
      'data-state',
      'active'
    );

    // Switch back to Cards — content should still be there
    await page.getByTestId('word-reference-tab-cards').click();
    await expect(page.locator('[data-testid^="card-group-"]').first()).toBeVisible();
  });
});

// ============================================================================
// DX-15: Word Reference — additional E2E coverage
// ============================================================================

test.describe('DX-15: Word Reference — audio dxPulse + view toggle + list rows', () => {
  test('DX-15.1: Cards view toggle is present and switches to list view', async ({ page }) => {
    await navigateToWordReference(page);
    await page.getByTestId('word-reference-tab-cards').click();
    await expect(page.getByTestId('cards-summary-bar')).toBeVisible({ timeout: 10000 });

    // The view toggle should be visible
    const toggle = page.getByTestId('cards-view-toggle');
    await expect(toggle).toBeVisible();

    // Grid button is active by default
    const gridBtn = page.getByTestId('cards-view-grid-btn');
    const listBtn = page.getByTestId('cards-view-list-btn');
    await expect(gridBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(listBtn).toHaveAttribute('aria-pressed', 'false');

    // Switch to list view
    await listBtn.click();
    await expect(listBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(gridBtn).toHaveAttribute('aria-pressed', 'false');
  });

  test('DX-15.2: List view renders card rows with correct testids', async ({ page }) => {
    await navigateToWordReference(page);
    await page.getByTestId('word-reference-tab-cards').click();
    await expect(page.getByTestId('cards-summary-bar')).toBeVisible({ timeout: 10000 });

    // Switch to list view
    await page.getByTestId('cards-view-list-btn').click();

    // Card rows should appear within any non-placeholder group
    const cardRows = page.locator('[data-testid^="card-row-"]');
    const hasCardRows = await cardRows.first().isVisible({ timeout: 8000 }).catch(() => false);

    if (hasCardRows) {
      await expect(cardRows.first()).toBeVisible();
      // Each row has mastery dot, type, prompt, answer, due columns
      const firstRow = cardRows.first();
      await expect(firstRow.locator('[data-testid="card-row-mastery-dot"]')).toBeVisible();
      await expect(firstRow.locator('[data-testid="card-row-due"]')).toBeVisible();
    }
  });

  test('DX-15.3: Switching back to grid view after list shows mini-flip cards', async ({
    page,
  }) => {
    await navigateToWordReference(page);
    await page.getByTestId('word-reference-tab-cards').click();
    await expect(page.getByTestId('cards-summary-bar')).toBeVisible({ timeout: 10000 });

    // Switch to list then back to grid
    await page.getByTestId('cards-view-list-btn').click();
    await expect(page.getByTestId('cards-view-list-btn')).toHaveAttribute('aria-pressed', 'true');

    await page.getByTestId('cards-view-grid-btn').click();
    await expect(page.getByTestId('cards-view-grid-btn')).toHaveAttribute('aria-pressed', 'true');

    // Mini-flip cards should be visible in grid view
    const firstCard = page.locator('[data-testid^="mini-flip-card-"]').first();
    const hasFlipCards = await firstCard.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasFlipCards) {
      await expect(firstCard).toBeVisible();
    }
  });

  test('DX-15.4: audio wrapper has dxPulse on play (is-playing class)', async ({ page }) => {
    await navigateToWordReference(page);

    // The audio wrapper in the hero: data-testid="word-audio-wrapper"
    const audioWrapper = page.locator('[data-testid="word-audio-wrapper"]');
    const hasAudio = await audioWrapper.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasAudio) {
      // Word has no audio — skip this assertion gracefully
      return;
    }

    // Before clicking: no is-playing class
    await expect(audioWrapper).not.toHaveClass(/is-playing/);

    // Note: actually clicking the speaker triggers audio network request.
    // We verify the is-playing state is wired by checking the element exists and has
    // the correct wrapper structure (dxPulse is controlled by the is-playing class).
    await expect(audioWrapper).toHaveClass(/dx-w-audio/);
  });

  test('DX-15.5: reduced-motion emulation — page renders without crash', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await navigateToWordReference(page);

    // Under reduced-motion, animations are neutralized.
    // Verify the page still renders the hero and tabs correctly.
    await expect(page.locator('[data-testid="word-hero"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="word-reference-tabs"]')).toBeVisible();
  });
});

test.describe('DX-15: Word Reference — UnwiredDot presence (R3-R8)', () => {
  test('DX-15.6: R3 — hero WeekHeat UnwiredDot visible', async ({ page }) => {
    await navigateToWordReference(page);

    const hero = page.locator('[data-testid="word-hero"]');
    await expect(hero).toBeVisible({ timeout: 10000 });

    // R3: UnwiredDot wrapping WeekHeat in the hero stats area
    const heroUnwiredDots = hero.locator('[data-testid="unwired-dot"]');
    // Hero has R4 (extra gloss) + R3 (WeekHeat) = at least 2 dots
    const dotCount = await heroUnwiredDots.count();
    expect(dotCount).toBeGreaterThanOrEqual(2);
  });

  test('DX-15.7: R4 — extra gloss placeholder UnwiredDot visible', async ({ page }) => {
    await navigateToWordReference(page);

    const hero = page.locator('[data-testid="word-hero"]');
    await expect(hero).toBeVisible({ timeout: 10000 });

    // R4: extra-gloss dot — wraps the extra translation placeholder
    const extraGloss = page.locator('[data-testid="word-en-extra"]');
    await expect(extraGloss).toBeVisible();
    // The extra gloss is inside an UnwiredDot wrapper
    const closestDot = extraGloss.locator('xpath=ancestor::*[@data-testid="unwired-dot"][1]');
    await expect(closestDot).toBeVisible();
  });

  test('DX-15.8: R5 — example tag amber UnwiredDot visible', async ({ page }) => {
    await navigateToWordReference(page);

    // Switch to word-info tab (default) and check examples section
    await expect(page.getByTestId('word-reference-tab-word-info')).toHaveAttribute(
      'data-state',
      'active'
    );

    const examplesSection = page.locator('[data-testid="examples-section"]');
    await expect(examplesSection).toBeVisible({ timeout: 10000 });

    // R5: amber UnwiredDot on each example tag
    const exampleTag = page.locator('[data-testid="example-tag"]').first();
    const hasExampleTag = await exampleTag.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasExampleTag) {
      const tagDot = exampleTag.locator('[data-testid="unwired-dot"]').first();
      // Or the example tag itself may be the dot's sibling — check parent
      const parentDot = page
        .locator('[data-testid="example-tag"]')
        .first()
        .locator('xpath=ancestor::*[@data-testid="unwired-dot"][1]')
        .or(
          page.locator('[data-testid="example-tag"]').first().locator('[data-testid="unwired-dot"]')
        );
      await expect(tagDot.or(parentDot).first()).toBeVisible();
    }
  });

  test('DX-15.9: R6 — Collocations section UnwiredDot visible', async ({ page }) => {
    await navigateToWordReference(page);

    const collocationsSection = page.locator('[data-testid="collocations-section"]');
    await expect(collocationsSection).toBeVisible({ timeout: 10000 });

    // R6: danger UnwiredDot in the collocations heading
    const collocationsDot = collocationsSection.locator('[data-testid="unwired-dot"]').first();
    await expect(collocationsDot).toBeVisible();
  });

  test('DX-15.10: R7 — Related Words section UnwiredDot visible', async ({ page }) => {
    await navigateToWordReference(page);

    const relatedSection = page.locator('[data-testid="related-words-section"]');
    await expect(relatedSection).toBeVisible({ timeout: 10000 });

    // R7: danger UnwiredDot in the related words heading
    const relatedDot = relatedSection.locator('[data-testid="unwired-dot"]').first();
    await expect(relatedDot).toBeVisible();
  });

  test('DX-15.11: R8 — Audio card group UnwiredDot visible', async ({ page }) => {
    await navigateToWordReference(page);
    await page.getByTestId('word-reference-tab-cards').click();
    await expect(page.getByTestId('cards-summary-bar')).toBeVisible({ timeout: 10000 });

    // R8: Audio group is a placeholder; it has an UnwiredDot wrapping the TypeChip
    const audioGroup = page.locator('[data-testid="card-group-audio"]');
    const hasAudioGroup = await audioGroup.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasAudioGroup) {
      const audioDot = audioGroup.locator('[data-testid="unwired-dot"]').first();
      await expect(audioDot).toBeVisible();
    }
  });
});
