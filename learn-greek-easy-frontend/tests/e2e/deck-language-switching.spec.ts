/**
 * Deck Language Switching E2E Tests
 *
 * Tests that deck names and descriptions update when the user
 * switches the UI language (EN <-> RU). The backend returns
 * localized content based on the Accept-Language header.
 *
 * Test data: Seeded vocabulary decks have name_en and name_ru fields.
 * Example: "Greek A1 Vocabulary" (EN) / "Греческий словарь A1" (RU)
 */

import { test, expect } from '@playwright/test';

test.describe('Deck Language Switching', () => {
  test('should update deck names when switching language on decks page', async ({ page }) => {
    // Navigate to decks page (authenticated via storageState)
    await page.goto('/decks');

    // Wait for deck cards to load
    const deckCards = page.locator('[data-testid="deck-card"]');
    await expect(deckCards.first()).toBeVisible({ timeout: 15000 });

    // Capture English deck names
    const englishNames = await deckCards.allTextContents();
    expect(englishNames.length).toBeGreaterThan(0);

    // Look for a known English deck name pattern from seed data
    const pageText = await page.textContent('body');
    const hasEnglishContent =
      pageText?.includes('Vocabulary') || pageText?.includes('Greek');
    expect(hasEnglishContent).toBe(true);

    // Switch language to Russian via language switcher
    await page.getByTestId('language-switcher-trigger').click();
    await page.getByTestId('language-option-ru').click();

    // Wait for deck cards to reload with Russian content
    // The useEffect should re-fetch with the new Accept-Language header
    await expect(deckCards.first()).toBeVisible({ timeout: 15000 });

    // Verify Russian deck names appear
    // Seeded decks have Russian names like "Греческий словарь A1"
    const russianPageText = await page.textContent('body');
    const hasRussianContent =
      russianPageText?.includes('словарь') ||
      russianPageText?.includes('Греческий') ||
      russianPageText?.includes('колода');
    expect(hasRussianContent).toBe(true);

    // Switch back to English
    await page.getByTestId('language-switcher-trigger').click();
    await page.getByTestId('language-option-en').click();

    // Wait for English content to return
    await expect(deckCards.first()).toBeVisible({ timeout: 15000 });

    const restoredPageText = await page.textContent('body');
    const hasRestoredEnglish =
      restoredPageText?.includes('Vocabulary') || restoredPageText?.includes('Greek');
    expect(hasRestoredEnglish).toBe(true);
  });
});

test.describe('Admin Deck Language Switching', () => {
  // Use admin storage state
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test('should update deck names in admin page when switching language', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByTestId('admin-page')).toBeVisible({ timeout: 15000 });

    // Wait for deck list to load (the All Decks section)
    const deckRows = page.locator('[data-testid^="deck-row-"]');

    // The admin page may show a loading state first, wait for content
    await expect(deckRows.first()).toBeVisible({ timeout: 15000 });

    // Verify we see English content
    const adminPageText = await page.textContent('body');
    const hasEnglishAdmin =
      adminPageText?.includes('Vocabulary') ||
      adminPageText?.includes('Greek') ||
      adminPageText?.includes('vocabulary');
    expect(hasEnglishAdmin).toBe(true);

    // Switch to Russian
    await page.getByTestId('language-switcher-trigger').click();
    await page.getByTestId('language-option-ru').click();

    // Wait for admin title to change (confirms language switch happened)
    await expect(page.getByTestId('admin-title')).toHaveText('Панель администратора');

    // Verify deck names switched to Russian
    // Wait for deck list to re-render with new locale
    await expect(deckRows.first()).toBeVisible({ timeout: 15000 });

    const russianAdminText = await page.textContent('body');
    const hasRussianAdmin =
      russianAdminText?.includes('словарь') ||
      russianAdminText?.includes('Греческий') ||
      russianAdminText?.includes('колода');
    expect(hasRussianAdmin).toBe(true);

    // Switch back to English
    await page.getByTestId('language-switcher-trigger').click();
    await page.getByTestId('language-option-en').click();

    // Verify English is restored
    await expect(page.getByTestId('admin-title')).toHaveText('Admin Dashboard');
  });
});
