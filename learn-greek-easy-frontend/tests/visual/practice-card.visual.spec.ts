/**
 * Practice Card Visual Regression Tests
 *
 * Visual regression tests for the Practice Card UI accessible from WordReferencePage.
 * Uses Chromatic for visual snapshots and comparison.
 *
 * Test Scenarios:
 * 1. Card front - EL to EN (Mobile + Desktop)
 * 2. Card front - EN to EL (Mobile)
 * 3. Card back - EL to EN (Mobile)
 * 4. Card back - EN to EL (Mobile + Desktop)
 * 5. SRS buttons disabled state (Mobile)
 * 6. Empty state - no cards (Mobile)
 * 7. Error state - API failure with retry (Mobile)
 *
 * Viewports:
 * - Desktop: 1280x720
 * - Mobile: 375x667
 *
 * Note: Practice cards are accessed from WordReferencePage via
 * /decks/:deckId/words/:wordId/practice route.
 * The practice UI renders card records from GET /api/v1/word-entries/{id}/cards.
 * SRS rating buttons are visible but disabled (MVP phase).
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

// Mock EL-to-EN meaning card (Greek word on front, English answer on back)
const mockElToEnCard = {
  id: 'card-el-to-en-001',
  word_entry_id: 'word-entry-001',
  deck_id: 'deck-001',
  card_type: 'meaning_el_to_en',
  tier: 1,
  front_content: {
    card_type: 'meaning_el_to_en',
    prompt: 'What does this mean?',
    main: '\u03C3\u03C0\u03AF\u03C4\u03B9',
    sub: 'noun, neuter',
    badge: 'A1',
  },
  back_content: {
    card_type: 'meaning_el_to_en',
    answer: 'house, home',
    context: {
      label: 'Example',
      greek: '\u03A4\u03BF \u03C3\u03C0\u03AF\u03C4\u03B9 \u03BC\u03BF\u03C5 \u03B5\u03AF\u03BD\u03B1\u03B9 \u03BC\u03B5\u03B3\u03AC\u03BB\u03BF.',
      english: 'My house is big.',
    },
  },
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

// Mock EN-to-EL meaning card (English word on front, Greek answer on back)
const mockEnToElCard = {
  id: 'card-en-to-el-001',
  word_entry_id: 'word-entry-001',
  deck_id: 'deck-001',
  card_type: 'meaning_en_to_el',
  tier: 1,
  front_content: {
    card_type: 'meaning_en_to_el',
    prompt: 'How do you say this in Greek?',
    main: 'house, home',
    badge: 'A1',
  },
  back_content: {
    card_type: 'meaning_en_to_el',
    answer: '\u03C3\u03C0\u03AF\u03C4\u03B9',
    answer_sub: '\u03C4\u03BF \u03C3\u03C0\u03AF\u03C4\u03B9',
    context: {
      label: 'Example',
      greek: '\u03A4\u03BF \u03C3\u03C0\u03AF\u03C4\u03B9 \u03BC\u03BF\u03C5 \u03B5\u03AF\u03BD\u03B1\u03B9 \u03BC\u03B5\u03B3\u03AC\u03BB\u03BF.',
      english: 'My house is big.',
    },
  },
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Mock the cards endpoint with the provided card array.
 * IMPORTANT: Must be called BEFORE loginForVisualTest to intercept all requests.
 */
async function setupPracticeMock(
  page: Page,
  cards: unknown[]
): Promise<void> {
  await page.route('**/api/v1/word-entries/*/cards', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(cards),
    });
  });
}

/**
 * Mock the cards endpoint to return an empty array (no cards).
 */
async function setupPracticeEmptyMock(page: Page): Promise<void> {
  await page.route('**/api/v1/word-entries/*/cards', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });
}

/**
 * Mock the cards endpoint to return a 500 error.
 */
async function setupPracticeErrorMock(page: Page): Promise<void> {
  await page.route('**/api/v1/word-entries/*/cards', (route) => {
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'Internal server error' }),
    });
  });
}

/**
 * Navigate to the practice page and wait for the card (or page content) to load.
 */
async function navigateToPractice(page: Page): Promise<void> {
  await page.goto('/decks/deck-001/words/word-entry-001/practice');
  await page.waitForLoadState('domcontentloaded');
}

/**
 * Flip the practice card by clicking it and wait for the back to appear.
 */
async function flipCard(page: Page): Promise<void> {
  await page.locator('[data-testid="practice-card"]').click();
  await expect(page.locator('[data-testid="practice-card-back"]')).toBeVisible({
    timeout: 5000,
  });
  await page.waitForTimeout(500);
}

/**
 * Set light or dark theme via localStorage and DOM class.
 */
async function setTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  await page.evaluate((t) => {
    localStorage.setItem('theme', t);
    document.documentElement.classList.toggle('dark', t === 'dark');
  }, theme);
}

// ============================================================================
// CARD FRONT VISUAL TESTS (MOBILE)
// ============================================================================

