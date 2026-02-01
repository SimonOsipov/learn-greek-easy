/**
 * Admin Bulk Upload E2E Tests
 *
 * Tests for admin bulk upload functionality including:
 * - Navigate to Bulk Uploads tab
 * - Select vocabulary deck from dropdown
 * - Validate valid JSON successfully
 * - Preview shows correct summary counts
 * - Upload cards and show success toast
 * - Invalid JSON shows parsing error
 * - Missing required fields show validation errors
 * - Validation errors show card index and field
 * - Form content preserved after validation error
 * - Maximum 100 cards validation
 *
 * Test User:
 * - e2e_admin: Admin user with superuser access
 */

import { test, expect } from '@playwright/test';

// Storage state paths
const ADMIN_AUTH = 'playwright/.auth/admin.json';

/**
 * Helper to seed admin vocabulary card test data
 * This creates vocabulary decks that can be used for bulk uploads
 */
async function seedAdminCards(page: import('@playwright/test').Page): Promise<void> {
  const apiBaseUrl = process.env.E2E_API_URL || process.env.VITE_API_URL || 'http://localhost:8000';
  const response = await page.request.post(`${apiBaseUrl}/api/v1/test/seed/admin-cards`);
  if (!response.ok()) {
    console.warn('[TEST] Admin card seeding failed, tests may use existing data');
  }
}

/**
 * Helper to navigate to admin panel and open the Bulk Uploads tab
 */
async function navigateToBulkUploads(page: import('@playwright/test').Page): Promise<void> {
  // Navigate to admin panel
  await page.goto('/admin');
  await expect(page.getByTestId('admin-page')).toBeVisible({ timeout: 15000 });

  // Click on Bulk Uploads tab
  await page.getByTestId('admin-tab-bulkUploads').click();

  // Verify the tab content loads
  await expect(page.getByTestId('bulk-uploads-tab')).toBeVisible({ timeout: 5000 });
}

/**
 * Helper to select a vocabulary deck from the dropdown
 */
async function selectVocabularyDeck(page: import('@playwright/test').Page): Promise<void> {
  const deckSelect = page.getByTestId('bulk-uploads-deck-select');
  await expect(deckSelect).toBeVisible();

  // Open dropdown
  await deckSelect.click();

  // Wait for options to load and select the first one
  const deckOptions = page.locator('[role="option"]');
  await expect(deckOptions.first()).toBeVisible({ timeout: 5000 });
  await deckOptions.first().click();

  // Verify selection is shown (dropdown closes and has value)
  await expect(deckSelect).not.toHaveText('Select a vocabulary deck');
}

// Sample JSON data for tests
const VALID_MINIMAL_JSON = JSON.stringify([
  { front_text: 'γεια', back_text_en: 'hello' },
]);

const VALID_JSON_WITH_GRAMMAR = JSON.stringify([
  {
    front_text: 'σπίτι',
    back_text_en: 'house',
    part_of_speech: 'noun',
    noun_data: { gender: 'neuter' },
  },
  {
    front_text: 'τρώω',
    back_text_en: 'I eat',
    part_of_speech: 'verb',
    verb_data: { voice: 'active' },
  },
]);

const VALID_JSON_WITH_EXAMPLES = JSON.stringify([
  {
    front_text: 'test',
    back_text_en: 'test',
    examples: [{ greek: 'example', english: 'translation' }],
  },
]);

const VALID_JSON_THREE_CARDS = JSON.stringify([
  {
    front_text: 'σπίτι',
    back_text_en: 'house',
    part_of_speech: 'noun',
    noun_data: { gender: 'neuter' },
  },
  {
    front_text: 'τρώω',
    back_text_en: 'I eat',
    part_of_speech: 'verb',
    verb_data: { voice: 'active' },
  },
  {
    front_text: 'γρήγορα',
    back_text_en: 'quickly',
    examples: [{ greek: 'Τρέχει γρήγορα', english: 'He runs quickly' }],
  },
]);

const INVALID_JSON_NOT_PARSEABLE = 'not json';

const INVALID_JSON_MISSING_FRONT_TEXT = JSON.stringify([
  { back_text_en: 'test' },
]);

const INVALID_JSON_SECOND_CARD_ERROR = JSON.stringify([
  { front_text: 'valid', back_text_en: 'valid' },
  { back_text_en: 'missing front_text' },
]);

// ============================================================================
// NAVIGATION TESTS
// ============================================================================

