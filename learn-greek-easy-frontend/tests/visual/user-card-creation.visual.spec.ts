/**
 * User Card Creation - Visual Regression Tests
 *
 * Visual regression tests for user-facing vocabulary card CRUD features.
 * Uses Chromatic for visual snapshots and comparison.
 *
 * These tests capture scenarios for:
 * 1. Deck detail page with cards (desktop/mobile)
 * 2. Deck detail empty state (desktop/mobile)
 * 3. Card create modal - basic, grammar, examples
 * 4. Card edit modal - populated form
 * 5. Card delete confirmation (desktop/mobile)
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

const mockUserDecks = [
  {
    id: 'user-deck-001',
    name: 'My Greek Basics',
    description: 'Personal vocabulary collection',
    level: 'A1',
    type: 'vocabulary',
    is_active: true,
    is_premium: false,
    item_count: 3,
    owner_id: 'user-1',
    owner_name: 'Demo User',
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-01-15T10:00:00Z',
  },
  {
    id: 'user-deck-002',
    name: 'Empty Deck',
    description: 'A deck with no cards yet',
    level: 'A2',
    type: 'vocabulary',
    is_active: true,
    is_premium: false,
    item_count: 0,
    owner_id: 'user-1',
    owner_name: 'Demo User',
    created_at: '2026-01-16T10:00:00Z',
    updated_at: '2026-01-16T10:00:00Z',
  },
];

const mockCards = [
  {
    id: 'card-001',
    deck_id: 'user-deck-001',
    front_text: 'γεια',
    back_text_en: 'hello',
    back_text_ru: 'привет',
    pronunciation: 'YA',
    part_of_speech: null,
    level: 'A1',
    noun_data: null,
    verb_data: null,
    adjective_data: null,
    adverb_data: null,
    examples: null,
    created_at: '2026-01-20T10:00:00Z',
    updated_at: '2026-01-20T10:00:00Z',
  },
  {
    id: 'card-002',
    deck_id: 'user-deck-001',
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
    },
    verb_data: null,
    adjective_data: null,
    adverb_data: null,
    examples: null,
    created_at: '2026-01-20T10:00:00Z',
    updated_at: '2026-01-20T10:00:00Z',
  },
  {
    id: 'card-003',
    deck_id: 'user-deck-001',
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
    },
    adjective_data: null,
    adverb_data: null,
    examples: [
      {
        greek: 'Τρώω ψωμί.',
        english: 'I eat bread.',
        russian: 'Я ем хлеб.',
      },
    ],
    created_at: '2026-01-20T10:00:00Z',
    updated_at: '2026-01-20T10:00:00Z',
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function setupUserDeckMocks(
  page: any,
  deckId: string,
  cards: typeof mockCards = []
) {
  // Mock user's decks list
  await page.route('**/api/v1/decks/mine*', (route: { fulfill: (options: { status: number; contentType: string; body: string }) => void }) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        decks: mockUserDecks,
        total: mockUserDecks.length,
      }),
    });
  });

  // Mock single deck fetch
  await page.route(`**/api/v1/decks/${deckId}`, (route: { fulfill: (options: { status: number; contentType: string; body: string }) => void }) => {
    const deck = mockUserDecks.find((d) => d.id === deckId);
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(deck || mockUserDecks[0]),
    });
  });

  // Mock cards list for deck
  await page.route(`**/api/v1/cards?deck_id=${deckId}*`, (route: { fulfill: (options: { status: number; contentType: string; body: string }) => void }) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        cards: cards,
        total: cards.length,
        page: 1,
        page_size: 100,
      }),
    });
  });

  // Mock single card fetch for edit
  for (const card of cards) {
    await page.route(`**/api/v1/cards/${card.id}`, (route: { fulfill: (options: { status: number; contentType: string; body: string }) => void }) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(card),
      });
    });
  }
}

// ============================================================================
// DECK DETAIL PAGE - VISUAL TESTS
// ============================================================================

