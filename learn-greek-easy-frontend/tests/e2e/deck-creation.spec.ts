/**
 * Deck Creation E2E Tests
 *
 * Tests for user deck CRUD operations including:
 * - Create Flows (1-3): Full flow, validation, cancel
 * - Edit Flows (4-5): From deck detail page, cancel
 * - Delete Flows (6-7): From deck detail page, cancel
 * - Admin Flows (8-9): Admin sees only own deck, admin can edit own deck
 * - Validation Flows (10-12): Max character, default level, no changes edit
 *
 * Edit/delete moved off the My Decks grid card onto the deck detail page
 * (V2DeckPage): open a deck, then use its Edit / Delete buttons. Deleting a
 * deck redirects back to /my-decks.
 *
 * Test Users:
 * - e2e_learner: Has 3 user-owned decks (My Greek Basics, Travel Phrases, Practice Deck)
 * - e2e_beginner: Has 0 user-owned decks (empty state)
 * - e2e_admin: Has 1 user-owned deck (Admin's Personal Deck) + admin role
 *
 * Note: Tests that create decks should clean up after themselves to maintain isolation.
 */

import { test, expect, type Page } from '@playwright/test';

// Storage state paths
const LEARNER_AUTH = 'playwright/.auth/learner.json';
const BEGINNER_AUTH = 'playwright/.auth/beginner.json';
const ADMIN_AUTH = 'playwright/.auth/admin.json';

/**
 * Open a personal deck's detail page (V2DeckPage) from /my-decks by its title.
 * Edit/delete buttons live here, not on the grid card.
 */
async function openDeckDetail(page: Page, title: string) {
  const card = page.locator('[data-testid="deck-card"]').filter({
    has: page.locator('[data-testid="deck-card-title"]', { hasText: title }),
  });
  await expect(card).toBeVisible({ timeout: 15000 });
  await card.click();
  await page.waitForURL(/\/decks\/[a-f0-9-]+/i);
  await expect(page.locator('[data-testid="v2-deck-detail"]')).toBeVisible({ timeout: 15000 });
  // Owner actions are only rendered for personal decks.
  await expect(page.locator('[data-testid="deck-detail-actions"]')).toBeVisible({ timeout: 10000 });
}

/**
 * Delete a personal deck via its detail page; resolves once redirected back to
 * /my-decks. Used for test cleanup as well as the delete flow itself.
 */
async function deleteDeckViaDetail(page: Page, title: string) {
  await openDeckDetail(page, title);
  await page.locator('[data-testid="delete-deck-button"]').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 5000 });
  await dialog.getByRole('button', { name: /delete/i }).click();
  await page.waitForURL(/\/my-decks$/, { timeout: 10000 });
}

// ============================================================================
// CREATE FLOWS (1-3)
// ============================================================================

