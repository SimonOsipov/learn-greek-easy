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
 *
 * Tests run in serial mode. Order is intentional — tests consuming more cards
 * run last to preserve due cards for tests that need them.
 * Expected card budget: 0 (V2-05) + 0 (V2-04) + 1 (V2-06) + 2 (V2-03) + 3 (V2-01) + remaining (V2-02)
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

async function navigateToV2Practice(
  page: import('@playwright/test').Page,
  deckId: string,
  cardType?: string,
): Promise<void> {
  const url = cardType
    ? `/decks/${deckId}/practice?cardType=${cardType}`
    : `/decks/${deckId}/practice`;
  await page.goto(url);

  const practiceCard = page.locator('[data-testid="practice-card"]');
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
    const decks = data.decks as Array<{ id: string; card_system: string; name: string }>;

    const v2Deck = decks.find(
      (d) => d.card_system === 'V2' && d.name.includes('V2 Nouns')
    );

    if (!v2Deck) {
      throw new Error(
        '[V2-REVIEW] No V2 Nouns deck found in database. ' +
          `Available decks: ${decks.map((d) => `${d.name} (${d.card_system})`).join(', ')}`
      );
    }

    v2NounsDeckId = v2Deck.id;
    console.log(`[V2-REVIEW] Found V2 Nouns deck: ${v2Deck.name} (${v2NounsDeckId})`);
  });

  // E2E-V2-05: Exit session — 0 cards consumed, runs first to preserve card budget
  test('E2E-V2-05: exit session via close button', async ({ page }) => {
    await navigateToV2Practice(page, v2NounsDeckId);
    await expect(page.locator('[data-testid="practice-card"]')).toBeVisible();
    await page.locator('[data-testid="practice-close-button"]').click();
    await expect(page).toHaveURL(new RegExp(`/decks/${v2NounsDeckId}$`));
  });

  // E2E-V2-04: Filter pills — 0 cards consumed, navigates from deck detail
  test('E2E-V2-04: card type filter pills on deck detail', async ({ page }) => {
    await page.goto(`/decks/${v2NounsDeckId}`);
    await expect(page.locator('[data-testid="v2-deck-detail"]')).toBeVisible({ timeout: 10000 });

    for (const label of ['All', 'Translation', 'Sentence', 'Plural Form', 'Article']) {
      await expect(page.getByRole('button', { name: label })).toBeVisible();
    }

    await page.getByRole('button', { name: 'Translation' }).click();
    await expect(page.getByRole('button', { name: 'Translation' })).toHaveAttribute(
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
    await expect(page.locator('[data-testid="practice-card-back"]')).toBeVisible({ timeout: 5000 });
    await page.locator('[data-testid="srs-button-good"]').click();
    const front = page.locator('[data-testid="practice-card-front"]');
    const summary = page.getByText(/cards reviewed/i);
    await expect(front.or(summary)).toBeVisible({ timeout: 5000 });
  });

  // E2E-V2-03: Keyboard-only navigation — 2 cards consumed
  test('E2E-V2-03: keyboard-only navigation', async ({ page }) => {
    await navigateToV2Practice(page, v2NounsDeckId);

    // Card 1: flip then rate Good
    await page.keyboard.press('Space');
    await expect(page.locator('[data-testid="practice-card-back"]')).toBeVisible({ timeout: 5000 });
    await page.keyboard.press('3');
    const frontOrSummary1 = page.locator('[data-testid="practice-card-front"]').or(
      page.getByText(/cards reviewed/i)
    );
    await expect(frontOrSummary1).toBeVisible({ timeout: 5000 });

    // Only proceed to card 2 if still in active session
    const isCardVisible = await page.locator('[data-testid="practice-card-front"]').isVisible().catch(() => false);
    if (isCardVisible) {
      // Card 2: flip then rate Easy
      await page.keyboard.press('Space');
      await expect(page.locator('[data-testid="practice-card-back"]')).toBeVisible({ timeout: 5000 });
      await page.keyboard.press('4');
      const frontOrSummary2 = page.locator('[data-testid="practice-card-front"]').or(
        page.getByText(/cards reviewed/i)
      );
      await expect(frontOrSummary2).toBeVisible({ timeout: 5000 });
    }
  });

  // E2E-V2-01: Partial session — 3 cards consumed
  test('E2E-V2-01: partial review session', async ({ page }) => {
    await navigateToV2Practice(page, v2NounsDeckId);
    await expect(page.locator('[data-testid="practice-card"]')).toBeVisible();
    await expect(page.getByText(/\d+ of \d+/)).toBeVisible();

    for (let i = 0; i < 3; i++) {
      const isCardVisible = await page
        .locator('[data-testid="practice-card-front"]')
        .isVisible()
        .catch(() => false);
      if (!isCardVisible) break;

      await page.keyboard.press('Space');
      await expect(page.locator('[data-testid="practice-card-back"]')).toBeVisible({ timeout: 5000 });
      await page.keyboard.press('3');
      const front = page.locator('[data-testid="practice-card-front"]');
      const summary = page.getByText(/cards reviewed/i);
      await expect(front.or(summary)).toBeVisible({ timeout: 5000 });
    }
  });

  // E2E-V2-02: Full session with inline summary — reviews all remaining cards
  test('E2E-V2-02: full session shows inline summary', async ({ page }) => {
    await navigateToV2Practice(page, v2NounsDeckId);

    // Review all remaining due cards (safety limit of 50)
    for (let i = 0; i < 50; i++) {
      const summaryVisible = await page.getByText(/cards reviewed/i).isVisible().catch(() => false);
      if (summaryVisible) break;

      const cardFrontVisible = await page
        .locator('[data-testid="practice-card-front"]')
        .isVisible()
        .catch(() => false);
      if (!cardFrontVisible) break;

      await page.keyboard.press('Space');
      await expect(page.locator('[data-testid="practice-card-back"]')).toBeVisible({ timeout: 5000 });
      await page.keyboard.press('3');
      const front = page.locator('[data-testid="practice-card-front"]');
      const summary = page.getByText(/cards reviewed/i);
      await expect(front.or(summary)).toBeVisible({ timeout: 5000 });
    }

    // Verify inline summary (URL stays on /practice, no separate /summary route)
    await expect(page.getByText(/cards reviewed/i)).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(new RegExp(`/decks/${v2NounsDeckId}/practice`));

    // Back to Deck button navigates back to deck detail
    await page.getByRole('button', { name: /back to deck/i }).click();
    await expect(page).toHaveURL(new RegExp(`/decks/${v2NounsDeckId}$`));
  });
});
