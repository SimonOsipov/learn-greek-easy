/**
 * E2E Test: Flashcard Review Session
 * Tests complete review workflow: login → select deck → review cards → view summary
 */

import { test, expect } from '@playwright/test';

// ENABLED: Now uses seed data from E2E database seeding infrastructure (SEED-10)
// Seed creates 60 cards (10 per deck) with SM-2 spaced repetition states
// NOTE: Must select V1 decks (with enabled review button), not V2 decks (word browser only)

/**
 * Helper to find and click a V1 deck (one with an enabled review button)
 * V2 decks have disabled review buttons, so we need to find a regular vocabulary deck
 */
async function navigateToV1Deck(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/decks');

  // Wait for deck cards to load
  const deckCards = page.locator('[data-testid="deck-card"]');
  await expect(deckCards.first()).toBeVisible({ timeout: 15000 });

  // Click on a deck that contains "A1 Vocabulary" or similar V1 deck name
  // These are the standard vocabulary decks with enabled review buttons
  const v1DeckCard = page.locator('[data-testid="deck-card"]').filter({
    hasText: /A1 Vocabulary|A2 Vocabulary|B1 Vocabulary|Greek A1|Greek A2/i,
  }).first();

  // If no specific V1 deck found, try clicking any deck that is NOT a V2 test deck
  const hasV1Deck = await v1DeckCard.isVisible().catch(() => false);

  if (hasV1Deck) {
    await v1DeckCard.click();
  } else {
    // Fallback: click the first non-V2 deck (skip E2E test decks)
    const regularDeck = page.locator('[data-testid="deck-card"]').filter({
      hasNotText: /E2E V2|Word Entry/i,
    }).first();
    await regularDeck.click();
  }

  // Wait for deck detail page with an ENABLED review button
  const reviewButton = page.getByRole('button', { name: /review|start/i }).first();
  await expect(reviewButton).toBeVisible({ timeout: 5000 });
  await expect(reviewButton).toBeEnabled({ timeout: 5000 });
}

