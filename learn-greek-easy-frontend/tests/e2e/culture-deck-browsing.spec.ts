import { test, expect } from '@playwright/test';

test.describe('Culture Deck Browsing', () => {
  test.beforeEach(async ({ page }) => {
    await page.request.post('http://localhost:8000/api/v1/test/seed/all');
  });

  test('should display culture decks in deck list', async ({ page }) => {
    await page.goto('/decks');
    await page.getByRole('button', { name: /culture/i }).click();

    const deckCards = page.locator('[data-testid="deck-card"]');
    await expect(deckCards.first()).toBeVisible();

    const cultureBadge = page.locator('[data-testid="culture-badge"]');
    await expect(cultureBadge.first()).toBeVisible();
  });

  test('should navigate to culture deck detail', async ({ page }) => {
    await page.goto('/decks');
    await page.getByRole('button', { name: /culture/i }).click();

    const firstDeck = page.locator('[data-testid="deck-card"]').first();
    await firstDeck.click();

    await expect(page).toHaveURL(/\/culture\/decks\//);
    await expect(page.getByTestId('deck-detail')).toBeVisible();
  });

  test('should show deck progress for authenticated user', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'e2e_learner@test.com');
    await page.fill('[name="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');

    await page.goto('/decks');
    await page.getByRole('button', { name: /culture/i }).click();

    const progressBar = page.locator('[data-testid="deck-progress"]');
    await expect(progressBar.first()).toBeVisible();
  });
});
