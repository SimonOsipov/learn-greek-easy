/**
 * User Card Creation E2E Tests
 *
 * Tests for user-facing vocabulary card CRUD operations including:
 * - Create Flows (1-3): Basic card, with noun grammar, with verb grammar
 * - Edit Flow (4): Update existing card
 * - Delete Flows (5-6): Full delete flow, cancel delete
 * - Empty State Flow (7): First card creation from empty deck
 * - Authorization Flow (8): Cannot edit other user's cards
 *
 * Test Users:
 * - e2e_learner: Has 3 user-owned decks with cards
 * - e2e_beginner: Has 0 user-owned decks (empty state)
 */

import * as fs from 'fs';

import { test, expect } from '@playwright/test';

import { getSupabaseStorageKey } from './helpers/supabase-test-client';

// Storage state paths
const LEARNER_AUTH = 'playwright/.auth/learner.json';
const BEGINNER_AUTH = 'playwright/.auth/beginner.json';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Helper function to extract access token from auth state.
 * Token is stored in the Supabase session localStorage key (sb-<ref>-auth-token).
 */
function getAccessToken(authPath: string): string | null {
  try {
    const storageKey = getSupabaseStorageKey();
    const authState = JSON.parse(fs.readFileSync(authPath, 'utf-8'));
    const sessionEntry = authState.origins?.[0]?.localStorage?.find(
      (item: { name: string; value: string }) => item.name === storageKey
    );
    if (sessionEntry) {
      const session = JSON.parse(sessionEntry.value);
      return session?.access_token || null;
    }
  } catch {
    // File might not exist or be invalid
  }
  return null;
}

// ============================================================================
// CREATE CARD FLOWS (1-3)
// ============================================================================

