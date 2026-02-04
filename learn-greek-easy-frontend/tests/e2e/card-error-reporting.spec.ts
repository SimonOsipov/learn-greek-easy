/**
 * E2E Test: Card Error Reporting
 *
 * Tests the card error reporting feature for both vocabulary flashcards and culture questions.
 * Verifies the report modal opens, validates input, and handles submission.
 *
 * These tests use the pre-authenticated learner user from auth.setup.ts.
 *
 * NOTE: Do NOT add beforeEach seed calls - the auth setup already seeds
 * the database and authenticates users. Re-seeding would invalidate
 * the cached auth tokens since user UUIDs would change.
 */

import { test, expect, Page } from '@playwright/test';

/**
 * Helper function to navigate to a flashcard review session.
 * Returns once the first flashcard is visible.
 */
async function navigateToFlashcardReview(page: Page): Promise<void> {
  // Navigate to decks page
  await page.goto('/decks');

  // Wait for deck cards to load
  const deckCard = page.locator('[data-testid="deck-card"]').first();
  await expect(deckCard).toBeVisible({ timeout: 15000 });

  // Click on first vocabulary deck (not culture)
  const vocabDeck = page.locator('[data-testid="deck-card"]').filter({
    hasNot: page.locator('[data-testid="culture-badge"]'),
  }).first();
  await expect(vocabDeck).toBeVisible({ timeout: 5000 });
  await vocabDeck.click();

  // Wait for deck detail page and click review button
  const reviewButton = page.getByRole('button', { name: /review|start/i }).first();
  await expect(reviewButton).toBeVisible({ timeout: 5000 });
  await reviewButton.click();

  // Wait for flashcard to be visible
  const flashcard = page.locator('[data-testid="flashcard"]');
  await expect(flashcard).toBeVisible({ timeout: 10000 });
}

/**
 * Helper function to flip a flashcard and reveal the answer.
 */
async function flipFlashcard(page: Page): Promise<void> {
  const showAnswerBtn = page.getByRole('button', { name: /show answer|flip/i });
  const isButtonVisible = await showAnswerBtn.isVisible().catch(() => false);

  if (isButtonVisible) {
    await showAnswerBtn.click();
  } else {
    // Try clicking the card itself
    const flashcard = page.locator('[data-testid="flashcard"]');
    await flashcard.click();
  }

  // Wait for rating buttons to appear (indicates card is flipped)
  const goodButton = page.getByRole('button', { name: /good/i }).first();
  await expect(goodButton).toBeVisible({ timeout: 3000 });
}

/**
 * Helper function to navigate to a culture practice session and answer a question.
 * Returns once feedback is visible.
 */
async function navigateToCultureFeedback(page: Page): Promise<void> {
  // Navigate to decks page
  await page.goto('/decks');

  // Wait for deck cards and filter to culture
  await expect(page.locator('[data-testid="deck-card"]').first()).toBeVisible({ timeout: 15000 });

  // Click on Culture filter
  const cultureButton = page.getByRole('button', { name: 'Culture', exact: true });
  await cultureButton.click();
  await expect(cultureButton).toHaveAttribute('aria-pressed', 'true', { timeout: 5000 });

  // Click on a non-premium culture deck
  const cultureDeckCard = page.locator('[data-testid="deck-card"]').filter({
    has: page.locator('[data-testid="culture-badge"]'),
  });
  const nonPremiumDeck = cultureDeckCard.filter({
    hasNot: page.locator('[aria-label="Premium content"]'),
  }).first();
  await expect(nonPremiumDeck).toBeVisible();
  await nonPremiumDeck.click();

  // Start practice session
  await expect(page.getByTestId('start-practice-button')).toBeVisible({ timeout: 5000 });
  await page.getByTestId('start-practice-button').click();

  // Wait for practice page to load
  await expect(page).toHaveURL(/\/culture\/[^/]+\/practice/, { timeout: 10000 });

  // Wait for MCQ options to be visible
  const optionButton = page.locator('button').filter({ hasText: /^[A-D]\s/ }).first();
  await expect(optionButton).toBeVisible({ timeout: 10000 });

  // Select an answer and submit
  await optionButton.click();
  const submitButton = page.getByRole('button', { name: /submit answer/i });
  await submitButton.click();

  // Wait for feedback to appear (correct or wrong)
  const feedback = page.locator('text=/Correct!|Wrong!/');
  await expect(feedback).toBeVisible({ timeout: 5000 });
}

