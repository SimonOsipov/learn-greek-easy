/**
 * Grammar UI Visual Regression Tests
 *
 * Visual regression tests for grammar UI components displayed during flashcard review.
 * Uses Chromatic for visual snapshots and comparison.
 *
 * Test Scenarios:
 * 1. PartOfSpeechBadge - All 4 colors (noun, verb, adjective, adverb)
 * 2. NounDeclensionTable - Complete data and N/A state
 * 3. VerbConjugationGrid - Complete data
 * 4. AdjectiveDeclensionTables - Complete data with 3 gender tables
 * 5. AdverbFormsTable - Complete data
 * 6. ExampleSentences - Single and multiple examples
 * 7. Mobile responsive layouts
 *
 * Note: Grammar components are rendered inside FlashcardContainer during review.
 * Tests mock the review API to display specific card types.
 */

import { test, expect } from '@chromatic-com/playwright';
import { Page } from '@playwright/test';

import {
  takeSnapshot,
  loginForVisualTest,
  VIEWPORTS,
} from './helpers/visual-helpers';

// ============================================================================
// MOCK DATA
// ============================================================================

// Mock noun card data (neuter noun "house")
const mockNounCard = {
  id: 'noun-card-001',
  front: 'το σπίτι',
  back: 'the house',
  deck_id: 'deck-001',
  word: 'το σπίτι',
  translation: 'the house',
  back_text_ru: 'дом',
  part_of_speech: 'noun' as const,
  level: 'A1' as const,
  noun_data: {
    gender: 'neuter' as const,
    nominative_singular: 'το σπίτι',
    nominative_plural: 'τα σπίτια',
    genitive_singular: 'του σπιτιού',
    genitive_plural: 'των σπιτιών',
    accusative_singular: 'το σπίτι',
    accusative_plural: 'τα σπίτια',
    vocative_singular: 'σπίτι',
    vocative_plural: 'σπίτια',
  },
  examples: [
    {
      greek: 'Το σπίτι μου είναι μεγάλο.',
      english: 'My house is big.',
      russian: 'Мой дом большой.',
    },
  ],
  srData: {
    cardId: 'noun-card-001',
    deckId: 'deck-001',
    interval: 0,
    easeFactor: 2.5,
    repetitions: 0,
    state: 'new' as const,
    step: 0,
    dueDate: null,
    lastReviewed: null,
    reviewCount: 0,
    successCount: 0,
    failureCount: 0,
    successRate: 0,
  },
};

// Mock verb card data (active voice "write")
const mockVerbCard = {
  id: 'verb-card-001',
  front: 'γράφω',
  back: 'to write',
  deck_id: 'deck-001',
  word: 'γράφω',
  translation: 'to write',
  back_text_ru: 'писать',
  part_of_speech: 'verb' as const,
  level: 'A1' as const,
  verb_data: {
    voice: 'active' as const,
    present_1s: 'γράφω',
    present_2s: 'γράφεις',
    present_3s: 'γράφει',
    present_1p: 'γράφουμε',
    present_2p: 'γράφετε',
    present_3p: 'γράφουν',
    imperfect_1s: 'έγραφα',
    imperfect_2s: 'έγραφες',
    imperfect_3s: 'έγραφε',
    imperfect_1p: 'γράφαμε',
    imperfect_2p: 'γράφατε',
    imperfect_3p: 'έγραφαν',
    past_1s: 'έγραψα',
    past_2s: 'έγραψες',
    past_3s: 'έγραψε',
    past_1p: 'γράψαμε',
    past_2p: 'γράψατε',
    past_3p: 'έγραψαν',
    future_1s: 'θα γράψω',
    future_2s: 'θα γράψεις',
    future_3s: 'θα γράψει',
    future_1p: 'θα γράψουμε',
    future_2p: 'θα γράψετε',
    future_3p: 'θα γράψουν',
    perfect_1s: 'έχω γράψει',
    perfect_2s: 'έχεις γράψει',
    perfect_3s: 'έχει γράψει',
    perfect_1p: 'έχουμε γράψει',
    perfect_2p: 'έχετε γράψει',
    perfect_3p: 'έχουν γράψει',
    imperative_2s: 'γράψε',
    imperative_2p: 'γράψτε',
  },
  examples: [
    {
      greek: 'Γράφω ένα γράμμα.',
      english: 'I write a letter.',
      russian: 'Я пишу письмо.',
    },
    {
      greek: 'Θα γράψουμε μαζί.',
      english: 'We will write together.',
      russian: 'Мы напишем вместе.',
    },
  ],
  srData: {
    cardId: 'verb-card-001',
    deckId: 'deck-001',
    interval: 0,
    easeFactor: 2.5,
    repetitions: 0,
    state: 'new' as const,
    step: 0,
    dueDate: null,
    lastReviewed: null,
    reviewCount: 0,
    successCount: 0,
    failureCount: 0,
    successRate: 0,
  },
};