test.describe('User Card Creation - Deck Detail Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginForVisualTest(page);
  });

  // Scenario 1: Deck detail with cards (Desktop)
  test('deck-detail-with-cards', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setupUserDeckMocks(page, 'user-deck-001', mockCards);

    await page.goto('/my-decks/user-deck-001');
    await waitForPageReady(page, '[data-testid="my-deck-detail"]');

    // Wait for cards list to load
    await expect(page.locator('[data-testid="cards-list"]')).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(500);

    await takeSnapshot(page, 'User Deck Detail - With Cards (Desktop)', testInfo);
  });

  // Scenario 2: Deck detail with cards (Mobile)
  test('deck-detail-with-cards-mobile', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await setupUserDeckMocks(page, 'user-deck-001', mockCards);

    await page.goto('/my-decks/user-deck-001');
    await waitForPageReady(page, '[data-testid="my-deck-detail"]');

    // Wait for cards list to load
    await expect(page.locator('[data-testid="cards-list"]')).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(500);

    await takeSnapshot(page, 'User Deck Detail - With Cards (Mobile)', testInfo);
  });

  // Scenario 3: Deck detail empty state (Desktop)
  test('deck-detail-empty-state', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setupUserDeckMocks(page, 'user-deck-002', []);

    await page.goto('/my-decks/user-deck-002');
    await waitForPageReady(page, '[data-testid="my-deck-detail"]');

    // Wait for empty state to load
    await expect(page.locator('[data-testid="cards-empty-state"]')).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(500);

    await takeSnapshot(page, 'User Deck Detail - Empty State (Desktop)', testInfo);
  });

  // Scenario 4: Deck detail empty state (Mobile)
  test('deck-detail-empty-state-mobile', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await setupUserDeckMocks(page, 'user-deck-002', []);

    await page.goto('/my-decks/user-deck-002');
    await waitForPageReady(page, '[data-testid="my-deck-detail"]');

    // Wait for empty state to load
    await expect(page.locator('[data-testid="cards-empty-state"]')).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(500);

    await takeSnapshot(page, 'User Deck Detail - Empty State (Mobile)', testInfo);
  });
});

// ============================================================================
// USER CARD CREATE MODAL - VISUAL TESTS
// ============================================================================

test.describe('User Card Create Modal - Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginForVisualTest(page);
  });

  // Scenario 5: Create modal - Basic info tab
  test('user-card-create-basic', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setupUserDeckMocks(page, 'user-deck-001', mockCards);

    await page.goto('/my-decks/user-deck-001');
    await waitForPageReady(page, '[data-testid="my-deck-detail"]');

    // Wait for page to fully load
    await expect(page.locator('[data-testid="cards-list"]')).toBeVisible({ timeout: 5000 });

    // Click create card button
    await page.locator('[data-testid="create-card-button"]').click();

    // Wait for modal to open
    await expect(page.locator('[data-testid="vocabulary-card-create-modal"]')).toBeVisible({
      timeout: 5000,
    });
    await page.waitForTimeout(500);

    await takeSnapshot(page, 'User Card Create Modal - Basic Info Tab', testInfo);
  });

  // Scenario 6: Create modal - Grammar tab (Noun)
  test('user-card-create-grammar-noun', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setupUserDeckMocks(page, 'user-deck-001', mockCards);

    await page.goto('/my-decks/user-deck-001');
    await waitForPageReady(page, '[data-testid="my-deck-detail"]');

    await expect(page.locator('[data-testid="cards-list"]')).toBeVisible({ timeout: 5000 });

    // Open create modal
    await page.locator('[data-testid="create-card-button"]').click();
    await expect(page.locator('[data-testid="vocabulary-card-create-modal"]')).toBeVisible({
      timeout: 5000,
    });
    await page.waitForTimeout(300);

    // Select noun as part_of_speech
    await page.locator('[data-testid="part-of-speech-select"]').click();
    await page.locator('[role="option"]').filter({ hasText: /^noun$/i }).click();

    // Wait for noun grammar form to appear
    await expect(page.locator('[data-testid="noun-grammar-form"]')).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(500);

    await takeSnapshot(page, 'User Card Create Modal - Grammar Tab (Noun)', testInfo);
  });

  // Scenario 7: Create modal - Grammar tab (Verb)
  test('user-card-create-grammar-verb', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setupUserDeckMocks(page, 'user-deck-001', mockCards);

    await page.goto('/my-decks/user-deck-001');
    await waitForPageReady(page, '[data-testid="my-deck-detail"]');

    await expect(page.locator('[data-testid="cards-list"]')).toBeVisible({ timeout: 5000 });

    // Open create modal
    await page.locator('[data-testid="create-card-button"]').click();
    await expect(page.locator('[data-testid="vocabulary-card-create-modal"]')).toBeVisible({
      timeout: 5000,
    });
    await page.waitForTimeout(300);

    // Select verb as part_of_speech
    await page.locator('[data-testid="part-of-speech-select"]').click();
    await page.locator('[role="option"]').filter({ hasText: /^verb$/i }).click();

    // Wait for verb grammar form to appear
    await expect(page.locator('[data-testid="verb-grammar-form"]')).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(500);

    await takeSnapshot(page, 'User Card Create Modal - Grammar Tab (Verb)', testInfo);
  });

  // Scenario 8: Create modal - Examples tab
  test('user-card-create-examples', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setupUserDeckMocks(page, 'user-deck-001', mockCards);

    await page.goto('/my-decks/user-deck-001');
    await waitForPageReady(page, '[data-testid="my-deck-detail"]');

    await expect(page.locator('[data-testid="cards-list"]')).toBeVisible({ timeout: 5000 });

    // Open create modal
    await page.locator('[data-testid="create-card-button"]').click();
    await expect(page.locator('[data-testid="vocabulary-card-create-modal"]')).toBeVisible({
      timeout: 5000,
    });
    await page.waitForTimeout(300);

    // Switch to Examples tab
    await page.getByRole('tab', { name: /examples/i }).click();
    await expect(page.locator('[data-testid="examples-tab"]')).toBeVisible({ timeout: 3000 });

    // Add an example
    await page.locator('[data-testid="examples-add-button"]').click();
    await expect(page.locator('[data-testid="examples-row-0"]')).toBeVisible();
    await page.locator('[data-testid="examples-greek-0"]').fill('Γεια σου!');
    await page.locator('[data-testid="examples-english-0"]').fill('Hello!');

    await page.waitForTimeout(500);

    await takeSnapshot(page, 'User Card Create Modal - Examples Tab', testInfo);
  });
});

