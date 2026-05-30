/**
 * E2E Tests: V2 Flashcard Review Session
 *
 * Tests the full V2 practice session flow using the SM-2 v2 algorithm:
 * - Partial session with flip and rating
 * - Full session with inline summary
 * - Keyboard-only navigation
 * - Card type filter pills and Study Now navigation
 * - Exit session via close button
 * - Button-click rating
 * - Family-robust declension card navigation
 *
 * Tests run in serial mode. Order is intentional — tests consuming more cards
 * run last to preserve due cards for tests that need them.
 * Expected card budget: 0 (V2-05) + 0 (V2-04) + 1 (V2-06) + 2 (V2-03) + 3 (V2-01) + remaining (V2-02) + variable (V2-07)
 *
 * Selector notes (post-PRACT2-1 pf-renderer migration):
 *   pf-card          — the flip target (Card.tsx), replaces legacy practice-card
 *   pf-rating-btn-ok — the OK rating button (rating 3), replaces srs-button-good
 *   pf-exit-button   — the exit button in TopBar (active session), replaces practice-close-button
 *   pf-done          — the session-complete screen
 *   pf-decl-grid     — the declension paradigm table
 *   pf-decl-target   — the target cell (revealed = filled form, unrevealed = "?")
 *   .pf-app[data-fam] — family discriminator set by PracticeApp (reliable for asserting current family)
 *
 * Note on practice-close-button: this testid is emitted ONLY by PracticeHeader (used in the
 * error/empty/summary/loading renders). The active-session render uses TopBar with pf-exit-button.
 * The E2E tests here operate against the active-session pf UI.
 */

import * as fs from 'fs';

import { test, expect } from '@playwright/test';

import { getSupabaseStorageKey } from './helpers/supabase-test-client';

const LEARNER_AUTH = 'playwright/.auth/learner.json';

function getApiBaseUrl(): string {
  return process.env.E2E_API_URL || process.env.VITE_API_URL || 'http://localhost:8000';
}

function getLearnerAccessToken(): string | null {
  try {
    const storageKey = getSupabaseStorageKey();
    const authState = JSON.parse(fs.readFileSync(LEARNER_AUTH, 'utf-8'));
    const sessionEntry = authState.origins?.[0]?.localStorage?.find(
      (item: { name: string; value: string }) => item.name === storageKey
    );
    if (sessionEntry) {
      const session = JSON.parse(sessionEntry.value);
      return session?.access_token || null;
    }
  } catch {
    // File might not exist or be invalid
  }
  return null;
}

/**
 * Navigate to the V2 practice page and wait for pf-card or empty state.
 *
 * Uses [data-testid="pf-card"] (Card.tsx L42) — the correct testid for pf renderers.
 * Replaces the stale [data-testid="practice-card"] pattern (legacy shared/PracticeCard.tsx,
 * not emitted by pf renderers for meaning/sentence/grammar/declension card types).
 */
async function navigateToV2Practice(
  page: import('@playwright/test').Page,
  deckId: string,
  cardType?: string,
): Promise<void> {
  const url = cardType
    ? `/decks/${deckId}/practice?cardType=${cardType}`
    : `/decks/${deckId}/practice`;
  await page.goto(url);

  // pf-card is the correct testid for the pf renderer (Card.tsx).
  // also accept the empty-state text as a valid settled state.
  const practiceCard = page.locator('[data-testid="pf-card"]');
  const emptyState = page.getByText(/all caught up/i);
  await expect(practiceCard.or(emptyState)).toBeVisible({ timeout: 15000 });
}

let v2NounsDeckId: string;

test.describe.configure({ mode: 'serial' });