// Mock adjective card data ("big")
const mockAdjectiveCard = {
  id: 'adjective-card-001',
  front: 'μεγάλος',
  back: 'big, large',
  deck_id: 'deck-001',
  word: 'μεγάλος',
  translation: 'big, large',
  back_text_ru: 'большой',
  part_of_speech: 'adjective' as const,
  level: 'A1' as const,
  adjective_data: {
    masculine_nom_sg: 'μεγάλος',
    masculine_gen_sg: 'μεγάλου',
    masculine_acc_sg: 'μεγάλο',
    masculine_voc_sg: 'μεγάλε',
    masculine_nom_pl: 'μεγάλοι',
    masculine_gen_pl: 'μεγάλων',
    masculine_acc_pl: 'μεγάλους',
    masculine_voc_pl: 'μεγάλοι',
    feminine_nom_sg: 'μεγάλη',
    feminine_gen_sg: 'μεγάλης',
    feminine_acc_sg: 'μεγάλη',
    feminine_voc_sg: 'μεγάλη',
    feminine_nom_pl: 'μεγάλες',
    feminine_gen_pl: 'μεγάλων',
    feminine_acc_pl: 'μεγάλες',
    feminine_voc_pl: 'μεγάλες',
    neuter_nom_sg: 'μεγάλο',
    neuter_gen_sg: 'μεγάλου',
    neuter_acc_sg: 'μεγάλο',
    neuter_voc_sg: 'μεγάλο',
    neuter_nom_pl: 'μεγάλα',
    neuter_gen_pl: 'μεγάλων',
    neuter_acc_pl: 'μεγάλα',
    neuter_voc_pl: 'μεγάλα',
    comparative: 'μεγαλύτερος',
    superlative: 'ο μεγαλύτερος',
  },
  examples: [
    {
      greek: 'Το σπίτι είναι μεγάλο.',
      english: 'The house is big.',
      russian: 'Дом большой.',
    },
  ],
  srData: {
    cardId: 'adjective-card-001',
    deckId: 'deck-001',
    interval: 0,
    easeFactor: 2.5,
    repetitions: 0,
    state: 'new' as const,
    step: 0,
    dueDate: null,
    lastReviewed: null,
    reviewCount: 0,
    successCount: 0,
    failureCount: 0,
    successRate: 0,
  },
};

// Mock adverb card data ("quickly")
const mockAdverbCard = {
  id: 'adverb-card-001',
  front: 'γρήγορα',
  back: 'quickly',
  deck_id: 'deck-001',
  word: 'γρήγορα',
  translation: 'quickly',
  back_text_ru: 'быстро',
  part_of_speech: 'adverb' as const,
  level: 'A2' as const,
  adverb_data: {
    comparative: 'πιο γρήγορα',
    superlative: 'γρηγορότατα',
  },
  examples: [
    {
      greek: 'Τρέχει πολύ γρήγορα.',
      english: 'He runs very quickly.',
      russian: 'Он бежит очень быстро.',
    },
  ],
  srData: {
    cardId: 'adverb-card-001',
    deckId: 'deck-001',
    interval: 0,
    easeFactor: 2.5,
    repetitions: 0,
    state: 'new' as const,
    step: 0,
    dueDate: null,
    lastReviewed: null,
    reviewCount: 0,
    successCount: 0,
    failureCount: 0,
    successRate: 0,
  },
};

