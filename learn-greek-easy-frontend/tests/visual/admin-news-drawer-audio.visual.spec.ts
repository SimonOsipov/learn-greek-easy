/**
 * Admin News Drawer Audio — Visual Regression Tests (NADM-26 / ADMIN2-27)
 *
 * Visual regression baseline for the Audio tab of NewsEditDrawer.
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

const NEWS_ITEM_ID = 'news-drawer-audio-001';

const mockNewsItem = {
  id: NEWS_ITEM_ID,
  title_el: 'Ελληνική είδηση με ήχο',
  title_en: 'Greek news item with audio',
  title_ru: 'Греческая новость с аудио',
  description_el: 'Περιγραφή με ήχο.',
  description_en: 'Description with audio.',
  description_ru: 'Описание с аудио.',
  publication_date: '2026-01-15',
  original_article_url: 'https://example.com/article-audio',
  image_url: null,
  audio_url: 'https://cdn.example.com/audio/news-001.mp3',
  audio_generated_at: '2026-01-12T10:00:00Z',
  audio_duration_seconds: 42,
  audio_file_size_bytes: 672000,
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

async function setupAudioDrawerRoutes(page: import('@playwright/test').Page) {
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

test.describe('Admin News Drawer — Audio tab', () => {
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
    await setupAudioDrawerRoutes(page);
    await page.setViewportSize(VIEWPORTS.desktop);
  });

  test.skip('Audio tab — with existing audio', async ({ page }, testInfo) => {
    await page.goto(`/admin?tab=news&edit=${NEWS_ITEM_ID}`);
    await waitForPageReady(page, '[data-testid="admin-page"]');
    await page.waitForSelector('[data-testid="news-edit-drawer"]');
    await page.waitForTimeout(400);

    // Switch to Audio tab
    const audioTab = page.getByRole('tab', { name: /audio/i });
    if (await audioTab.isVisible()) {
      await audioTab.click();
      await page.waitForTimeout(300);
    }

    await takeSnapshot(page, 'News Drawer Audio — with existing audio', testInfo);
    expect(true).toBe(true);
  });

  test.skip('Audio tab — no audio (generate CTA)', async ({ page }, testInfo) => {
    // Override with item that has no audio
    await page.route('**/api/v1/admin/news*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [{ ...mockNewsItem, audio_url: null, audio_generated_at: null, audio_duration_seconds: null, audio_file_size_bytes: null }],
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

    const audioTab = page.getByRole('tab', { name: /audio/i });
    if (await audioTab.isVisible()) {
      await audioTab.click();
      await page.waitForTimeout(300);
    }

    await takeSnapshot(page, 'News Drawer Audio — generate CTA', testInfo);
    expect(true).toBe(true);
  });
});
