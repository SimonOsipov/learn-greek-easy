/**
 * V2 Practice Visual Regression Tests
 *
 * Visual regression tests for the V2 Practice session UI accessible from deck pages.
 * Uses Chromatic for visual snapshots and comparison.
 *
 * Test Scenarios:
 * 1. V2 Practice - Active Front - Mobile Light
 * 2. V2 Practice - Active Back with Ratings - Mobile Light
 * 3. V2 Practice - Active Front - Desktop Light
 * 4. V2 Practice - Empty State - Mobile Light
 * 5. V2 Practice - Summary - Mobile Light
 * 6. V2 Practice - Summary - Desktop Light
 * 7. V2 Practice - Filter Pills - Mobile Light
 *
 * Viewports:
 * - Desktop: 1280x720
 * - Mobile: 375x667
 *
 * Note: V2 Practice is accessed from deck pages via /decks/:deckId/practice route.
 * The practice UI renders card records from GET /api/v1/study/queue/v2.
 * SRS rating buttons submit reviews to POST /api/v1/reviews/v2.
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

const mockV2Card1 = {
  card_record_id: 'cr-001',
  word_entry_id: 'we-001',
  deck_id: 'deck-001',
  deck_name: 'Essential Greek A1',
  card_type: 'meaning_el_to_en',
  variant_key: null,
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
      greek: '\u0394\u03B5\u03BD \u03B5\u03AF\u03BC\u03B1\u03B9 \u03C3\u03C0\u03AF\u03C4\u03B9.',
      english: 'I am not at home.',
    },
  },
  status: 'new',
  is_new: true,
  is_early_practice: false,
  due_date: null,
  easiness_factor: 2.5,
  interval: 0,
  audio_url: null,
  example_audio_url: null,
  translation_ru: '\u0434\u043E\u043C',
  translation_ru_plural: null,
  sentence_ru: null,
};

const mockV2Card2 = {
  card_record_id: 'cr-002',
  word_entry_id: 'we-002',
  deck_id: 'deck-001',
  deck_name: 'Essential Greek A1',
  card_type: 'meaning_en_to_el',
  variant_key: null,
  front_content: {
    card_type: 'meaning_en_to_el',
    prompt: 'How do you say this in Greek?',
    main: 'water',
    badge: 'A1',
  },
  back_content: {
    card_type: 'meaning_en_to_el',
    answer: '\u03BD\u03B5\u03C1\u03CC',
    answer_sub: '\u03C4\u03BF \u03BD\u03B5\u03C1\u03CC',
    context: {
      label: 'Example',
      greek: '\u0398\u03AD\u03BB\u03C9 \u03BD\u03B5\u03C1\u03CC.',
      english: 'I want water.',
    },
  },
  status: 'new',
  is_new: true,
  is_early_practice: false,
  due_date: null,
  easiness_factor: 2.5,
  interval: 0,
  audio_url: null,
  example_audio_url: null,
  translation_ru: '\u0432\u043E\u0434\u0430',
  translation_ru_plural: null,
  sentence_ru: null,
};

const mockV2Queue = {
  total_due: 2,
  total_new: 2,
  total_early_practice: 0,
  total_in_queue: 2,
  cards: [mockV2Card1, mockV2Card2],
};

const mockV2QueueEmpty = {
  total_due: 0,
  total_new: 0,
  total_early_practice: 0,
  total_in_queue: 0,
  cards: [],
};

const mockV2Deck = {
  id: 'deck-001',
  name: 'Essential Greek A1',
  name_en: 'Essential Greek A1',
  name_ru: '\u041E\u0441\u043D\u043E\u0432\u044B \u0433\u0440\u0435\u0447\u0435\u0441\u043A\u043E\u0433\u043E A1',
  description: 'Learn essential Greek vocabulary',
  description_en: 'Learn essential Greek vocabulary',
  description_ru: null,
  level: 'A1',
  is_active: true,
  is_premium: false,
  card_count: 25,
  estimated_time_minutes: 30,
  tags: ['vocabulary'],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  card_system: 'V2',
  cover_image_url: null,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Set light or dark theme via localStorage and DOM class.
 */
async function setTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  await page.evaluate((t) => {
    localStorage.setItem('theme', t);
    document.documentElement.classList.toggle('dark', t === 'dark');
  }, theme);
}

/**
 * Build a review result response for a given card record and quality score.
 */
function makeReviewResult(cardRecordId: string, quality: number): object {
  return {
    card_record_id: cardRecordId,
    quality,
    previous_status: 'new',
    new_status: quality >= 4 ? 'review' : 'learning',
    easiness_factor: 2.5,
    interval: 1,
    repetitions: 1,
    next_review_date: '2026-03-19T00:00:00Z',
    message: null,
  };
}

/**
 * Mock the V2 study queue and review endpoints.
 * IMPORTANT: Must be called BEFORE loginForVisualTest to intercept all requests.
 */
async function setupV2PracticeMocks(
  page: Page,
  queue: typeof mockV2Queue | typeof mockV2QueueEmpty
): Promise<void> {
  await page.route('**/api/v1/study/queue/v2*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(queue),
    });
  });

  await page.route('**/api/v1/reviews/v2', async (route) => {
    const body = route.request().postDataJSON();
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(makeReviewResult(body.card_record_id, body.quality)),
    });
  });
}

/**
 * Mock deck detail, progress, and word-entries endpoints for the deck header / filter pills snapshot.
 * IMPORTANT: Must be called BEFORE loginForVisualTest to intercept all requests.
 */
