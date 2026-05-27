/**
 * Admin News Drawer Body — Visual Regression Tests (NADM-26 / ADMIN2-27)
 *
 * Visual regression baseline for the Body (content/text) tab of NewsEditDrawer.
 * Covers both populated and empty-content states.
 *
 * NOTE: Tests are marked .skip — remove once CI seeding and baseline regen
 * pass are available.
 */

import { test, expect } from '@chromatic-com/playwright';
import {
  takeSnapshot,
  loginForVisualTest,
  waitForPageReady,
  VIEWPORTS,
} from './helpers/visual-helpers';

const NEWS_ITEM_ID = 'news-drawer-body-001';

const mockNewsItem = {
  id: NEWS_ITEM_ID,
  title_el: 'Ελληνική είδηση με σώμα',
  title_en: 'Greek news item with body',
  title_ru: 'Греческая новость с содержимым',
  description_el: 'Πλήρης περιγραφή στα Ελληνικά για το σώμα του άρθρου.',
  description_en: 'Full description in English for the article body.',
  description_ru: 'Полное описание на русском для тела статьи.',
  publication_date: '2026-01-15',
  original_article_url: 'https://example.com/article-body',
  image_url: null,
  audio_url: null,
  audio_generated_at: null,
  audio_duration_seconds: null,
  audio_file_size_bytes: null,
  created_at: '2026-01-10T10:00:00Z',
  updated_at: '2026-01-14T12:00:00Z',
  country: 'greece',
  title_el_a2: 'Απλή είδηση A2',
  description_el_a2: 'Απλή περιγραφή A2.',
  audio_a2_url: null,
  audio_a2_duration_seconds: null,
  audio_a2_generated_at: null,
  audio_a2_file_size_bytes: null,
  has_a2_content: true,
  source_image_url: null,
};

const mockNewsList = {
  items: [mockNewsItem],
  total: 1,
  page: 1,
  page_size: 20,
};

const mockStats = {
  total_decks: 0,
  total_cards: 0,
  total_vocabulary_decks: 0,
  total_vocabulary_cards: 0,
  total_culture_decks: 0,
  total_culture_questions: 0,
};

async function setupBodyDrawerRoutes(page: import('@playwright/test').Page) {
  await page.route('**/api/v1/admin/stats*', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockStats) });
  });
  await page.route('**/api/v1/admin/tab-counts*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ inbox: 0, decks: 0, news: 1, situations: 0, exercises: 0, errors: 0, feedback: 0, changelog: 0, announcements: 0 }),
    });
  });
  await page.route('**/api/v1/admin/news*', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockNewsList) });
  });
}

test.describe('Admin News Drawer — Body tab', () => {
  test.beforeEach(async ({ page }) => {
    await loginForVisualTest(page);
    await page.evaluate(() => {
      const raw = localStorage.getItem('auth-storage');
      if (raw) {
        const authState = JSON.parse(raw);
        authState.state.user.role = 'admin';
        localStorage.setItem('auth-storage', JSON.stringify(authState));
      }
    });
    await setupBodyDrawerRoutes(page);
    await page.setViewportSize(VIEWPORTS.desktop);
  });

  test.skip('Body tab — populated content (B2 + A2 fields)', async ({ page }, testInfo) => {
    await page.goto(`/admin?tab=news&edit=${NEWS_ITEM_ID}`);
    await waitForPageReady(page, '[data-testid="admin-page"]');
    await page.waitForSelector('[data-testid="news-edit-drawer"]');
    await page.waitForTimeout(400);

    // Body/Content is often the default tab — if not, navigate to it
    const bodyTab = page.getByRole('tab', { name: /body|content/i });
    if (await bodyTab.isVisible()) {
      await bodyTab.click();
      await page.waitForTimeout(300);
    }

    await takeSnapshot(page, 'News Drawer Body — populated B2 + A2', testInfo);
    expect(true).toBe(true);
  });

  test.skip('Body tab — empty content (no A2)', async ({ page }, testInfo) => {
    await page.route('**/api/v1/admin/news*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [{ ...mockNewsItem, title_el_a2: null, description_el_a2: null, has_a2_content: false }],
          total: 1,
          page: 1,
          page_size: 20,
        }),
      });
    });

    await page.goto(`/admin?tab=news&edit=${NEWS_ITEM_ID}`);
    await waitForPageReady(page, '[data-testid="admin-page"]');
    await page.waitForSelector('[data-testid="news-edit-drawer"]');
    await page.waitForTimeout(400);

    const bodyTab = page.getByRole('tab', { name: /body|content/i });
    if (await bodyTab.isVisible()) {
      await bodyTab.click();
      await page.waitForTimeout(300);
    }

    await takeSnapshot(page, 'News Drawer Body — empty A2 content', testInfo);
    expect(true).toBe(true);
  });
});
