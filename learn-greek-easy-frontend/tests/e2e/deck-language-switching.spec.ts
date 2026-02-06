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

  test('should switch multiple deck names when language is changed', async ({ page }) => {
    await page.goto('/decks');

    // Wait for deck cards to load
    const deckCards = page.locator('[data-testid="deck-card"]');
    await expect(deckCards.first()).toBeVisible({ timeout: 15000 });

    // Verify at least 2 English deck names are visible
    const firstTitle = deckCards.nth(0).locator('[data-testid="deck-card-title"]');
    const secondTitle = deckCards.nth(1).locator('[data-testid="deck-card-title"]');
    await expect(firstTitle).toContainText('Greek', { timeout: 10000 });
    await expect(secondTitle).toContainText('Greek', { timeout: 10000 });

    // Switch language to Russian
    await page.locator('[data-testid="language-switcher-trigger"]').click();
    await page.locator('[data-testid="language-option-ru"]').click();

    // Verify both deck names switched to Russian
    await expect(firstTitle).toContainText('Греческий', { timeout: 10000 });
    await expect(secondTitle).toContainText('Греческий', { timeout: 10000 });

    // Switch back to English
    await page.locator('[data-testid="language-switcher-trigger"]').click();
    await page.locator('[data-testid="language-option-en"]').click();

    // Verify English names are restored
    await expect(firstTitle).toContainText('Greek', { timeout: 10000 });
    await expect(secondTitle).toContainText('Greek', { timeout: 10000 });
  });
});