test.describe('User Card Creation - Create Flows', () => {
  test.use({ storageState: LEARNER_AUTH });

  test('Flow 1: Create card with basic fields only', async ({ page }) => {
    await page.goto('/my-decks');

    // Wait for page and decks to load
    await expect(page.locator('[data-testid="my-decks-title"]')).toBeVisible({ timeout: 15000 });
    const deckCards = page.locator('[data-testid="deck-card"]');
    await expect(deckCards.first()).toBeVisible({ timeout: 15000 });

    // Click on the first deck to go to detail page
    const firstDeck = deckCards.first();
    await firstDeck.click();

    // Wait for deck detail page
    await page.waitForURL(/\/my-decks\/[a-f0-9-]+/i);
    await expect(page.locator('[data-testid="my-deck-detail"]')).toBeVisible({ timeout: 10000 });

    // Get initial card count
    const cardsListLocator = page.locator('[data-testid="cards-list"]');
    const emptyState = page.locator('[data-testid="cards-empty-state"]');

    // Wait for either cards list or empty state
    await expect(cardsListLocator.or(emptyState)).toBeVisible({ timeout: 10000 });

    const hasCards = await cardsListLocator.isVisible().catch(() => false);
    const initialCardCount = hasCards
      ? await cardsListLocator.locator('[data-testid^="card-"]').count()
      : 0;

    // Click Create Card button
    const createCardButton = page.locator('[data-testid="create-card-button"]');
    await expect(createCardButton).toBeVisible();
    await createCardButton.click();

    // Modal should open
    const modal = page.locator('[data-testid="user-vocabulary-card-create-modal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Fill required fields
    const uniqueGreek = `test_${Date.now()}`;
    await page.locator('[data-testid="front-text-input"]').fill(uniqueGreek);
    await page.locator('[data-testid="back-text-en-input"]').fill('test translation');

    // Submit the form
    const submitButton = page.locator('[data-testid="user-vocabulary-card-submit"]');
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    // Wait for success state
    await expect(page.locator('[data-testid="user-vocabulary-card-create-success"]')).toBeVisible({
      timeout: 10000,
    });

    // Click Done to close modal
    await page.locator('[data-testid="user-vocabulary-card-done"]').click();
    await expect(modal).not.toBeVisible({ timeout: 5000 });

    // Verify card appears in the list
    await expect(cardsListLocator).toBeVisible({ timeout: 10000 });
    const newCardCount = await cardsListLocator.locator('[data-testid^="card-"]').count();
    expect(newCardCount).toBe(initialCardCount + 1);

    // Verify the new card text is visible
    await expect(page.getByText(uniqueGreek)).toBeVisible();

    // Clean up - delete the card we just created
    const newCard = page.locator('[data-testid^="card-"]').filter({
      hasText: uniqueGreek,
    });
    const deleteButton = newCard.locator('button[data-testid^="delete-card-"]');
    await deleteButton.click();

    // Confirm deletion - use specific button selector to avoid matching dialog title
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    const deleteConfirmButton = dialog.locator('button').filter({ hasText: /delete/i });
    await deleteConfirmButton.click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });
  });

  // TODO: This test has a form submission issue that needs deeper investigation.
  // The selectors and tab navigation work correctly, but the form submit button
  // click does not trigger the onSubmit handler when grammar data is present.
  // This may be related to react-hook-form or Radix UI dialog focus management.
  test.skip('Flow 2: Create card with noun grammar', async ({ page }) => {
    await page.goto('/my-decks');

    // Navigate to deck detail
    await expect(page.locator('[data-testid="my-decks-title"]')).toBeVisible({ timeout: 15000 });
    const deckCards = page.locator('[data-testid="deck-card"]');
    await expect(deckCards.first()).toBeVisible({ timeout: 15000 });
    await deckCards.first().click();
    await page.waitForURL(/\/my-decks\/[a-f0-9-]+/i);
    await expect(page.locator('[data-testid="my-deck-detail"]')).toBeVisible({ timeout: 10000 });

    // Click Create Card button
    await page.locator('[data-testid="create-card-button"]').click();

    // Modal should open
    const modal = page.locator('[data-testid="user-vocabulary-card-create-modal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Click on the Noun tab to switch part-of-speech
    // The modal has 5 tabs: General | Noun | Verb | Adjective | Adverb
    await page.getByRole('tab', { name: /noun/i }).click();

    // Verify noun grammar form is visible
    await expect(page.locator('[data-testid="noun-grammar-form"]')).toBeVisible({ timeout: 5000 });

    // Fill basic fields
    const uniqueGreek = `noun_test_${Date.now()}`;
    await page.locator('[data-testid="front-text-input"]').fill(uniqueGreek);
    await page.locator('[data-testid="back-text-en-input"]').fill('noun test');

    // Fill noun gender
    await page.locator('[data-testid="noun-gender-select"]').click();
    await page.locator('[role="option"]').filter({ hasText: /neuter/i }).click();

    // Fill some declension fields (optional)
    const nominativeSingular = page.locator('[data-testid="noun-nominative-singular"]');
    await nominativeSingular.fill(uniqueGreek);

    // Blur the field to ensure the value is committed to form state
    await nominativeSingular.blur();

    // Submit the form
    const submitButton = page.locator('[data-testid="user-vocabulary-card-submit"]');
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toBeEnabled();

    // Wait for form state to settle
    await page.waitForTimeout(1000);
    await submitButton.click();

    // Wait for either success state or an error toast
    const successState = page.locator('[data-testid="user-vocabulary-card-create-success"]');
    await expect(successState).toBeVisible({ timeout: 15000 });

    // Click Done
    await page.locator('[data-testid="user-vocabulary-card-done"]').click();
    await expect(modal).not.toBeVisible({ timeout: 5000 });

    // Verify card appears with noun badge
    await expect(page.getByText(uniqueGreek)).toBeVisible({ timeout: 5000 });

    // Clean up - delete the card
    const newCard = page.locator('[data-testid^="card-"]').filter({
      hasText: uniqueGreek,
    });
    const deleteButton = newCard.locator('button[data-testid^="delete-card-"]');
    await deleteButton.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    const deleteConfirmButton = dialog.locator('button').filter({ hasText: /delete/i });
    await deleteConfirmButton.click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });
  });

  // TODO: This test has a form submission issue that needs deeper investigation.
  // The selectors and tab navigation work correctly, but the form submit button
  // click does not trigger the onSubmit handler when grammar data is present.
  // This may be related to react-hook-form or Radix UI dialog focus management.
  test.skip('Flow 3: Create card with verb grammar', async ({ page }) => {
    await page.goto('/my-decks');

    // Navigate to deck detail
    await expect(page.locator('[data-testid="my-decks-title"]')).toBeVisible({ timeout: 15000 });
    const deckCards = page.locator('[data-testid="deck-card"]');
    await expect(deckCards.first()).toBeVisible({ timeout: 15000 });
    await deckCards.first().click();
    await page.waitForURL(/\/my-decks\/[a-f0-9-]+/i);
    await expect(page.locator('[data-testid="my-deck-detail"]')).toBeVisible({ timeout: 10000 });

    // Click Create Card button
    await page.locator('[data-testid="create-card-button"]').click();

    // Modal should open
    const modal = page.locator('[data-testid="user-vocabulary-card-create-modal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Click on the Verb tab to switch part-of-speech
    // The modal has 5 tabs: General | Noun | Verb | Adjective | Adverb
    await page.getByRole('tab', { name: /verb/i }).click();

    // Verify verb grammar form is visible
    await expect(page.locator('[data-testid="verb-grammar-form"]')).toBeVisible({ timeout: 5000 });

    // Fill basic fields
    const uniqueGreek = `verb_test_${Date.now()}`;
    await page.locator('[data-testid="front-text-input"]').fill(uniqueGreek);
    await page.locator('[data-testid="back-text-en-input"]').fill('verb test');

    // Select voice
    await page.locator('[data-testid="verb-voice-select"]').click();
    await page.locator('[role="option"]').filter({ hasText: /active/i }).click();

    // Fill some conjugation fields
    const present1s = page.locator('[data-testid="verb-present-1s"]');
    await present1s.fill(uniqueGreek);

    // Blur the field to ensure the value is committed to form state
    await present1s.blur();

    // Submit the form
    const submitButton = page.locator('[data-testid="user-vocabulary-card-submit"]');
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toBeEnabled();

    // Wait for form state to settle
    await page.waitForTimeout(1000);
    await submitButton.click();

    // Wait for either success state or an error toast
    const successState = page.locator('[data-testid="user-vocabulary-card-create-success"]');
    await expect(successState).toBeVisible({ timeout: 15000 });

    // Click Done
    await page.locator('[data-testid="user-vocabulary-card-done"]').click();
    await expect(modal).not.toBeVisible({ timeout: 5000 });

    // Verify card appears with verb badge
    await expect(page.getByText(uniqueGreek)).toBeVisible({ timeout: 5000 });

    // Clean up - delete the card
    const newCard = page.locator('[data-testid^="card-"]').filter({
      hasText: uniqueGreek,
    });
    const deleteButton = newCard.locator('button[data-testid^="delete-card-"]');
    await deleteButton.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    const deleteConfirmButton = dialog.locator('button').filter({ hasText: /delete/i });
    await deleteConfirmButton.click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });
  });
});

