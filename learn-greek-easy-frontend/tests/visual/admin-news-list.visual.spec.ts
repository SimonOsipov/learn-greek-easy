/**
 * Admin News List — Visual Regression Tests (NADM-26 / ADMIN2-27)
 *
 * Visual regression baselines for the News admin list view at four
 * breakpoints: 320 / 768 / 1024 / 1440 px.
 *
 * NOTE: Tests are marked .skip because they require admin auth + mock news
 * data via a dedicated CI seed pass. Remove .skip once the seeding
 * infrastructure and baseline regen pass are available.
 */

import { test, expect } from '@chromatic-com/playwright';
import {
  takeSnapshot,
  loginForVisualTest,
  waitForPageReady,
} from './helpers/visual-helpers';

const BREAKPOINTS = [
  { width: 320, height: 568, label: '320px' },
  { width: 768, height: 1024, label: '768px' },
  { width: 1024, height: 768, label: '1024px' },
  { width: 1440, height: 900, label: '1440px' },
];

// ── Mock data ─────────────────────────────────────────────────────────────────

const mockNewsItem = {
  id: 'news-list-001',
  title_el: 'Ελληνική είδηση για δοκιμή',
  title_en: 'Greek news item for testing',
  title_ru: 'Греческая новость для теста',
  description_el: 'Περιγραφή στα Ελληνικά.',
  description_en: 'Description in English.',
  description_ru: 'Описание на русском.',
  publication_date: '2026-01-15',
  original_article_url: 'https://example.com/article',
  image_url: null,
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

const mockTabCounts = {
  inbox: 0,
  decks: 0,
  news: 1,
  situations: 0,
  exercises: 0,
  errors: 0,
  feedback: 0,
  changelog: 0,
  announcements: 0,
};

// ── Route setup helper ────────────────────────────────────────────────────────

async function setupNewsListRoutes(page: import('@playwright/test').Page) {
  await page.route('**/api/v1/admin/stats*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockStats),
    });
  });

  await page.route('**/api/v1/admin/tab-counts*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockTabCounts),
    });
  });

  await page.route('**/api/v1/admin/news*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockNewsList),
    });
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────────

test.describe('Admin News List — breakpoint matrix', () => {
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

    await setupNewsListRoutes(page);
  });

  for (const bp of BREAKPOINTS) {
    test.skip(`News list renders at ${bp.label}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.goto('/admin?tab=news');
      await waitForPageReady(page, '[data-testid="admin-page"]');
      await page.waitForTimeout(300);

      await takeSnapshot(page, `Admin News List — ${bp.label}`, testInfo);
      expect(true).toBe(true);
    });
  }

  test.skip('News list empty state', async ({ page }, testInfo) => {
    // Override with empty list
    await page.route('**/api/v1/admin/news*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], total: 0, page: 1, page_size: 20 }),
      });
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/admin?tab=news');
    await waitForPageReady(page, '[data-testid="admin-page"]');
    await page.waitForTimeout(300);

    await takeSnapshot(page, 'Admin News List — empty state', testInfo);
    expect(true).toBe(true);
  });
});