test.describe('Admin Bulk Upload - Navigation', () => {
  test.use({ storageState: ADMIN_AUTH });

  test.beforeEach(async ({ page }) => {
    await seedAdminCards(page);
  });

  test('navigates to Bulk Uploads tab', async ({ page }) => {
    // Navigate to admin panel
    await page.goto('/admin');
    await expect(page.getByTestId('admin-page')).toBeVisible({ timeout: 15000 });

    // Click on Bulk Uploads tab
    await page.getByTestId('admin-tab-bulkUploads').click();

    // Verify the tab content loads
    await expect(page.getByTestId('bulk-uploads-tab')).toBeVisible({ timeout: 5000 });

    // Verify key elements are present
    await expect(page.getByTestId('bulk-uploads-deck-select')).toBeVisible();
    await expect(page.getByTestId('bulk-uploads-json-textarea')).toBeVisible();
    await expect(page.getByTestId('bulk-uploads-validate-button')).toBeVisible();
    await expect(page.getByTestId('bulk-uploads-upload-button')).toBeVisible();
  });
});

// ============================================================================
// DECK SELECTION TESTS
// ============================================================================

test.describe('Admin Bulk Upload - Deck Selection', () => {
  test.use({ storageState: ADMIN_AUTH });

  test.beforeEach(async ({ page }) => {
    await seedAdminCards(page);
    await navigateToBulkUploads(page);
  });

  test('selects vocabulary deck from dropdown', async ({ page }) => {
    const deckSelect = page.getByTestId('bulk-uploads-deck-select');
    await expect(deckSelect).toBeVisible();

    // Open deck selector
    await deckSelect.click();

    // Wait for options to load
    const deckOptions = page.locator('[role="option"]');
    await expect(deckOptions.first()).toBeVisible({ timeout: 5000 });

    // Select a vocabulary deck
    await deckOptions.first().click();

    // Verify selection is shown (the select should no longer show placeholder)
    await expect(deckSelect).not.toHaveText('Select a vocabulary deck');
  });
});

// ============================================================================
// VALIDATION SUCCESS TESTS
// ============================================================================

test.describe('Admin Bulk Upload - Validation Success', () => {
  test.use({ storageState: ADMIN_AUTH });

  test.beforeEach(async ({ page }) => {
    await seedAdminCards(page);
    await navigateToBulkUploads(page);
  });

  test('validates valid JSON successfully', async ({ page }) => {
    // Select deck
    await selectVocabularyDeck(page);

    // Paste valid JSON
    await page.getByTestId('bulk-uploads-json-textarea').fill(VALID_MINIMAL_JSON);

    // Click Validate & Preview
    await page.getByTestId('bulk-uploads-validate-button').click();

    // Verify no errors shown
    await expect(page.getByTestId('bulk-uploads-errors')).not.toBeVisible();

    // Verify preview summary appears
    await expect(page.getByTestId('bulk-uploads-preview')).toBeVisible({ timeout: 5000 });
  });

  test('preview shows correct summary counts', async ({ page }) => {
    // Select deck
    await selectVocabularyDeck(page);

    // Paste JSON with 3 cards: 1 noun, 1 verb, 1 with examples
    await page.getByTestId('bulk-uploads-json-textarea').fill(VALID_JSON_THREE_CARDS);

    // Click Validate & Preview
    await page.getByTestId('bulk-uploads-validate-button').click();

    // Verify preview summary appears
    const preview = page.getByTestId('bulk-uploads-preview');
    await expect(preview).toBeVisible({ timeout: 5000 });

    // Verify: Total Cards: 3 (the large font number)
    await expect(preview.locator('text=3').first()).toBeVisible();

    // Verify grammar counts are shown (Nouns: 1, Verbs: 1)
    // Use locator with text content matching to handle React text node splitting
    await expect(preview.locator('span:has-text("Nouns")').filter({ hasText: '1' })).toBeVisible();
    await expect(preview.locator('span:has-text("Verbs")').filter({ hasText: '1' })).toBeVisible();

    // Verify examples count exists (1 example) - check for the large font number in examples section
    await expect(preview.locator('text=1').first()).toBeVisible();
  });
});

// ============================================================================
// UPLOAD SUCCESS TESTS
// ============================================================================

test.describe('Admin Bulk Upload - Upload Success', () => {
  test.use({ storageState: ADMIN_AUTH });

  test.beforeEach(async ({ page }) => {
    await seedAdminCards(page);
    await navigateToBulkUploads(page);
  });

  test('uploads cards and shows success toast', async ({ page }) => {
    const uniqueId = `E2E_BULK_${Date.now()}`;
    const uniqueJson = JSON.stringify([
      { front_text: `γεια_${uniqueId}`, back_text_en: `hello_${uniqueId}` },
    ]);

    // Select deck
    await selectVocabularyDeck(page);

    // Paste valid JSON
    await page.getByTestId('bulk-uploads-json-textarea').fill(uniqueJson);

    // Validate first
    await page.getByTestId('bulk-uploads-validate-button').click();
    await expect(page.getByTestId('bulk-uploads-preview')).toBeVisible({ timeout: 5000 });

    // Click Upload Cards
    await page.getByTestId('bulk-uploads-upload-button').click();

    // Verify success toast appears (wait for the toast notification)
    // The toast should contain "Successfully uploaded X cards"
    await expect(page.getByText(/Successfully uploaded \d+ cards/i)).toBeVisible({ timeout: 10000 });

    // Verify form is cleared (textarea should be empty)
    await expect(page.getByTestId('bulk-uploads-json-textarea')).toHaveValue('');

    // Deck select should also be cleared (shows placeholder again)
    await expect(page.getByTestId('bulk-uploads-deck-select')).toContainText('Select a vocabulary deck');
  });
});