test.describe('Card Error Reporting - Vocabulary Flashcards', () => {
  test('CDERR-E2E-01: Report error button appears after flipping card', async ({ page }) => {
    await navigateToFlashcardReview(page);

    // Before flipping, report button should not be visible
    await expect(page.getByTestId('report-error-button')).not.toBeVisible();

    // Flip the card
    await flipFlashcard(page);

    // Report error button should now be visible
    await expect(page.getByTestId('report-error-button')).toBeVisible();
  });

  test('CDERR-E2E-02: Report error modal opens and closes', async ({ page }) => {
    await navigateToFlashcardReview(page);
    await flipFlashcard(page);

    // Click report error button
    await page.getByTestId('report-error-button').click();

    // Modal should be visible
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Report an Error')).toBeVisible();

    // Close modal with X button
    const closeButton = page.getByRole('button', { name: /close/i });
    await closeButton.click();

    // Modal should be hidden
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('CDERR-E2E-03: Report error requires minimum description length', async ({ page }) => {
    await navigateToFlashcardReview(page);
    await flipFlashcard(page);
    await page.getByTestId('report-error-button').click();

    // Modal should be open
    await expect(page.getByRole('dialog')).toBeVisible();

    // Type short description
    await page.locator('textarea').fill('Short');

    // Submit button should be disabled or show validation message on click
    const submitButton = page.getByRole('button', { name: /submit/i }).last();
    await expect(submitButton).toBeDisabled();

    // Verify character count is shown
    await expect(page.getByText('5/1000')).toBeVisible();
  });

  test('CDERR-E2E-04: Report error submits successfully', async ({ page }) => {
    await navigateToFlashcardReview(page);
    await flipFlashcard(page);
    await page.getByTestId('report-error-button').click();

    // Modal should be open
    await expect(page.getByRole('dialog')).toBeVisible();

    // Type a valid description
    const description = 'This is a test error report. The translation seems incorrect for this vocabulary card.';
    await page.locator('textarea').fill(description);

    // Submit button should be enabled
    const submitButton = page.getByRole('button', { name: /submit/i }).last();
    await expect(submitButton).toBeEnabled();

    // Submit the report
    await submitButton.click();

    // Should close modal on successful submission
    // (Modal closing without error proves the API call succeeded)
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 });
  });

  test('CDERR-E2E-05: Cancel button closes modal without submitting', async ({ page }) => {
    await navigateToFlashcardReview(page);
    await flipFlashcard(page);
    await page.getByTestId('report-error-button').click();

    // Modal should be open
    await expect(page.getByRole('dialog')).toBeVisible();

    // Type something
    await page.locator('textarea').fill('This is a description I will cancel');

    // Click cancel
    const cancelButton = page.getByRole('button', { name: /cancel/i });
    await cancelButton.click();

    // Modal should close
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });
});

test.describe('Card Error Reporting - Culture Questions', () => {
  test('CDERR-E2E-10: Report error button appears in culture feedback', async ({ page }) => {
    await navigateToCultureFeedback(page);

    // Report error button should be visible in feedback
    await expect(page.getByTestId('culture-report-error-button')).toBeVisible();
  });

  test('CDERR-E2E-11: Culture report error modal works', async ({ page }) => {
    await navigateToCultureFeedback(page);

    // Click report error button
    await page.getByTestId('culture-report-error-button').click();

    // Modal should be visible
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Report an Error')).toBeVisible();

    // Type a valid description
    const description = 'This culture question has an incorrect answer. The correct answer should be different.';
    await page.locator('textarea').fill(description);

    // Submit
    const submitButton = page.getByRole('button', { name: /submit/i }).last();
    await submitButton.click();

    // Should show success toast
    await expect(page.getByText(/thank you for reporting/i)).toBeVisible({ timeout: 5000 });
  });
});