async function setupV2DeckMocks(page: Page): Promise<void> {
  await page.route('**/api/v1/decks/deck-001', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockV2Deck),
    });
  });

  await page.route('**/api/v1/progress/decks/deck-001', (route) => {
    route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'Not found' }),
    });
  });

  // The word browser uses /api/v1/decks/:id/word-entries (NOT /api/v1/word-entries)
  await page.route('**/api/v1/decks/*/word-entries*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [], total: 0, page: 1, page_size: 20 }),
    });
  });
}

// ============================================================================
// ACTIVE SESSION VISUAL TESTS
// ============================================================================

test.describe('V2 Practice - Active Session', () => {
  test('V2 Practice - Active Front - Mobile Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await setupV2PracticeMocks(page, mockV2Queue);
    await loginForVisualTest(page);
    await setTheme(page, 'light');
    await page.goto('/decks/deck-001/practice');

    await expect(page.locator('[data-testid="practice-card-front"]')).toBeVisible({
      timeout: 10000,
    });
    await page.waitForTimeout(500);

    await takeSnapshot(page, 'V2 Practice - Active Front - Mobile Light', testInfo);
  });

  test('V2 Practice - Active Back with Ratings - Mobile Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await setupV2PracticeMocks(page, mockV2Queue);
    await loginForVisualTest(page);
    await setTheme(page, 'light');
    await page.goto('/decks/deck-001/practice');

    await expect(page.locator('[data-testid="practice-card-front"]')).toBeVisible({
      timeout: 10000,
    });
    await page.locator('[data-testid="practice-card"]').click();
    await expect(page.locator('[data-testid="practice-card-back"]')).toBeVisible();
    await page.waitForTimeout(500);

    await takeSnapshot(page, 'V2 Practice - Active Back with Ratings - Mobile Light', testInfo);
  });

  test('V2 Practice - Active Front - Desktop Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setupV2PracticeMocks(page, mockV2Queue);
    await loginForVisualTest(page);
    await setTheme(page, 'light');
    await page.goto('/decks/deck-001/practice');

    await expect(page.locator('[data-testid="practice-card-front"]')).toBeVisible({
      timeout: 10000,
    });
    await page.waitForTimeout(500);

    await takeSnapshot(page, 'V2 Practice - Active Front - Desktop Light', testInfo);
  });
});

// ============================================================================
// EMPTY STATE VISUAL TESTS
// ============================================================================

test.describe('V2 Practice - Empty State', () => {
  test('V2 Practice - Empty State - Mobile Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await setupV2PracticeMocks(page, mockV2QueueEmpty);
    await loginForVisualTest(page);
    await setTheme(page, 'light');
    await page.goto('/decks/deck-001/practice');

    await expect(page.getByText(/all caught up/i)).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(500);

    await takeSnapshot(page, 'V2 Practice - Empty State - Mobile Light', testInfo);
  });
});

// ============================================================================
// SESSION SUMMARY VISUAL TESTS
// ============================================================================

test.describe('V2 Practice - Session Summary', () => {
  test('V2 Practice - Summary - Mobile Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await setupV2PracticeMocks(page, mockV2Queue);
    await loginForVisualTest(page);
    await setTheme(page, 'light');
    await page.goto('/decks/deck-001/practice');

    // Card 1: flip and rate
    await expect(page.locator('[data-testid="practice-card-front"]')).toBeVisible({
      timeout: 10000,
    });
    await page.locator('[data-testid="practice-card"]').click();
    await expect(page.locator('[data-testid="practice-card-back"]')).toBeVisible();
    await page.locator('[data-testid="srs-button-good"]').click();

    // Card 2: wait for front, flip and rate
    await expect(page.locator('[data-testid="practice-card-front"]')).toBeVisible({
      timeout: 5000,
    });
    await page.locator('[data-testid="practice-card"]').click();
    await expect(page.locator('[data-testid="practice-card-back"]')).toBeVisible();
    await page.locator('[data-testid="srs-button-good"]').click();

    // Wait for summary
    await expect(page.getByText(/session complete/i)).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(500);

    await takeSnapshot(page, 'V2 Practice - Summary - Mobile Light', testInfo);
  });

  test('V2 Practice - Summary - Desktop Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setupV2PracticeMocks(page, mockV2Queue);
    await loginForVisualTest(page);
    await setTheme(page, 'light');
    await page.goto('/decks/deck-001/practice');

    // Card 1: flip and rate
    await expect(page.locator('[data-testid="practice-card-front"]')).toBeVisible({
      timeout: 10000,
    });
    await page.locator('[data-testid="practice-card"]').click();
    await expect(page.locator('[data-testid="practice-card-back"]')).toBeVisible();
    await page.locator('[data-testid="srs-button-good"]').click();

    // Card 2: wait for front, flip and rate
    await expect(page.locator('[data-testid="practice-card-front"]')).toBeVisible({
      timeout: 5000,
    });
    await page.locator('[data-testid="practice-card"]').click();
    await expect(page.locator('[data-testid="practice-card-back"]')).toBeVisible();
    await page.locator('[data-testid="srs-button-good"]').click();

    // Wait for summary
    await expect(page.getByText(/session complete/i)).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(500);

    await takeSnapshot(page, 'V2 Practice - Summary - Desktop Light', testInfo);
  });
});

// ============================================================================
// DECK HEADER FILTER PILLS VISUAL TESTS
// ============================================================================

test.describe('V2 Practice - Deck Header Filter Pills', () => {
  test('V2 Practice - Filter Pills - Mobile Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await setupV2DeckMocks(page);
    await loginForVisualTest(page);
    await setTheme(page, 'light');
    await page.goto('/decks/deck-001');

    await expect(page.locator('[data-testid="start-review-button"]')).toBeVisible({
      timeout: 10000,
    });
    await page.waitForTimeout(500);

    await takeSnapshot(page, 'V2 Practice - Filter Pills - Mobile Light', testInfo);
  });
});
