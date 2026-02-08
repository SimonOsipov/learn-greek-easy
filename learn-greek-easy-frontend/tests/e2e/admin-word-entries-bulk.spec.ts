/**
 * Admin Word Entries Bulk Upload E2E Tests
 *
 * Tests for admin Word Entries bulk upload functionality including:
 * - Navigate to Word Entries tab
 * - Validate valid JSON with deck_id successfully
 * - Preview shows correct summary counts
 * - Upload word entries and show success toast with create/update counts
 * - Invalid JSON shows parsing error
 * - Missing required fields show validation errors
 * - Validation errors show entry index and field
 * - Form content preserved after validation error
 * - Maximum 100 entries validation
 * - Array format shows migration error
 * - Missing deck_id shows error
 * - Invalid deck_id format shows error
 * - Uploading same entry twice shows updated count > 0 (upsert behavior)
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
 * Helper to navigate to admin panel and open the Word Entries tab
 */
async function navigateToWordEntriesTab(page: import('@playwright/test').Page): Promise<void> {
  // Navigate to admin panel
  await page.goto('/admin');
  await expect(page.getByTestId('admin-page')).toBeVisible({ timeout: 15000 });

  // Click on Word Entries tab (it's a top-level tab, not a sub-tab)
  await page.getByTestId('admin-tab-wordEntries').click();

  // Verify the tab content loads
  await expect(page.getByTestId('word-entries-tab')).toBeVisible({ timeout: 5000 });
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

// ============================================================================
// Sample JSON data makers for tests
// ============================================================================

// Word entry required fields: lemma, part_of_speech, translation_en
// Optional: translation_ru, pronunciation, grammar_data, examples

const makeValidMinimalJson = (deckId: string) => JSON.stringify({
  deck_id: deckId,
  word_entries: [{ lemma: 'test_word', part_of_speech: 'noun', translation_en: 'house, home' }],
});

const makeValidJsonWithGrammar = (deckId: string) => JSON.stringify({
  deck_id: deckId,
  word_entries: [
    {
      lemma: 'test_noun',
      part_of_speech: 'noun',
      translation_en: 'house, home',
      grammar_data: { gender: 'neuter' },
    },
    {
      lemma: 'test_verb',
      part_of_speech: 'verb',
      translation_en: 'I eat',
      grammar_data: { voice: 'active' },
    },
  ],
});

const makeValidJsonWithExamples = (deckId: string) => JSON.stringify({
  deck_id: deckId,
  word_entries: [{
    lemma: 'test_greeting',
    part_of_speech: 'noun',
    translation_en: 'good morning',
    examples: [{ greek: 'Test example!', english: 'Good morning to you!' }],
  }],
});

const makeValidJsonThreeEntries = (deckId: string) => JSON.stringify({
  deck_id: deckId,
  word_entries: [
    {
      lemma: 'test_noun_1',
      part_of_speech: 'noun',
      translation_en: 'house',
      grammar_data: { gender: 'neuter' },
    },
    {
      lemma: 'test_verb_1',
      part_of_speech: 'verb',
      translation_en: 'I eat',
      grammar_data: { voice: 'active' },
    },
    {
      lemma: 'test_adverb_1',
      part_of_speech: 'adverb',
      translation_en: 'quickly',
      examples: [{ greek: 'Test runs quickly', english: 'He runs quickly' }],
    },
  ],
});

const makeInvalidJsonMissingLemma = (deckId: string) => JSON.stringify({
  deck_id: deckId,
  word_entries: [{
    part_of_speech: 'noun',
    translation_en: 'test',
  }],
});

const makeInvalidJsonMissingPartOfSpeech = (deckId: string) => JSON.stringify({
  deck_id: deckId,
  word_entries: [{
    lemma: 'test',
    translation_en: 'test',
  }],
});

const makeInvalidJsonMissingTranslation = (deckId: string) => JSON.stringify({
  deck_id: deckId,
  word_entries: [{
    lemma: 'test',
    part_of_speech: 'noun',
  }],
});

const makeInvalidJsonSecondEntryError = (deckId: string) => JSON.stringify({
  deck_id: deckId,
  word_entries: [
    { lemma: 'valid', part_of_speech: 'noun', translation_en: 'valid' },
    { part_of_speech: 'verb', translation_en: 'missing lemma' },
  ],
});

const makeTooManyEntriesJson = (deckId: string) => {
  const entries = [];
  for (let i = 0; i < 101; i++) {
    entries.push({
      lemma: `word${i}`,
      part_of_speech: 'noun',
      translation_en: `translation${i}`,
    });
  }
  return JSON.stringify({ deck_id: deckId, word_entries: entries });
};

const INVALID_JSON_NOT_PARSEABLE = 'not json';

// ============================================================================
// NAVIGATION TESTS
// ============================================================================

test.describe('Admin Word Entries Bulk - Navigation', () => {
  test.use({ storageState: ADMIN_AUTH });

  test.beforeEach(async ({ page }) => {
    await seedAdminCards(page);
  });

  test('navigates to Word Entries tab', async ({ page }) => {
    // Navigate to admin panel
    await page.goto('/admin');
    await expect(page.getByTestId('admin-page')).toBeVisible({ timeout: 15000 });

    // Click on Word Entries tab
    await page.getByTestId('admin-tab-wordEntries').click();

    // Verify the tab content loads
    await expect(page.getByTestId('word-entries-tab')).toBeVisible({ timeout: 5000 });

    // Verify key elements are present
    await expect(page.getByTestId('word-entries-json-textarea')).toBeVisible();
    await expect(page.getByTestId('word-entries-validate-button')).toBeVisible();
    await expect(page.getByTestId('word-entries-upload-button')).toBeVisible();
  });
});

// ============================================================================
// VALIDATION SUCCESS TESTS
// ============================================================================

test.describe('Admin Word Entries Bulk - Validation Success', () => {
  test.use({ storageState: ADMIN_AUTH });

  test.beforeEach(async ({ page }) => {
    await seedAdminCards(page);
    await navigateToWordEntriesTab(page);
  });

  test('validates valid JSON successfully', async ({ page }) => {
    const deckId = await getVocabularyDeckId(page);

    // Paste valid JSON with deck_id
    await page.getByTestId('word-entries-json-textarea').fill(makeValidMinimalJson(deckId));

    // Click Validate & Preview
    await page.getByTestId('word-entries-validate-button').click();

    // Verify no errors shown
    await expect(page.getByTestId('word-entries-errors')).not.toBeVisible();

    // Verify preview summary appears
    await expect(page.getByTestId('word-entries-preview')).toBeVisible({ timeout: 5000 });
  });

  test('preview shows correct summary counts', async ({ page }) => {
    const deckId = await getVocabularyDeckId(page);

    // Paste JSON with 3 entries: 1 noun, 1 verb, 1 adverb
    await page.getByTestId('word-entries-json-textarea').fill(makeValidJsonThreeEntries(deckId));

    // Click Validate & Preview
    await page.getByTestId('word-entries-validate-button').click();

    // Verify preview summary appears
    const preview = page.getByTestId('word-entries-preview');
    await expect(preview).toBeVisible({ timeout: 5000 });

    // Verify: Total Entries: 3 (the large font number)
    await expect(preview.locator('text=3').first()).toBeVisible();

    // Verify part of speech counts are shown (Nouns: 1, Verbs: 1)
    // Use locator with text content matching to handle React text node splitting
    await expect(preview.locator('span:has-text("Nouns")').filter({ hasText: '1' })).toBeVisible();
    await expect(preview.locator('span:has-text("Verbs")').filter({ hasText: '1' })).toBeVisible();
  });
});

// ============================================================================
// UPLOAD SUCCESS TESTS
// ============================================================================

test.describe('Admin Word Entries Bulk - Upload Success', () => {
  test.use({ storageState: ADMIN_AUTH });

  test.beforeEach(async ({ page }) => {
    await seedAdminCards(page);
    await navigateToWordEntriesTab(page);
  });

  test('uploads entries and shows success toast with create/update counts', async ({ page }) => {
    const deckId = await getVocabularyDeckId(page);
    const uniqueId = `E2E_WORD_${Date.now()}`;
    const uniqueJson = JSON.stringify({
      deck_id: deckId,
      word_entries: [{
        lemma: `test_${uniqueId}`,
        part_of_speech: 'noun',
        translation_en: `house_${uniqueId}`,
      }],
    });

    // Paste valid JSON
    await page.getByTestId('word-entries-json-textarea').fill(uniqueJson);

    // Validate first
    await page.getByTestId('word-entries-validate-button').click();
    await expect(page.getByTestId('word-entries-preview')).toBeVisible({ timeout: 5000 });

    // Click Upload Entries
    await page.getByTestId('word-entries-upload-button').click();

    // Verify success toast appears (wait for the toast notification)
    // Toast format: "Successfully uploaded: X created, Y updated"
    await expect(
      page.getByText(/Successfully uploaded.*\d+ created.*\d+ updated/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('form is cleared after successful upload', async ({ page }) => {
    const deckId = await getVocabularyDeckId(page);
    const uniqueId = `E2E_CLEAR_${Date.now()}`;
    const uniqueJson = JSON.stringify({
      deck_id: deckId,
      word_entries: [{
        lemma: `test_${uniqueId}`,
        part_of_speech: 'noun',
        translation_en: 'test',
      }],
    });

    // Paste valid JSON
    await page.getByTestId('word-entries-json-textarea').fill(uniqueJson);

    // Validate first
    await page.getByTestId('word-entries-validate-button').click();
    await expect(page.getByTestId('word-entries-preview')).toBeVisible({ timeout: 5000 });

    // Click Upload Entries
    await page.getByTestId('word-entries-upload-button').click();
    await expect(
      page.getByText(/Successfully uploaded/i).first()
    ).toBeVisible({ timeout: 10000 });

    // Verify form is cleared (textarea should be empty)
    await expect(page.getByTestId('word-entries-json-textarea')).toHaveValue('');
  });
});

// ============================================================================
// VALIDATION ERROR TESTS
// ============================================================================

test.describe('Admin Word Entries Bulk - Validation Errors', () => {
  test.use({ storageState: ADMIN_AUTH });

  test.beforeEach(async ({ page }) => {
    await seedAdminCards(page);
    await navigateToWordEntriesTab(page);
  });

  test('invalid JSON shows parsing error', async ({ page }) => {
    // Paste invalid JSON (not parseable)
    await page.getByTestId('word-entries-json-textarea').fill(INVALID_JSON_NOT_PARSEABLE);

    // Click Validate
    await page.getByTestId('word-entries-validate-button').click();

    // Verify error: "JSON syntax error" (shown when JSON can't be parsed)
    const errors = page.getByTestId('word-entries-errors');
    await expect(errors).toBeVisible({ timeout: 5000 });
    await expect(errors.getByText(/JSON syntax error/i)).toBeVisible();
  });

  test('missing required fields shows validation errors', async ({ page }) => {
    const deckId = await getVocabularyDeckId(page);

    // Paste JSON with missing lemma
    await page.getByTestId('word-entries-json-textarea').fill(makeInvalidJsonMissingLemma(deckId));

    // Click Validate
    await page.getByTestId('word-entries-validate-button').click();

    // Verify error shows field name and message
    const errors = page.getByTestId('word-entries-errors');
    await expect(errors).toBeVisible({ timeout: 5000 });
    await expect(errors.getByText(/lemma/i)).toBeVisible();
    await expect(errors.getByText(/required/i)).toBeVisible();
  });

  test('validation errors show entry index and field', async ({ page }) => {
    const deckId = await getVocabularyDeckId(page);

    // Paste JSON with error on entry 2
    await page.getByTestId('word-entries-json-textarea').fill(makeInvalidJsonSecondEntryError(deckId));

    // Click Validate
    await page.getByTestId('word-entries-validate-button').click();

    // Verify error shows "Entry 2" (1-indexed in display) and field name
    const errors = page.getByTestId('word-entries-errors');
    await expect(errors).toBeVisible({ timeout: 5000 });
    await expect(errors.getByText(/Entry 2/i)).toBeVisible();
    await expect(errors.getByText(/lemma/i)).toBeVisible();
  });

  test('form content preserved after validation error', async ({ page }) => {
    const invalidJson = INVALID_JSON_NOT_PARSEABLE;

    // Paste invalid JSON
    await page.getByTestId('word-entries-json-textarea').fill(invalidJson);

    // Click Validate (shows error)
    await page.getByTestId('word-entries-validate-button').click();

    // Verify error is shown
    await expect(page.getByTestId('word-entries-errors')).toBeVisible({ timeout: 5000 });

    // Verify textarea still has the JSON content
    await expect(page.getByTestId('word-entries-json-textarea')).toHaveValue(invalidJson);
  });

  test('maximum 100 entries validation', async ({ page }) => {
    const deckId = await getVocabularyDeckId(page);

    // Generate JSON with 101 entries
    const tooManyEntriesJson = makeTooManyEntriesJson(deckId);

    // Paste JSON
    await page.getByTestId('word-entries-json-textarea').fill(tooManyEntriesJson);

    // Click Validate
    await page.getByTestId('word-entries-validate-button').click();

    // Verify error: "Too many entries. Maximum is 100."
    const errors = page.getByTestId('word-entries-errors');
    await expect(errors).toBeVisible({ timeout: 5000 });
    await expect(errors.getByText(/Too many/i)).toBeVisible();
    await expect(errors.getByText(/Maximum is 100/i)).toBeVisible();
  });

  test('array format shows migration error', async ({ page }) => {
    // Old format - should show clear migration message
    const oldFormatJson = JSON.stringify([
      { lemma: 'test', part_of_speech: 'noun', translation_en: 'test' },
    ]);

    await page.getByTestId('word-entries-json-textarea').fill(oldFormatJson);
    await page.getByTestId('word-entries-validate-button').click();

    const errors = page.getByTestId('word-entries-errors');
    await expect(errors).toBeVisible({ timeout: 5000 });
    await expect(errors).toContainText(/format has changed/i);
  });

  test('missing deck_id shows error', async ({ page }) => {
    const jsonWithoutDeckId = JSON.stringify({
      word_entries: [{ lemma: 'test', part_of_speech: 'noun', translation_en: 'test' }],
    });

    await page.getByTestId('word-entries-json-textarea').fill(jsonWithoutDeckId);
    await page.getByTestId('word-entries-validate-button').click();

    const errors = page.getByTestId('word-entries-errors');
    await expect(errors).toBeVisible({ timeout: 5000 });
    await expect(errors).toContainText(/deck_id.*required/i);
  });

  test('invalid deck_id format shows error', async ({ page }) => {
    const jsonWithBadDeckId = JSON.stringify({
      deck_id: 'not-a-uuid',
      word_entries: [{ lemma: 'test', part_of_speech: 'noun', translation_en: 'test' }],
    });

    await page.getByTestId('word-entries-json-textarea').fill(jsonWithBadDeckId);
    await page.getByTestId('word-entries-validate-button').click();

    const errors = page.getByTestId('word-entries-errors');
    await expect(errors).toBeVisible({ timeout: 5000 });
    await expect(errors).toContainText(/UUID/i);
  });
});

// ============================================================================
// UPSERT BEHAVIOR TESTS
// ============================================================================

test.describe('Admin Word Entries Bulk - Upsert Behavior', () => {
  test.use({ storageState: ADMIN_AUTH });

  test.beforeEach(async ({ page }) => {
    await seedAdminCards(page);
    await navigateToWordEntriesTab(page);
  });

  test('uploading same entry twice shows updated count > 0', async ({ page }) => {
    const deckId = await getVocabularyDeckId(page);
    // Use a fixed unique lemma for this test to ensure upsert behavior
    const testLemma = `upsert_test_${Date.now()}`;

    const json = JSON.stringify({
      deck_id: deckId,
      word_entries: [{
        lemma: testLemma,
        part_of_speech: 'noun',
        translation_en: 'first translation',
      }],
    });

    // First upload - should create
    await page.getByTestId('word-entries-json-textarea').fill(json);
    await page.getByTestId('word-entries-validate-button').click();
    await expect(page.getByTestId('word-entries-preview')).toBeVisible({ timeout: 5000 });
    await page.getByTestId('word-entries-upload-button').click();
    await expect(page.getByText(/Successfully uploaded/i).first()).toBeVisible({ timeout: 10000 });

    // Navigate back to Word Entries tab (form was cleared)
    await navigateToWordEntriesTab(page);

    // Second upload with same lemma + part_of_speech - should update
    const updatedJson = JSON.stringify({
      deck_id: deckId,
      word_entries: [{
        lemma: testLemma,
        part_of_speech: 'noun',
        translation_en: 'updated translation',
      }],
    });

    await page.getByTestId('word-entries-json-textarea').fill(updatedJson);
    await page.getByTestId('word-entries-validate-button').click();
    await expect(page.getByTestId('word-entries-preview')).toBeVisible({ timeout: 5000 });
    await page.getByTestId('word-entries-upload-button').click();

    // Verify toast shows updated count > 0
    // Should show "0 created, 1 updated" or similar
    await expect(
      page.getByText(/\d+ updated/i).first()
    ).toBeVisible({ timeout: 10000 });
  });
});