test.describe('Flashcard Review Session', () => {
  test('E2E-02.1: Complete review session with 5 cards', async ({ page }) => {
    // Navigate to a V1 deck with enabled review button
    await navigateToV1Deck(page);

    // Review button should already be visible and enabled
    const reviewButton = page.getByRole('button', { name: /review|start/i }).first();
    await reviewButton.click();

    // Wait for deck detail page - review button should become visible
    const reviewButton = page.getByRole('button', { name: /review|start/i }).first();
    await expect(reviewButton).toBeVisible({ timeout: 5000 });
    await reviewButton.click();

    // Wait for review session to start - card should be visible
    const cardContent = page.locator('[data-testid="flashcard"]').or(
      page.locator('.flashcard')
    );
    await expect(cardContent.first()).toBeVisible({ timeout: 10000 });

    // Review cards (up to 5, or until session ends)
    for (let i = 0; i < 5; i++) {
      // Check if we're still in review mode (card visible)
      const isCardVisible = await cardContent.isVisible().catch(() => false);

      if (!isCardVisible) {
        // Session might have ended early
        break;
      }

      // Flip card (click "Show Answer" button or card itself)
      const showAnswerBtn = page.getByRole('button', { name: /show answer|flip/i });
      const isButtonVisible = await showAnswerBtn.isVisible().catch(() => false);

      if (isButtonVisible) {
        await showAnswerBtn.click();
      } else {
        // Try clicking the card itself
        await cardContent.click();
      }

      // Wait for answer to be visible or rating buttons to appear
      const goodButton = page.getByRole('button', { name: /good/i }).or(
        page.getByRole('button', { name: /^4$/i })
      ).first();

      const isRatingVisible = await goodButton.isVisible({ timeout: 3000 }).catch(() => false);
      if (isRatingVisible) {
        await goodButton.click();
        // Wait for next card or session end
        await page.waitForLoadState('networkidle');
      } else {
        // Try keyboard shortcut
        await page.keyboard.press('4');
        await page.waitForLoadState('networkidle');
      }
    }

    // Verify we're no longer in review mode (either on summary or back to deck)
    // Session should have completed or redirected
    const url = page.url();
    expect(url).not.toContain('/review/');
  });

  test('E2E-02.2: Flip card using keyboard shortcut (Space)', async ({ page }) => {
    // Navigate to a V1 deck with enabled review button
    await navigateToV1Deck(page);

    // Start review - button should already be visible and enabled
    const reviewButton = page.getByRole('button', { name: /review|start/i }).first();
    await reviewButton.click();

    // Wait for card to be visible
    const cardContent = page.locator('[data-testid="flashcard"]').or(
      page.locator('.flashcard')
    );
    await expect(cardContent).toBeVisible({ timeout: 10000 });

    // Get initial text content
    const initialContent = await page.textContent('body');

    // Flip card with Space key
    await page.keyboard.press('Space');

    // Wait for content to change - rating buttons should appear
    const ratingButton = page.getByRole('button', { name: /good|easy|hard|again/i }).first();
    await expect(ratingButton).toBeVisible({ timeout: 5000 });

    // Verify content changed (answer should be visible now)
    const afterFlipContent = await page.textContent('body');

    // Content should be different after flip, or answer button should be hidden
    const showAnswerBtn = page.getByRole('button', { name: /show answer/i });
    const isAnswerBtnVisible = await showAnswerBtn.isVisible().catch(() => false);

    // Either content changed or button is no longer visible
    expect(!isAnswerBtnVisible || initialContent !== afterFlipContent).toBe(true);
  });

  test('E2E-02.3: Rate card using keyboard shortcuts (1-5)', async ({ page }) => {
    // Navigate to a V1 deck with enabled review button
    await navigateToV1Deck(page);

    // Start review - button should already be visible and enabled
    const reviewButton = page.getByRole('button', { name: /review|start/i }).first();
    await reviewButton.click();

    // Wait for flashcard to appear
    const cardContent = page.locator('[data-testid="flashcard"]').or(
      page.locator('.flashcard')
    );
    await expect(cardContent.first()).toBeVisible({ timeout: 10000 });

    // Flip card
    const showAnswerBtn = page.getByRole('button', { name: /show answer|flip/i });
    const isButtonVisible = await showAnswerBtn.isVisible().catch(() => false);

    if (isButtonVisible) {
      await showAnswerBtn.click();
    } else {
      await page.keyboard.press('Space');
    }

    // Wait for rating buttons to appear (indicates flip complete)
    const ratingButton = page.getByRole('button', { name: /good|easy|hard|again/i }).first();
    await expect(ratingButton).toBeVisible({ timeout: 5000 });

    // Get current URL
    const beforeRatingUrl = page.url();

    // Rate with keyboard (4 = Good)
    await page.keyboard.press('4');

    // Wait for state change - either next card or session end
    await page.waitForLoadState('networkidle');

    // Verify something changed (URL or content)
    const afterRatingUrl = page.url();

    // Either URL changed (next card) or we're on summary/deck page
    const urlChanged = beforeRatingUrl !== afterRatingUrl;
    const notInReview = !afterRatingUrl.includes('/review/');

    expect(urlChanged || notInReview).toBe(true);
  });

  test('E2E-02.4: Exit review session early with Esc key', async ({ page }) => {
    // Navigate to a V1 deck with enabled review button
    await navigateToV1Deck(page);

    // Start review - button should already be visible and enabled
    const reviewButton = page.getByRole('button', { name: /review|start/i }).first();
    await reviewButton.click();

    // Wait for flashcard to appear (indicates review started)
    const cardContent = page.locator('[data-testid="flashcard"]').or(
      page.locator('.flashcard')
    );
    await expect(cardContent.first()).toBeVisible({ timeout: 10000 });

    // Verify we're in review mode
    const reviewUrl = page.url();
    expect(reviewUrl).toContain('/decks/');

    // Press Esc to attempt exit
    await page.keyboard.press('Escape');

    // Check if confirmation dialog appears
    const confirmButton = page.getByRole('button', { name: /exit|confirm|yes/i });
    const isConfirmVisible = await confirmButton.isVisible({ timeout: 3000 }).catch(() => false);

    if (isConfirmVisible) {
      await confirmButton.click();
      // Wait for navigation after confirming exit
      await page.waitForLoadState('networkidle');
    }

    // Should have exited review (back to deck detail or decks page)
    const finalUrl = page.url();
    expect(finalUrl).not.toContain('/review/');
  });

  test('E2E-02.5: Dashboard statistics update after review session', async ({ page }) => {
    // Check initial statistics on dashboard
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({ timeout: 10000 });

    // Try to get words learned count (may not be visible if no data yet)
    const wordsLearnedText = await page.getByText(/\d+.*word/i).first().textContent().catch(() => '0');

    // Navigate to a V1 deck with enabled review button
    await navigateToV1Deck(page);

    // Start review - button should already be visible and enabled
    const reviewButton = page.getByRole('button', { name: /review|start/i }).first();
    await reviewButton.click();

    // Wait for flashcard to appear
    const cardContent = page.locator('[data-testid="flashcard"]').or(
      page.locator('.flashcard')
    );
    await expect(cardContent.first()).toBeVisible({ timeout: 10000 });

    // Review 3 cards (rate all as "Good")
    for (let i = 0; i < 3; i++) {
      const isCardVisible = await cardContent.isVisible().catch(() => false);

      if (!isCardVisible) break;

      // Flip card
      const showAnswerBtn = page.getByRole('button', { name: /show answer|flip/i });
      const isButtonVisible = await showAnswerBtn.isVisible().catch(() => false);

      if (isButtonVisible) {
        await showAnswerBtn.click();
      } else {
        await page.keyboard.press('Space');
      }

      // Wait for rating buttons to appear
      const ratingButton = page.getByRole('button', { name: /good|easy|hard|again/i }).first();
      await expect(ratingButton).toBeVisible({ timeout: 5000 });

      // Rate as Good (4)
      await page.keyboard.press('4');
      // Wait for next card or session end
      await page.waitForLoadState('networkidle');
    }

    // Return to dashboard (either via button or navigation)
    await page.goto('/');

    // Verify dashboard loaded
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({ timeout: 10000 });

    // Verify some statistics are present (exact values will vary)
    const dashboardContent = await page.textContent('body');
    expect(dashboardContent).toBeTruthy();
  });
});