// ============================================================================
// EDIT CARD FLOW (4)
// ============================================================================

test.describe('User Card Creation - Edit Flow', () => {
  test.use({ storageState: LEARNER_AUTH });

  test('Flow 4: Edit card - update text field', async ({ page }) => {
    // First, create a card to edit
    await page.goto('/my-decks');
    await expect(page.locator('[data-testid="my-decks-title"]')).toBeVisible({ timeout: 15000 });
    const deckCards = page.locator('[data-testid="deck-card"]');
    await expect(deckCards.first()).toBeVisible({ timeout: 15000 });
    await deckCards.first().click();
    await page.waitForURL(/\/my-decks\/[a-f0-9-]+/i);
    await expect(page.locator('[data-testid="my-deck-detail"]')).toBeVisible({ timeout: 10000 });

    // Create a test card
    await page.locator('[data-testid="create-card-button"]').click();
    const createModal = page.locator('[data-testid="user-vocabulary-card-create-modal"]');
    await expect(createModal).toBeVisible({ timeout: 5000 });

    const uniqueGreek = `edit_test_${Date.now()}`;
    await page.locator('[data-testid="front-text-input"]').fill(uniqueGreek);
    await page.locator('[data-testid="back-text-en-input"]').fill('original translation');
    await page.locator('[data-testid="user-vocabulary-card-submit"]').click();
    await expect(page.locator('[data-testid="user-vocabulary-card-create-success"]')).toBeVisible({
      timeout: 10000,
    });
    await page.locator('[data-testid="user-vocabulary-card-done"]').click();
    await expect(createModal).not.toBeVisible({ timeout: 5000 });

    // Find the card and click edit
    const cardLocator = page.locator('[data-testid^="card-"]').filter({
      hasText: uniqueGreek,
    });
    await expect(cardLocator).toBeVisible({ timeout: 10000 });

    const editButton = cardLocator.locator('button[data-testid^="edit-card-"]');
    await editButton.click();

    // Edit modal should open with pre-populated data
    const editModal = page.locator('[data-testid="vocabulary-card-edit-modal"]');
    await expect(editModal).toBeVisible({ timeout: 5000 });

    // Verify form is pre-populated
    await expect(page.locator('[data-testid="front-text-input"]')).toHaveValue(uniqueGreek);

    // Update the English translation
    const backTextInput = page.locator('[data-testid="back-text-en-input"]');
    await backTextInput.clear();
    await backTextInput.fill('updated translation');

    // Save changes
    await page.locator('[data-testid="vocabulary-card-edit-submit"]').click();

    // Modal should close
    await expect(editModal).not.toBeVisible({ timeout: 10000 });

    // Verify the update is reflected - scope to the specific card
    await expect(cardLocator.getByText('updated translation')).toBeVisible({ timeout: 5000 });

    // Clean up - delete the card
    const deleteButton = cardLocator.locator('button[data-testid^="delete-card-"]');
    await deleteButton.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    const deleteConfirmButton = dialog.locator('button').filter({ hasText: /delete/i });
    await deleteConfirmButton.click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });
  });
});

