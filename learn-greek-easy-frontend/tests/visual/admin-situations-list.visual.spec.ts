/**
 * Admin Situations List - Visual Regression Tests
 *
 * Verifies the per-source exercise count badges render on each row of the
 * admin Situations list (Dialog Ex / Desc Ex / Pic Ex), with green/gray
 * states driven by the count.
 */

import { test, expect } from '@chromatic-com/playwright';
import {
  takeSnapshot,
  loginForVisualTest,
  waitForPageReady,
  VIEWPORTS,
} from './helpers/visual-helpers';

const SIT_FULL_ID = '11111111-1111-1111-1111-111111111111';
const SIT_EMPTY_ID = '22222222-2222-2222-2222-222222222222';

const mockSituationsList = {
  items: [
    {
      id: SIT_FULL_ID,
      scenario_el: 'Πλήρης σκηνή',
      scenario_en: 'Situation with all three sources',
      scenario_ru: 'Ситуация со всеми источниками',
      status: 'ready',
      created_at: '2026-01-01T00:00:00Z',
      has_dialog: true,
      has_description: true,
      has_picture: true,
      has_dialog_audio: true,
      has_description_audio: true,
      description_timestamps_count: 2,
      dialog_exercises_count: 2,
      description_exercises_count: 3,
      picture_exercises_count: 1,
    },
    {
      id: SIT_EMPTY_ID,
      scenario_el: 'Σκηνή χωρίς ασκήσεις',
      scenario_en: 'Draft situation without exercises',
      scenario_ru: 'Черновик без упражнений',
      status: 'draft',
      created_at: '2026-01-02T00:00:00Z',
      has_dialog: false,
      has_description: true,
      has_picture: false,
      has_dialog_audio: false,
      has_description_audio: false,
      description_timestamps_count: 0,
      dialog_exercises_count: 0,
      description_exercises_count: 0,
      picture_exercises_count: 0,
    },
  ],
  total: 2,
  page: 1,
  page_size: 10,
  status_counts: { draft: 1, ready: 1 },
};

const mockStats = {
  total_decks: 0,
  total_cards: 0,
  total_vocabulary_decks: 0,
  total_vocabulary_cards: 0,
  total_culture_decks: 0,
  total_culture_questions: 0,
  total_situations: 2,
  situations_draft: 1,
  situations_ready: 1,
};

test.describe('Admin Situations List — exercise count badges', () => {
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

    await page.route('**/api/v1/admin/stats*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockStats),
      });
    });

    await page.route('**/api/v1/admin/situations**', (route) => {
      const url = route.request().url();
      // Don't match nested routes (e.g. /situations/{id} or /situations/{id}/exercises)
      const path = new URL(url).pathname;
      if (path === '/api/v1/admin/situations') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockSituationsList),
        });
      }
      return route.fallback();
    });
  });

  test('Row badges render Dialog/Desc/Pic exercise counts with green/gray states', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    await page.goto('/admin');
    await waitForPageReady(page, '[data-testid="admin-page"]');

    // Open the Decks dropdown and switch to Situations tab
    await page.getByTestId('admin-group-content').click();
    await page.getByTestId('admin-tab-situations').click();
    await page.waitForTimeout(300);

    // Full-source row: all three badges green with correct numbers
    const fullDialogBadge = page.getByTestId(`situation-dialog-ex-badge-${SIT_FULL_ID}`);
    const fullDescBadge = page.getByTestId(`situation-desc-ex-badge-${SIT_FULL_ID}`);
    const fullPicBadge = page.getByTestId(`situation-pic-ex-badge-${SIT_FULL_ID}`);
    await expect(fullDialogBadge).toHaveText('Dialog Ex 2');
    await expect(fullDialogBadge).toHaveClass(/b-green/);
    await expect(fullDescBadge).toHaveText('Desc Ex 3');
    await expect(fullDescBadge).toHaveClass(/b-green/);
    await expect(fullPicBadge).toHaveText('Pic Ex 1');
    await expect(fullPicBadge).toHaveClass(/b-green/);

    // Empty-exercise row: all three badges gray with 0
    const emptyDialogBadge = page.getByTestId(`situation-dialog-ex-badge-${SIT_EMPTY_ID}`);
    const emptyDescBadge = page.getByTestId(`situation-desc-ex-badge-${SIT_EMPTY_ID}`);
    const emptyPicBadge = page.getByTestId(`situation-pic-ex-badge-${SIT_EMPTY_ID}`);
    await expect(emptyDialogBadge).toHaveText('Dialog Ex 0');
    await expect(emptyDialogBadge).toHaveClass(/b-gray/);
    await expect(emptyDescBadge).toHaveText('Desc Ex 0');
    await expect(emptyDescBadge).toHaveClass(/b-gray/);
    await expect(emptyPicBadge).toHaveText('Pic Ex 0');
    await expect(emptyPicBadge).toHaveClass(/b-gray/);

    await takeSnapshot(page, 'Admin Situations list with exercise count badges', testInfo);
  });
});
