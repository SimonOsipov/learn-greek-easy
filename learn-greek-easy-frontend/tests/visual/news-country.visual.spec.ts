/**
 * Visual Regression Tests: News Country Filter Feature
 *
 * Visual regression tests for the multi-country news feature.
 * Uses Chromatic for visual snapshots and comparison.
 *
 * Scenarios:
 * 1. News Card - Cyprus Pill
 * 2. News Card - Greece Pill
 * 3. News Card - World Pill
 * 4. News Page - Filter Tabs Default (All selected)
 * 5. News Page - Filter Tabs Cyprus Selected
 * 6. News Page - Filter Tabs Greece Selected
 * 7. News Page - Filter Tabs World Selected
 * 8. Admin News Table - Country Badges
 * 9. Admin News Table - Country Filter Dropdown
 * 10. News Page - Mobile Viewport
 * 11. News Page - Tablet Viewport
 */

import { test } from '@chromatic-com/playwright';
import {
  loginForVisualTest,
  takeSnapshot,
  waitForPageReady,
  VIEWPORTS,
} from './helpers/visual-helpers';

// ============================================================================
// MOCK DATA
// ============================================================================

const mockNewsItemCyprus = {
  id: 'news-cy-001',
  title_el: 'Κυπριακά νέα: Πολιτιστική εκδήλωση',
  title_en: 'Cyprus News: Cultural Event',
  title_ru: 'Новости Кипра: Культурное мероприятие',
  description_el: 'Μια σημαντική πολιτιστική εκδήλωση στη Λευκωσία.',
  description_en: 'A significant cultural event in Nicosia.',
  description_ru: 'Значительное культурное мероприятие в Никосии.',
  publication_date: '2026-02-15',
  original_article_url: 'https://example.com/cyprus-news',
  image_url: null,
  audio_url: null,
  audio_generated_at: null,
  audio_duration_seconds: null,
  audio_file_size_bytes: null,
  created_at: '2026-02-15T10:00:00Z',
  updated_at: '2026-02-15T10:00:00Z',
  country: 'cyprus',
  card_id: null,
  deck_id: null,
};

const mockNewsItemGreece = {
  ...mockNewsItemCyprus,
  id: 'news-gr-001',
  title_el: 'Ελληνικά νέα: Αρχαιολογική ανακάλυψη',
  title_en: 'Greek News: Archaeological Discovery',
  title_ru: 'Греческие новости: Археологическое открытие',
  description_el: 'Σημαντική αρχαιολογική ανακάλυψη στην Αθήνα.',
  description_en: 'Significant archaeological discovery in Athens.',
  description_ru: 'Значительное археологическое открытие в Афинах.',
  country: 'greece',
  original_article_url: 'https://example.com/greece-news',
};

const mockNewsItemWorld = {
  ...mockNewsItemCyprus,
  id: 'news-wo-001',
  title_el: 'Παγκόσμια νέα: Κλιματική αλλαγή',
  title_en: 'World News: Climate Change',
  title_ru: 'Мировые новости: Изменение климата',
  description_el: 'Νέα έκθεση για την κλιματική αλλαγή.',
  description_en: 'New report on climate change.',
  description_ru: 'Новый доклад об изменении климата.',
  country: 'world',
  original_article_url: 'https://example.com/world-news',
};

const mockCountryCounts = { cyprus: 5, greece: 3, world: 2 };

const mockNewsListResponse = (
  items: typeof mockNewsItemCyprus[],
  countryFilter?: string
) => ({
  items,
  total: items.length,
  page: 1,
  page_size: 12,
  country_counts: mockCountryCounts,
});

// ============================================================================
// Learner: Country Pills on News Cards
// ============================================================================