test.describe('Deck Creation - Create Flows', () => {
  test.use({ storageState: BEGINNER_AUTH });

  test('Flow 1: Create deck full flow - modal to grid', async ({ page }) => {
    await page.goto('/my-decks');

    // Wait for page to load - check for either empty state or deck cards
    await expect(page.locator('[data-testid="my-decks-title"]')).toBeVisible({ timeout: 15000 });

    // Wait for loading to complete
    await page.waitForTimeout(1000);

    // Check current state - might have empty state or existing test decks
    const emptyState = page.locator('[data-testid="my-decks-empty-state"]');
    const hasEmptyState = await emptyState.isVisible().catch(() => false);

    // Get initial deck count
    const deckCards = page.locator('[data-testid="deck-card"]');
    const initialCount = hasEmptyState ? 0 : await deckCards.count();

    // Click "Create Deck" button (either in empty state or action card)
    const createDeckButton = page.getByRole('button', { name: /create deck/i }).first();
    await expect(createDeckButton).toBeVisible();
    await createDeckButton.click();

    // Modal should open
    const modal = page.locator('[data-testid="user-deck-modal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Modal should show "Create New Deck" title
    await expect(page.locator('[data-testid="user-deck-modal-title"]')).toContainText(
      /create new deck/i
    );

    // Fill in deck name with unique identifier
    const nameInput = page.locator('[data-testid="user-deck-form-name"]');
    const uniqueName = `Test Vocabulary ${Date.now()}`;
    await nameInput.fill(uniqueName);

    // Fill in description (optional)
    const descriptionInput = page.locator('[data-testid="user-deck-form-description"]');
    await descriptionInput.fill('A collection of words for testing');

    // Select level (A2)
    const levelSelect = page.locator('[data-testid="user-deck-form-level"]');
    await levelSelect.click();
    await page.locator('[data-testid="user-deck-form-level-A2"]').click();

    // Submit form
    const submitButton = page.locator('[data-testid="user-deck-form-submit"]');
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    // Modal should close
    await expect(modal).not.toBeVisible({ timeout: 10000 });

    // Deck count should increase by 1
    await expect(deckCards).toHaveCount(initialCount + 1, { timeout: 10000 });

    // Verify deck name appears
    await expect(page.locator('[data-testid="deck-card-title"]', { hasText: uniqueName })).toBeVisible();

    // If we started with empty state, it should no longer be visible
    if (hasEmptyState) {
      await expect(emptyState).not.toBeVisible();
    }

    // Clean up - delete the deck we just created (via its detail page)
    await deleteDeckViaDetail(page, uniqueName);
  });

  test('Flow 2: Create deck validation - empty name shows error', async ({ page }) => {
    await page.goto('/my-decks');

    // Wait for page to load
    await expect(page.locator('[data-testid="my-decks-title"]')).toBeVisible({ timeout: 15000 });

    // Click "Create Deck" button (in card or empty state)
    const createDeckButton = page.getByRole('button', { name: /create deck/i }).first();
    await createDeckButton.click();

    // Modal should open
    const modal = page.locator('[data-testid="user-deck-modal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Leave name empty and check submit is disabled
    const nameInput = page.locator('[data-testid="user-deck-form-name"]');
    await expect(nameInput).toHaveValue('');

    // Submit button should be disabled when form is invalid
    const submitButton = page.locator('[data-testid="user-deck-form-submit"]');
    await expect(submitButton).toBeDisabled();

    // Focus on name and blur to trigger validation
    await nameInput.focus();
    await nameInput.blur();

    // Wait a moment for validation to trigger
    await page.waitForTimeout(500);

    // Submit should still be disabled
    await expect(submitButton).toBeDisabled();
  });

  test('Flow 3: Create deck cancel - modal closes, no deck created', async ({ page }) => {
    await page.goto('/my-decks');

    // Wait for page to load
    await expect(page.locator('[data-testid="my-decks-title"]')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1000);

    // Get initial state
    const deckCards = page.locator('[data-testid="deck-card"]');
    const emptyState = page.locator('[data-testid="my-decks-empty-state"]');
    const hasEmptyState = await emptyState.isVisible().catch(() => false);
    const initialCount = hasEmptyState ? 0 : await deckCards.count();

    // Click "Create Deck" button
    const createDeckButton = page.getByRole('button', { name: /create deck/i }).first();
    await createDeckButton.click();

    // Modal should open
    const modal = page.locator('[data-testid="user-deck-modal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Fill in some data with unique name
    const nameInput = page.locator('[data-testid="user-deck-form-name"]');
    const uniqueName = `Should Not Be Created ${Date.now()}`;
    await nameInput.fill(uniqueName);

    // Click cancel button
    const cancelButton = page.locator('[data-testid="user-deck-form-cancel"]');
    await cancelButton.click();

    // Modal should close
    await expect(modal).not.toBeVisible({ timeout: 5000 });

    // Deck count should remain the same (no deck was created)
    if (hasEmptyState) {
      await expect(emptyState).toBeVisible();
      await expect(deckCards).toHaveCount(0);
    } else {
      await expect(deckCards).toHaveCount(initialCount);
    }

    // The unique name should NOT appear anywhere
    await expect(page.locator('[data-testid="deck-card-title"]', { hasText: uniqueName })).not.toBeVisible();
  });
});

// ============================================================================
// EDIT FLOWS (4-5)
// ============================================================================

test.describe('Deck Creation - Edit Flows', () => {
  test.use({ storageState: LEARNER_AUTH });

  test('Flow 4: Edit from detail page - open deck, modify, save, verify changes', async ({
    page,
  }) => {
    await page.goto('/my-decks');

    // Wait for page title
    await expect(page.locator('[data-testid="my-decks-title"]')).toBeVisible({ timeout: 15000 });

    // Wait for decks to load - handle potential 429 rate limit errors
    const deckCards = page.locator('[data-testid="deck-card"]');
    const errorState = page.getByText(/error loading|request failed/i);

    // Wait for either decks or error state
    await expect(deckCards.first().or(errorState.first())).toBeVisible({ timeout: 15000 });

    // If error, click retry and wait for decks
    if (await errorState.isVisible().catch(() => false)) {
      const retryButton = page.getByRole('button', { name: /try again/i });
      await retryButton.click();
      await expect(deckCards.first()).toBeVisible({ timeout: 15000 });
    }

    // Open "My Greek Basics" detail page and click Edit
    await openDeckDetail(page, 'My Greek Basics');
    await page.locator('[data-testid="edit-deck-button"]').click();

    // Modal should open in edit mode
    const modal = page.locator('[data-testid="user-deck-modal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="user-deck-modal-title"]')).toContainText(/edit deck/i);

    // Name should be pre-filled
    const nameInput = page.locator('[data-testid="user-deck-form-name"]');
    await expect(nameInput).toHaveValue('My Greek Basics');

    // Modify the name
    await nameInput.clear();
    await nameInput.fill('My Greek Basics Updated');

    // Save changes
    const submitButton = page.locator('[data-testid="user-deck-form-submit"]');
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    // Modal should close
    await expect(modal).not.toBeVisible({ timeout: 10000 });

    // Verify the deck name was updated, visible back in the grid
    await page.goto('/my-decks');
    await expect(
      page.locator('[data-testid="deck-card-title"]', { hasText: 'My Greek Basics Updated' })
    ).toBeVisible({ timeout: 10000 });

    // Restore original name for other tests (via detail page)
    await openDeckDetail(page, 'My Greek Basics Updated');
    await page.locator('[data-testid="edit-deck-button"]').click();
    await expect(modal).toBeVisible({ timeout: 5000 });
    await nameInput.clear();
    await nameInput.fill('My Greek Basics');
    await submitButton.click();
    await expect(modal).not.toBeVisible({ timeout: 10000 });
  });

  test('Flow 5: Edit cancel - open edit modal, cancel, verify no changes', async ({ page }) => {
    await page.goto('/my-decks');

    // Wait for page title
    await expect(page.locator('[data-testid="my-decks-title"]')).toBeVisible({ timeout: 15000 });

    // Wait for decks to load - handle potential 429 rate limit errors
    const deckCards = page.locator('[data-testid="deck-card"]');
    const errorState = page.getByText(/error loading|request failed/i);

    // Wait for either decks or error state
    await expect(deckCards.first().or(errorState.first())).toBeVisible({ timeout: 15000 });

    // If error, click retry and wait for decks
    if (await errorState.isVisible().catch(() => false)) {
      const retryButton = page.getByRole('button', { name: /try again/i });
      await retryButton.click();
      await expect(deckCards.first()).toBeVisible({ timeout: 15000 });
    }

    // Open "Practice Deck" detail page and click Edit
    await openDeckDetail(page, 'Practice Deck');
    await page.locator('[data-testid="edit-deck-button"]').click();

    // Modal should open
    const modal = page.locator('[data-testid="user-deck-modal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Store original name
    const nameInput = page.locator('[data-testid="user-deck-form-name"]');
    const originalName = await nameInput.inputValue();

    // Make changes
    await nameInput.clear();
    await nameInput.fill('Changed Name That Should Not Save');

    // Click cancel
    const cancelButton = page.locator('[data-testid="user-deck-form-cancel"]');
    await cancelButton.click();

    // Modal should close
    await expect(modal).not.toBeVisible({ timeout: 5000 });

    // Original name should still be visible in the grid (changes not saved)
    await page.goto('/my-decks');
    await expect(
      page.locator('[data-testid="deck-card-title"]', { hasText: originalName })
    ).toBeVisible();

    // Changed name should NOT be visible
    await expect(
      page.locator('[data-testid="deck-card-title"]', { hasText: 'Changed Name That Should Not Save' })
    ).not.toBeVisible();
  });
});

// ============================================================================
// DELETE FLOWS (6-7)
// ============================================================================

test.describe('Deck Creation - Delete Flows', () => {
  test.describe('Delete from Detail Page', () => {
    test.use({ storageState: BEGINNER_AUTH });

    test('Flow 6: Delete from detail page - delete, verify redirect + removed', async ({
      page,
    }) => {
      // First create a deck to delete
      await page.goto('/my-decks');
      await expect(page.locator('[data-testid="my-decks-title"]')).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(1000);

      // Get initial deck count
      const deckCards = page.locator('[data-testid="deck-card"]');
      const emptyState = page.locator('[data-testid="my-decks-empty-state"]');
      const hasEmptyState = await emptyState.isVisible().catch(() => false);
      const initialCount = hasEmptyState ? 0 : await deckCards.count();

      // Create a new deck first
      const createDeckButton = page.getByRole('button', { name: /create deck/i }).first();
      await createDeckButton.click();

      const modal = page.locator('[data-testid="user-deck-modal"]');
      await expect(modal).toBeVisible({ timeout: 5000 });

      const nameInput = page.locator('[data-testid="user-deck-form-name"]');
      const uniqueName = `Deck To Delete ${Date.now()}`;
      await nameInput.fill(uniqueName);

      const submitButton = page.locator('[data-testid="user-deck-form-submit"]');
      await submitButton.click();
      await expect(modal).not.toBeVisible({ timeout: 10000 });

      // Verify deck was created
      await expect(
        page.locator('[data-testid="deck-card-title"]', { hasText: uniqueName })
      ).toBeVisible({ timeout: 10000 });
      await expect(deckCards).toHaveCount(initialCount + 1, { timeout: 5000 });

      // Open the deck detail page and delete it
      await openDeckDetail(page, uniqueName);
      await page.locator('[data-testid="delete-deck-button"]').click();

      // Confirmation dialog should appear
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: 5000 });
      await expect(dialog.getByText(/delete deck/i)).toBeVisible();

      // Confirm deletion → redirects to /my-decks
      await dialog.getByRole('button', { name: /delete/i }).click();
      await page.waitForURL(/\/my-decks$/, { timeout: 10000 });

      // Deck should be removed from the grid
      await expect(
        page.locator('[data-testid="deck-card-title"]', { hasText: uniqueName })
      ).not.toBeVisible({ timeout: 5000 });

      // Deck count should be back to initial
      if (initialCount === 0) {
        await expect(emptyState).toBeVisible({ timeout: 5000 });
      } else {
        await expect(deckCards).toHaveCount(initialCount, { timeout: 5000 });
      }
    });
  });

  test.describe('Delete Cancel', () => {
    test.use({ storageState: LEARNER_AUTH });

    test('Flow 7: Delete cancel - click delete, cancel, verify deck still exists', async ({
      page,
    }) => {
      await page.goto('/my-decks');

      // Wait for decks to load
      const deckCards = page.locator('[data-testid="deck-card"]');
      await expect(deckCards.first()).toBeVisible({ timeout: 15000 });

      // Open "My Greek Basics" detail and click delete
      await openDeckDetail(page, 'My Greek Basics');
      await page.locator('[data-testid="delete-deck-button"]').click();

      // Confirmation dialog should appear
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: 5000 });

      // Click cancel
      const cancelButton = dialog.getByRole('button', { name: /cancel/i });
      await cancelButton.click();

      // Dialog should close, still on the deck detail page (no redirect)
      await expect(dialog).not.toBeVisible({ timeout: 5000 });
      await expect(page.locator('[data-testid="v2-deck-detail"]')).toBeVisible();

      // Deck should still exist in the grid (still 3 decks)
      await page.goto('/my-decks');
      await expect(
        page.locator('[data-testid="deck-card-title"]', { hasText: 'My Greek Basics' })
      ).toBeVisible();
      await expect(deckCards).toHaveCount(3);
    });
  });
});

