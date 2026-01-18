/**
 * Mock Exam Visual Regression Tests
 *
 * Visual tests for the Mock Citizenship Exam feature covering:
 * - Landing Page States (empty stats, with stats)
 * - Results Page (passed, failed)
 * - Exit Confirmation Dialog (via navigation trigger)
 *
 * Total: 7+ visual test scenarios
 *
 * Viewports:
 * - Desktop: 1280x720
 * - Mobile: 375x667
 *
 * Note: Session page tests require real API calls which aren't available
 * in the mock auth environment, so we focus on landing and results states
 * that can be fully mocked.
 */

import { test, expect } from '@chromatic-com/playwright';
import { Page } from '@playwright/test';

import {
  takeSnapshot,
  waitForPageReady,
  loginForVisualTest,
  VIEWPORTS,
} from './helpers/visual-helpers';

/**
 * Helper to set theme via localStorage
 */
async function setTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  await page.evaluate((t) => {
    localStorage.setItem('theme', t);
    document.documentElement.classList.toggle('dark', t === 'dark');
  }, theme);
}

/**
 * Helper to set language via localStorage
 */
async function setLanguage(page: Page, lang: 'en' | 'el'): Promise<void> {
  await page.evaluate((l) => {
    localStorage.setItem('i18nextLng', l);
  }, lang);
}

/**
 * Mock empty statistics API response
 */
async function mockEmptyStatistics(page: Page): Promise<void> {
  await page.route('**/api/v1/culture/mock-exam/statistics', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        stats: {
          total_exams: 0,
          pass_rate: 0,
          average_score: 0,
          best_score: 0,
          average_time_seconds: 0,
        },
        recent_exams: [],
      }),
    });
  });

  await page.route('**/api/v1/culture/mock-exam/queue', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total_questions: 30,
        available_questions: 30,
        can_start_exam: true,
        sample_questions: [],
      }),
    });
  });
}

/**
 * Mock statistics with history for returning user
 */
async function mockStatisticsWithHistory(page: Page): Promise<void> {
  await page.route('**/api/v1/culture/mock-exam/statistics', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        stats: {
          total_exams: 5,
          pass_rate: 60,
          average_score: 75,
          best_score: 95,
          average_time_seconds: 1800,
        },
        recent_exams: [
          {
            id: 'exam-1',
            started_at: new Date(Date.now() - 86400000).toISOString(),
            completed_at: new Date(Date.now() - 86400000 + 1800000).toISOString(),
            score: 18,
            total_questions: 20,
            passed: true,
            time_taken_seconds: 1500,
          },
          {
            id: 'exam-2',
            started_at: new Date(Date.now() - 172800000).toISOString(),
            completed_at: new Date(Date.now() - 172800000 + 2100000).toISOString(),
            score: 14,
            total_questions: 20,
            passed: false,
            time_taken_seconds: 2100,
          },
          {
            id: 'exam-3',
            started_at: new Date(Date.now() - 259200000).toISOString(),
            completed_at: new Date(Date.now() - 259200000 + 1200000).toISOString(),
            score: 19,
            total_questions: 20,
            passed: true,
            time_taken_seconds: 1200,
          },
        ],
      }),
    });
  });

  await page.route('**/api/v1/culture/mock-exam/queue', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total_questions: 50,
        available_questions: 50,
        can_start_exam: true,
        sample_questions: [],
      }),
    });
  });
}

// ============================================================================
// LANDING PAGE VISUAL TESTS - Empty State
// ============================================================================

test.describe('Mock Exam Landing - Empty State Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    await mockEmptyStatistics(page);
    await loginForVisualTest(page);
  });

  // Scenario 1: Desktop EN Light - Empty Statistics
  test('Mock Exam Landing - Empty State - Desktop EN Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setTheme(page, 'light');
    await setLanguage(page, 'en');
    await page.goto('/practice/culture-exam');
    await waitForPageReady(page, '[data-testid="mock-exam-page"]');
    await page.waitForTimeout(1000); // Wait for data to load

    await takeSnapshot(page, 'Mock Exam Landing - Empty State - Desktop EN Light', testInfo);
  });

  // Scenario 2: Mobile EN Light - Empty Statistics
  test('Mock Exam Landing - Empty State - Mobile EN Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await setTheme(page, 'light');
    await setLanguage(page, 'en');
    await page.goto('/practice/culture-exam');
    await waitForPageReady(page, '[data-testid="mock-exam-page"]');
    await page.waitForTimeout(1000);

    await takeSnapshot(page, 'Mock Exam Landing - Empty State - Mobile EN Light', testInfo);
  });

  // Scenario 3: Desktop EN Dark - Empty Statistics
  test('Mock Exam Landing - Empty State - Desktop EN Dark', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setTheme(page, 'dark');
    await setLanguage(page, 'en');
    await page.goto('/practice/culture-exam');
    await waitForPageReady(page, '[data-testid="mock-exam-page"]');
    await page.waitForTimeout(1000);

    await takeSnapshot(page, 'Mock Exam Landing - Empty State - Desktop EN Dark', testInfo);
  });
});

// ============================================================================
// LANDING PAGE VISUAL TESTS - With Statistics
// ============================================================================

