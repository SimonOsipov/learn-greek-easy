/**
 * Admin Culture Cards E2E Tests
 *
 * Tests for admin culture card create/edit operations including:
 * - Create card from action bar (full flow)
 * - Create card from deck detail modal
 * - Edit existing culture card
 * - Validation error for incomplete languages
 * - Cancel with unsaved changes confirmation
 * - Delete answer option (down to minimum 2)
 *
 * Test User:
 * - e2e_admin: Admin user with access to admin panel
 */

import { test, expect } from '@playwright/test';

// Storage state paths
const ADMIN_AUTH = 'playwright/.auth/admin.json';

// Helper function to fill culture card form with multilingual content
async function fillCultureCardForm(
  page: import('@playwright/test').Page,
  options: {
    questionRu?: string;
    questionEl?: string;
    questionEn?: string;
    answerA_Ru?: string;
    answerA_El?: string;
    answerA_En?: string;
    answerB_Ru?: string;
    answerB_El?: string;
    answerB_En?: string;
    correctAnswer?: 'A' | 'B' | 'C' | 'D';
  }
) {
  const {
    questionRu = 'Test question RU',
    questionEl = 'Test question EL',
    questionEn = 'Test question EN',
    answerA_Ru = 'Answer A RU',
    answerA_El = 'Answer A EL',
    answerA_En = 'Answer A EN',
    answerB_Ru = 'Answer B RU',
    answerB_El = 'Answer B EL',
    answerB_En = 'Answer B EN',
    correctAnswer = 'A',
  } = options;

  // Fill Russian tab (default active)
  await page.getByTestId('question-input-ru').fill(questionRu);
  await page.getByTestId('answer-input-A-ru').fill(answerA_Ru);
  await page.getByTestId('answer-input-B-ru').fill(answerB_Ru);

  // Switch to Greek tab and fill
  await page.getByTestId('lang-tab-el').click();
  await page.getByTestId('question-input-el').fill(questionEl);
  await page.getByTestId('answer-input-A-el').fill(answerA_El);
  await page.getByTestId('answer-input-B-el').fill(answerB_El);

  // Switch to English tab and fill
  await page.getByTestId('lang-tab-en').click();
  await page.getByTestId('question-input-en').fill(questionEn);
  await page.getByTestId('answer-input-A-en').fill(answerA_En);
  await page.getByTestId('answer-input-B-en').fill(answerB_En);

  // Select correct answer (radio buttons exist on all tabs, just click one)
  const correctRadio = page.getByTestId(`correct-radio-${correctAnswer}-en`);
  await correctRadio.click();
}

// ============================================================================
// CREATE FROM ACTION BAR
// ============================================================================

