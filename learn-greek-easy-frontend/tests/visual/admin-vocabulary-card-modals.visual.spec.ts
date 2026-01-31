/**
 * Admin Vocabulary Card Modals - Visual Regression Tests
 *
 * Visual regression tests for vocabulary card create/edit modals.
 * Uses Chromatic for visual snapshots and comparison.
 *
 * These tests capture scenarios for:
 * 1. VocabularyCardCreateModal - Basic Info tab
 * 2. VocabularyCardCreateModal - Grammar tab (noun, verb, adjective)
 * 3. VocabularyCardCreateModal - Examples tab (empty, with examples)
 * 4. VocabularyCardEditModal - Pre-populated form
 * 5. Validation error states
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
];

const mockVocabularyCardNoun = {
  id: 'card-001',
  deck_id: 'vocab-deck-001',
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
    accusative_singular: 'σπίτι',
    vocative_singular: 'σπίτι',
    nominative_plural: 'σπίτια',
    genitive_plural: 'σπιτιών',
    accusative_plural: 'σπίτια',
    vocative_plural: 'σπίτια',
  },
  verb_data: null,
  adjective_data: null,
  adverb_data: null,
  examples: null,
  created_at: '2026-01-20T10:00:00Z',
  updated_at: '2026-01-20T10:00:00Z',
};

const mockVocabularyCardVerb = {
  id: 'card-002',
  deck_id: 'vocab-deck-001',
  front_text: 'τρώω',
  back_text_en: 'I eat',
  back_text_ru: 'я ем',
  pronunciation: 'TRO-o',
  part_of_speech: 'verb',
  level: 'A1',
  noun_data: null,
  verb_data: {
    voice: 'active',
    present_1s: 'τρώω',
    present_2s: 'τρως',
    present_3s: 'τρώει',
    present_1p: 'τρώμε',
    present_2p: 'τρώτε',
    present_3p: 'τρώνε',
    past_1s: 'έφαγα',
    past_2s: 'έφαγες',
    past_3s: 'έφαγε',
  },
  adjective_data: null,
  adverb_data: null,
  examples: null,
  created_at: '2026-01-20T10:00:00Z',
  updated_at: '2026-01-20T10:00:00Z',
};

const mockVocabularyCardAdjective = {
  id: 'card-003',
  deck_id: 'vocab-deck-001',
  front_text: 'καλός',
  back_text_en: 'good',
  back_text_ru: 'хороший',
  pronunciation: 'ka-LOS',
  part_of_speech: 'adjective',
  level: 'A1',
  noun_data: null,
  verb_data: null,
  adjective_data: {
    masculine_nom_sg: 'καλός',
    masculine_gen_sg: 'καλού',
    masculine_acc_sg: 'καλό',
    feminine_nom_sg: 'καλή',
    feminine_gen_sg: 'καλής',
    feminine_acc_sg: 'καλή',
    neuter_nom_sg: 'καλό',
    neuter_gen_sg: 'καλού',
    neuter_acc_sg: 'καλό',
    comparative: 'καλύτερος',
    superlative: 'κάλλιστος',
  },
  adverb_data: null,
  examples: null,
  created_at: '2026-01-20T10:00:00Z',
  updated_at: '2026-01-20T10:00:00Z',
};

const mockVocabularyCardWithExamples = {
  id: 'card-004',
  deck_id: 'vocab-deck-001',
  front_text: 'βιβλίο',
  back_text_en: 'book',
  back_text_ru: 'книга',
  pronunciation: 'vi-VLI-o',
  part_of_speech: 'noun',
  level: 'A1',
  noun_data: {
    gender: 'neuter',
    nominative_singular: 'βιβλίο',
    genitive_singular: 'βιβλίου',
    accusative_singular: 'βιβλίο',
  },
  verb_data: null,
  adjective_data: null,
  adverb_data: null,
  examples: [
    {
      greek: 'Διαβάζω ένα βιβλίο.',
      english: 'I am reading a book.',
      russian: 'Я читаю книгу.',
    },
    {
      greek: 'Το βιβλίο είναι στο τραπέζι.',
      english: 'The book is on the table.',
      russian: 'Книга на столе.',
    },
  ],
  created_at: '2026-01-20T10:00:00Z',
  updated_at: '2026-01-20T10:00:00Z',
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Set up common API mocks for admin vocabulary tests
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function setupAdminMocks(page: any, cards: typeof mockVocabularyCardNoun[] = []) {
  // Mock admin decks API
  await page.route('**/api/v1/admin/decks*', (route: { fulfill: (options: { status: number; contentType: string; body: string }) => void }) => {
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

  // Mock vocabulary cards for deck detail
  await page.route('**/api/v1/admin/vocabulary/decks/vocab-deck-001/cards*', (route: { fulfill: (options: { status: number; contentType: string; body: string }) => void }) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        cards: cards,
        total: cards.length,
        page: 1,
        page_size: 20,
        deck_id: 'vocab-deck-001',
      }),
    });
  });
}