// ============================================================================
// DELETE CARD FLOWS (5-6)
// ============================================================================

test.describe('User Card Creation - Delete Flows', () => {
  test.use({ storageState: LEARNER_AUTH });

  test('Flow 5: Delete card - full flow', async ({ page }) => {
    // First, create a card to delete
    await page.goto('/my-decks');
    await expect(page.locator('[data-testid="my-decks-title"]')).toBeVisible({ timeout: 15000 });
    const deckCards = page.locator('[data-testid="deck-card"]');
    await expect(deckCards.first()).toBeVisible({ timeout: 15000 });
    await deckCards.first().click();
    await page.waitForURL(/\/my-decks\/[a-f0-9-]+/i);
    await expect(page.locator('[data-testid="my-deck-detail"]')).toBeVisible({ timeout: 10000 });

    // Create a test card
    await page.locator('[data-testid="create-card-button"]').click();
    const createModal = page.locator('[data-testid="user-vocabulary-card-create-modal"]');
    await expect(createModal).toBeVisible({ timeout: 5000 });

    const uniqueGreek = `delete_test_${Date.now()}`;
    await page.locator('[data-testid="front-text-input"]').fill(uniqueGreek);
    await page.locator('[data-testid="back-text-en-input"]').fill('to be deleted');
    await page.locator('[data-testid="user-vocabulary-card-submit"]').click();
    await expect(page.locator('[data-testid="user-vocabulary-card-create-success"]')).toBeVisible({
      timeout: 10000,
    });
    await page.locator('[data-testid="user-vocabulary-card-done"]').click();
    await expect(createModal).not.toBeVisible({ timeout: 5000 });

    // Wait for cards list and get count
    const cardsList = page.locator('[data-testid="cards-list"]');
    await expect(cardsList).toBeVisible({ timeout: 10000 });
    const initialCount = await cardsList.locator('[data-testid^="card-"]').count();

    // Find the card and click delete
    const cardLocator = page.locator('[data-testid^="card-"]').filter({
      hasText: uniqueGreek,
    });
    await expect(cardLocator).toBeVisible();

    const deleteButton = cardLocator.locator('button[data-testid^="delete-card-"]');
    await deleteButton.click();

    // Confirmation dialog should appear
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Click Delete to confirm - use button filter to avoid matching title
    const deleteConfirmButton = dialog.locator('button').filter({ hasText: /delete/i });
    await deleteConfirmButton.click();

    // Dialog should close
    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    // Card should be removed - wait for the specific card to disappear
    await expect(cardLocator).not.toBeVisible({ timeout: 5000 });

    // Verify the count decreased
    // If we deleted the last card, empty state should be shown instead of cards list
    if (initialCount === 1) {
      // Deleted the only card - empty state should now be visible
      const emptyState = page.locator('[data-testid="cards-empty-state"]');
      await expect(emptyState).toBeVisible({ timeout: 5000 });
    } else {
      // Still have cards remaining - verify count decreased
      const updatedCardsList = page.locator('[data-testid="cards-list"]');
      await expect(updatedCardsList).toBeVisible({ timeout: 5000 });
      const newCount = await updatedCardsList.locator('[data-testid^="card-"]').count();
      expect(newCount).toBe(initialCount - 1);
    }
  });

  test('Flow 6: Delete card - cancel', async ({ page }) => {
    // First, create a card to test cancel
    await page.goto('/my-decks');
    await expect(page.locator('[data-testid="my-decks-title"]')).toBeVisible({ timeout: 15000 });
    const deckCards = page.locator('[data-testid="deck-card"]');
    await expect(deckCards.first()).toBeVisible({ timeout: 15000 });
    await deckCards.first().click();
    await page.waitForURL(/\/my-decks\/[a-f0-9-]+/i);
    await expect(page.locator('[data-testid="my-deck-detail"]')).toBeVisible({ timeout: 10000 });

    // Create a test card
    await page.locator('[data-testid="create-card-button"]').click();
    const createModal = page.locator('[data-testid="user-vocabulary-card-create-modal"]');
    await expect(createModal).toBeVisible({ timeout: 5000 });

    const uniqueGreek = `cancel_delete_test_${Date.now()}`;
    await page.locator('[data-testid="front-text-input"]').fill(uniqueGreek);
    await page.locator('[data-testid="back-text-en-input"]').fill('should remain');
    await page.locator('[data-testid="user-vocabulary-card-submit"]').click();
    await expect(page.locator('[data-testid="user-vocabulary-card-create-success"]')).toBeVisible({
      timeout: 10000,
    });
    await page.locator('[data-testid="user-vocabulary-card-done"]').click();
    await expect(createModal).not.toBeVisible({ timeout: 5000 });

    // Find the card and click delete
    const cardLocator = page.locator('[data-testid^="card-"]').filter({
      hasText: uniqueGreek,
    });
    await expect(cardLocator).toBeVisible({ timeout: 10000 });

    const deleteButton = cardLocator.locator('button[data-testid^="delete-card-"]');
    await deleteButton.click();

    // Confirmation dialog should appear
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Click Cancel
    await dialog.getByRole('button', { name: /cancel/i }).click();

    // Dialog should close
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    // Card should still exist
    await expect(cardLocator).toBeVisible();

    // Actually delete the card for cleanup
    await deleteButton.click();
    await expect(dialog).toBeVisible({ timeout: 5000 });
    const deleteConfirmButton = dialog.locator('button').filter({ hasText: /delete/i });
    await deleteConfirmButton.click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });
  });
});

