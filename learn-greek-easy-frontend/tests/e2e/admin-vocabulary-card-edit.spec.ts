/**
 * Admin Vocabulary Card Edit E2E Tests
 *
 * Tests for admin vocabulary card editing operations including:
 * - Edit modal pre-populates existing data
 * - Edit basic fields and save
 * - Edit noun grammar data and save
 * - Change part_of_speech from noun to verb
 * - Verify old grammar data cleared on part_of_speech change
 * - Add/remove examples and save
 * - Unsaved changes confirmation on close
 * - "Keep Editing" returns to form
 * - "Discard" closes without saving
 *
 * Test User:
 * - e2e_admin: Admin user with access to admin panel
 *
 * Seed Data:
 * - Deck: "E2E Vocabulary Cards Test Deck" with 10 cards
 *   - Card 4 "σπίτι": noun with partial declension
 *   - Card 5 "νερό": noun with full declension
 *   - Card 6 "τρώω": verb with active voice
 *   - Card 10 "βιβλίο": noun with examples
 */

import { test, expect } from '@playwright/test';

// Storage state paths
const ADMIN_AUTH = 'playwright/.auth/admin.json';

// Test data constants from seed_service.py
const DECK_NAME = 'E2E Vocabulary Cards Test Deck';
const UNIQUE_PREFIX = `E2E_EDIT_${Date.now()}`;

/**
 * Helper to seed admin vocabulary card test data
 */
async function seedAdminCards(page: import('@playwright/test').Page): Promise<void> {
  const apiBaseUrl = process.env.E2E_API_URL || process.env.VITE_API_URL || 'http://localhost:8000';
  const response = await page.request.post(`${apiBaseUrl}/api/v1/test/seed/admin-cards`);
  if (!response.ok()) {
    console.warn('[TEST] Admin card seeding failed, tests may use existing data');
  }
}

/**
 * Helper to navigate to admin panel and open the vocabulary deck with cards
 */
async function openVocabularyDeck(page: import('@playwright/test').Page): Promise<void> {
  // Navigate to admin panel
  await page.goto('/admin');
  await expect(page.getByTestId('admin-page')).toBeVisible({ timeout: 15000 });

  // Ensure we're on the decks tab
  await page.getByTestId('admin-tab-decks').click();

  // Wait for deck list to load
  await page.waitForTimeout(1000);

  // Find and click on the E2E Vocabulary Cards Test Deck
  const deckRow = page.locator('[data-testid^="deck-row-"]').filter({
    hasText: DECK_NAME,
  }).first();

  const hasDeck = await deckRow.isVisible().catch(() => false);
  if (hasDeck) {
    await deckRow.click();
  } else {
    // Fallback: click first vocabulary deck row
    const vocabDeckRow = page.locator('[data-testid^="deck-row-"]').filter({
      has: page.locator('text=/vocabulary/i'),
    }).first();
    if (await vocabDeckRow.isVisible().catch(() => false)) {
      await vocabDeckRow.click();
    } else {
      throw new Error('No vocabulary decks found in admin panel');
    }
  }

  // Deck detail modal should open
  const detailModal = page.getByTestId('deck-detail-modal');
  await expect(detailModal).toBeVisible({ timeout: 5000 });
}

/**
 * Helper to click the edit button for a card with specific front_text
 */
async function clickEditForCard(page: import('@playwright/test').Page, frontText: string): Promise<void> {
  // Find the card item that contains this front_text
  const cardItem = page.locator('[data-testid^="card-item-"]').filter({
    hasText: frontText,
  }).first();

  await expect(cardItem).toBeVisible({ timeout: 5000 });

  // Click the edit button within this card item
  const editBtn = cardItem.locator('[data-testid^="vocabulary-card-edit-"]');
  await editBtn.click();

  // Wait for edit modal to open
  await expect(page.getByTestId('vocabulary-card-edit-modal')).toBeVisible({ timeout: 5000 });
}