// ============================================================================
// VOCABULARY CARD CREATE MODAL - VISUAL TESTS
// ============================================================================

test.describe('VocabularyCardCreateModal - Visual Tests', () => {
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

  // Scenario: Create Modal - Basic Info Tab (Default State)
  test('vocab-card-create-basic', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setupAdminMocks(page, [mockVocabularyCardNoun]);

    await page.goto('/admin');
    await waitForPageReady(page, '[data-testid="admin-page"]');

    // Click on vocabulary deck to open deck detail
    await page.getByTestId('deck-row-vocab-deck-001').click();
    await expect(page.getByTestId('deck-detail-modal')).toBeVisible();
    await page.waitForTimeout(300);

    // Click create card button
    await page.getByTestId('create-card-btn').click();

    // Wait for create modal to open
    await expect(page.getByTestId('vocabulary-card-create-modal')).toBeVisible();
    await page.waitForTimeout(500);

    await takeSnapshot(page, 'VocabularyCardCreateModal - Basic Info Tab', testInfo);
  });

  // Scenario: Create Modal - Grammar Tab with Noun Selected
  test('vocab-card-create-grammar-noun', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setupAdminMocks(page, [mockVocabularyCardNoun]);

    await page.goto('/admin');
    await waitForPageReady(page, '[data-testid="admin-page"]');

    // Open vocabulary deck
    await page.getByTestId('deck-row-vocab-deck-001').click();
    await expect(page.getByTestId('deck-detail-modal')).toBeVisible();
    await page.waitForTimeout(300);

    // Open create modal
    await page.getByTestId('create-card-btn').click();
    await expect(page.getByTestId('vocabulary-card-create-modal')).toBeVisible();
    await page.waitForTimeout(300);

    // Select noun as part_of_speech (this auto-switches to Grammar tab)
    await page.getByTestId('part-of-speech-select').click();
    await page.locator('[role="option"]').filter({ hasText: /^noun$/i }).click();

    // Wait for Grammar tab to become active and noun form to appear
    await expect(page.getByTestId('noun-grammar-form')).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(500);

    await takeSnapshot(page, 'VocabularyCardCreateModal - Grammar Tab (Noun)', testInfo);
  });

  // Scenario: Create Modal - Grammar Tab with Verb Selected
  test('vocab-card-create-grammar-verb', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setupAdminMocks(page, [mockVocabularyCardVerb]);

    await page.goto('/admin');
    await waitForPageReady(page, '[data-testid="admin-page"]');

    // Open vocabulary deck
    await page.getByTestId('deck-row-vocab-deck-001').click();
    await expect(page.getByTestId('deck-detail-modal')).toBeVisible();
    await page.waitForTimeout(300);

    // Open create modal
    await page.getByTestId('create-card-btn').click();
    await expect(page.getByTestId('vocabulary-card-create-modal')).toBeVisible();
    await page.waitForTimeout(300);

    // Select verb as part_of_speech
    await page.getByTestId('part-of-speech-select').click();
    await page.locator('[role="option"]').filter({ hasText: /^verb$/i }).click();

    // Wait for verb grammar form to appear
    await expect(page.getByTestId('verb-grammar-form')).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(500);

    await takeSnapshot(page, 'VocabularyCardCreateModal - Grammar Tab (Verb)', testInfo);
  });

  // Scenario: Create Modal - Grammar Tab with Adjective Selected
  test('vocab-card-create-grammar-adjective', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setupAdminMocks(page, [mockVocabularyCardAdjective]);

    await page.goto('/admin');
    await waitForPageReady(page, '[data-testid="admin-page"]');

    // Open vocabulary deck
    await page.getByTestId('deck-row-vocab-deck-001').click();
    await expect(page.getByTestId('deck-detail-modal')).toBeVisible();
    await page.waitForTimeout(300);

    // Open create modal
    await page.getByTestId('create-card-btn').click();
    await expect(page.getByTestId('vocabulary-card-create-modal')).toBeVisible();
    await page.waitForTimeout(300);

    // Select adjective as part_of_speech
    await page.getByTestId('part-of-speech-select').click();
    await page.locator('[role="option"]').filter({ hasText: /^adjective$/i }).click();

    // Wait for adjective grammar form to appear
    await expect(page.getByTestId('adjective-grammar-form')).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(500);

    await takeSnapshot(page, 'VocabularyCardCreateModal - Grammar Tab (Adjective)', testInfo);
  });

  // Scenario: Create Modal - Examples Tab with Examples Added
  test('vocab-card-create-examples', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setupAdminMocks(page, [mockVocabularyCardWithExamples]);

    await page.goto('/admin');
    await waitForPageReady(page, '[data-testid="admin-page"]');

    // Open vocabulary deck
    await page.getByTestId('deck-row-vocab-deck-001').click();
    await expect(page.getByTestId('deck-detail-modal')).toBeVisible();
    await page.waitForTimeout(300);

    // Open create modal
    await page.getByTestId('create-card-btn').click();
    await expect(page.getByTestId('vocabulary-card-create-modal')).toBeVisible();
    await page.waitForTimeout(300);

    // Switch to Examples tab
    await page.getByRole('tab', { name: /examples/i }).click();
    await expect(page.getByTestId('examples-tab')).toBeVisible({ timeout: 3000 });

    // Add first example
    await page.getByTestId('examples-add-button').click();
    await expect(page.getByTestId('examples-row-0')).toBeVisible();
    await page.getByTestId('examples-greek-0').fill('Διαβάζω ένα βιβλίο.');
    await page.getByTestId('examples-english-0').fill('I am reading a book.');

    // Add second example
    await page.getByTestId('examples-add-button').click();
    await expect(page.getByTestId('examples-row-1')).toBeVisible();
    await page.getByTestId('examples-greek-1').fill('Το βιβλίο είναι στο τραπέζι.');
    await page.getByTestId('examples-english-1').fill('The book is on the table.');

    await page.waitForTimeout(500);

    await takeSnapshot(page, 'VocabularyCardCreateModal - Examples Tab (With Examples)', testInfo);
  });

  // Scenario: Create Modal - Examples Tab Empty State
  test('vocab-card-create-examples-empty', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setupAdminMocks(page, [mockVocabularyCardNoun]);

    await page.goto('/admin');
    await waitForPageReady(page, '[data-testid="admin-page"]');

    // Open vocabulary deck
    await page.getByTestId('deck-row-vocab-deck-001').click();
    await expect(page.getByTestId('deck-detail-modal')).toBeVisible();
    await page.waitForTimeout(300);

    // Open create modal
    await page.getByTestId('create-card-btn').click();
    await expect(page.getByTestId('vocabulary-card-create-modal')).toBeVisible();
    await page.waitForTimeout(300);

    // Switch to Examples tab
    await page.getByRole('tab', { name: /examples/i }).click();

    // Wait for empty state
    await expect(page.getByTestId('examples-tab-empty')).toBeVisible({ timeout: 3000 });
    await page.waitForTimeout(500);

    await takeSnapshot(page, 'VocabularyCardCreateModal - Examples Tab (Empty)', testInfo);
  });

  // Scenario: Create Modal - Validation Errors
  test('vocab-card-validation-errors', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setupAdminMocks(page, [mockVocabularyCardNoun]);

    await page.goto('/admin');
    await waitForPageReady(page, '[data-testid="admin-page"]');

    // Open vocabulary deck
    await page.getByTestId('deck-row-vocab-deck-001').click();
    await expect(page.getByTestId('deck-detail-modal')).toBeVisible();
    await page.waitForTimeout(300);

    // Open create modal
    await page.getByTestId('create-card-btn').click();
    await expect(page.getByTestId('vocabulary-card-create-modal')).toBeVisible();
    await page.waitForTimeout(300);

    // Try to submit without filling required fields
    await page.getByTestId('vocabulary-card-create-submit').click();

    // Wait for validation errors to appear
    await page.waitForTimeout(500);

    await takeSnapshot(page, 'VocabularyCardCreateModal - Validation Errors', testInfo);
  });
});