test.describe('Mock Exam Landing - With Statistics Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    await mockStatisticsWithHistory(page);
    await loginForVisualTest(page);
  });

  // Scenario 4: Desktop EN Light - With Statistics
  test('Mock Exam Landing - With Stats - Desktop EN Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setTheme(page, 'light');
    await setLanguage(page, 'en');
    await page.goto('/practice/culture-exam');
    await waitForPageReady(page, '[data-testid="mock-exam-page"]');
    await page.waitForTimeout(1000);

    await takeSnapshot(page, 'Mock Exam Landing - With Stats - Desktop EN Light', testInfo);
  });

  // Scenario 5: Mobile EN Light - With Statistics
  test('Mock Exam Landing - With Stats - Mobile EN Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await setTheme(page, 'light');
    await setLanguage(page, 'en');
    await page.goto('/practice/culture-exam');
    await waitForPageReady(page, '[data-testid="mock-exam-page"]');
    await page.waitForTimeout(1000);

    await takeSnapshot(page, 'Mock Exam Landing - With Stats - Mobile EN Light', testInfo);
  });

  // Scenario 6: Desktop EN Dark - With Statistics
  test('Mock Exam Landing - With Stats - Desktop EN Dark', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setTheme(page, 'dark');
    await setLanguage(page, 'en');
    await page.goto('/practice/culture-exam');
    await waitForPageReady(page, '[data-testid="mock-exam-page"]');
    await page.waitForTimeout(1000);

    await takeSnapshot(page, 'Mock Exam Landing - With Stats - Desktop EN Dark', testInfo);
  });

  // Scenario 7: Mobile EN Dark - With Statistics
  test('Mock Exam Landing - With Stats - Mobile EN Dark', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await setTheme(page, 'dark');
    await setLanguage(page, 'en');
    await page.goto('/practice/culture-exam');
    await waitForPageReady(page, '[data-testid="mock-exam-page"]');
    await page.waitForTimeout(1000);

    await takeSnapshot(page, 'Mock Exam Landing - With Stats - Mobile EN Dark', testInfo);
  });
});

// ============================================================================
// LANDING PAGE LOADING STATE TESTS
// ============================================================================

test.describe('Mock Exam Landing - Loading State Visual Tests', () => {
  // Scenario 8: Desktop EN Light - Loading
  test('Mock Exam Landing - Loading - Desktop EN Light', async ({ page }, testInfo) => {
    // Delay API response to capture loading state
    await page.route('**/api/v1/culture/mock-exam/statistics', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 10000));
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          stats: { total_exams: 0 },
          recent_exams: [],
        }),
      });
    });

    await page.route('**/api/v1/culture/mock-exam/queue', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 10000));
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ can_start_exam: true }),
      });
    });

    await loginForVisualTest(page);
    await page.setViewportSize(VIEWPORTS.desktop);
    await setTheme(page, 'light');
    await setLanguage(page, 'en');
    await page.goto('/practice/culture-exam', { waitUntil: 'domcontentloaded' });

    // Wait for loading skeleton to appear
    await page.waitForTimeout(500);

    await takeSnapshot(page, 'Mock Exam Landing - Loading - Desktop EN Light', testInfo);
  });
});

// ============================================================================
// LANDING PAGE ERROR STATE TESTS
// ============================================================================

test.describe('Mock Exam Landing - Error State Visual Tests', () => {
  // Scenario 9: Desktop EN Light - Error
  test('Mock Exam Landing - Error - Desktop EN Light', async ({ page }, testInfo) => {
    // Mock API to return error
    await page.route('**/api/v1/culture/mock-exam/statistics', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          detail: 'Internal server error. Please try again later.',
        }),
      });
    });

    await page.route('**/api/v1/culture/mock-exam/queue', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ can_start_exam: false }),
      });
    });

    await loginForVisualTest(page);
    await page.setViewportSize(VIEWPORTS.desktop);
    await setTheme(page, 'light');
    await setLanguage(page, 'en');
    await page.goto('/practice/culture-exam');
    await waitForPageReady(page, '[data-testid="mock-exam-page"]');
    await page.waitForTimeout(1000);

    await takeSnapshot(page, 'Mock Exam Landing - Error - Desktop EN Light', testInfo);
  });
});

// ============================================================================
// LANDING PAGE NOT ENOUGH QUESTIONS STATE
// ============================================================================

test.describe('Mock Exam Landing - Not Enough Questions Visual Tests', () => {
  // Scenario 10: Desktop EN Light - Not Enough Questions
  test('Mock Exam Landing - Not Enough Questions - Desktop EN Light', async ({ page }, testInfo) => {
    await page.route('**/api/v1/culture/mock-exam/statistics', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          stats: { total_exams: 0 },
          recent_exams: [],
        }),
      });
    });

    await page.route('**/api/v1/culture/mock-exam/queue', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          total_questions: 10,
          available_questions: 10,
          can_start_exam: false, // Not enough questions
          sample_questions: [],
        }),
      });
    });

    await loginForVisualTest(page);
    await page.setViewportSize(VIEWPORTS.desktop);
    await setTheme(page, 'light');
    await setLanguage(page, 'en');
    await page.goto('/practice/culture-exam');
    await waitForPageReady(page, '[data-testid="mock-exam-page"]');
    await page.waitForTimeout(1000);

    await takeSnapshot(page, 'Mock Exam Landing - Not Enough Questions - Desktop EN Light', testInfo);
  });
});
