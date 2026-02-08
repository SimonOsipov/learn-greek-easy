/**
 * Card Error Reporting - Visual Regression Tests
 *
 * Visual regression tests for the card error reporting feature on WordReferencePage.
 * Uses Chromatic for visual snapshots and comparison.
 *
 * Test Scenarios:
 * 1. Report Error button visible on WordReferencePage (Desktop)
 * 2. Report Error button visible on WordReferencePage (Mobile)
 * 3. Report Error modal in empty state (Desktop)
 * 4. Report Error modal with description filled (Desktop)
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

const mockWordEntry = {
  id: 'word-entry-001',
  deck_id: 'deck-001',
  lemma: '\u03C3\u03C0\u03AF\u03C4\u03B9',
  part_of_speech: 'noun',
  translation_en: 'house',
  translation_ru: '\u0434\u043E\u043C',
  pronunciation: 'SPI-ti',
  grammar_data: {
    gender: 'neuter',
    cases: {
      singular: {
        nominative: '\u03C3\u03C0\u03AF\u03C4\u03B9',
        genitive: '\u03C3\u03C0\u03B9\u03C4\u03B9\u03BF\u03CD',
        accusative: '\u03C3\u03C0\u03AF\u03C4\u03B9',
        vocative: '\u03C3\u03C0\u03AF\u03C4\u03B9',
      },
      plural: {
        nominative: '\u03C3\u03C0\u03AF\u03C4\u03B9\u03B1',
        genitive: '\u03C3\u03C0\u03B9\u03C4\u03B9\u03CE\u03BD',
        accusative: '\u03C3\u03C0\u03AF\u03C4\u03B9\u03B1',
        vocative: '\u03C3\u03C0\u03AF\u03C4\u03B9\u03B1',
      },
    },
  },
  examples: [
    {
      greek: '\u0398\u03BF \u03C3\u03C0\u03AF\u03C4\u03B9 \u03B5\u03AF\u03BD\u03B1\u03B9 \u03BC\u03B5\u03B3\u03AC\u03BB\u03BF.',
      english: 'The house is big.',
      russian: '\u0414\u043E\u043C \u0431\u043E\u043B\u044C\u0448\u043E\u0439.',
    },
  ],
  audio_key: null,
  is_active: true,
  created_at: '2026-01-20T10:00:00Z',
  updated_at: '2026-01-20T10:00:00Z',
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Set up API mocks for the WordReferencePage and card error reporting.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function setupWordReferenceMocks(page: any) {
  await page.route('**/api/v1/word-entries/word-entry-001', (route: any) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockWordEntry),
    });
  });

  await page.route('**/api/v1/card-errors', (route: any) => {
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'error-001',
        card_id: 'word-entry-001',
        card_type: 'WORD',
        description: 'Test error report',
        status: 'PENDING',
        admin_notes: null,
        resolved_at: null,
        created_at: '2026-02-07T10:00:00Z',
        updated_at: '2026-02-07T10:00:00Z',
      }),
    });
  });
}

// ============================================================================
// CARD ERROR REPORTING - VISUAL TESTS
// ============================================================================

test.describe('Card Error Reporting - WordReferencePage', () => {
  test.beforeEach(async ({ page }) => {
    await loginForVisualTest(page);
  });

  // Scenario 1: Report Error button visible on desktop
  test('word-reference-report-button', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setupWordReferenceMocks(page);

    await page.goto('/decks/deck-001/words/word-entry-001');
    await waitForPageReady(page, '[data-testid="word-reference-page"]');

    await expect(page.getByTestId('report-error-button')).toBeVisible();
    await page.waitForTimeout(500);

    await takeSnapshot(page, 'WordReferencePage - Report Error Button (Desktop)', testInfo);
  });

  // Scenario 2: Report Error button visible on mobile
  test('word-reference-report-button-mobile', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await setupWordReferenceMocks(page);

    await page.goto('/decks/deck-001/words/word-entry-001');
    await waitForPageReady(page, '[data-testid="word-reference-page"]');

    await expect(page.getByTestId('report-error-button')).toBeVisible();
    await page.waitForTimeout(500);

    await takeSnapshot(page, 'WordReferencePage - Report Error Button (Mobile)', testInfo);
  });

  // Scenario 3: Report Error modal in empty state
  test('word-reference-report-modal-empty', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setupWordReferenceMocks(page);

    await page.goto('/decks/deck-001/words/word-entry-001');
    await waitForPageReady(page, '[data-testid="word-reference-page"]');

    await page.getByTestId('report-error-button').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.waitForTimeout(500);

    await takeSnapshot(page, 'WordReferencePage - Report Error Modal (Empty)', testInfo);
  });

  // Scenario 4: Report Error modal with description filled
  test('word-reference-report-modal-filled', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setupWordReferenceMocks(page);

    await page.goto('/decks/deck-001/words/word-entry-001');
    await waitForPageReady(page, '[data-testid="word-reference-page"]');

    await page.getByTestId('report-error-button').click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.locator('textarea').fill(
      'The pronunciation guide seems incorrect for this word'
    );
    await page.waitForTimeout(300);

    await takeSnapshot(page, 'WordReferencePage - Report Error Modal (Filled)', testInfo);
  });
});
