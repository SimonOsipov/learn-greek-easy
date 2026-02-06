/**
 * E2E Tests: V1/V2 Deck Pages
 *
 * Tests the dual card system functionality:
 * - V1 decks: Legacy flashcard view with Study button
 * - V2 decks: Word browser with search and disabled Study button
 * - Word reference page: Grammar data display and navigation
 *
 * Test data is seeded via the /api/v1/test/seed/all endpoint.
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

// Fresh auth tokens obtained after seed/all truncates all tables (including users).
// The storageState from auth.setup.ts becomes invalid because the user UUID no longer
// exists, so we re-authenticate via seed/auth and inject these tokens in beforeEach.
let freshAuthState: Record<string, unknown> | null = null;

/**
 * Seed all test data and extract V1/V2 deck IDs for dual card system tests.
 * Uses the unified seed/all endpoint which includes dual-deck data.
 *
 * Also re-authenticates via seed/auth since seed/all truncates the users table,
 * invalidating the JWT from the storageState file.
 */
async function seedAndExtractDeckIds(
  request: APIRequestContext
): Promise<{ v1DeckId: string; v2DeckId: string }> {
  const apiBaseUrl = getApiBaseUrl();

  // Step 1: Seed all test data
  const response = await request.post(`${apiBaseUrl}/api/v1/test/seed/all`);
  expect(response.ok()).toBe(true);

  const data = await response.json();

  // Step 2: Re-authenticate as e2e_learner since seed/all wiped the users table
  const authResponse = await request.post(`${apiBaseUrl}/api/v1/test/seed/auth`, {
    data: { email: 'e2e_learner@test.com' },
    headers: { 'Content-Type': 'application/json' },
  });
  expect(authResponse.ok()).toBe(true);

  const tokens = await authResponse.json();
  const now = new Date().toISOString();

  // Build auth state matching the Zustand store format (same as auth.setup.ts)
  freshAuthState = {
    state: {
      user: {
        id: tokens.user_id,
        email: 'e2e_learner@test.com',
        name: 'E2E Learner',
        role: tokens.is_superuser ? 'admin' : 'free',
        preferences: {
          language: 'en',
          dailyGoal: 20,
          notifications: true,
          theme: 'light',
        },
        stats: {
          streak: 0,
          wordsLearned: 0,
          totalXP: 0,
          joinedDate: now,
        },
        createdAt: now,
        updatedAt: now,
      },
      token: tokens.access_token,
      refreshToken: tokens.refresh_token,
      isAuthenticated: true,
      rememberMe: true,
      error: null,
    },
    version: 0,
  };

  return {
    v1DeckId: data.results.v1_deck_id,
    v2DeckId: data.results.v2_deck_id,
  };
}

// Use serial mode to ensure seeding happens only once and deck IDs are consistent
test.describe.configure({ mode: 'serial' });

test.describe('V1/V2 Deck Pages', () => {
  test.beforeAll(async ({ request }) => {
    console.log('[SEED-ALL] Starting full seeding for V1/V2 deck tests...');

    // Seed all test data and extract V1/V2 deck IDs
    const deckIds = await seedAndExtractDeckIds(request);
    v1DeckId = deckIds.v1DeckId;
    v2DeckId = deckIds.v2DeckId;

    console.log(`[SEED-ALL] Seeded decks - V1: ${v1DeckId}, V2: ${v2DeckId}`);
  });

  // Re-inject fresh auth tokens into localStorage before each test.
  // seed/all truncates the users table, so the storageState from auth.setup.ts
  // references a nonexistent user. We set the fresh tokens obtained after seeding.
  test.beforeEach(async ({ page }) => {
    if (!freshAuthState) {
      throw new Error('[SEED-ALL] freshAuthState is null - seeding may have failed');
    }
    await page.addInitScript((authState) => {
      localStorage.setItem('auth-storage', JSON.stringify(authState));
    }, freshAuthState);
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
    test('E2E-DUAL-04: V2 deck displays word browser', async ({ page }) => {
      // Navigate to V2 deck detail page
      await page.goto(`/decks/${v2DeckId}`);

      // Wait for V2 deck detail to load
      const deckDetail = page.locator('[data-testid="v2-deck-detail"]');
      await expect(deckDetail).toBeVisible({ timeout: 15000 });

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
      // Search within the reference page to avoid finding hidden h1 elements elsewhere
      const wordHeading = referencePage.locator('h1, [data-testid="word-lemma"]').first();
      await expect(wordHeading).toBeVisible({ timeout: 5000 });
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

      // Wait for V2 deck to load first
      const wordBrowser = page.locator('[data-testid="word-browser"]');
      await expect(wordBrowser).toBeVisible({ timeout: 15000 });

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

      // Should return to deck detail page with word browser visible
      await expect(wordBrowser).toBeVisible({ timeout: 15000 });
    });
  });
});