// Mock noun card with partial data (N/A states)
const mockNounCardPartial = {
  ...mockNounCard,
  id: 'noun-card-partial',
  word: 'ο άνθρωπος',
  front: 'ο άνθρωπος',
  back: 'the person, human',
  translation: 'the person, human',
  noun_data: {
    gender: 'masculine' as const,
    nominative_singular: 'ο άνθρωπος',
    nominative_plural: 'οι άνθρωποι',
    genitive_singular: 'του ανθρώπου',
    genitive_plural: '', // Missing
    accusative_singular: 'τον άνθρωπο',
    accusative_plural: 'τους ανθρώπους',
    vocative_singular: '', // Missing
    vocative_plural: '', // Missing
  },
  srData: {
    ...mockNounCard.srData,
    cardId: 'noun-card-partial',
  },
};

// Mock deck data
const mockDeck = {
  id: 'deck-001',
  name: 'Greek Basics A1',
  description: 'Essential Greek vocabulary for beginners',
  level: 'A1',
  type: 'vocabulary',
  card_count: 100,
  is_active: true,
  is_premium: false,
  created_at: '2026-01-01T00:00:00Z',
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Helper to set up review session mock API for a specific card type.
 * IMPORTANT: Must be called BEFORE loginForVisualTest to intercept all requests.
 */
async function setupReviewMock(
  page: Page,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  card: any
): Promise<void> {
  // Mock deck endpoint
  await page.route('**/api/v1/decks/*', (route) => {
    if (route.request().url().includes('/study-queue')) {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          deck_id: mockDeck.id,
          cards: [card],
          new_count: 1,
          due_count: 0,
          total_count: 1,
        }),
      });
    } else {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockDeck),
      });
    }
  });

  // Mock decks list endpoint
  await page.route('**/api/v1/decks', (route) => {
    if (route.request().url().includes('?')) {
      route.continue();
      return;
    }
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        decks: [mockDeck],
        total: 1,
        page: 1,
        page_size: 50,
      }),
    });
  });

  // Mock user stats
  await page.route('**/api/v1/users/*/stats*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total_cards_learned: 100,
        total_reviews: 500,
        streak_days: 7,
        daily_xp: 50,
      }),
    });
  });
}

/**
 * Helper to navigate to review page and wait for card to load
 */
async function navigateToReview(page: Page): Promise<void> {
  await page.goto('/decks/deck-001/review');
  await page.waitForLoadState('domcontentloaded');

  // Wait for flashcard to appear
  const flashcard = page.locator('[data-testid="flashcard"]');
  await expect(flashcard).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(500); // Allow animations to settle
}

/**
 * Helper to flip the card
 */
async function flipCard(page: Page): Promise<void> {
  // Press Space to flip
  await page.keyboard.press('Space');
  // Wait for flip animation and content to render
  await page.waitForTimeout(500);
  // Verify rating buttons are visible (indicates flip complete)
  await expect(page.getByRole('button', { name: /good/i })).toBeVisible({ timeout: 5000 });
}

/**
 * Helper to set theme
 */
async function setTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  await page.evaluate((t) => {
    localStorage.setItem('theme', t);
    document.documentElement.classList.toggle('dark', t === 'dark');
  }, theme);
}

// ============================================================================
// NOUN CARD VISUAL TESTS
// ============================================================================

