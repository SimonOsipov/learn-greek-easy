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

    // Find "E2E V2 Nouns Deck (A1)"
    const decksResp = await request.get(`${apiBaseUrl}/api/v1/decks?page_size=100`, { headers });
    if (!decksResp.ok()) {
      throw new Error(`[WCRD] Failed to fetch decks: ${decksResp.status()}`);
    }
    const decksData = await decksResp.json();
    const v2Deck = (decksData.decks ?? []).find(
      (d: { name: string }) => d.name === 'E2E V2 Nouns Deck (A1)'
    );
    if (!v2Deck) {
      throw new Error('[WCRD] Could not find "E2E V2 Nouns Deck (A1)" deck. Ensure seed data is loaded.');
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
      throw new Error('[WCRD] No word entries found in E2E V2 Nouns Deck (A1).');
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
    await expect(page.locator('[data-testid^="card-item-"]').first()).toBeVisible();
  });

  test('WCRD-E2E-03: tap card expands and collapses front content', async ({ page }) => {
    await navigateToWordReference(page);
    await page.getByTestId('word-reference-tab-cards').click();
    await expect(page.getByTestId('cards-summary-bar')).toBeVisible({ timeout: 10000 });

    const firstCard = page.locator('[data-testid^="card-item-"]').first();
    await expect(firstCard).toHaveAttribute('data-state', 'closed');

    await firstCard.locator('button').first().click();
    await expect(firstCard).toHaveAttribute('data-state', 'open');

    await firstCard.locator('button').first().click();
    await expect(firstCard).toHaveAttribute('data-state', 'closed');
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
