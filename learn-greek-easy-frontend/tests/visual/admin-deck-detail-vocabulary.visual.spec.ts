/**
 * Admin Deck Detail Vocabulary - Visual Regression Tests
 *
 * Visual regression tests for the deck detail modal showing vocabulary cards.
 * Uses Chromatic for visual snapshots and comparison.
 *
 * These tests capture scenarios for:
 * 1. Vocabulary deck with cards showing part_of_speech and level badges
 * 2. Deck detail with Create Card button visible
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

const mockVocabularyDeck = {
  id: 'vocab-deck-001',
  name: 'A1 Vocabulary',
  type: 'vocabulary',
  level: 'A1',
  category: null,
  item_count: 5,
  is_active: true,
  is_premium: false,
  created_at: '2026-01-01T00:00:00Z',
  owner_id: null,
  owner_name: null,
};

const mockVocabularyCards = [
  {
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
    },
    verb_data: null,
    adjective_data: null,
    adverb_data: null,
    examples: null,
    created_at: '2026-01-20T10:00:00Z',
    updated_at: '2026-01-20T10:00:00Z',
  },
  {
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
    },
    adjective_data: null,
    adverb_data: null,
    examples: null,
    created_at: '2026-01-20T10:00:00Z',
    updated_at: '2026-01-20T10:00:00Z',
  },
  {
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
      feminine_nom_sg: 'καλή',
      neuter_nom_sg: 'καλό',
    },
    adverb_data: null,
    examples: null,
    created_at: '2026-01-20T10:00:00Z',
    updated_at: '2026-01-20T10:00:00Z',
  },
  {
    id: 'card-004',
    deck_id: 'vocab-deck-001',
    front_text: 'γρήγορα',
    back_text_en: 'quickly',
    back_text_ru: 'быстро',
    pronunciation: 'GRI-go-ra',
    part_of_speech: 'adverb',
    level: 'A2', // Different level than deck - should show badge
    noun_data: null,
    verb_data: null,
    adjective_data: null,
    adverb_data: {
      comparative: 'πιο γρήγορα',
      superlative: 'πολύ γρήγορα',
    },
    examples: null,
    created_at: '2026-01-20T10:00:00Z',
    updated_at: '2026-01-20T10:00:00Z',
  },
  {
    id: 'card-005',
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
    ],
    created_at: '2026-01-20T10:00:00Z',
    updated_at: '2026-01-20T10:00:00Z',
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Set up common API mocks for vocabulary deck detail tests
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function setupVocabularyDeckDetailMocks(page: any) {
  // Mock admin decks API
  await page.route('**/api/v1/admin/decks*', (route: { fulfill: (options: { status: number; contentType: string; body: string }) => void }) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        decks: [mockVocabularyDeck],
        total: 1,
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
        cards: mockVocabularyCards,
        total: mockVocabularyCards.length,
        page: 1,
        page_size: 20,
        deck_id: 'vocab-deck-001',
      }),
    });
  });
}

// ============================================================================
// DECK DETAIL VOCABULARY - VISUAL TESTS
// ============================================================================

test.describe('DeckDetailModal Vocabulary - Visual Tests', () => {
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

  // Scenario: Deck Detail - Vocabulary Cards with Badges
  test('deck-detail-vocabulary', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setupVocabularyDeckDetailMocks(page);

    await page.goto('/admin');
    await waitForPageReady(page, '[data-testid="admin-page"]');

    // Click on vocabulary deck to open deck detail
    await page.getByTestId('deck-row-vocab-deck-001').click();

    // Wait for deck detail modal to be visible
    await expect(page.getByTestId('deck-detail-modal')).toBeVisible();

    // Wait for vocabulary cards list to load
    await expect(page.getByTestId('vocabulary-cards-list')).toBeVisible();
    await page.waitForTimeout(500);

    // Verify badges are visible for various cards
    await expect(page.getByTestId('vocabulary-card-pos-badge-card-001')).toBeVisible();
    await expect(page.getByTestId('vocabulary-card-pos-badge-card-002')).toBeVisible();
    await expect(page.getByTestId('vocabulary-card-pos-badge-card-003')).toBeVisible();

    // Card-004 has a different level (A2) than deck (A1), so should show level badge
    await expect(page.getByTestId('vocabulary-card-level-badge-card-004')).toBeVisible();

    await takeSnapshot(page, 'DeckDetailModal - Vocabulary Cards with Badges', testInfo);
  });

  // Scenario: Deck Detail - Vocabulary with Create Button
  test('deck-detail-vocabulary-with-create', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setupVocabularyDeckDetailMocks(page);

    await page.goto('/admin');
    await waitForPageReady(page, '[data-testid="admin-page"]');

    // Click on vocabulary deck to open deck detail
    await page.getByTestId('deck-row-vocab-deck-001').click();

    // Wait for deck detail modal to be visible
    await expect(page.getByTestId('deck-detail-modal')).toBeVisible();

    // Wait for vocabulary cards list to load
    await expect(page.getByTestId('vocabulary-cards-list')).toBeVisible();

    // Verify Create Card button is visible
    await expect(page.getByTestId('create-card-btn')).toBeVisible();
    await page.waitForTimeout(500);

    await takeSnapshot(page, 'DeckDetailModal - Vocabulary with Create Button', testInfo);
  });
});