test.describe('Admin Culture Cards - Create from Action Bar', () => {
  test.use({ storageState: ADMIN_AUTH });

  test('Create culture card full flow - action bar to success', async ({ page }) => {
    // Navigate to admin panel
    await page.goto('/admin');
    await expect(page.getByTestId('admin-page')).toBeVisible({ timeout: 15000 });

    // Ensure we're on the decks tab
    await page.getByTestId('admin-tab-decks').click();

    // Click "Create Card" button in action bar
    await page.getByTestId('create-card-button').click();

    // Card create modal should open
    const modal = page.getByTestId('card-create-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Card type should default to culture (vocabulary is disabled)
    const cardTypeSelect = page.getByTestId('card-type-select');
    await expect(cardTypeSelect).toContainText('Culture');

    // Select a deck from the dropdown
    const deckSelect = page.getByTestId('deck-select');
    await deckSelect.click();

    // Wait for decks to load and select the first available deck
    const deckOptions = page.locator('[role="option"]').filter({ hasNot: page.locator('[data-disabled]') });
    await expect(deckOptions.first()).toBeVisible({ timeout: 5000 });
    await deckOptions.first().click();

    // Fill the culture card form with complete data
    const uniqueId = Date.now();
    await fillCultureCardForm(page, {
      questionRu: `E2E Test Question RU ${uniqueId}`,
      questionEl: `E2E Test Question EL ${uniqueId}`,
      questionEn: `E2E Test Question EN ${uniqueId}`,
      answerA_Ru: 'Correct Answer RU',
      answerA_El: 'Correct Answer EL',
      answerA_En: 'Correct Answer EN',
      answerB_Ru: 'Wrong Answer RU',
      answerB_El: 'Wrong Answer EL',
      answerB_En: 'Wrong Answer EN',
      correctAnswer: 'A',
    });

    // Click create button
    await page.getByTestId('create-btn').click();

    // Success state should appear - dialog shows "Card Created" heading
    await expect(page.getByRole('heading', { name: /card created/i })).toBeVisible({ timeout: 10000 });

    // "Create Another" and "Done" buttons should be visible
    await expect(page.getByTestId('create-another-btn')).toBeVisible();
    await expect(page.getByTestId('done-btn')).toBeVisible();

    // Click "Done" to close modal
    await page.getByTestId('done-btn').click();

    // Modal should close
    await expect(modal).not.toBeVisible({ timeout: 5000 });
  });
});

// ============================================================================
// CREATE FROM DECK DETAIL MODAL
// ============================================================================

/**
 * Helper to seed culture content (decks and questions)
 */
async function seedCultureContent(page: import('@playwright/test').Page): Promise<void> {
  const apiBaseUrl = process.env.E2E_API_URL || process.env.VITE_API_URL || 'http://localhost:8000';
  const response = await page.request.post(`${apiBaseUrl}/api/v1/test/seed/culture`);
  if (!response.ok()) {
    console.warn('[TEST] Culture seeding failed, tests may use existing data');
  }
}

test.describe('Admin Culture Cards - Create from Deck Detail', () => {
  test.use({ storageState: ADMIN_AUTH });

  test.beforeEach(async ({ page }) => {
    // Seed culture decks and questions to ensure test data exists
    await seedCultureContent(page);
  });

  test('Create card from deck detail modal', async ({ page }) => {
    // Navigate to admin panel
    await page.goto('/admin');
    await expect(page.getByTestId('admin-page')).toBeVisible({ timeout: 15000 });

    // Ensure we're on the decks tab
    await page.getByTestId('admin-tab-decks').click();

    // Wait for deck list to load
    await page.waitForTimeout(2000);

    // Find and click on a culture deck to open detail modal
    // Look for a deck row with "culture" type indicator or culture badge
    const cultureDeckRow = page.locator('[data-testid^="deck-row-"]').filter({
      has: page.locator('text=/culture/i'),
    }).first();

    // Try culture deck first, fall back to any deck if not found
    let clickedCultureDeck = false;
    if (await cultureDeckRow.isVisible({ timeout: 2000 }).catch(() => false)) {
      await cultureDeckRow.click();
      clickedCultureDeck = true;
    } else {
      // Try any deck row as fallback
      const anyDeckRow = page.locator('[data-testid^="deck-row-"]').first();
      if (await anyDeckRow.isVisible()) {
        await anyDeckRow.click();
      } else {
        // No decks available
        test.skip();
        return;
      }
    }

    // Deck detail modal should open
    const detailModal = page.getByTestId('deck-detail-modal');
    await expect(detailModal).toBeVisible({ timeout: 5000 });

    // Click "Create Card" button (available for both culture and vocabulary decks)
    const createCardBtn = page.getByTestId('create-card-btn');
    await expect(createCardBtn).toBeVisible({ timeout: 3000 });
    await createCardBtn.click();

    // Wait for either culture or vocabulary create modal to appear
    // Culture decks open card-create-modal, vocabulary decks open vocabulary-card-create-modal
    const cultureCreateModal = page.getByTestId('card-create-modal');
    const vocabCreateModal = page.getByTestId('vocabulary-card-create-modal');

    // Check which modal opened
    const isCultureModal = await cultureCreateModal.isVisible({ timeout: 3000 }).catch(() => false);

    if (!isCultureModal) {
      // This is a vocabulary deck, not a culture deck - close and skip
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      await page.getByTestId('deck-detail-close').click();
      test.skip();
      return;
    }

    // Culture card create modal is open
    const createModal = cultureCreateModal;
    await expect(createModal).toBeVisible({ timeout: 5000 });

    // Fill the culture card form
    const uniqueId = Date.now();
    await fillCultureCardForm(page, {
      questionRu: `Deck Detail Test RU ${uniqueId}`,
      questionEl: `Deck Detail Test EL ${uniqueId}`,
      questionEn: `Deck Detail Test EN ${uniqueId}`,
      answerA_Ru: 'Option A RU',
      answerA_El: 'Option A EL',
      answerA_En: 'Option A EN',
      answerB_Ru: 'Option B RU',
      answerB_El: 'Option B EL',
      answerB_En: 'Option B EN',
      correctAnswer: 'B',
    });

    // Click create button
    await page.getByTestId('create-btn').click();

    // Success state should appear - dialog shows "Card Created" heading
    await expect(page.getByRole('heading', { name: /card created/i })).toBeVisible({ timeout: 10000 });

    // Click "Done" to close
    await page.getByTestId('done-btn').click();
    await expect(createModal).not.toBeVisible({ timeout: 5000 });
  });
});

// ============================================================================
// EDIT EXISTING CULTURE CARD
// ============================================================================

test.describe('Admin Culture Cards - Edit Card', () => {
  test.use({ storageState: ADMIN_AUTH });

  test('Edit existing culture card', async ({ page }) => {
    // Navigate to admin panel
    await page.goto('/admin');
    await expect(page.getByTestId('admin-page')).toBeVisible({ timeout: 15000 });

    // Ensure we're on the decks tab
    await page.getByTestId('admin-tab-decks').click();

    // Wait for deck list to load
    await page.waitForTimeout(2000);

    // Click on a deck to open detail modal
    const deckRow = page.locator('[data-testid^="deck-row-"]').first();
    if (!(await deckRow.isVisible())) {
      test.skip();
      return;
    }
    await deckRow.click();

    // Deck detail modal should open
    const detailModal = page.getByTestId('deck-detail-modal');
    await expect(detailModal).toBeVisible({ timeout: 5000 });

    // Wait for questions to load
    await page.waitForTimeout(1000);

    // Find an edit button for a question
    const editBtn = page.locator('[data-testid^="edit-question-"]').first();
    const hasEditButton = await editBtn.isVisible().catch(() => false);

    if (!hasEditButton) {
      // No questions to edit, close modal
      await page.getByTestId('deck-detail-close').click();
      test.skip();
      return;
    }

    // Click edit button
    await editBtn.click();

    // Card edit modal should open
    const editModal = page.getByTestId('card-edit-modal');
    await expect(editModal).toBeVisible({ timeout: 5000 });

    // Modify the question text in Russian tab (should be active by default)
    const questionInput = page.getByTestId('question-input-ru');
    await expect(questionInput).toBeVisible();

    // Append text to existing question
    const originalText = await questionInput.inputValue();
    await questionInput.fill(`${originalText} (Edited)`);

    // Click save button
    await page.getByTestId('save-btn').click();

    // Modal should close after successful save
    await expect(editModal).not.toBeVisible({ timeout: 10000 });

    // Verify the edited question appears in the list
    await expect(page.getByText(/edited/i)).toBeVisible({ timeout: 5000 });
  });
});

// ============================================================================
// VALIDATION ERRORS
// ============================================================================

test.describe('Admin Culture Cards - Validation', () => {
  test.use({ storageState: ADMIN_AUTH });

  test('Validation error for incomplete languages', async ({ page }) => {
    // Navigate to admin panel
    await page.goto('/admin');
    await expect(page.getByTestId('admin-page')).toBeVisible({ timeout: 15000 });

    // Ensure we're on the decks tab
    await page.getByTestId('admin-tab-decks').click();

    // Click "Create Card" button
    await page.getByTestId('create-card-button').click();

    // Card create modal should open
    const modal = page.getByTestId('card-create-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Select a deck
    const deckSelect = page.getByTestId('deck-select');
    await deckSelect.click();
    const deckOptions = page.locator('[role="option"]').filter({ hasNot: page.locator('[data-disabled]') });
    await expect(deckOptions.first()).toBeVisible({ timeout: 5000 });
    await deckOptions.first().click();

    // Fill only Russian tab (leave Greek and English empty)
    await page.getByTestId('question-input-ru').fill('Russian question only');
    await page.getByTestId('answer-input-A-ru').fill('Answer A RU');
    await page.getByTestId('answer-input-B-ru').fill('Answer B RU');
    await page.getByTestId('correct-radio-A-ru').click();

    // Check that Greek and English tabs show incomplete indicators (red dots)
    const elIncomplete = page.getByTestId('lang-tab-el-incomplete');
    const enIncomplete = page.getByTestId('lang-tab-en-incomplete');

    await expect(elIncomplete).toBeVisible();
    await expect(enIncomplete).toBeVisible();

    // Try to submit - create button should be enabled but form validation should fail
    await page.getByTestId('create-btn').click();

    // Modal should still be open (submission failed due to validation)
    await expect(modal).toBeVisible();

    // The incomplete indicators should still be visible
    await expect(elIncomplete).toBeVisible();

    // Cancel and close
    await page.getByTestId('cancel-btn').click();

    // Since we made changes, should see discard confirmation
    const discardBtn = page.getByRole('button', { name: /discard/i });
    if (await discardBtn.isVisible()) {
      await discardBtn.click();
    }

    await expect(modal).not.toBeVisible({ timeout: 5000 });
  });
});

// ============================================================================
// CANCEL WITH UNSAVED CHANGES
// ============================================================================

test.describe('Admin Culture Cards - Cancel Confirmation', () => {
  test.use({ storageState: ADMIN_AUTH });

  test('Cancel with unsaved changes shows confirmation', async ({ page }) => {
    // Navigate to admin panel
    await page.goto('/admin');
    await expect(page.getByTestId('admin-page')).toBeVisible({ timeout: 15000 });

    // Ensure we're on the decks tab
    await page.getByTestId('admin-tab-decks').click();

    // Click "Create Card" button
    await page.getByTestId('create-card-button').click();

    // Card create modal should open
    const modal = page.getByTestId('card-create-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Select a deck
    const deckSelect = page.getByTestId('deck-select');
    await deckSelect.click();
    const deckOptions = page.locator('[role="option"]').filter({ hasNot: page.locator('[data-disabled]') });
    await expect(deckOptions.first()).toBeVisible({ timeout: 5000 });
    await deckOptions.first().click();

    // Make some changes to the form
    await page.getByTestId('question-input-ru').fill('Unsaved question content');

    // Click cancel button
    await page.getByTestId('cancel-btn').click();

    // Confirmation dialog should appear
    const keepEditingBtn = page.getByRole('button', { name: /keep editing/i });
    const discardBtn = page.getByRole('button', { name: /discard/i });

    await expect(keepEditingBtn).toBeVisible({ timeout: 5000 });
    await expect(discardBtn).toBeVisible();

    // Click "Keep Editing" to stay in the modal
    await keepEditingBtn.click();

    // Modal should still be open
    await expect(modal).toBeVisible();

    // The form should still have our content
    await expect(page.getByTestId('question-input-ru')).toHaveValue('Unsaved question content');

    // Now click cancel again and choose to discard
    await page.getByTestId('cancel-btn').click();
    await discardBtn.click();

    // Modal should close
    await expect(modal).not.toBeVisible({ timeout: 5000 });
  });
});

// ============================================================================
// DELETE ANSWER OPTION
// ============================================================================

test.describe('Admin Culture Cards - Delete Answer', () => {
  test.use({ storageState: ADMIN_AUTH });

  test('Delete answer option down to minimum 2', async ({ page }) => {
    // Navigate to admin panel
    await page.goto('/admin');
    await expect(page.getByTestId('admin-page')).toBeVisible({ timeout: 15000 });

    // Ensure we're on the decks tab
    await page.getByTestId('admin-tab-decks').click();

    // Click "Create Card" button
    await page.getByTestId('create-card-button').click();

    // Card create modal should open
    const modal = page.getByTestId('card-create-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Select a deck
    const deckSelect = page.getByTestId('deck-select');
    await deckSelect.click();
    const deckOptions = page.locator('[role="option"]').filter({ hasNot: page.locator('[data-disabled]') });
    await expect(deckOptions.first()).toBeVisible({ timeout: 5000 });
    await deckOptions.first().click();

    // Initially should have 2 answers (A and B)
    await expect(page.getByTestId('answer-input-A-ru')).toBeVisible();
    await expect(page.getByTestId('answer-input-B-ru')).toBeVisible();

    // Add answer C - use .first() since button exists on all language tabs but only one is visible
    await page.getByTestId('add-answer-btn').first().click();
    await expect(page.getByTestId('answer-input-C-ru')).toBeVisible();

    // Add answer D
    await page.getByTestId('add-answer-btn').first().click();
    await expect(page.getByTestId('answer-input-D-ru')).toBeVisible();

    // Now we have 4 answers, delete button should be enabled
    // Use .first() since delete buttons also exist on all language tabs
    const deleteD = page.getByTestId('delete-answer-D').first();
    await expect(deleteD).toBeEnabled();

    // Delete answer D
    await deleteD.click();
    await expect(page.getByTestId('answer-input-D-ru')).not.toBeVisible();

    // Delete answer C
    const deleteC = page.getByTestId('delete-answer-C').first();
    await expect(deleteC).toBeEnabled();
    await deleteC.click();
    await expect(page.getByTestId('answer-input-C-ru')).not.toBeVisible();

    // Now we're at minimum (2 answers), delete buttons should be disabled
    const deleteA = page.getByTestId('delete-answer-A').first();
    const deleteB = page.getByTestId('delete-answer-B').first();

    await expect(deleteA).toBeDisabled();
    await expect(deleteB).toBeDisabled();

    // Cancel and discard
    await page.getByTestId('cancel-btn').click();
    const discardBtn = page.getByRole('button', { name: /discard/i });
    if (await discardBtn.isVisible()) {
      await discardBtn.click();
    }
    await expect(modal).not.toBeVisible({ timeout: 5000 });
  });
});
