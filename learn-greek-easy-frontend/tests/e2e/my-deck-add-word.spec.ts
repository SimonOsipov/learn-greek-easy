/**
 * My Deck Add Word E2E Tests
 *
 * Tests the "add word to my deck" flow from word reference pages:
 * - Add a word to a personal deck via the add-to-deck modal
 * - See the word inside the personal deck (same V2 deck page as public decks)
 * - Remove the word again and see the empty-deck hint
 * - Empty modal state for users with no decks
 *
 * Test Users:
 * - e2e_learner: Has 3 user-owned decks (My Greek Basics, Travel Phrases, Practice Deck)
 * - e2e_beginner: Has 0 user-owned decks (empty state)
 *
 * The flow is self-cleaning: every added word is removed at the end so the
 * seeded personal decks stay empty for other tests.
 */

import { test, expect, type Page } from '@playwright/test';

const LEARNER_AUTH = 'playwright/.auth/learner.json';
const BEGINNER_AUTH = 'playwright/.auth/beginner.json';

const PUBLIC_DECK_NAME = 'Greek A1 Vocabulary (Nouns)';
const TARGET_DECK_NAME = 'Travel Phrases';

/** Open the first word of a public deck and return its lemma. */
async function openFirstWordOfPublicDeck(page: Page): Promise<string> {
  await page.goto('/decks');

  const publicDeckCard = page
    .locator('[data-testid="deck-card"]')
    .filter({ hasText: PUBLIC_DECK_NAME });
  await expect(publicDeckCard).toBeVisible({ timeout: 15000 });
  await publicDeckCard.click();

  // V2 deck page word browser
  const firstWordCard = page.locator('[data-testid="word-card"]').first();
  await expect(firstWordCard).toBeVisible({ timeout: 15000 });
  const lemma = (
    await firstWordCard.locator('[data-testid="word-card-lemma"]').textContent()
  )?.trim();
  expect(lemma).toBeTruthy();

  await firstWordCard.click();
  await page.waitForURL(/\/decks\/[a-f0-9-]+\/words\/[a-f0-9-]+/i);
  await expect(page.locator('[data-testid="word-hero"]')).toBeVisible({ timeout: 15000 });

  return lemma as string;
}

/** Open the add-to-deck modal from the word reference page. */
async function openAddToDeckModal(page: Page) {
  await page.locator('[data-testid="add-to-deck-button"]').click();
  const modal = page.locator('[data-testid="add-to-deck-modal"]');
  await expect(modal).toBeVisible({ timeout: 5000 });
  return modal;
}

/**
 * Ensure the target deck row does NOT contain the word (cleanup from
 * earlier retries). Returns the row locator.
 */
async function normalizeDeckRow(page: Page) {
  const row = page
    .locator('[data-testid^="add-to-deck-row-"]')
    .filter({ hasText: TARGET_DECK_NAME });
  await expect(row).toBeVisible({ timeout: 10000 });

  if (await row.getByText('Added', { exact: true }).isVisible()) {
    await row.click();
    await expect(page.getByText(/Removed from/)).toBeVisible({ timeout: 10000 });
    await expect(row.getByText('Add', { exact: true })).toBeVisible({ timeout: 10000 });
  }
  return row;
}

test.describe('My Deck - Add Word from Word Page', () => {
  test.use({ storageState: LEARNER_AUTH });

  test('add word to personal deck, see it in the deck, then remove it', async ({ page }) => {
    // 1. Open a word from a public seeded deck
    const lemma = await openFirstWordOfPublicDeck(page);

    // 2. Open the add-to-deck modal — all 3 seeded personal decks are listed
    await openAddToDeckModal(page);
    const deckRows = page.locator('[data-testid^="add-to-deck-row-"]');
    await expect(deckRows).toHaveCount(3, { timeout: 10000 });

    // 3. Add the word to "Travel Phrases" (normalize first for retry safety)
    const targetRow = await normalizeDeckRow(page);
    await targetRow.click();
    await expect(page.getByText(/Added to/)).toBeVisible({ timeout: 10000 });
    await expect(targetRow.getByText('Added', { exact: true })).toBeVisible({ timeout: 10000 });

    // 4. Close the modal and open the personal deck — same V2 deck page as public decks
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="add-to-deck-modal"]')).not.toBeVisible();

    await page.goto('/my-decks');
    const myDeckCard = page
      .locator('[data-testid="deck-card"]')
      .filter({ hasText: TARGET_DECK_NAME });
    await expect(myDeckCard).toBeVisible({ timeout: 15000 });
    await myDeckCard.click();
    await page.waitForURL(/\/decks\/[a-f0-9-]+/i);

    // The added word renders in the personal deck's word browser
    const addedWordCard = page.locator('[data-testid="word-card"]').filter({ hasText: lemma });
    await expect(addedWordCard).toBeVisible({ timeout: 15000 });

    // 5. Remove the word again from its word page (cleanup + remove flow)
    await addedWordCard.click();
    await page.waitForURL(/\/decks\/[a-f0-9-]+\/words\/[a-f0-9-]+/i);
    await openAddToDeckModal(page);

    const rowAfter = page
      .locator('[data-testid^="add-to-deck-row-"]')
      .filter({ hasText: TARGET_DECK_NAME });
    await expect(rowAfter.getByText('Added', { exact: true })).toBeVisible({ timeout: 10000 });
    await rowAfter.click();
    await expect(page.getByText(/Removed from/)).toBeVisible({ timeout: 10000 });
    await expect(rowAfter.getByText('Add', { exact: true })).toBeVisible({ timeout: 10000 });

    // 6. The personal deck is empty again and shows the add-words hint
    await page.keyboard.press('Escape');
    await page.goto('/my-decks');
    await expect(myDeckCard).toBeVisible({ timeout: 15000 });
    await myDeckCard.click();
    await page.waitForURL(/\/decks\/[a-f0-9-]+/i);
    await expect(page.getByText('No words in this deck yet')).toBeVisible({ timeout: 15000 });
  });
});

test.describe('My Deck - Add Word Empty State', () => {
  test.use({ storageState: BEGINNER_AUTH });

  test('user with no decks sees create-deck CTA in the modal', async ({ page }) => {
    await openFirstWordOfPublicDeck(page);
    await openAddToDeckModal(page);

    // Beginner has no personal decks — empty state with CTA
    await expect(page.locator('[data-testid="add-to-deck-empty"]')).toBeVisible({
      timeout: 10000,
    });

    await page.getByRole('button', { name: 'Create a deck' }).click();

    // CTA navigates to My Decks where the user can create a deck
    await expect(page).toHaveURL(/\/my-decks$/, { timeout: 10000 });
  });
});
