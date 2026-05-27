/**
 * Admin News Drawer Chrome — Visual Regression Tests (NADM-09 / ADMIN2-27)
 *
 * Visual regression baseline for the full-screen NewsEditDrawer chrome:
 * - size="full" → 100vw / 100vh sheet
 * - bg-black/50 overlay (no backdrop-blur)
 * - .drawer-shadow-handoff drop shadow (-30px 0 60px rgba(0,0,0,0.3))
 * - slide animation tuned to 250ms cubic-bezier(0.4,0,0.2,1)
 *
 * NOTE: Tests are marked .skip because the drawer requires mock news data
 * and admin auth that need a dedicated CI seed pass. Remove .skip once the
 * seeding infrastructure and baseline regen pass are available.
 */

import { test, expect } from '@chromatic-com/playwright';
import {
  takeSnapshot,
  loginForVisualTest,
  waitForPageReady,
  VIEWPORTS,
} from './helpers/visual-helpers';

const NEWS_ITEM_ID = 'news-drawer-001';

// ── Mock data ─────────────────────────────────────────────────────────────────

const mockNewsItem = {
  id: NEWS_ITEM_ID,
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

// ── Route setup helper ────────────────────────────────────────────────────────

async function setupNewsDrawerRoutes(page: import('@playwright/test').Page) {
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
      body: JSON.stringify({
        inbox: 0,
        decks: 0,
        news: 1,
        situations: 0,
        exercises: 0,
        errors: 0,
        feedback: 0,
        changelog: 0,
        announcements: 0,
      }),
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

test.describe('Admin News Drawer Chrome', () => {
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

    await setupNewsDrawerRoutes(page);
    await page.setViewportSize(VIEWPORTS.desktop);
  });

  test.skip('Full-screen drawer open — header + tab strip', async ({ page }, testInfo) => {
    await page.goto(`/admin?tab=news&edit=${NEWS_ITEM_ID}`);
    await waitForPageReady(page, '[data-testid="admin-page"]');

    await page.waitForSelector('[data-testid="news-edit-drawer"]');
    // Wait for animation to complete (250ms + buffer)
    await page.waitForTimeout(400);

    // Verify full-screen chrome attributes are present
    await expect(page.locator('[data-testid="news-edit-drawer"]')).toHaveAttribute(
      'data-size',
      'full'
    );

    await takeSnapshot(page, 'News Drawer Chrome — full-screen header + tab strip', testInfo);
  });

  test.skip('Full-screen drawer — overlay (bg-black/50)', async ({ page }, testInfo) => {
    await page.goto(`/admin?tab=news&edit=${NEWS_ITEM_ID}`);
    await waitForPageReady(page, '[data-testid="admin-page"]');

    await page.waitForSelector('[data-testid="news-edit-drawer"]');
    await page.waitForTimeout(400);

    await takeSnapshot(page, 'News Drawer Chrome — overlay', testInfo);
  });

  test.skip('Full-screen drawer — footer', async ({ page }, testInfo) => {
    await page.goto(`/admin?tab=news&edit=${NEWS_ITEM_ID}`);
    await waitForPageReady(page, '[data-testid="admin-page"]');

    await page.waitForSelector('[data-testid="news-edit-drawer"]');
    await page.waitForTimeout(400);

    await expect(page.locator('[data-testid="news-drawer-save"]')).toBeVisible();

    await takeSnapshot(page, 'News Drawer Chrome — footer', testInfo);
  });
});
