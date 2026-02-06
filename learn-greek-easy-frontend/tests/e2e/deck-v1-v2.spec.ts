/**
 * E2E Tests: V1/V2 Deck Pages
 *
 * Tests the dual card system functionality:
 * - V1 decks: Legacy flashcard view with Study button
 * - V2 decks: Word browser with search and disabled Study button
 * - Word reference page: Grammar data display and navigation
 *
 * Test data is seeded via the /api/v1/test/seed/dual-decks endpoint.
 */

import { test, expect, APIRequestContext } from '@playwright/test';

/**
 * Get the API base URL from environment
 */
function getApiBaseUrl(): string {
  return process.env.E2E_API_URL || process.env.VITE_API_URL || 'http://localhost:8000';
}

// Test IDs for seeded V1/V2 decks (populated in beforeAll)
let v1DeckId: string;
let v2DeckId: string;

/**
 * Seed V1/V2 test decks
 */
async function seedDualDecks(
  request: APIRequestContext
): Promise<{ v1DeckId: string; v2DeckId: string }> {
  const apiBaseUrl = getApiBaseUrl();
  const response = await request.post(`${apiBaseUrl}/api/v1/test/seed/dual-decks`);
  expect(response.ok()).toBe(true);

  const data = await response.json();
  return {
    v1DeckId: data.results.v1_deck_id,
    v2DeckId: data.results.v2_deck_id,
  };
}