// ============================================================================
// EMPTY STATE FLOW (7)
// ============================================================================

test.describe('User Card Creation - Empty State Flow', () => {
  test.use({ storageState: BEGINNER_AUTH });

  test('Flow 7: Create first card from empty deck', async ({ page }) => {
    // First, create a deck (beginner has no decks)
    await page.goto('/my-decks');
    await expect(page.locator('[data-testid="my-decks-title"]')).toBeVisible({ timeout: 15000 });

    // Wait for loading to complete - either empty state or decks
    const emptyState = page.locator('[data-testid="my-decks-empty-state"]');
    const deckCards = page.locator('[data-testid="deck-card"]');
    await expect(emptyState.or(deckCards.first())).toBeVisible({ timeout: 15000 });

    // Create a new deck
    const createDeckButton = page.getByRole('button', { name: /create deck/i }).first();
    await createDeckButton.click();

    const deckModal = page.locator('[data-testid="user-deck-modal"]');
    await expect(deckModal).toBeVisible({ timeout: 5000 });

    const uniqueDeckName = `Empty Deck Test ${Date.now()}`;
    await page.locator('[data-testid="user-deck-form-name"]').fill(uniqueDeckName);
    await page.locator('[data-testid="user-deck-form-submit"]').click();
    await expect(deckModal).not.toBeVisible({ timeout: 10000 });

    // Click on the new deck to go to detail page
    const newDeckCard = page.locator('[data-testid="deck-card"]').filter({
      has: page.locator('[data-testid="deck-card-title"]', { hasText: uniqueDeckName }),
    });
    await expect(newDeckCard).toBeVisible({ timeout: 10000 });
    await newDeckCard.click();

    // Wait for deck detail page
    await page.waitForURL(/\/my-decks\/[a-f0-9-]+/i);
    await expect(page.locator('[data-testid="my-deck-detail"]')).toBeVisible({ timeout: 10000 });

    // Verify empty state is shown for cards
    const cardsEmptyState = page.locator('[data-testid="cards-empty-state"]');
    await expect(cardsEmptyState).toBeVisible({ timeout: 10000 });

    // Click the empty state CTA button
    await page.locator('[data-testid="empty-state-create-card-button"]').click();

    // Modal should open
    const createCardModal = page.locator('[data-testid="user-vocabulary-card-create-modal"]');
    await expect(createCardModal).toBeVisible({ timeout: 5000 });

    // Fill and create card
    const uniqueGreek = `first_card_${Date.now()}`;
    await page.locator('[data-testid="front-text-input"]').fill(uniqueGreek);
    await page.locator('[data-testid="back-text-en-input"]').fill('first translation');
    await page.locator('[data-testid="user-vocabulary-card-submit"]').click();

    // Wait for success
    await expect(page.locator('[data-testid="user-vocabulary-card-create-success"]')).toBeVisible({
      timeout: 10000,
    });
    await page.locator('[data-testid="user-vocabulary-card-done"]').click();
    await expect(createCardModal).not.toBeVisible({ timeout: 5000 });

    // Verify empty state is gone and cards list is shown
    await expect(cardsEmptyState).not.toBeVisible();
    await expect(page.locator('[data-testid="cards-list"]')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(uniqueGreek)).toBeVisible();

    // Clean up - delete the deck (which will delete the card)
    await page.locator('[data-testid="deck-detail-delete-button"]').click();
    const deleteDialog = page.getByRole('dialog');
    await expect(deleteDialog).toBeVisible({ timeout: 5000 });
    const deleteConfirmButton = deleteDialog.locator('button').filter({ hasText: /delete/i });
    await deleteConfirmButton.click();
    await expect(page).toHaveURL(/\/my-decks$/, { timeout: 10000 });
  });
});