test.describe('Grammar UI - Noun Card Visual Tests', () => {
  test('Noun Card - Front (Before Flip) - Desktop Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setupReviewMock(page, mockNounCard);
    await loginForVisualTest(page);
    await setTheme(page, 'light');
    await navigateToReview(page);

    // Verify blue badge is visible
    const badge = page.locator('[data-testid="part-of-speech-badge"]');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveClass(/bg-blue-500/);

    await takeSnapshot(page, 'Noun Card - Front (Before Flip) - Desktop Light', testInfo);
  });

  test('Noun Card - Back (After Flip) - Desktop Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setupReviewMock(page, mockNounCard);
    await loginForVisualTest(page);
    await setTheme(page, 'light');
    await navigateToReview(page);
    await flipCard(page);

    // Verify declension table is visible
    const tableRows = page.locator('.grid.grid-cols-3');
    const rowCount = await tableRows.count();
    expect(rowCount).toBeGreaterThanOrEqual(5); // Header + 4 cases

    await takeSnapshot(page, 'Noun Card - Back (After Flip) - Desktop Light', testInfo);
  });

  test('Noun Card - Back (After Flip) - Desktop Dark', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setupReviewMock(page, mockNounCard);
    await loginForVisualTest(page);
    await setTheme(page, 'dark');
    await navigateToReview(page);
    await flipCard(page);

    await takeSnapshot(page, 'Noun Card - Back (After Flip) - Desktop Dark', testInfo);
  });

  test('Noun Card - N/A States - Desktop Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setupReviewMock(page, mockNounCardPartial);
    await loginForVisualTest(page);
    await setTheme(page, 'light');
    await navigateToReview(page);
    await flipCard(page);

    // Verify N/A text is visible for missing forms
    await expect(page.getByText('N/A').first()).toBeVisible();

    await takeSnapshot(page, 'Noun Card - N/A States - Desktop Light', testInfo);
  });
});

// ============================================================================
// VERB CARD VISUAL TESTS
// ============================================================================

test.describe('Grammar UI - Verb Card Visual Tests', () => {
  test('Verb Card - Front (Before Flip) - Desktop Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setupReviewMock(page, mockVerbCard);
    await loginForVisualTest(page);
    await setTheme(page, 'light');
    await navigateToReview(page);

    // Verify green badge is visible
    const badge = page.locator('[data-testid="part-of-speech-badge"]');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveClass(/bg-green-500/);

    await takeSnapshot(page, 'Verb Card - Front (Before Flip) - Desktop Light', testInfo);
  });

  test('Verb Card - Back (After Flip) - Desktop Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setupReviewMock(page, mockVerbCard);
    await loginForVisualTest(page);
    await setTheme(page, 'light');
    await navigateToReview(page);
    await flipCard(page);

    // Verify 6x5 conjugation grid is visible
    const gridRows = page.locator('.grid.grid-cols-6');
    const rowCount = await gridRows.count();
    expect(rowCount).toBeGreaterThanOrEqual(7); // Header + 6 persons

    // Verify imperative section is visible
    const imperativeGrid = page.locator('.grid.grid-cols-2');
    await expect(imperativeGrid.first()).toBeVisible();

    await takeSnapshot(page, 'Verb Card - Back (After Flip) - Desktop Light', testInfo);
  });

  test('Verb Card - Back (After Flip) - Desktop Dark', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setupReviewMock(page, mockVerbCard);
    await loginForVisualTest(page);
    await setTheme(page, 'dark');
    await navigateToReview(page);
    await flipCard(page);

    await takeSnapshot(page, 'Verb Card - Back (After Flip) - Desktop Dark', testInfo);
  });
});

// ============================================================================
// ADJECTIVE CARD VISUAL TESTS
// ============================================================================