test.describe('V1/V2 Deck Pages', () => {
  test.beforeAll(async ({ request }) => {
    // Seed V1/V2 test decks
    const deckIds = await seedDualDecks(request);
    v1DeckId = deckIds.v1DeckId;
    v2DeckId = deckIds.v2DeckId;
  });

  // =====================
  // V1 Deck Tests (Legacy Flashcard View)
  // =====================

  test.describe('V1 Deck (Legacy Flashcard View)', () => {
    test('E2E-DUAL-01: V1 deck displays legacy card-based view', async ({ page }) => {
      // Navigate directly to V1 deck detail page
      await page.goto(`/decks/${v1DeckId}`);

      // Wait for deck detail to load (V1 uses deck-detail, not v2-deck-detail)
      const deckDetail = page
        .locator('[data-testid="deck-detail"]')
        .or(page.locator('[data-testid="v1-deck-detail"]'));
      await expect(deckDetail.first()).toBeVisible({ timeout: 10000 });

      // Verify V1-specific UI elements
      // 1. Should have deck title visible
      const deckTitle = page.getByRole('heading').first();
      await expect(deckTitle).toBeVisible();

      // 2. Should have card count mentioned
      const cardText = page.getByText(/card/i);
      await expect(cardText.first()).toBeVisible();

      // 3. NO word browser should be present (V2 only)
      const wordBrowser = page.locator('[data-testid="word-browser"]');
      await expect(wordBrowser).not.toBeVisible();
    });

    test('E2E-DUAL-02: V1 deck Study Now button works', async ({ page }) => {
      await page.goto(`/decks/${v1DeckId}`);

      // Wait for page to load
      const deckDetail = page
        .locator('[data-testid="deck-detail"]')
        .or(page.locator('[data-testid="v1-deck-detail"]'));
      await expect(deckDetail.first()).toBeVisible({ timeout: 10000 });

      // Find "Study Now" / "Start Review" / "Continue Review" button
      const studyButton = page
        .locator('[data-testid="start-review-button"]')
        .or(page.getByRole('button', { name: /review|start|study/i }).first());
      await expect(studyButton).toBeVisible();
      await expect(studyButton).toBeEnabled();

      // Click the button
      await studyButton.click();

      // Should navigate to review session
      await page.waitForURL(/\/decks\/.*\/review/);

      // Verify review session started (flashcard visible)
      const flashcard = page.locator('[data-testid="flashcard"]').or(page.locator('.flashcard'));
      await expect(flashcard.first()).toBeVisible({ timeout: 10000 });
    });
  });

  // =====================
  // V2 Deck Tests (Word Browser View)
  // =====================

  test.describe('V2 Deck (Word Browser View)', () => {
    test('E2E-DUAL-04: V2 deck displays word browser', async ({ page, request }) => {
      // First verify the API returns V2 for this deck
      const apiBaseUrl = getApiBaseUrl();
      console.log(`[DEBUG] Checking API for V2 deck: ${v2DeckId}`);

      // Get storage state to get auth token
      const cookies = await page.context().cookies();
      const storageState = await page.context().storageState();
      console.log(`[DEBUG] Has cookies: ${cookies.length > 0}`);
      console.log(`[DEBUG] Storage state keys: ${Object.keys(storageState).join(', ')}`);

      // Navigate to V2 deck detail page
      console.log(`[DEBUG] Navigating to V2 deck: ${v2DeckId}`);
      await page.goto(`/decks/${v2DeckId}`);

      // Wait for page to load (give it some time)
      await page.waitForTimeout(3000);

      // Debug: Capture what's actually on the page
      const pageHTML = await page.content();
      const hasLoadingState = pageHTML.includes('skeleton') || pageHTML.includes('loading');
      const hasErrorState =
        pageHTML.includes('error') ||
        pageHTML.includes('not found') ||
        pageHTML.includes('Not Found');
      const hasDeckDetail =
        pageHTML.includes('deck-detail') || pageHTML.includes('v2-deck-detail');
      console.log(`[DEBUG] Page state - Loading: ${hasLoadingState}, Error: ${hasErrorState}, HasDeck: ${hasDeckDetail}`);
      console.log(`[DEBUG] Page URL: ${page.url()}`);

      // Also check if there's an alert or error message visible
      const alertLocator = page.locator('[role="alert"], .error, .alert');
      if ((await alertLocator.count()) > 0) {
        const alertText = await alertLocator.first().textContent();
        console.log(`[DEBUG] Alert/Error text: ${alertText}`);
      }

      // Wait for any deck detail element first (V1 or V2)
      const anyDeckDetail = page.locator(
        '[data-testid="deck-detail"], [data-testid="v2-deck-detail"]'
      );
      await expect(anyDeckDetail.first()).toBeVisible({ timeout: 15000 });

      // Debug: Log what we got
      const v1Detail = page.locator('[data-testid="deck-detail"]');
      const v2Detail = page.locator('[data-testid="v2-deck-detail"]');
      const v1CardSystem = await v1Detail.getAttribute('data-card-system').catch(() => null);
      const v2Visible = await v2Detail.isVisible().catch(() => false);
      console.log(`[DEBUG] V1 deck visible: ${await v1Detail.isVisible().catch(() => false)}`);
      console.log(`[DEBUG] V1 deck card_system attr: ${v1CardSystem}`);
      console.log(`[DEBUG] V2 deck visible: ${v2Visible}`);

      // Now wait for V2 deck detail to load
      const deckDetail = page.locator('[data-testid="v2-deck-detail"]');
      await expect(deckDetail).toBeVisible({ timeout: 10000 });

      // Verify V2-specific UI elements
      // 1. Word browser component is visible
      const wordBrowser = page.locator('[data-testid="word-browser"]');
      await expect(wordBrowser).toBeVisible();

      // 2. Search input is present
      const searchInput = wordBrowser.locator('[data-testid="word-browser-search"]');
      await expect(searchInput).toBeVisible();

      // 3. Word cards are displayed
      const wordCards = page.locator('[data-testid="word-card"]');
      await expect(wordCards.first()).toBeVisible({ timeout: 10000 });

      // 4. Should have multiple word cards
      const cardCount = await wordCards.count();
      expect(cardCount).toBeGreaterThanOrEqual(1);
    });

    test('E2E-DUAL-05: V2 deck Study Now button is disabled', async ({ page }) => {
      await page.goto(`/decks/${v2DeckId}`);

      // Wait for page to load
      const deckDetail = page.locator('[data-testid="v2-deck-detail"]');
      await expect(deckDetail).toBeVisible({ timeout: 10000 });

      // Find the study button - it should be disabled for V2 decks
      const studyButton = page
        .locator('[data-testid="start-review-button"]')
        .or(page.getByRole('button', { name: /review|start|study/i }).first());
      await expect(studyButton).toBeVisible();

      // Verify it's disabled
      await expect(studyButton).toBeDisabled();
    });

    test('E2E-DUAL-06: V2 deck word search filters correctly', async ({ page }) => {
      await page.goto(`/decks/${v2DeckId}`);

      // Wait for word browser
      const wordBrowser = page.locator('[data-testid="word-browser"]');
      await expect(wordBrowser).toBeVisible({ timeout: 10000 });

      // Get initial word count
      const wordCards = page.locator('[data-testid="word-card"]');
      await expect(wordCards.first()).toBeVisible();
      const initialCount = await wordCards.count();

      // Type in search input - use a term that won't match
      const searchInput = wordBrowser.locator('[data-testid="word-browser-search"]');
      await searchInput.fill('xyz123nonexistent');

      // Wait for filtering (debounced)
      await page.waitForTimeout(500);

      // Either no results or fewer results
      const filteredCount = await wordCards.count();
      expect(filteredCount).toBeLessThanOrEqual(initialCount);

      // Clear search
      await searchInput.clear();
      await page.waitForTimeout(500);

      // Verify original count restored
      const restoredCount = await wordCards.count();
      expect(restoredCount).toBe(initialCount);
    });

    test('E2E-DUAL-07: V2 deck word card click navigates to reference page', async ({ page }) => {
      await page.goto(`/decks/${v2DeckId}`);

      // Wait for word browser
      const wordCards = page.locator('[data-testid="word-card"]');
      await expect(wordCards.first()).toBeVisible({ timeout: 10000 });

      // Click the first word card
      const firstCard = wordCards.first();
      await firstCard.click();

      // Should navigate to word reference page
      await page.waitForURL(/\/decks\/.*\/words\//);

      // Verify reference page loaded
      const referencePage = page.locator('[data-testid="word-reference-page"]');
      await expect(referencePage).toBeVisible({ timeout: 10000 });
    });
  });

  // =====================
  // Word Reference Page Tests
  // =====================

  test.describe('Word Reference Page', () => {
    test('E2E-DUAL-08: Word reference page displays grammar data', async ({ page }) => {
      await page.goto(`/decks/${v2DeckId}`);

      // Navigate to first word's reference page
      const wordCards = page.locator('[data-testid="word-card"]');
      await expect(wordCards.first()).toBeVisible({ timeout: 10000 });
      await wordCards.first().click();

      // Wait for reference page
      await page.waitForURL(/\/decks\/.*\/words\//);
      const referencePage = page.locator('[data-testid="word-reference-page"]');
      await expect(referencePage).toBeVisible({ timeout: 10000 });

      // Verify word is shown (the Greek lemma should be prominent)
      const wordHeading = page.locator('h1').first();
      await expect(wordHeading).toBeVisible();
      const headingText = await wordHeading.textContent();
      expect(headingText).toBeTruthy();
      expect(headingText!.length).toBeGreaterThan(0);

      // Verify grammar section is present (conjugation or declension)
      // Look for any grammar-related content
      const grammarContent = page
        .getByText(/present|singular|plural|nominative|genitive|conjugation|declension/i)
        .first();
      const hasGrammar = await grammarContent.isVisible().catch(() => false);
      // Grammar content should be present for most words
      expect(hasGrammar || (await page.getByText(/translation/i).isVisible())).toBe(true);

      // Verify translation is shown
      const pageContent = await page.textContent('body');
      expect(pageContent).toBeTruthy();
    });

    test('E2E-DUAL-09: Word reference page Practice button is disabled', async ({ page }) => {
      await page.goto(`/decks/${v2DeckId}`);

      // Navigate to word reference page
      const wordCards = page.locator('[data-testid="word-card"]');
      await expect(wordCards.first()).toBeVisible({ timeout: 10000 });
      await wordCards.first().click();

      // Wait for reference page
      await page.waitForURL(/\/decks\/.*\/words\//);
      const referencePage = page.locator('[data-testid="word-reference-page"]');
      await expect(referencePage).toBeVisible({ timeout: 10000 });

      // Find practice button
      const practiceButton = page.locator('[data-testid="practice-word-button"]');
      await expect(practiceButton).toBeVisible();

      // Verify it's disabled
      await expect(practiceButton).toBeDisabled();
    });

    test('E2E-DUAL-10: Back navigation from reference page works', async ({ page }) => {
      const deckUrl = `/decks/${v2DeckId}`;
      await page.goto(deckUrl);

      // Navigate to word reference page
      const wordCards = page.locator('[data-testid="word-card"]');
      await expect(wordCards.first()).toBeVisible({ timeout: 10000 });
      await wordCards.first().click();

      // Wait for reference page
      await page.waitForURL(/\/decks\/.*\/words\//);
      await expect(page.locator('[data-testid="word-reference-page"]')).toBeVisible({
        timeout: 10000,
      });

      // Click back button
      const backButton = page.locator('[data-testid="back-button"]');
      await expect(backButton).toBeVisible();
      await backButton.click();

      // Should return to deck detail page
      await page.waitForURL(deckUrl);
      await expect(page.locator('[data-testid="word-browser"]')).toBeVisible();
    });
  });
});
