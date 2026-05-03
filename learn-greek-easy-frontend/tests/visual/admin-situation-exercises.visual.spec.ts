/**
 * Admin Situation Exercises Tab - Visual Regression Tests
 *
 * Visual regression tests for the Exercises tab in the admin situation detail modal.
 * Uses Chromatic for visual snapshots and comparison.
 *
 * Scenarios:
 * 1. Exercises tab with listening exercise expanded (waveform + 2x2 grid + correct highlighted)
 * 2. Exercises tab with reading exercise expanded (text block + 2x2 grid + correct highlighted)
 * 3. Exercises tab with empty state (no exercises)
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

const SITUATION_ID = 'sit-001';

const mockSituationsList = {
  situations: [
    {
      id: SITUATION_ID,
      title_en: 'Supreme Court rejects appeal against dismissal',
      title_el: 'Το Ανώτατο Δικαστήριο απέρριψε την έφεση κατά της απόλυσής',
      status: 'ready',
      has_dialog: true,
      has_description: true,
      has_picture: false,
      dialog_audio_status: 'audio_ready',
      description_audio_status: 'audio_ready',
      description_a2_audio_status: 'audio_ready',
      timestamps_ready_count: 2,
      timestamps_total_count: 2,
      image_url: null,
      created_at: '2026-01-01T00:00:00Z',
    },
  ],
  total: 1,
  page: 1,
  page_size: 10,
};

const mockSituationDetail = {
  id: SITUATION_ID,
  title_en: 'Supreme Court rejects appeal against dismissal',
  title_el: 'Το Ανώτατο Δικαστήριο απέρριψε την έφεση κατά της απόλυσής',
  status: 'ready',
  has_dialog: false,
  has_description: true,
  has_picture: false,
  dialog: null,
  description: {
    id: 'desc-001',
    text_el: 'Το Ανώτατο Δικαστήριο απέρριψε σήμερα την έφεση που είχε καταθέσει η πρώην δικαστής κατά της απόλυσής της.',
    text_el_a2: 'Το Δικαστήριο είπε ότι η απόλυση ήταν σωστή.',
    source_type: 'original',
    status: 'audio_ready',
    audio_duration_seconds: 90,
    audio_a2_duration_seconds: 45,
    audio_url: null,
    audio_a2_url: null,
    word_timestamps: null,
    word_timestamps_a2: null,
    created_at: '2026-01-01T00:00:00Z',
  },
  picture: null,
  created_at: '2026-01-01T00:00:00Z',
};

const mockExercisesWithData = {
  groups: [
    {
      source_type: 'dialog',
      exercises: [],
      exercise_count: 0,
    },
    {
      source_type: 'description',
      exercises: [
        {
          id: 'ex-listening-b1',
          exercise_type: 'select_correct_answer',
          status: 'approved',
          items: [
            {
              item_index: 0,
              payload: {
                prompt: {
                  el: 'Πόσοι δικαστές ήταν υπό δοκιμασία;',
                  en: 'How many judges were on probation?',
                  ru: 'Сколько судей были на испытательном сроке?',
                },
                options: [
                  { el: '8 δικαστές', en: '8 judges', ru: '8 судей' },
                  { el: '15 δικαστές', en: '15 judges', ru: '15 судей' },
                  { el: '11 δικαστές', en: '11 judges', ru: '11 судей' },
                  { el: '6 δικαστές', en: '6 judges', ru: '6 судей' },
                ],
                correct_answer_index: 2,
              },
            },
          ],
          audio_level: 'B1',
          modality: 'listening',
          audio_url: 'https://example.com/audio.mp3',
          reading_text: null,
        },
        {
          id: 'ex-reading-b1',
          exercise_type: 'select_correct_answer',
          status: 'approved',
          items: [
            {
              item_index: 0,
              payload: {
                prompt: {
                  el: 'Ποια ήταν η απόφαση του δικαστηρίου;',
                  en: 'What was the court decision?',
                  ru: 'Каково было решение суда?',
                },
                options: [
                  { el: 'Απέρριψε την έφεση', en: 'Rejected the appeal', ru: 'Отклонил апелляцию' },
                  { el: 'Δέχτηκε την έφεση', en: 'Accepted the appeal', ru: 'Принял апелляцию' },
                  { el: 'Ανέβαλε τη συζήτηση', en: 'Postponed the hearing', ru: 'Отложил слушание' },
                  { el: 'Ζήτησε νέα στοιχεία', en: 'Requested new evidence', ru: 'Запросил новые доказательства' },
                ],
                correct_answer_index: 0,
              },
            },
          ],
          audio_level: 'B1',
          modality: 'reading',
          audio_url: null,
          reading_text:
            'Το Ανώτατο Δικαστήριο απέρριψε σήμερα την έφεση που είχε καταθέσει η πρώην δικαστής κατά της απόλυσής της.',
        },
      ],
      exercise_count: 2,
    },
    {
      source_type: 'picture',
      exercises: [],
      exercise_count: 0,
    },
  ],
  total_count: 2,
};

const mockExercisesEmpty = {
  groups: [
    { source_type: 'dialog', exercises: [], exercise_count: 0 },
    { source_type: 'description', exercises: [], exercise_count: 0 },
    { source_type: 'picture', exercises: [], exercise_count: 0 },
  ],
  total_count: 0,
};

const mockStats = {
  total_decks: 10,
  total_cards: 100,
  total_vocabulary_decks: 5,
  total_vocabulary_cards: 50,
  total_culture_decks: 5,
  total_culture_questions: 50,
  total_situations: 1,
  situations_draft: 0,
  situations_ready: 1,
};

// ============================================================================
// HELPER: Setup admin routes
// ============================================================================

async function setupAdminRoutes(
  page: import('@playwright/test').Page,
  exercisesResponse: typeof mockExercisesWithData | typeof mockExercisesEmpty
) {
  await page.route('**/api/v1/admin/stats*', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockStats) });
  });

  await page.route('**/api/v1/admin/situations?*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockSituationsList),
    });
  });

  await page.route(`**/api/v1/admin/situations/${SITUATION_ID}`, (route) => {
    if (route.request().url().includes('/exercises')) return route.fallback();
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockSituationDetail),
    });
  });

  await page.route(`**/api/v1/admin/situations/${SITUATION_ID}/exercises`, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(exercisesResponse),
    });
  });
}