// ============================================================================
// USER CARD EDIT MODAL - VISUAL TESTS
// ============================================================================

test.describe('User Card Edit Modal - Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginForVisualTest(page);
  });

  // Scenario 9: Edit modal - Populated form
  test('user-card-edit-populated', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setupUserDeckMocks(page, 'user-deck-001', mockCards);

    // Also mock the single card endpoint for edit fetch
    await page.route('**/api/v1/cards/card-002', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockCards[1]), // The noun card
      });
    });

    await page.goto('/my-decks/user-deck-001');
    await waitForPageReady(page, '[data-testid="my-deck-detail"]');

    await expect(page.locator('[data-testid="cards-list"]')).toBeVisible({ timeout: 5000 });

    // Click edit on the noun card
    await page.locator('[data-testid="edit-card-card-002"]').click();

    // Wait for edit modal to open
    await expect(page.locator('[data-testid="vocabulary-card-edit-modal"]')).toBeVisible({
      timeout: 5000,
    });
    await page.waitForTimeout(500);

    await takeSnapshot(page, 'User Card Edit Modal - Populated Form', testInfo);
  });
});

// ============================================================================
// USER CARD DELETE CONFIRMATION - VISUAL TESTS
// ============================================================================

test.describe('User Card Delete Confirmation - Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginForVisualTest(page);
  });

  // Scenario 10: Delete confirmation (Desktop)
  test('user-card-delete-confirmation', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setupUserDeckMocks(page, 'user-deck-001', mockCards);

    await page.goto('/my-decks/user-deck-001');
    await waitForPageReady(page, '[data-testid="my-deck-detail"]');

    await expect(page.locator('[data-testid="cards-list"]')).toBeVisible({ timeout: 5000 });

    // Click delete on the first card
    await page.locator('[data-testid="delete-card-card-001"]').click();

    // Wait for confirmation dialog
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(300);

    await takeSnapshot(page, 'User Card Delete Confirmation (Desktop)', testInfo);
  });

  // Scenario 11: Delete confirmation (Mobile)
  test('user-card-delete-confirmation-mobile', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await setupUserDeckMocks(page, 'user-deck-001', mockCards);

    await page.goto('/my-decks/user-deck-001');
    await waitForPageReady(page, '[data-testid="my-deck-detail"]');

    await expect(page.locator('[data-testid="cards-list"]')).toBeVisible({ timeout: 5000 });

    // Click delete on the first card
    await page.locator('[data-testid="delete-card-card-001"]').click();

    // Wait for confirmation dialog
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(300);

    await takeSnapshot(page, 'User Card Delete Confirmation (Mobile)', testInfo);
  });
});
