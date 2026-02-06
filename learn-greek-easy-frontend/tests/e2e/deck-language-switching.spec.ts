/**
 * Deck Language Switching E2E Tests
 *
 * Verifies that deck names and descriptions switch instantly when the user
 * changes the UI language. This is client-side locale resolution (no re-fetch).
 *
 * Seed data deck names:
 * - English: "Greek A1 Vocabulary", "Greek A2 Vocabulary", etc.
 * - Russian: "Греческий словарь A1", "Греческий словарь A2", etc.
 */

import { test, expect } from '@playwright/test';

test.describe('Deck Language Switching', () => {
  test('should switch deck names when language is changed on /decks page', async ({ page }) => {
    await page.goto('/decks');

    // Wait for deck cards to load
    const deckCards = page.locator('[data-testid="deck-card"]');
    await expect(deckCards.first()).toBeVisible({ timeout: 15000 });

    // Verify English deck names are visible
    await expect(deckCards.first()).toContainText('Greek', { timeout: 10000 });

    // Switch language to Russian
    await page.locator('[data-testid="language-switcher-trigger"]').click();
    await page.locator('[data-testid="language-option-ru"]').click();

    // Verify Russian deck names appear (client-side, no re-fetch needed)
    await expect(deckCards.first()).toContainText('Греческий', { timeout: 10000 });

    // Switch back to English
    await page.locator('[data-testid="language-switcher-trigger"]').click();
    await page.locator('[data-testid="language-option-en"]').click();

    // Verify English deck names are restored
    await expect(deckCards.first()).toContainText('Greek', { timeout: 10000 });
  });

  test('should switch deck name on detail page when language changes', async ({ page }) => {
    await page.goto('/decks');

    // Wait for deck cards to load and click the first one
    const firstDeck = page.locator('[data-testid="deck-card"]').first();
    await expect(firstDeck).toBeVisible({ timeout: 15000 });
    await firstDeck.click();

    // Wait for detail page to load (look for heading or action button)
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 10000 });

    // Verify English name is shown
    await expect(heading).toContainText('Greek', { timeout: 10000 });

    // Switch language to Russian
    await page.locator('[data-testid="language-switcher-trigger"]').click();
    await page.locator('[data-testid="language-option-ru"]').click();

    // Verify Russian name appears on the detail page
    await expect(heading).toContainText('Греческий', { timeout: 10000 });

    // Switch back to English
    await page.locator('[data-testid="language-switcher-trigger"]').click();
    await page.locator('[data-testid="language-option-en"]').click();

    // Verify English name is restored
    await expect(heading).toContainText('Greek', { timeout: 10000 });
  });
});