// ============================================================================
// ADMIN FLOWS (8-9)
// ============================================================================

test.describe('Deck Creation - Admin Flows', () => {
  test.use({ storageState: ADMIN_AUTH });

  test('Flow 8: Admin sees only their own deck on My Decks page', async ({ page }) => {
    await page.goto('/my-decks');

    // Wait for page to load
    await expect(page.locator('[data-testid="my-decks-title"]')).toBeVisible({ timeout: 15000 });

    // Wait for decks to load
    const deckCards = page.locator('[data-testid="deck-card"]');
    await expect(deckCards.first()).toBeVisible({ timeout: 15000 });

    // Admin should see exactly 1 deck - their own personal deck
    await expect(deckCards).toHaveCount(1);

    // Assert it's the admin's personal deck
    await expect(
      page.locator('[data-testid="deck-card-title"]', { hasText: "Admin's Personal Deck" })
    ).toBeVisible();

    // Other users' decks should NOT be visible
    await expect(
      page.locator('[data-testid="deck-card-title"]', { hasText: 'My Greek Basics' })
    ).not.toBeVisible();
    await expect(
      page.locator('[data-testid="deck-card-title"]', { hasText: 'Travel Phrases' })
    ).not.toBeVisible();
  });

  test('Flow 9: Admin can edit their own deck', async ({ page }) => {
    await page.goto('/my-decks');

    // Wait for deck to load
    const deckCards = page.locator('[data-testid="deck-card"]');
    await expect(deckCards.first()).toBeVisible({ timeout: 15000 });

    // Open admin's deck detail and click edit
    await openDeckDetail(page, "Admin's Personal Deck");
    await page.locator('[data-testid="edit-deck-button"]').click();

    // Modal should open
    const modal = page.locator('[data-testid="user-deck-modal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Should show edit mode
    await expect(page.locator('[data-testid="user-deck-modal-title"]')).toContainText(/edit deck/i);

    // Name should be pre-filled
    const nameInput = page.locator('[data-testid="user-deck-form-name"]');
    await expect(nameInput).toHaveValue("Admin's Personal Deck");

    // Cancel without changes
    const cancelButton = page.locator('[data-testid="user-deck-form-cancel"]');
    await cancelButton.click();
    await expect(modal).not.toBeVisible({ timeout: 5000 });
  });
});

// ============================================================================
// VALIDATION FLOWS (10-12)
// ============================================================================

test.describe('Deck Creation - Validation Flows', () => {
  test.use({ storageState: BEGINNER_AUTH });

  test('Flow 10: Max character validation for name (255 chars)', async ({ page }) => {
    await page.goto('/my-decks');
    await expect(page.locator('[data-testid="my-decks-title"]')).toBeVisible({ timeout: 15000 });

    // Open create modal
    const createDeckButton = page.getByRole('button', { name: /create deck/i }).first();
    await createDeckButton.click();

    const modal = page.locator('[data-testid="user-deck-modal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Enter a name that exceeds 255 characters
    const nameInput = page.locator('[data-testid="user-deck-form-name"]');
    const longName = 'A'.repeat(256);
    await nameInput.fill(longName);

    // Trigger validation by blurring
    await nameInput.blur();

    // Submit button should be disabled
    const submitButton = page.locator('[data-testid="user-deck-form-submit"]');
    await expect(submitButton).toBeDisabled();

    // Enter valid name (exactly 255 chars)
    await nameInput.clear();
    const validName = 'B'.repeat(255);
    await nameInput.fill(validName);

    // Submit should be enabled
    await expect(submitButton).toBeEnabled({ timeout: 2000 });

    // Cancel to clean up
    const cancelButton = page.locator('[data-testid="user-deck-form-cancel"]');
    await cancelButton.click();
  });

  test('Flow 11: Default level is A1', async ({ page }) => {
    await page.goto('/my-decks');
    await expect(page.locator('[data-testid="my-decks-title"]')).toBeVisible({ timeout: 15000 });

    // Open create modal
    const createDeckButton = page.getByRole('button', { name: /create deck/i }).first();
    await createDeckButton.click();

    const modal = page.locator('[data-testid="user-deck-modal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Check that the level dropdown shows A1 by default
    const levelSelect = page.locator('[data-testid="user-deck-form-level"]');
    await expect(levelSelect).toContainText('A1');

    // Cancel to clean up
    const cancelButton = page.locator('[data-testid="user-deck-form-cancel"]');
    await cancelButton.click();
  });

  /**
   * Flow 12: Edit with no changes - submit works
   *
   * Verifies that opening the edit modal and submitting without making any changes
   * works correctly. The form should remain valid and the submit should succeed.
   */
  test('Flow 12: Edit with no changes - submit works', async ({ page }) => {
    await page.goto('/my-decks');

    // Wait for page to load
    await expect(page.locator('[data-testid="my-decks-title"]')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1000);

    // Open create modal and create a test deck with unique name
    const createDeckButton = page.getByRole('button', { name: /create deck/i }).first();
    await createDeckButton.click();

    const modal = page.locator('[data-testid="user-deck-modal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    const nameInput = page.locator('[data-testid="user-deck-form-name"]');
    const uniqueName = `No Changes Test ${Date.now()}`;
    await nameInput.fill(uniqueName);

    const submitButton = page.locator('[data-testid="user-deck-form-submit"]');
    await submitButton.click();
    await expect(modal).not.toBeVisible({ timeout: 10000 });

    // Open the new deck's detail page and edit without changes
    await openDeckDetail(page, uniqueName);
    await page.locator('[data-testid="edit-deck-button"]').click();
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Wait for form to be ready - name should be pre-filled
    await expect(nameInput).toHaveValue(uniqueName, { timeout: 5000 });

    // Wait for level to be populated (form validation)
    const levelSelect = page.locator('[data-testid="user-deck-form-level"]');
    await expect(levelSelect).toContainText('A1', { timeout: 5000 });

    // Submit without making any changes - form should be valid
    await expect(submitButton).toBeEnabled({ timeout: 5000 });
    await submitButton.click();

    // Modal should close (no error)
    await expect(modal).not.toBeVisible({ timeout: 10000 });

    // Clean up - delete the test deck via its detail page
    await deleteDeckViaDetail(page, uniqueName);
  });
});

// ============================================================================
// CREATE FROM ACTION CARD (additional test)
// ============================================================================

test.describe('Deck Creation - Action Card Button', () => {
  test.use({ storageState: LEARNER_AUTH });

  test('Create deck from action card button (user with existing decks)', async ({ page }) => {
    await page.goto('/my-decks');

    // Wait for decks to load
    const deckCards = page.locator('[data-testid="deck-card"]');
    await expect(deckCards.first()).toBeVisible({ timeout: 15000 });

    // Learner should have at least 3 existing decks (from seeding)
    const initialCount = await deckCards.count();
    expect(initialCount).toBeGreaterThanOrEqual(3);

    // Click "Create Deck" button in the action card (top of page)
    const createDeckButton = page
      .locator('button')
      .filter({ has: page.locator('text=/create deck/i') })
      .first();
    await createDeckButton.click();

    // Modal should open
    const modal = page.locator('[data-testid="user-deck-modal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Create a new deck with unique name
    const nameInput = page.locator('[data-testid="user-deck-form-name"]');
    const uniqueName = `Action Card Deck ${Date.now()}`;
    await nameInput.fill(uniqueName);

    const submitButton = page.locator('[data-testid="user-deck-form-submit"]');
    await submitButton.click();

    // Modal should close
    await expect(modal).not.toBeVisible({ timeout: 10000 });

    // Should now have one more deck
    await expect(deckCards).toHaveCount(initialCount + 1, { timeout: 10000 });

    // Verify the new deck appears
    await expect(
      page.locator('[data-testid="deck-card-title"]', { hasText: uniqueName })
    ).toBeVisible();

    // Clean up - delete the deck we just created (via its detail page)
    await deleteDeckViaDetail(page, uniqueName);

    // Back to initial count
    await expect(deckCards).toHaveCount(initialCount, { timeout: 10000 });
  });
});