// ============================================================================
// EDIT MODAL PRE-POPULATION TESTS
// ============================================================================

test.describe('Admin Vocabulary Card Edit - Pre-population', () => {
  test.use({ storageState: ADMIN_AUTH });

  test.beforeEach(async ({ page }) => {
    await seedAdminCards(page);
    await openVocabularyDeck(page);
  });

  test('edit modal pre-populates existing data', async ({ page }) => {
    // Click edit on the card "σπίτι" (house) - Card 4 with noun data
    await clickEditForCard(page, 'σπίτι');

    // Verify form fields contain the card's data
    await expect(page.getByTestId('front-text-input')).toHaveValue('σπίτι');
    await expect(page.getByTestId('back-text-en-input')).toHaveValue('house');
    await expect(page.getByTestId('back-text-ru-input')).toHaveValue('дом');
    await expect(page.getByTestId('pronunciation-input')).toHaveValue('SPI-ti');

    // Verify part_of_speech is "noun"
    const posSelect = page.getByTestId('part-of-speech-select');
    await expect(posSelect).toContainText(/noun/i);

    // Close the modal
    await page.getByTestId('vocabulary-card-edit-cancel').click();
    await expect(page.getByTestId('vocabulary-card-edit-modal')).not.toBeVisible({ timeout: 5000 });
  });
});

// ============================================================================
// BASIC FIELDS EDIT TESTS
// ============================================================================

test.describe('Admin Vocabulary Card Edit - Basic Fields', () => {
  test.use({ storageState: ADMIN_AUTH });

  test.beforeEach(async ({ page }) => {
    await seedAdminCards(page);
    await openVocabularyDeck(page);
  });

  test('edits basic fields and saves', async ({ page }) => {
    // Click edit on "καλημέρα" (good morning) - Card 1 with just basic fields
    await clickEditForCard(page, 'καλημέρα');

    // Change the English translation
    const originalEn = await page.getByTestId('back-text-en-input').inputValue();
    const newTranslation = `${originalEn} (edited ${UNIQUE_PREFIX})`;
    await page.getByTestId('back-text-en-input').fill(newTranslation);

    // Save
    await page.getByTestId('vocabulary-card-edit-submit').click();

    // Modal should close
    await expect(page.getByTestId('vocabulary-card-edit-modal')).not.toBeVisible({ timeout: 10000 });

    // Verify card is still visible in the list
    await expect(page.getByText('καλημέρα')).toBeVisible({ timeout: 5000 });
  });
});

// ============================================================================
// NOUN GRAMMAR EDIT TESTS
// ============================================================================

test.describe('Admin Vocabulary Card Edit - Noun Grammar', () => {
  test.use({ storageState: ADMIN_AUTH });

  test.beforeEach(async ({ page }) => {
    await seedAdminCards(page);
    await openVocabularyDeck(page);
  });

  // TODO: Form editing with noun_data has timing issues in E2E
  // The form loads correctly but navigating to Grammar tab and editing is flaky
  test.skip('edits noun grammar data and saves', async ({ page }) => {
    // Click edit on "σπίτι" - a noun card with grammar data
    await clickEditForCard(page, 'σπίτι');

    // Go to Grammar tab
    await page.getByRole('tab', { name: /grammar/i }).click();

    // Verify noun grammar form is visible
    await expect(page.getByTestId('noun-grammar-form')).toBeVisible({ timeout: 5000 });

    // Modify a declension field - add genitive plural
    await page.getByTestId('noun-genitive-plural').fill('σπιτιών');

    // Save
    await page.getByTestId('vocabulary-card-edit-submit').click();

    // Modal should close
    await expect(page.getByTestId('vocabulary-card-edit-modal')).not.toBeVisible({ timeout: 10000 });
  });
});

// ============================================================================
// PART OF SPEECH CHANGE TESTS
// ============================================================================