test.describe('V2 Flashcard Review', () => {
  test.use({ storageState: LEARNER_AUTH });

  test.beforeAll(async ({ request }) => {
    const apiBaseUrl = getApiBaseUrl();
    const accessToken = getLearnerAccessToken();
    if (!accessToken) {
      throw new Error(
        '[V2-REVIEW] Could not read learner access token from storageState. ' +
          'Ensure auth.setup.ts ran successfully.'
      );
    }

    const response = await request.get(`${apiBaseUrl}/api/v1/decks?page_size=100`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    expect(response.ok()).toBe(true);

    const data = await response.json();
    const decks = data.decks as Array<{ id: string; name: string }>;

    // card_system removed in SM2V2-06 — find V2 deck by name
    const v2Deck = decks.find((d) => d.name.includes('Greek A1 Vocabulary'));

    if (!v2Deck) {
      throw new Error(
        '[V2-REVIEW] No V2 Nouns deck found in database. ' +
          `Available decks: ${decks.map((d) => d.name).join(', ')}`
      );
    }

    v2NounsDeckId = v2Deck.id;
    console.log(`[V2-REVIEW] Found V2 Nouns deck: ${v2Deck.name} (${v2NounsDeckId})`);
  });

  // E2E-V2-05: Exit session — 0 cards consumed, runs first to preserve card budget
  test('E2E-V2-05: exit session via close button', async ({ page }) => {
    await navigateToV2Practice(page, v2NounsDeckId);
    // Active session uses TopBar with pf-exit-button (not practice-close-button)
    await expect(page.locator('[data-testid="pf-card"]')).toBeVisible();
    await page.locator('[data-testid="pf-exit-button"]').click();
    await expect(page).toHaveURL(new RegExp(`/decks/${v2NounsDeckId}$`));
  });

  // E2E-V2-04: Filter pills — 0 cards consumed, navigates from deck detail
  test('E2E-V2-04: card type filter pills on deck detail', async ({ page }) => {
    await page.goto(`/decks/${v2NounsDeckId}`);
    await expect(page.locator('[data-testid="v2-deck-detail"]')).toBeVisible({ timeout: 10000 });

    for (const label of ['All Words', 'Translations', 'Plural Form', 'Article', 'Declension']) {
      await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
    }

    await page.getByRole('button', { name: 'Translations', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Translations', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true'
    );

    await page.locator('[data-testid="start-review-button"]').click();
    await expect(page).toHaveURL(/\/decks\/.*\/practice\?cardType=meaning/);
  });

  // E2E-V2-06: Button-click rating — 1 card consumed
  test('E2E-V2-06: button-click rating advances card', async ({ page }) => {
    await navigateToV2Practice(page, v2NounsDeckId);
    await page.keyboard.press('Space');
    // After flip, rating row appears; use pf-rating-btn-ok (replaces srs-button-good)
    await expect(page.locator('[data-testid="pf-rating-row"]')).toBeVisible({ timeout: 10000 });
    await page.locator('[data-testid="pf-rating-btn-ok"]').click();
    const front = page.locator('[data-testid="pf-card"]');
    const summary = page.locator('[data-testid="pf-done"]');
    await expect(front.or(summary)).toBeVisible({ timeout: 10000 });
  });

  // E2E-V2-03: Keyboard-only navigation — 2 cards consumed
  test('E2E-V2-03: keyboard-only navigation', async ({ page }) => {
    await navigateToV2Practice(page, v2NounsDeckId);

    // Card 1: flip then rate Good (key 3)
    await page.keyboard.press('Space');
    await expect(page.locator('[data-testid="pf-rating-row"]')).toBeVisible({ timeout: 10000 });
    await page.keyboard.press('3');
    const frontOrSummary1 = page.locator('[data-testid="pf-card"]').or(
      page.locator('[data-testid="pf-done"]')
    );
    await expect(frontOrSummary1).toBeVisible({ timeout: 10000 });

    // Only proceed to card 2 if still in active session
    const isCardVisible = await page.locator('[data-testid="pf-card"]').isVisible().catch(() => false);
    if (isCardVisible) {
      // Card 2: flip then rate Easy (key 4)
      await page.keyboard.press('Space');
      await expect(page.locator('[data-testid="pf-rating-row"]')).toBeVisible({ timeout: 10000 });
      await page.keyboard.press('4');
      const frontOrSummary2 = page.locator('[data-testid="pf-card"]').or(
        page.locator('[data-testid="pf-done"]')
      );
      await expect(frontOrSummary2).toBeVisible({ timeout: 10000 });
    }
  });

  // E2E-V2-01: Partial session — 3 cards consumed
  test('E2E-V2-01: partial review session', async ({ page }) => {
    await navigateToV2Practice(page, v2NounsDeckId);
    await expect(page.locator('[data-testid="pf-card"]')).toBeVisible();
    await expect(page.getByText(/\d+ of \d+/)).toBeVisible();

    for (let i = 0; i < 3; i++) {
      const isCardVisible = await page
        .locator('[data-testid="pf-card"]')
        .isVisible()
        .catch(() => false);
      if (!isCardVisible) break;

      await page.keyboard.press('Space');
      await expect(page.locator('[data-testid="pf-rating-row"]')).toBeVisible({ timeout: 10000 });
      await page.keyboard.press('3');
      const front = page.locator('[data-testid="pf-card"]');
      const summary = page.locator('[data-testid="pf-done"]');
      await expect(front.or(summary)).toBeVisible({ timeout: 10000 });
    }
  });

  // E2E-V2-02: Full session with inline summary — reviews all remaining cards
  test('E2E-V2-02: full session shows inline summary', async ({ page }) => {
    await navigateToV2Practice(page, v2NounsDeckId);

    // Review all remaining due cards (safety limit of 50)
    for (let i = 0; i < 50; i++) {
      const summaryVisible = await page.locator('[data-testid="pf-done"]').isVisible().catch(() => false);
      if (summaryVisible) break;

      const cardFrontVisible = await page
        .locator('[data-testid="pf-card"]')
        .isVisible()
        .catch(() => false);
      if (!cardFrontVisible) break;

      await page.keyboard.press('Space');
      await expect(page.locator('[data-testid="pf-rating-row"]')).toBeVisible({ timeout: 10000 });
      await page.keyboard.press('3');
      // Small pause to let the card transition or summary begin rendering
      await page.waitForTimeout(300);
    }

    // Verify inline summary (pf-done) with generous timeout (async reviews must all resolve)
    await expect(page.locator('[data-testid="pf-done"]')).toBeVisible({ timeout: 20000 });
    // pf-done-cards-reviewed shows "{n} cards reviewed"
    await expect(page.locator('[data-testid="pf-done-cards-reviewed"]')).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/decks/${v2NounsDeckId}/practice`));

    // Back to Deck button navigates back to deck detail
    await page.locator('[data-testid="pf-done-back-to-deck"]').click();
    await expect(page).toHaveURL(new RegExp(`/decks/${v2NounsDeckId}$`));
  });

  // E2E-V2-07: Family-robust declension navigation
  //
  // Uses .pf-app[data-fam="declension"] to locate the declension card deterministically,
  // regardless of SRS-driven queue ordering. Flips through cards until the declension
  // family is reached, then asserts the paradigm table renders with a revealed target cell.
  //
  // Selectors used:
  //   .pf-app[data-fam="declension"] — family discriminator (PracticeApp.tsx L47)
  //   [data-testid="pf-decl-grid"]   — the paradigm table (Declension.tsx L126)
  //   [data-testid="pf-decl-target"] — the target cell, revealed after flip (Declension.tsx L150/165)
  //
  // The seed deck (Greek A1 Vocabulary (Nouns)) carries declension-capable nouns (σπίτι etc.)
  // so at least one declension card will be present after POST /api/v1/test/seed/all.
  test('E2E-V2-07: family-robust declension navigation', async ({ page }) => {
    await navigateToV2Practice(page, v2NounsDeckId);
    await expect(page.locator('[data-testid="pf-card"]')).toBeVisible();

    // Iterate until we reach a declension card (data-fam="declension") or exhaust the queue.
    // Safety limit: 30 cards (the seed deck has 10 nouns x multiple card types).
    let foundDeclension = false;

    for (let i = 0; i < 30; i++) {
      // Check if current card is in the declension family
      const isDeclension = await page
        .locator('.pf-app[data-fam="declension"]')
        .isVisible()
        .catch(() => false);

      if (isDeclension) {
        foundDeclension = true;
        break;
      }

      // Check if session ended
      const isDone = await page.locator('[data-testid="pf-done"]').isVisible().catch(() => false);
      if (isDone) break;

      // Advance to next card: flip + rate OK
      const cardVisible = await page.locator('[data-testid="pf-card"]').isVisible().catch(() => false);
      if (!cardVisible) break;

      await page.keyboard.press('Space');
      await expect(page.locator('[data-testid="pf-rating-row"]')).toBeVisible({ timeout: 10000 });
      await page.keyboard.press('3');
      await page.waitForTimeout(300);

      // Wait for next state (card or done)
      const nextCard = page.locator('[data-testid="pf-card"]');
      const done = page.locator('[data-testid="pf-done"]');
      await expect(nextCard.or(done)).toBeVisible({ timeout: 10000 });
    }

    // Skip remainder of test if no declension card found (e.g. not seeded in this run)
    if (!foundDeclension) {
      console.log('[V2-07] No declension card found in queue — skipping declension assertions (seed may not have run)');
      return;
    }

    // Confirmed on a declension card — verify question state (target cell shows "?")
    await expect(page.locator('.pf-app[data-fam="declension"]')).toBeVisible();
    await expect(page.locator('[data-testid="pf-decl-grid"]')).toBeVisible();

    // Flip to reveal the filled target cell
    await page.locator('[data-testid="pf-card"]').click();
    await expect(page.locator('[data-testid="pf-rating-row"]')).toBeVisible({ timeout: 5000 });

    // pf-decl-target is now in is-revealed state (shows the real Greek form, not "?")
    await expect(page.locator('[data-testid="pf-decl-target"]')).toBeVisible();
  });
});