test.describe('Grammar UI - Adjective Card Visual Tests', () => {
  test('Adjective Card - Front (Before Flip) - Desktop Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setupReviewMock(page, mockAdjectiveCard);
    await loginForVisualTest(page);
    await setTheme(page, 'light');
    await navigateToReview(page);

    // Verify purple badge is visible
    const badge = page.locator('[data-testid="part-of-speech-badge"]');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveClass(/bg-purple-500/);

    await takeSnapshot(page, 'Adjective Card - Front (Before Flip) - Desktop Light', testInfo);
  });

  test('Adjective Card - Back (After Flip) - Desktop Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setupReviewMock(page, mockAdjectiveCard);
    await loginForVisualTest(page);
    await setTheme(page, 'light');
    await navigateToReview(page);
    await flipCard(page);

    // Verify 3 gender tables in responsive grid
    const genderGrid = page.locator('.grid.gap-4.md\\:grid-cols-3');
    await expect(genderGrid).toBeVisible();

    // Verify comparison section is visible
    const genderHeaders = page.locator('.bg-primary\\/10');
    const headerCount = await genderHeaders.count();
    expect(headerCount).toBeGreaterThanOrEqual(3); // 3 genders + comparison

    await takeSnapshot(page, 'Adjective Card - Back (After Flip) - Desktop Light', testInfo);
  });

  test('Adjective Card - Back (After Flip) - Desktop Dark', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setupReviewMock(page, mockAdjectiveCard);
    await loginForVisualTest(page);
    await setTheme(page, 'dark');
    await navigateToReview(page);
    await flipCard(page);

    await takeSnapshot(page, 'Adjective Card - Back (After Flip) - Desktop Dark', testInfo);
  });
});

// ============================================================================
// ADVERB CARD VISUAL TESTS
// ============================================================================

test.describe('Grammar UI - Adverb Card Visual Tests', () => {
  test('Adverb Card - Front (Before Flip) - Desktop Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setupReviewMock(page, mockAdverbCard);
    await loginForVisualTest(page);
    await setTheme(page, 'light');
    await navigateToReview(page);

    // Verify orange badge is visible
    const badge = page.locator('[data-testid="part-of-speech-badge"]');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveClass(/bg-orange-500/);

    await takeSnapshot(page, 'Adverb Card - Front (Before Flip) - Desktop Light', testInfo);
  });

  test('Adverb Card - Back (After Flip) - Desktop Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setupReviewMock(page, mockAdverbCard);
    await loginForVisualTest(page);
    await setTheme(page, 'light');
    await navigateToReview(page);
    await flipCard(page);

    // Verify adverb forms table with 3 rows (positive, comparative, superlative)
    const formRows = page.locator('.grid.grid-cols-2');
    const rowCount = await formRows.count();
    expect(rowCount).toBeGreaterThanOrEqual(1);

    await takeSnapshot(page, 'Adverb Card - Back (After Flip) - Desktop Light', testInfo);
  });

  test('Adverb Card - Back (After Flip) - Desktop Dark', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setupReviewMock(page, mockAdverbCard);
    await loginForVisualTest(page);
    await setTheme(page, 'dark');
    await navigateToReview(page);
    await flipCard(page);

    await takeSnapshot(page, 'Adverb Card - Back (After Flip) - Desktop Dark', testInfo);
  });
});

// ============================================================================
// ALL BADGES VISUAL TEST
// ============================================================================