// ============================================================================
// AUTHORIZATION FLOW (8)
// ============================================================================

test.describe('User Card Creation - Authorization', () => {
  test.use({ storageState: BEGINNER_AUTH });

  test('Flow 8: API returns 403 for unauthorized card update', async ({ request }) => {
    // Get both users' access tokens
    const learnerAccessToken = getAccessToken(LEARNER_AUTH);
    const beginnerAccessToken = getAccessToken(BEGINNER_AUTH);

    test.skip(
      !learnerAccessToken || !beginnerAccessToken,
      'Auth states not available for both users'
    );
    if (!learnerAccessToken || !beginnerAccessToken) return;

    // Fetch learner's decks to get a deck ID
    const decksResponse = await request.get('/api/v1/decks/mine', {
      headers: {
        Authorization: `Bearer ${learnerAccessToken}`,
      },
    });

    test.skip(!decksResponse.ok(), 'Could not fetch learner decks');
    if (!decksResponse.ok()) return;

    const decksData = await decksResponse.json();
    test.skip(!decksData.decks?.length, 'Learner has no decks');
    if (!decksData.decks?.length) return;

    const learnerDeckId = decksData.decks[0].id;

    // Fetch cards from the learner's deck
    const cardsResponse = await request.get(`/api/v1/cards?deck_id=${learnerDeckId}`, {
      headers: {
        Authorization: `Bearer ${learnerAccessToken}`,
      },
    });

    // If no cards, skip the test
    if (!cardsResponse.ok()) {
      test.skip(true, 'Could not fetch learner cards');
      return;
    }

    const cardsData = await cardsResponse.json();
    if (!cardsData.cards?.length) {
      test.skip(true, 'Learner has no cards in the deck');
      return;
    }

    const learnerCardId = cardsData.cards[0].id;

    // Try to update the learner's card as beginner
    const updateResponse = await request.patch(`/api/v1/cards/${learnerCardId}`, {
      headers: {
        Authorization: `Bearer ${beginnerAccessToken}`,
        'Content-Type': 'application/json',
      },
      data: {
        back_text_en: 'hacked translation',
      },
    });

    // Assert 403 status code
    expect(updateResponse.status()).toBe(403);

    // Assert error response includes appropriate error detail
    const errorData = await updateResponse.json();
    expect(errorData.error?.message).toBeDefined();
  });
});