// ============================================================================
// VOCABULARY CARD EDIT MODAL - VISUAL TESTS
// ============================================================================

test.describe('VocabularyCardEditModal - Visual Tests', () => {
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

  // Scenario: Edit Modal - Populated with Noun Data
  test('vocab-card-edit-populated', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    // Set up mocks with noun card
    await setupAdminMocks(page, [mockVocabularyCardNoun, mockVocabularyCardVerb]);

    // Mock single card fetch for edit
    await page.route('**/api/v1/admin/vocabulary/cards/card-001', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockVocabularyCardNoun),
      });
    });

    await page.goto('/admin');
    await waitForPageReady(page, '[data-testid="admin-page"]');

    // Open vocabulary deck
    await page.getByTestId('deck-row-vocab-deck-001').click();
    await expect(page.getByTestId('deck-detail-modal')).toBeVisible();
    await page.waitForTimeout(300);

    // Click edit on the first card
    await page.getByTestId('vocabulary-card-edit-card-001').click();

    // Wait for edit modal to open
    await expect(page.getByTestId('vocabulary-card-edit-modal')).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(500);

    await takeSnapshot(page, 'VocabularyCardEditModal - Populated (Noun)', testInfo);
  });

  // Scenario: Edit Modal - Populated with Verb Data (showing Grammar tab)
  test('vocab-card-edit-verb-grammar', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    // Set up mocks with verb card
    await setupAdminMocks(page, [mockVocabularyCardVerb]);

    // Mock single card fetch for edit
    await page.route('**/api/v1/admin/vocabulary/cards/card-002', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockVocabularyCardVerb),
      });
    });

    await page.goto('/admin');
    await waitForPageReady(page, '[data-testid="admin-page"]');

    // Open vocabulary deck
    await page.getByTestId('deck-row-vocab-deck-001').click();
    await expect(page.getByTestId('deck-detail-modal')).toBeVisible();
    await page.waitForTimeout(300);

    // Click edit on the verb card
    await page.getByTestId('vocabulary-card-edit-card-002').click();

    // Wait for edit modal to open
    await expect(page.getByTestId('vocabulary-card-edit-modal')).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(300);

    // Switch to Grammar tab
    await page.getByRole('tab', { name: /grammar/i }).click();
    await expect(page.getByTestId('verb-grammar-form')).toBeVisible({ timeout: 3000 });
    await page.waitForTimeout(500);

    await takeSnapshot(page, 'VocabularyCardEditModal - Verb Grammar Tab', testInfo);
  });

  // Scenario: Edit Modal - Card with Examples
  test('vocab-card-edit-with-examples', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    // Set up mocks with card that has examples
    await setupAdminMocks(page, [mockVocabularyCardWithExamples]);

    // Mock single card fetch for edit
    await page.route('**/api/v1/admin/vocabulary/cards/card-004', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockVocabularyCardWithExamples),
      });
    });

    await page.goto('/admin');
    await waitForPageReady(page, '[data-testid="admin-page"]');

    // Open vocabulary deck
    await page.getByTestId('deck-row-vocab-deck-001').click();
    await expect(page.getByTestId('deck-detail-modal')).toBeVisible();
    await page.waitForTimeout(300);

    // Click edit on the card with examples
    await page.getByTestId('vocabulary-card-edit-card-004').click();

    // Wait for edit modal to open
    await expect(page.getByTestId('vocabulary-card-edit-modal')).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(300);

    // Switch to Examples tab
    await page.getByRole('tab', { name: /examples/i }).click();
    await expect(page.getByTestId('examples-tab')).toBeVisible({ timeout: 3000 });
    await page.waitForTimeout(500);

    await takeSnapshot(page, 'VocabularyCardEditModal - Examples Tab', testInfo);
  });
});