// ============================================================================
// VALIDATION ERROR TESTS
// ============================================================================

test.describe('Admin Bulk Upload - Validation Errors', () => {
  test.use({ storageState: ADMIN_AUTH });

  test.beforeEach(async ({ page }) => {
    await seedAdminCards(page);
    await navigateToBulkUploads(page);
  });

  test('invalid JSON shows parsing error', async ({ page }) => {
    // Select deck
    await selectVocabularyDeck(page);

    // Paste invalid JSON (not parseable)
    await page.getByTestId('bulk-uploads-json-textarea').fill(INVALID_JSON_NOT_PARSEABLE);

    // Click Validate
    await page.getByTestId('bulk-uploads-validate-button').click();

    // Verify error: "Invalid JSON format"
    const errors = page.getByTestId('bulk-uploads-errors');
    await expect(errors).toBeVisible({ timeout: 5000 });
    await expect(errors.getByText(/Invalid JSON format/i)).toBeVisible();
  });

  test('missing required fields shows validation errors', async ({ page }) => {
    // Select deck
    await selectVocabularyDeck(page);

    // Paste JSON with missing front_text: [{"back_text_en": "test"}]
    await page.getByTestId('bulk-uploads-json-textarea').fill(INVALID_JSON_MISSING_FRONT_TEXT);

    // Click Validate
    await page.getByTestId('bulk-uploads-validate-button').click();

    // Verify error shows field name and message
    const errors = page.getByTestId('bulk-uploads-errors');
    await expect(errors).toBeVisible({ timeout: 5000 });
    await expect(errors.getByText(/front_text/i)).toBeVisible();
    await expect(errors.getByText(/required/i)).toBeVisible();
  });

  test('validation errors show card index and field', async ({ page }) => {
    // Select deck
    await selectVocabularyDeck(page);

    // Paste JSON with error on card 2: [{valid}, {invalid}]
    await page.getByTestId('bulk-uploads-json-textarea').fill(INVALID_JSON_SECOND_CARD_ERROR);

    // Click Validate
    await page.getByTestId('bulk-uploads-validate-button').click();

    // Verify error shows "Card 2" (1-indexed in display) and field name
    const errors = page.getByTestId('bulk-uploads-errors');
    await expect(errors).toBeVisible({ timeout: 5000 });
    await expect(errors.getByText(/Card 2/i)).toBeVisible();
    await expect(errors.getByText(/front_text/i)).toBeVisible();
  });

  test('form content preserved after validation error', async ({ page }) => {
    // Select deck
    await selectVocabularyDeck(page);

    const invalidJson = INVALID_JSON_NOT_PARSEABLE;

    // Paste invalid JSON
    await page.getByTestId('bulk-uploads-json-textarea').fill(invalidJson);

    // Click Validate (shows error)
    await page.getByTestId('bulk-uploads-validate-button').click();

    // Verify error is shown
    await expect(page.getByTestId('bulk-uploads-errors')).toBeVisible({ timeout: 5000 });

    // Verify textarea still has the JSON content
    await expect(page.getByTestId('bulk-uploads-json-textarea')).toHaveValue(invalidJson);
  });

  test('maximum 100 cards validation', async ({ page }) => {
    // Select deck
    await selectVocabularyDeck(page);

    // Generate JSON with 101 cards
    const tooManyCards = [];
    for (let i = 0; i < 101; i++) {
      tooManyCards.push({
        front_text: `word${i}`,
        back_text_en: `translation${i}`,
      });
    }
    const tooManyCardsJson = JSON.stringify(tooManyCards);

    // Paste JSON
    await page.getByTestId('bulk-uploads-json-textarea').fill(tooManyCardsJson);

    // Click Validate
    await page.getByTestId('bulk-uploads-validate-button').click();

    // Verify error: "Too many cards. Maximum is 100."
    const errors = page.getByTestId('bulk-uploads-errors');
    await expect(errors).toBeVisible({ timeout: 5000 });
    await expect(errors.getByText(/Too many cards/i)).toBeVisible();
    await expect(errors.getByText(/Maximum is 100/i)).toBeVisible();
  });
});