// ============================================================================
// TESTS
// ============================================================================

test.describe('Admin Situation Exercises Tab', () => {
  test.beforeEach(async ({ page }) => {
    await loginForVisualTest(page);

    // Elevate to admin
    await page.evaluate(() => {
      const raw = localStorage.getItem('auth-storage');
      if (raw) {
        const authState = JSON.parse(raw);
        authState.state.user.role = 'admin';
        localStorage.setItem('auth-storage', JSON.stringify(authState));
      }
    });
  });

  test('Listening exercise - waveform, Greek question, 2x2 grid, correct highlighted', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setupAdminRoutes(page, mockExercisesWithData);

    await page.goto('/admin');
    await waitForPageReady(page, '[data-testid="admin-page"]');

    // Switch to Situations tab
    await page.getByTestId('admin-tab-situations').click();
    await page.waitForTimeout(300);

    // Open situation detail modal
    await page.getByTestId(`situation-edit-btn-${SITUATION_ID}`).click();
    await page.waitForTimeout(500);

    // Click Exercises tab
    await page.getByTestId('situation-tab-exercises').click();
    await page.waitForTimeout(500);

    // Expand Description Exercises group
    await page.getByRole('button', { name: 'Description Exercises' }).click();
    await page.waitForTimeout(300);

    // Expand the listening exercise
    await page
      .getByTestId('situation-exercises-item-ex-listening-b1')
      .getByRole('button', { name: 'Select Correct Answer' })
      .click();
    await page.waitForTimeout(300);

    await takeSnapshot(page, 'Exercises Tab - Listening exercise expanded', testInfo);
  });

  test('Reading exercise - text block, Greek question, 2x2 grid, correct highlighted', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setupAdminRoutes(page, mockExercisesWithData);

    await page.goto('/admin');
    await waitForPageReady(page, '[data-testid="admin-page"]');

    // Switch to Situations tab
    await page.getByTestId('admin-tab-situations').click();
    await page.waitForTimeout(300);

    // Open situation detail modal
    await page.getByTestId(`situation-edit-btn-${SITUATION_ID}`).click();
    await page.waitForTimeout(500);

    // Click Exercises tab
    await page.getByTestId('situation-tab-exercises').click();
    await page.waitForTimeout(500);

    // Expand Description Exercises group
    await page.getByRole('button', { name: 'Description Exercises' }).click();
    await page.waitForTimeout(300);

    // Expand the reading exercise
    await page
      .getByTestId('situation-exercises-item-ex-reading-b1')
      .getByRole('button', { name: 'Select Correct Answer' })
      .click();
    await page.waitForTimeout(300);

    await takeSnapshot(page, 'Exercises Tab - Reading exercise expanded', testInfo);
  });

  test('Empty state - no exercises', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setupAdminRoutes(page, mockExercisesEmpty);

    await page.goto('/admin');
    await waitForPageReady(page, '[data-testid="admin-page"]');

    // Switch to Situations tab
    await page.getByTestId('admin-tab-situations').click();
    await page.waitForTimeout(300);

    // Open situation detail modal
    await page.getByTestId(`situation-edit-btn-${SITUATION_ID}`).click();
    await page.waitForTimeout(500);

    // Click Exercises tab
    await page.getByTestId('situation-tab-exercises').click();
    await page.waitForTimeout(500);

    await takeSnapshot(page, 'Exercises Tab - Empty state', testInfo);
  });
});