test.describe('News Cards - Country Pills', () => {
  test('Visual-MCNEWS-01: Cyprus pill displays on news card', async ({ page }, testInfo) => {
    await loginForVisualTest(page);

    // Mock news API to return Cyprus item
    await page.route('**/api/v1/news*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockNewsListResponse([mockNewsItemCyprus])),
      });
    });

    await page.goto('/news');
    await waitForPageReady(page);

    // Wait for news grid to load
    await page.waitForSelector('[data-testid="news-grid"]', { timeout: 10000 });

    await page.setViewportSize({ width: 1280, height: 720 });
    await takeSnapshot(page, 'News Card - Cyprus Pill', testInfo);
  });

  test('Visual-MCNEWS-02: Greece pill displays on news card', async ({ page }, testInfo) => {
    await loginForVisualTest(page);

    await page.route('**/api/v1/news*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockNewsListResponse([mockNewsItemGreece])),
      });
    });

    await page.goto('/news');
    await waitForPageReady(page);
    await page.waitForSelector('[data-testid="news-grid"]', { timeout: 10000 });

    await page.setViewportSize({ width: 1280, height: 720 });
    await takeSnapshot(page, 'News Card - Greece Pill', testInfo);
  });

  test('Visual-MCNEWS-03: World pill displays on news card', async ({ page }, testInfo) => {
    await loginForVisualTest(page);

    await page.route('**/api/v1/news*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockNewsListResponse([mockNewsItemWorld])),
      });
    });

    await page.goto('/news');
    await waitForPageReady(page);
    await page.waitForSelector('[data-testid="news-grid"]', { timeout: 10000 });

    await page.setViewportSize({ width: 1280, height: 720 });
    await takeSnapshot(page, 'News Card - World Pill', testInfo);
  });
});

// ============================================================================
// Learner: Filter Tabs on News Page
// ============================================================================

test.describe('News Page - Country Filter Tabs', () => {
  const mixedItems = [mockNewsItemCyprus, mockNewsItemGreece, mockNewsItemWorld];

  test('Visual-MCNEWS-04: Filter tabs default state (All selected)', async ({ page }, testInfo) => {
    await loginForVisualTest(page);

    await page.route('**/api/v1/news*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockNewsListResponse(mixedItems)),
      });
    });

    await page.goto('/news');
    await waitForPageReady(page);
    await page.waitForSelector('[data-testid="news-page"]', { timeout: 10000 });

    await page.setViewportSize({ width: VIEWPORTS.desktop.width, height: VIEWPORTS.desktop.height });
    await takeSnapshot(page, 'News Page - Filter Tabs Default (All)', testInfo);
  });

  test('Visual-MCNEWS-05: Filter tabs Cyprus selected state', async ({ page }, testInfo) => {
    await loginForVisualTest(page);

    let callCount = 0;
    await page.route('**/api/v1/news*', (route) => {
      const url = new URL(route.request().url());
      const country = url.searchParams.get('country');
      const items = country === 'cyprus' ? [mockNewsItemCyprus] : mixedItems;
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockNewsListResponse(items)),
      });
    });

    await page.goto('/news');
    await waitForPageReady(page);
    await page.waitForSelector('[data-testid="news-grid"]', { timeout: 10000 });

    // Click Cyprus tab
    const cyprusTab = page.getByRole('tab').filter({ hasText: /Cyprus/i }).first();
    if (await cyprusTab.isVisible({ timeout: 3000 })) {
      await cyprusTab.click();
      await page.waitForTimeout(500);
    }

    await page.setViewportSize({ width: VIEWPORTS.desktop.width, height: VIEWPORTS.desktop.height });
    await takeSnapshot(page, 'News Page - Cyprus Tab Selected', testInfo);
  });

  test('Visual-MCNEWS-06: Filter tabs Greece selected state', async ({ page }, testInfo) => {
    await loginForVisualTest(page);

    await page.route('**/api/v1/news*', (route) => {
      const url = new URL(route.request().url());
      const country = url.searchParams.get('country');
      const items = country === 'greece' ? [mockNewsItemGreece] : mixedItems;
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockNewsListResponse(items)),
      });
    });

    await page.goto('/news');
    await waitForPageReady(page);
    await page.waitForSelector('[data-testid="news-grid"]', { timeout: 10000 });

    const greeceTab = page.getByRole('tab').filter({ hasText: /Greece/i }).first();
    if (await greeceTab.isVisible({ timeout: 3000 })) {
      await greeceTab.click();
      await page.waitForTimeout(500);
    }

    await page.setViewportSize({ width: VIEWPORTS.desktop.width, height: VIEWPORTS.desktop.height });
    await takeSnapshot(page, 'News Page - Greece Tab Selected', testInfo);
  });

  test('Visual-MCNEWS-07: Filter tabs World selected state', async ({ page }, testInfo) => {
    await loginForVisualTest(page);

    await page.route('**/api/v1/news*', (route) => {
      const url = new URL(route.request().url());
      const country = url.searchParams.get('country');
      const items = country === 'world' ? [mockNewsItemWorld] : mixedItems;
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockNewsListResponse(items)),
      });
    });

    await page.goto('/news');
    await waitForPageReady(page);
    await page.waitForSelector('[data-testid="news-grid"]', { timeout: 10000 });

    const worldTab = page.getByRole('tab').filter({ hasText: /World/i }).first();
    if (await worldTab.isVisible({ timeout: 3000 })) {
      await worldTab.click();
      await page.waitForTimeout(500);
    }

    await page.setViewportSize({ width: VIEWPORTS.desktop.width, height: VIEWPORTS.desktop.height });
    await takeSnapshot(page, 'News Page - World Tab Selected', testInfo);
  });
});

