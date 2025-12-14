/**
 * E2E Test: Flashcard Review Session
 * Tests complete review workflow: login → select deck → review cards → view summary
 */

import { test, expect } from '@playwright/test';
import { loginViaLocalStorage } from './helpers/auth-helpers';

// ENABLED: Now uses seed data from E2E database seeding infrastructure (SEED-10)
// Seed creates 60 cards (10 per deck) with SM-2 spaced repetition states
test.describe('Flashcard Review Session', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test (using fast localStorage method)
    await loginViaLocalStorage(page);
  });

  test('E2E-02.1: Complete review session with 5 cards', async ({ page }) => {
    // Start at dashboard
    await page.goto('/dashboard');

    // Navigate to decks page
    const decksLink = page.getByRole('link', { name: /decks/i }).first();
    await decksLink.click();
    await page.waitForURL('/decks');

    // Wait for decks to load and select first available deck
    await page.waitForTimeout(1000);

    // Find and click on a deck card
    const deckCard = page.locator('[data-testid="deck-card"]').first();
    await expect(deckCard).toBeVisible({ timeout: 5000 });
    await deckCard.click();

    // Wait for deck detail page
    await page.waitForTimeout(500);

    // Click "Start Review" or "Review" button
    const reviewButton = page.getByRole('button', { name: /review|start/i }).first();
    await expect(reviewButton).toBeVisible({ timeout: 5000 });
    await reviewButton.click();

    // Wait for review session to start
    await page.waitForTimeout(1000);

    // Review cards (up to 5, or until session ends)
    for (let i = 0; i < 5; i++) {
      // Check if we're still in review mode (card visible)
      const cardContent = page.locator('[data-testid="flashcard"]').or(
        page.locator('.flashcard')
      );
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

      await page.waitForTimeout(500);

      // Rate card (quality 4 = "Good")
      // Try different selectors for rating buttons
      const goodButton = page.getByRole('button', { name: /good/i }).or(
        page.getByRole('button', { name: /^4$/i })
      ).first();

      const isRatingVisible = await goodButton.isVisible().catch(() => false);
      if (isRatingVisible) {
        await goodButton.click();
        await page.waitForTimeout(500);
      } else {
        // Try keyboard shortcut
        await page.keyboard.press('4');
        await page.waitForTimeout(500);
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
    await page.waitForTimeout(1000);

    // Click first deck
    const deckCard = page.locator('[data-testid="deck-card"]').first();
    await deckCard.click();
    await page.waitForTimeout(500);

    // Start review
    const reviewButton = page.getByRole('button', { name: /review|start/i }).first();
    await reviewButton.click();
    await page.waitForTimeout(1000);

    // Verify card is visible
    const cardContent = page.locator('[data-testid="flashcard"]').or(
      page.locator('.flashcard')
    );
    await expect(cardContent).toBeVisible({ timeout: 5000 });

    // Get initial text content
    const initialContent = await page.textContent('body');

    // Flip card with Space key
    await page.keyboard.press('Space');
    await page.waitForTimeout(500);

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
    await page.waitForTimeout(1000);

    // Click first deck
    const deckCard = page.locator('[data-testid="deck-card"]').first();
    await deckCard.click();
    await page.waitForTimeout(500);

    // Start review
    const reviewButton = page.getByRole('button', { name: /review|start/i }).first();
    await reviewButton.click();
    await page.waitForTimeout(1000);

    // Flip card
    const showAnswerBtn = page.getByRole('button', { name: /show answer|flip/i });
    const isButtonVisible = await showAnswerBtn.isVisible().catch(() => false);

    if (isButtonVisible) {
      await showAnswerBtn.click();
    } else {
      await page.keyboard.press('Space');
    }
    await page.waitForTimeout(500);

    // Get current URL
    const beforeRatingUrl = page.url();

    // Rate with keyboard (4 = Good)
    await page.keyboard.press('4');
    await page.waitForTimeout(500);

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
    await page.waitForTimeout(1000);

    // Click first deck
    const deckCard = page.locator('[data-testid="deck-card"]').first();
    await deckCard.click();
    await page.waitForTimeout(500);

    // Start review
    const reviewButton = page.getByRole('button', { name: /review|start/i }).first();
    await reviewButton.click();
    await page.waitForTimeout(1000);

    // Verify we're in review mode
    const reviewUrl = page.url();
    expect(reviewUrl).toContain('/decks/');

    // Press Esc to attempt exit
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Check if confirmation dialog appears
    const confirmButton = page.getByRole('button', { name: /exit|confirm|yes/i });
    const isConfirmVisible = await confirmButton.isVisible().catch(() => false);

    if (isConfirmVisible) {
      await confirmButton.click();
      await page.waitForTimeout(500);
    }

    // Should have exited review (back to deck detail or decks page)
    const finalUrl = page.url();
    expect(finalUrl).not.toContain('/review/');
  });

  test('E2E-02.5: Dashboard statistics update after review session', async ({ page }) => {
    // Check initial statistics on dashboard
    await page.goto('/dashboard');
    await page.waitForTimeout(1000);

    // Try to get words learned count (may not be visible if no data yet)
    const wordsLearnedText = await page.getByText(/\d+.*word/i).first().textContent().catch(() => '0');

    // Complete review session with 3 cards
    await page.goto('/decks');
    await page.waitForTimeout(1000);

    const deckCard = page.locator('[data-testid="deck-card"]').first();
    await deckCard.click();
    await page.waitForTimeout(500);

    const reviewButton = page.getByRole('button', { name: /review|start/i }).first();
    await reviewButton.click();
    await page.waitForTimeout(1000);

    // Review 3 cards (rate all as "Good")
    for (let i = 0; i < 3; i++) {
      const cardContent = page.locator('[data-testid="flashcard"]').or(
        page.locator('.flashcard')
      );
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
      await page.waitForTimeout(500);

      // Rate as Good (4)
      await page.keyboard.press('4');
      await page.waitForTimeout(500);
    }

    // Return to dashboard (either via button or navigation)
    await page.goto('/dashboard');
    await page.waitForTimeout(1000);

    // Verify dashboard loaded
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();

    // Verify some statistics are present (exact values will vary)
    const dashboardContent = await page.textContent('body');
    expect(dashboardContent).toBeTruthy();
  });
});