test.describe('Grammar UI - All Badges Visual Tests', () => {
  // Note: Since we can only show one card at a time in the review UI,
  // these tests capture each badge color separately for visual comparison.

  test('Badge Colors - Noun (Blue) - Desktop Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setupReviewMock(page, mockNounCard);
    await loginForVisualTest(page);
    await setTheme(page, 'light');
    await navigateToReview(page);

    const badge = page.locator('[data-testid="part-of-speech-badge"]');
    await expect(badge).toHaveClass(/bg-blue-500/);

    await takeSnapshot(page, 'Badge Colors - Noun (Blue) - Desktop Light', testInfo);
  });

  test('Badge Colors - Verb (Green) - Desktop Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setupReviewMock(page, mockVerbCard);
    await loginForVisualTest(page);
    await setTheme(page, 'light');
    await navigateToReview(page);

    const badge = page.locator('[data-testid="part-of-speech-badge"]');
    await expect(badge).toHaveClass(/bg-green-500/);

    await takeSnapshot(page, 'Badge Colors - Verb (Green) - Desktop Light', testInfo);
  });

  test('Badge Colors - Adjective (Purple) - Desktop Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setupReviewMock(page, mockAdjectiveCard);
    await loginForVisualTest(page);
    await setTheme(page, 'light');
    await navigateToReview(page);

    const badge = page.locator('[data-testid="part-of-speech-badge"]');
    await expect(badge).toHaveClass(/bg-purple-500/);

    await takeSnapshot(page, 'Badge Colors - Adjective (Purple) - Desktop Light', testInfo);
  });

  test('Badge Colors - Adverb (Orange) - Desktop Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setupReviewMock(page, mockAdverbCard);
    await loginForVisualTest(page);
    await setTheme(page, 'light');
    await navigateToReview(page);

    const badge = page.locator('[data-testid="part-of-speech-badge"]');
    await expect(badge).toHaveClass(/bg-orange-500/);

    await takeSnapshot(page, 'Badge Colors - Adverb (Orange) - Desktop Light', testInfo);
  });
});

// ============================================================================
// MOBILE RESPONSIVE VISUAL TESTS
// ============================================================================

test.describe('Grammar UI - Mobile Responsive Visual Tests', () => {
  test('Noun Card - Mobile Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await setupReviewMock(page, mockNounCard);
    await loginForVisualTest(page);
    await setTheme(page, 'light');
    await navigateToReview(page);
    await flipCard(page);

    await takeSnapshot(page, 'Noun Card - Mobile Light', testInfo);
  });

  test('Verb Card - Mobile Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await setupReviewMock(page, mockVerbCard);
    await loginForVisualTest(page);
    await setTheme(page, 'light');
    await navigateToReview(page);
    await flipCard(page);

    await takeSnapshot(page, 'Verb Card - Mobile Light', testInfo);
  });

  test('Adjective Card - Mobile Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await setupReviewMock(page, mockAdjectiveCard);
    await loginForVisualTest(page);
    await setTheme(page, 'light');
    await navigateToReview(page);
    await flipCard(page);

    await takeSnapshot(page, 'Adjective Card - Mobile Light', testInfo);
  });

  test('Adverb Card - Mobile Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await setupReviewMock(page, mockAdverbCard);
    await loginForVisualTest(page);
    await setTheme(page, 'light');
    await navigateToReview(page);
    await flipCard(page);

    await takeSnapshot(page, 'Adverb Card - Mobile Light', testInfo);
  });
});

// ============================================================================
// EXAMPLE SENTENCES VISUAL TESTS
// ============================================================================

test.describe('Grammar UI - Example Sentences Visual Tests', () => {
  test('Example Sentences - Single Example - Desktop Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setupReviewMock(page, mockNounCard); // Has single example
    await loginForVisualTest(page);
    await setTheme(page, 'light');
    await navigateToReview(page);
    await flipCard(page);

    // Verify example is visible
    await expect(page.getByText('Το σπίτι μου είναι μεγάλο.')).toBeVisible();
    await expect(page.getByText('My house is big.')).toBeVisible();
    await expect(page.getByText('Мой дом большой.')).toBeVisible();

    await takeSnapshot(page, 'Example Sentences - Single Example - Desktop Light', testInfo);
  });

  test('Example Sentences - Multiple Examples - Desktop Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setupReviewMock(page, mockVerbCard); // Has multiple examples
    await loginForVisualTest(page);
    await setTheme(page, 'light');
    await navigateToReview(page);
    await flipCard(page);

    // Verify multiple examples are visible with numbering
    await expect(page.getByText('1.')).toBeVisible();
    await expect(page.getByText('2.')).toBeVisible();

    await takeSnapshot(page, 'Example Sentences - Multiple Examples - Desktop Light', testInfo);
  });
});