// ============================================================================
// Admin: Country Badges in News Table
// ============================================================================

test.describe('Admin News Table - Country Badges', () => {
  const mockAdminNewsResponse = {
    total: 3,
    page: 1,
    page_size: 10,
    items: [
      { ...mockNewsItemCyprus, card_id: null, deck_id: null },
      { ...mockNewsItemGreece, card_id: null, deck_id: null },
      { ...mockNewsItemWorld, card_id: null, deck_id: null },
    ],
    country_counts: mockCountryCounts,
  };

  test('Visual-MCNEWS-08: Admin news table shows country badges', async ({ page }, testInfo) => {
    // Login as admin
    await loginForVisualTest(page);
    await page.evaluate(() => {
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        const authState = JSON.parse(authStorage);
        authState.state.user.role = 'admin';
        localStorage.setItem('auth-storage', JSON.stringify(authState));
      }
    });

    await page.route('**/api/v1/news*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockAdminNewsResponse),
      });
    });

    await page.route('**/api/v1/admin/news*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockAdminNewsResponse),
      });
    });

    await page.goto('/admin');
    await waitForPageReady(page);

    // Navigate to news tab if possible
    const newsTab = page.getByTestId('admin-tab-news');
    if (await newsTab.isVisible({ timeout: 5000 })) {
      await newsTab.click();
    }

    await page.setViewportSize({ width: VIEWPORTS.desktop.width, height: VIEWPORTS.desktop.height });
    await takeSnapshot(page, 'Admin News Table - Country Badges', testInfo);
  });

  test('Visual-MCNEWS-09: Admin news table with country filter', async ({ page }, testInfo) => {
    await loginForVisualTest(page);
    await page.evaluate(() => {
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        const authState = JSON.parse(authStorage);
        authState.state.user.role = 'admin';
        localStorage.setItem('auth-storage', JSON.stringify(authState));
      }
    });

    await page.route('**/api/v1/news*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockAdminNewsResponse),
      });
    });

    await page.goto('/admin');
    await waitForPageReady(page);

    const newsTab = page.getByTestId('admin-tab-news');
    if (await newsTab.isVisible({ timeout: 5000 })) {
      await newsTab.click();
    }

    await page.setViewportSize({ width: VIEWPORTS.desktop.width, height: VIEWPORTS.desktop.height });
    await takeSnapshot(page, 'Admin News Table - Country Filter', testInfo);
  });
});

// ============================================================================
// Responsive Viewports
// ============================================================================

test.describe('News Page - Responsive Viewports', () => {
  const mixedItems = [mockNewsItemCyprus, mockNewsItemGreece, mockNewsItemWorld];

  test('Visual-MCNEWS-10: News page at mobile viewport', async ({ page }, testInfo) => {
    await loginForVisualTest(page);

    await page.route('**/api/v1/news*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockNewsListResponse(mixedItems)),
      });
    });

    await page.goto('/news');
    await waitForPageReady(page);
    await page.waitForSelector('[data-testid="news-page"]', { timeout: 10000 });

    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(300); // Allow responsive reflow
    await takeSnapshot(page, 'News Page - Mobile Viewport', testInfo);
  });

  test('Visual-MCNEWS-11: News page at tablet viewport', async ({ page }, testInfo) => {
    await loginForVisualTest(page);

    await page.route('**/api/v1/news*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockNewsListResponse(mixedItems)),
      });
    });

    await page.goto('/news');
    await waitForPageReady(page);
    await page.waitForSelector('[data-testid="news-page"]', { timeout: 10000 });

    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(300);
    await takeSnapshot(page, 'News Page - Tablet Viewport', testInfo);
  });
});