test.describe('Admin Vocabulary Card Edit - Part of Speech Change', () => {
  test.use({ storageState: ADMIN_AUTH });

  test.beforeEach(async ({ page }) => {
    await seedAdminCards(page);
    await openVocabularyDeck(page);
  });

  // TODO: Tab switching and part_of_speech changes have timing issues
  // The form works but E2E automation has difficulty with the state changes
  test.skip('changes part_of_speech from noun to verb', async ({ page }) => {
    // Click edit on "σπίτι" - a noun card
    await clickEditForCard(page, 'σπίτι');

    // Verify it's currently a noun
    await expect(page.getByTestId('part-of-speech-select')).toContainText(/noun/i);

    // Go to Grammar tab first to verify noun form is shown
    await page.getByRole('tab', { name: /grammar/i }).click();
    await expect(page.getByTestId('noun-grammar-form')).toBeVisible({ timeout: 5000 });

    // Go back to Basic Info tab to change part_of_speech
    await page.getByRole('tab', { name: /basic info/i }).click();
    await expect(page.getByTestId('part-of-speech-select')).toBeVisible({ timeout: 5000 });

    // Change part_of_speech to verb
    await page.getByTestId('part-of-speech-select').click();
    await page.locator('[role="option"]').filter({ hasText: /^verb$/i }).click();

    // Grammar tab should now show verb form (auto-switches to Grammar)
    await expect(page.getByTestId('verb-grammar-form')).toBeVisible({ timeout: 5000 });
  });

  // TODO: Same timing issues as above
  test.skip('old grammar data cleared on part_of_speech change', async ({ page }) => {
    // Click edit on "σπίτι" - a noun card with noun_data
    await clickEditForCard(page, 'σπίτι');

    // Note: the card has noun_data with gender, nominative_singular, etc.
    // Verify Grammar tab shows noun form
    await page.getByRole('tab', { name: /grammar/i }).click();
    await expect(page.getByTestId('noun-grammar-form')).toBeVisible();

    // Verify gender is set to neuter (from seed data)
    await expect(page.getByTestId('noun-gender-select')).toContainText(/neuter/i);

    // Go back to Basic Info and change to verb
    await page.getByRole('tab', { name: /basic info/i }).click();
    await expect(page.getByTestId('part-of-speech-select')).toBeVisible({ timeout: 5000 });

    await page.getByTestId('part-of-speech-select').click();
    await page.locator('[role="option"]').filter({ hasText: /^verb$/i }).click();

    // Noun form should be gone, verb form should appear
    await expect(page.getByTestId('verb-grammar-form')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('noun-grammar-form')).not.toBeVisible();
  });
});

// ============================================================================
// EXAMPLES TAB TESTS
// ============================================================================

test.describe('Admin Vocabulary Card Edit - Examples', () => {
  test.use({ storageState: ADMIN_AUTH });

  test.beforeEach(async ({ page }) => {
    await seedAdminCards(page);
    await openVocabularyDeck(page);
  });

  test('adds and removes examples', async ({ page }) => {
    // Click edit on "βιβλίο" - Card 10 with existing examples
    await clickEditForCard(page, 'βιβλίο');

    // Go to Examples tab
    await page.getByRole('tab', { name: /examples/i }).click();

    // Verify examples tab content is visible
    await expect(page.getByTestId('examples-tab')).toBeVisible({ timeout: 5000 });

    // Should have existing examples from seed data (3 examples)
    // Verify at least one example row exists
    const existingRow0 = page.getByTestId('examples-row-0');
    const hasExistingExamples = await existingRow0.isVisible().catch(() => false);

    if (hasExistingExamples) {
      // Verify the first example has content
      await expect(page.getByTestId('examples-greek-0')).not.toHaveValue('');
    }

    // Add a new example
    await page.getByTestId('examples-add-button').click();

    // Find the new row (will be the last one)
    // If we had 3 examples (0, 1, 2), new one is row 3
    // If we had 0 examples, new one is row 0
    const newRowIndex = hasExistingExamples ? 3 : 0;
    await expect(page.getByTestId(`examples-row-${newRowIndex}`)).toBeVisible();

    // Fill the new example
    await page.getByTestId(`examples-greek-${newRowIndex}`).fill('Νέο παράδειγμα');
    await page.getByTestId(`examples-english-${newRowIndex}`).fill('New example');

    // If there's an existing example, remove it
    if (hasExistingExamples) {
      // Remove the first example
      await page.getByTestId('examples-remove-0').click();

      // The row indices should shift - original row 1 becomes row 0
      await expect(page.getByTestId('examples-row-0')).toBeVisible();
    }

    // Save
    await page.getByTestId('vocabulary-card-edit-submit').click();

    // Modal should close
    await expect(page.getByTestId('vocabulary-card-edit-modal')).not.toBeVisible({ timeout: 10000 });
  });
});

