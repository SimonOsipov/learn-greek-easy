/**
 * Grammar UI E2E Test Helpers
 *
 * Helper functions for testing grammar UI components with API mocking.
 */

import { Page, expect } from '@playwright/test';
import {
  MockCard,
  mockDeck,
  createStudyQueueResponse,
  createDeckResponse,
  createDeckListResponse,
  createUserStatsResponse,
} from '../fixtures/grammar-mock-data';

/**
 * Generate a valid mock token for visual tests
 * This token format matches what mockAuthAPI expects
 */
function generateValidMockToken(userId: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2);
  return `mock.${btoa(userId)}.${timestamp}.${random}`;
}

/**
 * Set up API mocks for review session with a specific card
 *
 * The review page calls these APIs:
 * - GET /api/v1/study/queue/{deckId} - Get cards for study (via studyAPI.getDeckQueue)
 * - GET /api/v1/decks/{deckId} - Get deck details (via deckAPI.getById)
 *
 * @param page - Playwright page object
 * @param card - The card to display in the review session
 */
export async function setupReviewMock(page: Page, card: MockCard): Promise<void> {
  const deckResponse = createDeckResponse();
  const userStatsResponse = createUserStatsResponse();

  // Mock study queue endpoint - the ACTUAL API used by reviewStore
  // API: GET /api/v1/study/queue/{deckId}
  await page.route('**/api/v1/study/queue/**', (route) => {
    // Create response matching StudyQueue interface from studyAPI.ts
    const studyQueueResponse = {
      deck_id: mockDeck.id,
      deck_name: mockDeck.name,
      total_due: 1,
      total_new: 1,
      total_early_practice: 0,
      total_in_queue: 1,
      cards: [
        {
          card_id: card.id,
          front_text: card.front,
          back_text: card.back,
          back_text_ru: card.back_text_ru || null,
          example_sentence: null,
          pronunciation: null,
          part_of_speech: card.part_of_speech || null,
          level: card.level || null,
          examples: card.examples || null,
          noun_data: card.noun_data || null,
          verb_data: card.verb_data || null,
          adjective_data: card.adjective_data || null,
          adverb_data: card.adverb_data || null,
          status: 'new',
          is_new: true,
          is_early_practice: false,
          due_date: null,
          easiness_factor: 2.5,
          interval: 0,
        },
      ],
    };

    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(studyQueueResponse),
    });
  });

  // Mock deck detail endpoint
  // API: GET /api/v1/decks/{deckId}
  await page.route('**/api/v1/decks/*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(deckResponse),
    });
  });

  // Mock user stats endpoint
  await page.route('**/api/v1/users/*/stats*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(userStatsResponse),
    });
  });

  // Mock reviews endpoint (for rating cards)
  await page.route('**/api/v1/reviews/**', (route) => {
    if (route.request().method() === 'POST') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          next_review: null,
          xp_earned: 10,
        }),
      });
    } else {
      route.continue();
    }
  });
}

/**
 * Login via localStorage for E2E tests (for use when storageState is not available)
 *
 * NOTE: E2E tests configured with storageState don't need to call this function.
 * The storage state loaded from playwright/.auth/*.json already contains auth.
 *
 * @param page - Playwright page object
 * @deprecated Use storageState instead in E2E tests. Only use for special cases.
 */
export async function loginForE2ETest(page: Page): Promise<void> {
  const userId = 'user-1';
  const mockToken = generateValidMockToken(userId);

  const authData = {
    state: {
      user: {
        id: userId,
        email: 'demo@learngreekeasy.com',
        name: 'Demo User',
        role: 'premium',
        avatar: undefined,
        preferences: {
          language: 'en',
          dailyGoal: 15,
          notifications: true,
        },
        stats: {
          streak: 7,
          wordsLearned: 142,
          totalXP: 1250,
        },
      },
      token: mockToken,
      isAuthenticated: true,
      rememberMe: true,
    },
    version: 0,
  };

  // Navigate to login page to establish context
  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');

  // Set auth state synchronously via evaluate()
  await page.evaluate((data) => {
    localStorage.clear();
    sessionStorage.clear();
    (window as Window & { playwright?: boolean }).playwright = true;
    localStorage.setItem('auth-storage', JSON.stringify(data));
    sessionStorage.setItem('auth-token', data.state.token);
  }, authData);
}

/**
 * Navigate to review page with the mock deck and wait for flashcard
 *
 * @param page - Playwright page object
 */
export async function navigateToReview(page: Page): Promise<void> {
  await page.goto(`/decks/${mockDeck.id}/review`);
  await page.waitForLoadState('domcontentloaded');

  // Wait for flashcard to appear
  const flashcard = page.locator('[data-testid="flashcard"]');
  await expect(flashcard).toBeVisible({ timeout: 15000 });

  // Allow animations to settle
  await page.waitForTimeout(500);
}

/**
 * Flip the card by clicking or pressing Space and wait for rating buttons
 *
 * @param page - Playwright page object
 */
export async function flipCard(page: Page): Promise<void> {
  // Press Space to flip
  await page.keyboard.press('Space');

  // Wait for flip animation and content to render
  await page.waitForTimeout(500);

  // Verify rating buttons are visible (indicates flip complete)
  await expect(page.getByRole('button', { name: /good/i })).toBeVisible({ timeout: 5000 });
}

/**
 * Click the card content area to flip
 *
 * @param page - Playwright page object
 */
export async function clickToFlip(page: Page): Promise<void> {
  // Find and click the card content area (before flip it's clickable)
  const cardContent = page.locator('[data-testid="flashcard"]');
  await cardContent.click();

  // Wait for flip animation
  await page.waitForTimeout(500);

  // Verify rating buttons are visible
  await expect(page.getByRole('button', { name: /good/i })).toBeVisible({ timeout: 5000 });
}

/**
 * Assert that an element has blur-md class (is blurred)
 *
 * @param page - Playwright page object
 * @param selector - CSS selector for the element
 */
export async function expectBlurred(page: Page, selector: string): Promise<void> {
  const element = page.locator(selector);
  await expect(element).toBeVisible();

  const hasBlur = await element.evaluate((el) => {
    return el.classList.contains('blur-md') || el.classList.contains('blur-sm');
  });
  expect(hasBlur).toBe(true);
}

/**
 * Assert that an element does not have blur class (is not blurred)
 *
 * @param page - Playwright page object
 * @param selector - CSS selector for the element
 */
export async function expectNotBlurred(page: Page, selector: string): Promise<void> {
  const element = page.locator(selector);
  await expect(element).toBeVisible();

  const hasBlur = await element.evaluate((el) => {
    return el.classList.contains('blur-md') || el.classList.contains('blur-sm');
  });
  expect(hasBlur).toBe(false);
}

/**
 * Set theme (light or dark)
 *
 * @param page - Playwright page object
 * @param theme - 'light' or 'dark'
 */
export async function setTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  await page.evaluate((t) => {
    localStorage.setItem('theme', t);
    document.documentElement.classList.toggle('dark', t === 'dark');
  }, theme);
}

/**
 * Set mobile viewport
 *
 * @param page - Playwright page object
 */
export async function setMobileViewport(page: Page): Promise<void> {
  await page.setViewportSize({ width: 375, height: 667 });
}

/**
 * Set desktop viewport
 *
 * @param page - Playwright page object
 */
export async function setDesktopViewport(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 720 });
}
