/**
 * Admin News Drawer Image — Visual Regression Tests (NADM-26 / ADMIN2-27)
 *
 * Visual regression baseline for the Image tab of NewsEditDrawer.
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

const NEWS_ITEM_ID = 'news-drawer-image-001';

const mockNewsItemWithImage = {
  id: NEWS_ITEM_ID,
  title_el: 'Ελληνική είδηση με εικόνα',
  title_en: 'Greek news item with image',
  title_ru: 'Греческая новость с изображением',
  description_el: 'Περιγραφή με εικόνα.',
  description_en: 'Description with image.',
  description_ru: 'Описание с изображением.',
  publication_date: '2026-01-15',
  original_article_url: 'https://example.com/article-image',
  image_url: 'https://cdn.example.com/images/news-001.jpg',
  audio_url: null,
  audio_generated_at: null,
  audio_duration_seconds: null,
  audio_file_size_bytes: null,
  created_at: '2026-01-10T10:00:00Z',
  updated_at: '2026-01-14T12:00:00Z',
  country: 'greece',
  title_el_a2: null,
  description_el_a2: null,
  audio_a2_url: null,
  audio_a2_duration_seconds: null,
  audio_a2_generated_at: null,
  audio_a2_file_size_bytes: null,
  has_a2_content: false,
  source_image_url: 'https://cdn.example.com/images/news-001-source.jpg',
};

const mockNewsList = {
  items: [mockNewsItemWithImage],
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

async function setupImageDrawerRoutes(page: import('@playwright/test').Page) {
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

test.describe('Admin News Drawer — Image tab', () => {
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
    await setupImageDrawerRoutes(page);
    await page.setViewportSize(VIEWPORTS.desktop);
  });

  test.skip('Image tab — with existing image', async ({ page }, testInfo) => {
    await page.goto(`/admin?tab=news&edit=${NEWS_ITEM_ID}`);
    await waitForPageReady(page, '[data-testid="admin-page"]');
    await page.waitForSelector('[data-testid="news-edit-drawer"]');
    await page.waitForTimeout(400);

    const imageTab = page.getByRole('tab', { name: /image/i });
    if (await imageTab.isVisible()) {
      await imageTab.click();
      await page.waitForTimeout(300);
    }

    await takeSnapshot(page, 'News Drawer Image — with existing image', testInfo);
    expect(true).toBe(true);
  });

  test.skip('Image tab — no image (upload CTA)', async ({ page }, testInfo) => {
    await page.route('**/api/v1/admin/news*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [{ ...mockNewsItemWithImage, image_url: null, source_image_url: null }],
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

    const imageTab = page.getByRole('tab', { name: /image/i });
    if (await imageTab.isVisible()) {
      await imageTab.click();
      await page.waitForTimeout(300);
    }

    await takeSnapshot(page, 'News Drawer Image — upload CTA', testInfo);
    expect(true).toBe(true);
  });
});
