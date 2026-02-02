/**
 * Admin Bulk Upload E2E Tests
 *
 * Tests for admin bulk upload functionality including:
 * - Navigate to Bulk Uploads tab
 * - Validate valid JSON with deck_id successfully
 * - Preview shows correct summary counts
 * - Upload cards and show success toast
 * - Invalid JSON shows parsing error
 * - Missing required fields show validation errors
 * - Validation errors show card index and field
 * - Form content preserved after validation error
 * - Maximum 100 cards validation
 * - Array format shows migration error
 * - Missing deck_id shows error
 * - Invalid deck_id format shows error
 *
 * Test User:
 * - e2e_admin: Admin user with superuser access
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';

// Storage state paths
const ADMIN_AUTH = 'playwright/.auth/admin.json';

/**
 * Helper to get admin access token from storage state file
 * This is needed because page.request doesn't automatically include
 * the Authorization header for authenticated API calls.
 */
function getAdminAccessToken(): string | null {
  try {
    const adminAuthState = JSON.parse(fs.readFileSync(ADMIN_AUTH, 'utf-8'));
    const authStorageItem = adminAuthState.origins?.[0]?.localStorage?.find(
      (item: { name: string; value: string }) => item.name === 'auth-storage'
    );
    if (authStorageItem) {
      const authData = JSON.parse(authStorageItem.value);
      // Check both 'accessToken' and 'token' for compatibility
      return authData?.state?.accessToken || authData?.state?.token || null;
    }
  } catch {
    // File might not exist or be invalid
  }
  return null;
}

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
 * Helper to get a valid vocabulary deck ID for tests
 * Uses the admin access token from storage state for authentication
 */
async function getVocabularyDeckId(page: import('@playwright/test').Page): Promise<string> {
  const apiBaseUrl = process.env.E2E_API_URL || process.env.VITE_API_URL || 'http://localhost:8000';
  const accessToken = getAdminAccessToken();

  if (!accessToken) {
    throw new Error('Admin access token not available - auth setup may have failed');
  }

  const response = await page.request.get(`${apiBaseUrl}/api/v1/admin/decks?type=vocabulary&page_size=1`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok()) {
    throw new Error(`Failed to fetch vocabulary decks: ${response.status()} ${response.statusText()}`);
  }

  const data = await response.json();
  if (!data.decks?.[0]?.id) {
    throw new Error('No vocabulary deck found for E2E tests');
  }
  return data.decks[0].id;
}

// Sample JSON data makers for tests (now take deckId as parameter)
const makeValidMinimalJson = (deckId: string) => JSON.stringify({
  deck_id: deckId,
  cards: [{ front_text: 'γεια', back_text_en: 'hello' }],
});

const makeValidJsonWithGrammar = (deckId: string) => JSON.stringify({
  deck_id: deckId,
  cards: [
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
  ],
});

const makeValidJsonWithExamples = (deckId: string) => JSON.stringify({
  deck_id: deckId,
  cards: [
    {
      front_text: 'test',
      back_text_en: 'test',
      examples: [{ greek: 'example', english: 'translation' }],
    },
  ],
});

const makeValidJsonThreeCards = (deckId: string) => JSON.stringify({
  deck_id: deckId,
  cards: [
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
  ],
});

const makeInvalidJsonMissingFrontText = (deckId: string) => JSON.stringify({
  deck_id: deckId,
  cards: [{ back_text_en: 'test' }],
});

const makeInvalidJsonSecondCardError = (deckId: string) => JSON.stringify({
  deck_id: deckId,
  cards: [
    { front_text: 'valid', back_text_en: 'valid' },
    { back_text_en: 'missing front_text' },
  ],
});

const makeTooManyCardsJson = (deckId: string) => {
  const cards = [];
  for (let i = 0; i < 101; i++) {
    cards.push({
      front_text: `word${i}`,
      back_text_en: `translation${i}`,
    });
  }
  return JSON.stringify({ deck_id: deckId, cards });
};