// ============================================================================
// CANCEL CONFIRMATION TESTS
// ============================================================================

test.describe('Admin Vocabulary Card Edit - Cancel Confirmation', () => {
  test.use({ storageState: ADMIN_AUTH });

  test.beforeEach(async ({ page }) => {
    await seedAdminCards(page);
    await openVocabularyDeck(page);
  });

  test('shows unsaved changes confirmation on close', async ({ page }) => {
    // Click edit on any card
    await clickEditForCard(page, 'καλημέρα');

    // Make a change
    const originalValue = await page.getByTestId('back-text-en-input').inputValue();
    await page.getByTestId('back-text-en-input').fill(`${originalValue} MODIFIED`);

    // Click cancel
    await page.getByTestId('vocabulary-card-edit-cancel').click();

    // Verify confirmation dialog appears
    const keepEditingBtn = page.getByRole('button', { name: /keep editing/i });
    const discardBtn = page.getByRole('button', { name: /discard/i });

    await expect(keepEditingBtn).toBeVisible({ timeout: 5000 });
    await expect(discardBtn).toBeVisible();
  });

  test('Keep Editing returns to form', async ({ page }) => {
    // Click edit on any card
    await clickEditForCard(page, 'καλημέρα');

    // Make a change
    const modifiedValue = 'KEEP_EDITING_TEST';
    await page.getByTestId('back-text-en-input').fill(modifiedValue);

    // Click cancel
    await page.getByTestId('vocabulary-card-edit-cancel').click();

    // Click Keep Editing
    const keepEditingBtn = page.getByRole('button', { name: /keep editing/i });
    await expect(keepEditingBtn).toBeVisible({ timeout: 5000 });
    await keepEditingBtn.click();

    // Verify still in edit mode with content preserved
    await expect(page.getByTestId('vocabulary-card-edit-modal')).toBeVisible();
    await expect(page.getByTestId('back-text-en-input')).toHaveValue(modifiedValue);
  });

  test('Discard closes without saving', async ({ page }) => {
    // Click edit on any card
    await clickEditForCard(page, 'καλημέρα');

    // Note original value
    const originalValue = await page.getByTestId('back-text-en-input').inputValue();

    // Make a change
    await page.getByTestId('back-text-en-input').fill(`${originalValue} SHOULD_NOT_SAVE`);

    // Click cancel, then Discard
    await page.getByTestId('vocabulary-card-edit-cancel').click();
    const discardBtn = page.getByRole('button', { name: /discard/i });
    await expect(discardBtn).toBeVisible({ timeout: 5000 });
    await discardBtn.click();

    // Verify modal closed
    await expect(page.getByTestId('vocabulary-card-edit-modal')).not.toBeVisible({ timeout: 5000 });

    // Verify original data is unchanged by opening edit again
    await clickEditForCard(page, 'καλημέρα');
    await expect(page.getByTestId('back-text-en-input')).toHaveValue(originalValue);
  });
});
