/**
 * Admin Bulk Upload - Visual Regression Tests
 *
 * Visual regression tests for the bulk upload tab in admin panel.
 * Uses Chromatic for visual snapshots and comparison.
 *
 * These tests capture scenarios for:
 * 1. Empty state (no deck selected, empty textarea)
 * 2. Preview state (validation passed, showing summary)
 * 3. Error state (validation errors displayed)
 */

import { test, expect } from '@chromatic-com/playwright';
import {
  takeSnapshot,
  loginForVisualTest,
  waitForPageReady,
  VIEWPORTS,
} from './helpers/visual-helpers';

// ============================================================================
// MOCK DATA
// ============================================================================

const mockVocabularyDecks = [
  {
    id: 'vocab-deck-001',
    name: 'A1 Vocabulary',
    type: 'vocabulary',
    level: 'A1',
    category: null,
    item_count: 25,
    is_active: true,
    is_premium: false,
    created_at: '2026-01-01T00:00:00Z',
    owner_id: null,
    owner_name: null,
  },
  {
    id: 'vocab-deck-002',
    name: 'A2 Vocabulary',
    type: 'vocabulary',
    level: 'A2',
    category: null,
    item_count: 30,
    is_active: true,
    is_premium: false,
    created_at: '2026-01-01T00:00:00Z',
    owner_id: null,
    owner_name: null,
  },
  {
    id: 'vocab-deck-003',
    name: 'B1 Vocabulary',
    type: 'vocabulary',
    level: 'B1',
    category: null,
    item_count: 45,
    is_active: true,
    is_premium: true,
    created_at: '2026-01-01T00:00:00Z',
    owner_id: null,
    owner_name: null,
  },
];

const validBulkUploadJson = [
  {
    front_text: 'σπίτι',
    back_text_en: 'house',
    back_text_ru: 'дом',
    pronunciation: 'SPI-ti',
    part_of_speech: 'noun',
    level: 'A1',
    noun_data: {
      gender: 'neuter',
      nominative_singular: 'σπίτι',
      genitive_singular: 'σπιτιού',
    },
    examples: [
      {
        greek: 'Το σπίτι είναι μεγάλο.',
        english: 'The house is big.',
        russian: 'Дом большой.',
      },
    ],
  },
  {
    front_text: 'τρώω',
    back_text_en: 'I eat',
    back_text_ru: 'я ем',
    pronunciation: 'TRO-o',
    part_of_speech: 'verb',
    level: 'A1',
    verb_data: {
      voice: 'active',
      present_1s: 'τρώω',
      present_2s: 'τρως',
    },
  },
  {
    front_text: 'καλός',
    back_text_en: 'good',
    back_text_ru: 'хороший',
    pronunciation: 'ka-LOS',
    part_of_speech: 'adjective',
    level: 'A1',
    adjective_data: {
      masculine_nom_sg: 'καλός',
      feminine_nom_sg: 'καλή',
      neuter_nom_sg: 'καλό',
    },
  },
  {
    front_text: 'γρήγορα',
    back_text_en: 'quickly',
    back_text_ru: 'быстро',
    pronunciation: 'GRI-go-ra',
    part_of_speech: 'adverb',
    level: 'A2',
    adverb_data: {
      comparative: 'πιο γρήγορα',
      superlative: 'πολύ γρήγορα',
    },
  },
];

const invalidBulkUploadJson = [
  {
    // Missing required front_text
    back_text_en: 'house',
    pronunciation: 'SPI-ti',
  },
  {
    front_text: 'τρώω',
    // Missing required back_text_en
    pronunciation: 'TRO-o',
    part_of_speech: 'verb',
  },
  {
    front_text: 'καλός',
    back_text_en: 'good',
    // Invalid part_of_speech
    part_of_speech: 'invalid_type',
  },
  {
    front_text: 'βιβλίο',
    back_text_en: 'book',
    // Invalid level
    level: 'X1',
  },
  {
    front_text: 'γρήγορα',
    back_text_en: 'quickly',
    // Invalid examples structure
    examples: [
      {
        // Missing required greek field
        english: 'quickly',
      },
    ],
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Set up common API mocks for bulk upload tests
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function setupBulkUploadMocks(page: any) {
  // Mock admin decks API (for vocabulary decks dropdown)
  await page.route('**/api/v1/admin/decks*', (route: { request: () => { method: () => string; url: () => string }; fulfill: (options: { status: number; contentType: string; body: string }) => void }) => {
    const url = route.request().url();
    // Only return vocabulary decks for the bulk uploads tab filter
    if (url.includes('type=vocabulary')) {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          decks: mockVocabularyDecks,
          total: mockVocabularyDecks.length,
          page: 1,
          page_size: 100,
        }),
      });
    } else {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          decks: mockVocabularyDecks,
          total: mockVocabularyDecks.length,
          page: 1,
          page_size: 10,
        }),
      });
    }
  });

  // Mock admin stats API
  await page.route('**/api/v1/admin/stats*', (route: { fulfill: (options: { status: number; contentType: string; body: string }) => void }) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total_decks: 10,
        total_cards: 100,
        total_vocabulary_decks: 5,
        total_vocabulary_cards: 50,
        total_culture_decks: 5,
        total_culture_questions: 50,
      }),
    });
  });
}

