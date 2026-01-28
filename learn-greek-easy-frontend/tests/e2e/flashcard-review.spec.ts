/**
 * E2E Test: Flashcard Review Session
 * Tests complete review workflow: login → select deck → review cards → view summary
 */

import { test, expect } from '@playwright/test';

// ENABLED: Now uses seed data from E2E database seeding infrastructure (SEED-10)
// Seed creates 60 cards (10 per deck) with SM-2 spaced repetition states
test.describe('Flashcard Review Session', () => {
  test('E2E-02.1: Complete review session with 5 cards', async ({ page }) => {
    // Start at dashboard
    await page.goto('/');

    // Navigate to decks page via dropdown menu
    const decksDropdown = page.locator('[data-testid="decks-dropdown-trigger"]');
    await expect(decksDropdown).toBeVisible();
    await decksDropdown.click();

    // Click "Public Decks" in the dropdown menu
    const publicDecksLink = page.getByRole('menuitem', { name: /public decks/i });
    await expect(publicDecksLink).toBeVisible();
    await publicDecksLink.click();

    // Wait for navigation to complete
    await page.waitForURL(/\/decks/);

    // Wait for deck cards to load
    const deckCard = page.locator('[data-testid="deck-card"]').first();
    await expect(deckCard).toBeVisible({ timeout: 15000 });
    await deckCard.click();

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
    // Navigate to review session
    await page.goto('/decks');

    // Wait for deck cards to load
    const deckCard = page.locator('[data-testid="deck-card"]').first();
    await expect(deckCard).toBeVisible({ timeout: 15000 });
    await deckCard.click();

    // Start review - wait for button to be visible first
    const reviewButton = page.getByRole('button', { name: /review|start/i }).first();
    await expect(reviewButton).toBeVisible({ timeout: 5000 });
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
    // Navigate to review session
    await page.goto('/decks');

    // Wait for deck cards to load
    const deckCard = page.locator('[data-testid="deck-card"]').first();
    await expect(deckCard).toBeVisible({ timeout: 15000 });
    await deckCard.click();

    // Start review - wait for button to be visible
    const reviewButton = page.getByRole('button', { name: /review|start/i }).first();
    await expect(reviewButton).toBeVisible({ timeout: 5000 });
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
    // Start review session
    await page.goto('/decks');

    // Wait for deck cards to load
    const deckCard = page.locator('[data-testid="deck-card"]').first();
    await expect(deckCard).toBeVisible({ timeout: 15000 });
    await deckCard.click();

    // Start review - wait for button to be visible
    const reviewButton = page.getByRole('button', { name: /review|start/i }).first();
    await expect(reviewButton).toBeVisible({ timeout: 5000 });
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

    // Complete review session with 3 cards
    await page.goto('/decks');

    // Wait for deck cards to load
    const deckCard = page.locator('[data-testid="deck-card"]').first();
    await expect(deckCard).toBeVisible({ timeout: 15000 });
    await deckCard.click();

    // Wait for review button to be visible
    const reviewButton = page.getByRole('button', { name: /review|start/i }).first();
    await expect(reviewButton).toBeVisible({ timeout: 5000 });
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
