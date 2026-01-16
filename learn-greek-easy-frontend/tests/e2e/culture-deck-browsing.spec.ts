import { test, expect } from '@playwright/test';

/**
 * Culture Deck Browsing E2E Tests
 *
 * These tests verify the culture deck integration in the decks page.
 * The tests use the pre-authenticated learner user from auth.setup.ts.
 *
 * NOTE: Do NOT add beforeEach seed calls - the auth setup already seeds
 * the database and authenticates users. Re-seeding would invalidate
 * the cached auth tokens since user UUIDs would change.
 */
test.describe('Culture Deck Browsing', () => {
  test('should display culture decks in deck list', async ({ page }) => {
    await page.goto('/decks');

    // Wait for decks to load
    await expect(page.locator('[data-testid="deck-card"]').first()).toBeVisible({ timeout: 15000 });

    // Click on culture filter button (use exact match to avoid matching deck cards)
    await page.getByRole('button', { name: 'Culture', exact: true }).click();

    // Wait for filtered results - culture badge should be visible
    const cultureBadge = page.locator('[data-testid="culture-badge"]');
    await expect(cultureBadge.first()).toBeVisible({ timeout: 5000 });

    const deckCards = page.locator('[data-testid="deck-card"]');
    await expect(deckCards.first()).toBeVisible();
  });

  test('should navigate to culture deck detail', async ({ page }) => {
    await page.goto('/decks');

    // Wait for decks to load
    await expect(page.locator('[data-testid="deck-card"]').first()).toBeVisible({ timeout: 15000 });

    // Click on culture filter button (use exact match to avoid matching deck cards)
    await page.getByRole('button', { name: 'Culture', exact: true }).click();

    // Wait for filtered results - culture badge should be visible
    const cultureBadge = page.locator('[data-testid="culture-badge"]');
    await expect(cultureBadge.first()).toBeVisible({ timeout: 5000 });

    // Click on a non-premium culture deck to avoid premium lock blocking navigation
    const deckCards = page.locator('[data-testid="deck-card"]');
    const nonPremiumDeck = deckCards.filter({
      hasNot: page.locator('[aria-label="Premium locked"]'),
    }).first();
    await nonPremiumDeck.click();

    await expect(page).toHaveURL(/\/culture\/decks\//);
    await expect(page.getByTestId('deck-detail')).toBeVisible();
  });

  test('should show deck cards with progress bar on decks page', async ({ page }) => {
    // User is already authenticated via storageState (learner user)
    await page.goto('/decks');

    // Wait for decks to load (with retry for rate limiting)
    await expect(page.locator('[data-testid="deck-card"]').first()).toBeVisible({ timeout: 30000 });

    // The progress bar is rendered inside deck cards (DeckProgressBar component)
    // It has data-testid="deck-progress"
    // Note: We check on all decks (not just culture filtered) to verify progress bar exists
    const progressBar = page.locator('[data-testid="deck-progress"]');
    await expect(progressBar.first()).toBeVisible({ timeout: 10000 });
  });
});