// ============================================================================
// BULK UPLOAD TAB - VISUAL TESTS
// ============================================================================

test.describe('BulkUploadsTab - Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set up admin authentication for visual tests
    await loginForVisualTest(page);

    // Override role to admin
    await page.evaluate(() => {
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        const authState = JSON.parse(authStorage);
        authState.state.user.role = 'admin';
        localStorage.setItem('auth-storage', JSON.stringify(authState));
      }
    });
  });

  // Scenario: Bulk Upload - Empty State
  test('bulk-upload-empty', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setupBulkUploadMocks(page);

    await page.goto('/admin');
    await waitForPageReady(page, '[data-testid="admin-page"]');

    // Click on Bulk Uploads tab
    await page.getByTestId('admin-tab-bulkUploads').click();

    // Wait for bulk uploads tab to be visible
    await expect(page.getByTestId('bulk-uploads-tab')).toBeVisible();
    await page.waitForTimeout(500);

    await takeSnapshot(page, 'BulkUploadsTab - Empty State', testInfo);
  });

  // Scenario: Bulk Upload - Preview State (Valid JSON)
  test('bulk-upload-preview', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setupBulkUploadMocks(page);

    await page.goto('/admin');
    await waitForPageReady(page, '[data-testid="admin-page"]');

    // Click on Bulk Uploads tab
    await page.getByTestId('admin-tab-bulkUploads').click();
    await expect(page.getByTestId('bulk-uploads-tab')).toBeVisible();
    await page.waitForTimeout(300);

    // Select a vocabulary deck
    await page.getByTestId('bulk-uploads-deck-select').click();
    await page.getByRole('option', { name: /A1 Vocabulary/i }).click();

    // Paste valid JSON into textarea
    await page.getByTestId('bulk-uploads-json-textarea').fill(
      JSON.stringify(validBulkUploadJson, null, 2)
    );

    // Click Validate button
    await page.getByTestId('bulk-uploads-validate-button').click();

    // Wait for preview to appear
    await expect(page.getByTestId('bulk-uploads-preview')).toBeVisible();
    await page.waitForTimeout(500);

    await takeSnapshot(page, 'BulkUploadsTab - Preview State', testInfo);
  });

  // Scenario: Bulk Upload - Validation Errors
  test('bulk-upload-errors', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setupBulkUploadMocks(page);

    await page.goto('/admin');
    await waitForPageReady(page, '[data-testid="admin-page"]');

    // Click on Bulk Uploads tab
    await page.getByTestId('admin-tab-bulkUploads').click();
    await expect(page.getByTestId('bulk-uploads-tab')).toBeVisible();
    await page.waitForTimeout(300);

    // Select a vocabulary deck
    await page.getByTestId('bulk-uploads-deck-select').click();
    await page.getByRole('option', { name: /A1 Vocabulary/i }).click();

    // Paste invalid JSON into textarea
    await page.getByTestId('bulk-uploads-json-textarea').fill(
      JSON.stringify(invalidBulkUploadJson, null, 2)
    );

    // Click Validate button
    await page.getByTestId('bulk-uploads-validate-button').click();

    // Wait for errors to appear
    await expect(page.getByTestId('bulk-uploads-errors')).toBeVisible();
    await page.waitForTimeout(500);

    await takeSnapshot(page, 'BulkUploadsTab - Validation Errors', testInfo);
  });
});