test.describe('Practice Card - Front States (Mobile)', () => {
  test('Practice Card Front - EL to EN - Mobile Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await setupPracticeMock(page, [mockElToEnCard]);
    await loginForVisualTest(page);
    await setTheme(page, 'light');
    await navigateToPractice(page);

    await expect(page.locator('[data-testid="practice-card-front"]')).toBeVisible({
      timeout: 10000,
    });
    await page.waitForTimeout(500);

    await takeSnapshot(page, 'Practice Card Front - EL to EN - Mobile Light', testInfo);
  });

  test('Practice Card Front - EN to EL - Mobile Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await setupPracticeMock(page, [mockEnToElCard]);
    await loginForVisualTest(page);
    await setTheme(page, 'light');
    await navigateToPractice(page);

    await expect(page.locator('[data-testid="practice-card-front"]')).toBeVisible({
      timeout: 10000,
    });
    await page.waitForTimeout(500);

    await takeSnapshot(page, 'Practice Card Front - EN to EL - Mobile Light', testInfo);
  });
});

// ============================================================================
// CARD BACK VISUAL TESTS (MOBILE)
// ============================================================================

test.describe('Practice Card - Back States (Mobile)', () => {
  test('Practice Card Back - EL to EN - Mobile Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await setupPracticeMock(page, [mockElToEnCard]);
    await loginForVisualTest(page);
    await setTheme(page, 'light');
    await navigateToPractice(page);

    await expect(page.locator('[data-testid="practice-card-front"]')).toBeVisible({
      timeout: 10000,
    });
    await flipCard(page);

    await takeSnapshot(page, 'Practice Card Back - EL to EN - Mobile Light', testInfo);
  });

  test('Practice Card Back - EN to EL - Mobile Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await setupPracticeMock(page, [mockEnToElCard]);
    await loginForVisualTest(page);
    await setTheme(page, 'light');
    await navigateToPractice(page);

    await expect(page.locator('[data-testid="practice-card-front"]')).toBeVisible({
      timeout: 10000,
    });
    await flipCard(page);

    await takeSnapshot(page, 'Practice Card Back - EN to EL - Mobile Light', testInfo);
  });
});

// ============================================================================
// DESKTOP LAYOUT VISUAL TESTS
// ============================================================================

test.describe('Practice Card - Desktop Layout', () => {
  test('Practice Card Front - EL to EN - Desktop Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setupPracticeMock(page, [mockElToEnCard]);
    await loginForVisualTest(page);
    await setTheme(page, 'light');
    await navigateToPractice(page);

    await expect(page.locator('[data-testid="practice-card-front"]')).toBeVisible({
      timeout: 10000,
    });
    await page.waitForTimeout(500);

    await takeSnapshot(page, 'Practice Card Front - EL to EN - Desktop Light', testInfo);
  });

  test('Practice Card Back - EN to EL - Desktop Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setupPracticeMock(page, [mockEnToElCard]);
    await loginForVisualTest(page);
    await setTheme(page, 'light');
    await navigateToPractice(page);

    await expect(page.locator('[data-testid="practice-card-front"]')).toBeVisible({
      timeout: 10000,
    });
    await flipCard(page);

    await takeSnapshot(page, 'Practice Card Back - EN to EL - Desktop Light', testInfo);
  });
});

// ============================================================================
// SRS DISABLED STATE VISUAL TESTS
// ============================================================================

test.describe('Practice Card - SRS Disabled State', () => {
  test('Practice SRS Disabled - Mobile Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await setupPracticeMock(page, [mockElToEnCard]);
    await loginForVisualTest(page);
    await setTheme(page, 'light');
    await navigateToPractice(page);

    await expect(page.locator('[data-testid="practice-card-front"]')).toBeVisible({
      timeout: 10000,
    });
    await flipCard(page);

    // Hover an SRS button to show the "coming soon" tooltip
    await page.locator('[data-testid="srs-button-again"]').hover();
    await page.waitForTimeout(300);

    await takeSnapshot(page, 'Practice SRS Disabled - Mobile Light', testInfo);
  });
});

// ============================================================================
// EMPTY STATE VISUAL TESTS
// ============================================================================

test.describe('Practice Card - Empty State', () => {
  test('Practice Empty State - Mobile Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await setupPracticeEmptyMock(page);
    await loginForVisualTest(page);
    await setTheme(page, 'light');
    await navigateToPractice(page);

    // Wait for the close button which is present in the empty state
    await expect(page.locator('[data-testid="practice-close-button"]')).toBeVisible({
      timeout: 10000,
    });
    await page.waitForTimeout(500);

    await takeSnapshot(page, 'Practice Empty State - Mobile Light', testInfo);
  });
});

// ============================================================================
// ERROR STATE VISUAL TESTS
// ============================================================================

test.describe('Practice Card - Error State', () => {
  test('Practice Error State - Mobile Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await setupPracticeErrorMock(page);
    await loginForVisualTest(page);
    await setTheme(page, 'light');
    await navigateToPractice(page);

    // Wait for the close button which is present in the error state
    await expect(page.locator('[data-testid="practice-close-button"]')).toBeVisible({
      timeout: 10000,
    });
    await page.waitForTimeout(500);

    await takeSnapshot(page, 'Practice Error State - Mobile Light', testInfo);
  });
});