const INVALID_JSON_NOT_PARSEABLE = 'not json';

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

    // Verify key elements are present (no deck select anymore)
    await expect(page.getByTestId('bulk-uploads-json-textarea')).toBeVisible();
    await expect(page.getByTestId('bulk-uploads-validate-button')).toBeVisible();
    await expect(page.getByTestId('bulk-uploads-upload-button')).toBeVisible();
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
    const deckId = await getVocabularyDeckId(page);

    // Paste valid JSON with deck_id
    await page.getByTestId('bulk-uploads-json-textarea').fill(makeValidMinimalJson(deckId));

    // Click Validate & Preview
    await page.getByTestId('bulk-uploads-validate-button').click();

    // Verify no errors shown
    await expect(page.getByTestId('bulk-uploads-errors')).not.toBeVisible();

    // Verify preview summary appears
    await expect(page.getByTestId('bulk-uploads-preview')).toBeVisible({ timeout: 5000 });
  });

  test('preview shows correct summary counts', async ({ page }) => {
    const deckId = await getVocabularyDeckId(page);

    // Paste JSON with 3 cards: 1 noun, 1 verb, 1 with examples
    await page.getByTestId('bulk-uploads-json-textarea').fill(makeValidJsonThreeCards(deckId));

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
    const deckId = await getVocabularyDeckId(page);
    const uniqueId = `E2E_BULK_${Date.now()}`;
    const uniqueJson = JSON.stringify({
      deck_id: deckId,
      cards: [{ front_text: `γεια_${uniqueId}`, back_text_en: `hello_${uniqueId}` }],
    });

    // Paste valid JSON
    await page.getByTestId('bulk-uploads-json-textarea').fill(uniqueJson);

    // Validate first
    await page.getByTestId('bulk-uploads-validate-button').click();
    await expect(page.getByTestId('bulk-uploads-preview')).toBeVisible({ timeout: 5000 });

    // Click Upload Cards
    await page.getByTestId('bulk-uploads-upload-button').click();

    // Verify success toast appears (wait for the toast notification)
    // The toast should contain "Successfully uploaded X cards"
    // Use .first() to handle multiple matches (toast text + aria-live region)
    await expect(page.getByText(/Successfully uploaded \d+ cards/i).first()).toBeVisible({ timeout: 10000 });

    // Verify form is cleared (textarea should be empty)
    await expect(page.getByTestId('bulk-uploads-json-textarea')).toHaveValue('');
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
    // Paste invalid JSON (not parseable)
    await page.getByTestId('bulk-uploads-json-textarea').fill(INVALID_JSON_NOT_PARSEABLE);

    // Click Validate
    await page.getByTestId('bulk-uploads-validate-button').click();

    // Verify error: "JSON syntax error" (shown when JSON can't be parsed)
    const errors = page.getByTestId('bulk-uploads-errors');
    await expect(errors).toBeVisible({ timeout: 5000 });
    await expect(errors.getByText(/JSON syntax error/i)).toBeVisible();
  });

  test('missing required fields shows validation errors', async ({ page }) => {
    const deckId = await getVocabularyDeckId(page);

    // Paste JSON with missing front_text
    await page.getByTestId('bulk-uploads-json-textarea').fill(makeInvalidJsonMissingFrontText(deckId));

    // Click Validate
    await page.getByTestId('bulk-uploads-validate-button').click();

    // Verify error shows field name and message
    const errors = page.getByTestId('bulk-uploads-errors');
    await expect(errors).toBeVisible({ timeout: 5000 });
    await expect(errors.getByText(/front_text/i)).toBeVisible();
    await expect(errors.getByText(/required/i)).toBeVisible();
  });

  test('validation errors show card index and field', async ({ page }) => {
    const deckId = await getVocabularyDeckId(page);

    // Paste JSON with error on card 2
    await page.getByTestId('bulk-uploads-json-textarea').fill(makeInvalidJsonSecondCardError(deckId));

    // Click Validate
    await page.getByTestId('bulk-uploads-validate-button').click();

    // Verify error shows "Card 2" (1-indexed in display) and field name
    const errors = page.getByTestId('bulk-uploads-errors');
    await expect(errors).toBeVisible({ timeout: 5000 });
    await expect(errors.getByText(/Card 2/i)).toBeVisible();
    await expect(errors.getByText(/front_text/i)).toBeVisible();
  });

  test('form content preserved after validation error', async ({ page }) => {
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
    const deckId = await getVocabularyDeckId(page);

    // Generate JSON with 101 cards
    const tooManyCardsJson = makeTooManyCardsJson(deckId);

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

  test('array format shows migration error', async ({ page }) => {
    // Old format - should show clear migration message
    const oldFormatJson = JSON.stringify([
      { front_text: 'test', back_text_en: 'test' },
    ]);

    await page.getByTestId('bulk-uploads-json-textarea').fill(oldFormatJson);
    await page.getByTestId('bulk-uploads-validate-button').click();

    const errors = page.getByTestId('bulk-uploads-errors');
    await expect(errors).toBeVisible({ timeout: 5000 });
    await expect(errors).toContainText(/format has changed/i);
  });

  test('missing deck_id shows error', async ({ page }) => {
    const jsonWithoutDeckId = JSON.stringify({
      cards: [{ front_text: 'test', back_text_en: 'test' }],
    });

    await page.getByTestId('bulk-uploads-json-textarea').fill(jsonWithoutDeckId);
    await page.getByTestId('bulk-uploads-validate-button').click();

    const errors = page.getByTestId('bulk-uploads-errors');
    await expect(errors).toBeVisible({ timeout: 5000 });
    await expect(errors).toContainText(/deck_id.*required/i);
  });

  test('invalid deck_id format shows error', async ({ page }) => {
    const jsonWithBadDeckId = JSON.stringify({
      deck_id: 'not-a-uuid',
      cards: [{ front_text: 'test', back_text_en: 'test' }],
    });

    await page.getByTestId('bulk-uploads-json-textarea').fill(jsonWithBadDeckId);
    await page.getByTestId('bulk-uploads-validate-button').click();

    const errors = page.getByTestId('bulk-uploads-errors');
    await expect(errors).toBeVisible({ timeout: 5000 });
    await expect(errors).toContainText(/UUID/i);
  });
});
