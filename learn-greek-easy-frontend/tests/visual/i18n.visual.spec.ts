/**
 * i18n Visual Regression Tests
 *
 * Visual tests for internationalization features.
 * Captures snapshots in English to detect UI regressions
 * when translations change or layout issues occur with different text lengths.
 * Note: Greek UI was removed - only EN/RU are now supported.
 */

import { test, expect } from '@chromatic-com/playwright';
import {
  takeSnapshot,
  waitForPageReady,
  loginForVisualTest,
  VIEWPORTS,
} from './helpers/visual-helpers';

test.describe('Language Switcher Visual Tests', () => {
  test('Language Switcher Dropdown - English', async ({ page }, testInfo) => {
    await page.goto('/login');
    await page.evaluate(() => localStorage.setItem('i18nextLng', 'en'));
    await page.reload();
    await waitForPageReady(page, '[data-testid="login-card"]');

    // Open the language switcher dropdown
    await page.getByTestId('language-switcher-trigger').click();
    await page.waitForTimeout(300);

    await takeSnapshot(page, 'Language Switcher Dropdown - English', testInfo);
  });

});

test.describe('Login Page - Multi-language Visual Tests', () => {
  test('Login Page - English', async ({ page }, testInfo) => {
    await page.goto('/login');
    await page.evaluate(() => localStorage.setItem('i18nextLng', 'en'));
    await page.reload();
    await expect(page.getByTestId('login-card')).toBeVisible();
    await waitForPageReady(page, '[data-testid="login-card"]');

    await takeSnapshot(page, 'Login Page - English', testInfo);
  });

});

test.describe('Register Page - Multi-language Visual Tests', () => {
  test('Register Page - English', async ({ page }, testInfo) => {
    await page.goto('/register');
    await page.evaluate(() => localStorage.setItem('i18nextLng', 'en'));
    await page.reload();
    await expect(page.getByTestId('register-card')).toBeVisible();
    await waitForPageReady(page, '[data-testid="register-card"]');

    await takeSnapshot(page, 'Register Page - English', testInfo);
  });

});

test.describe('Authenticated Pages - Multi-language Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginForVisualTest(page);
  });

  test('Dashboard - English', async ({ page }, testInfo) => {
    await page.evaluate(() => localStorage.setItem('i18nextLng', 'en'));
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await waitForPageReady(page);
    await page.waitForTimeout(500);

    await takeSnapshot(page, 'Dashboard - English', testInfo);
  });

  test('Decks Page - English', async ({ page }, testInfo) => {
    await page.evaluate(() => localStorage.setItem('i18nextLng', 'en'));
    await page.goto('/decks');
    await page.waitForLoadState('networkidle');
    await waitForPageReady(page);
    await page.waitForTimeout(500);

    await takeSnapshot(page, 'Decks Page - English', testInfo);
  });

});

test.describe('Navigation - Multi-language Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginForVisualTest(page);
  });

  test('Navigation Menu - English', async ({ page }, testInfo) => {
    await page.evaluate(() => localStorage.setItem('i18nextLng', 'en'));
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await waitForPageReady(page);

    // Focus on navigation area
    await takeSnapshot(page, 'Navigation - English', testInfo);
  });

  test('Mobile Navigation - English', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.evaluate(() => localStorage.setItem('i18nextLng', 'en'));
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await waitForPageReady(page);

    await takeSnapshot(page, 'Mobile Navigation - English', testInfo);
  });

});

// ── News Admin i18n Smoke Tests (NADM-26) ─────────────────────────────────────
//
// Assert that no raw English-only strings leak into ru locale renders.
// Strings checked: known UI labels that must be translated.
//
// These tests are marked .skip because they require admin auth + mock data.
// Remove .skip once seeding infrastructure is available.

const NEWS_MOCK_ITEM = {
  id: 'news-i18n-001',
  title_el: 'Ελληνική είδηση',
  title_en: 'Greek News Article',
  title_ru: 'Греческая новостная статья',
  description_el: 'Περιγραφή.',
  description_en: 'Article description.',
  description_ru: 'Описание статьи.',
  publication_date: '2026-01-15',
  original_article_url: 'https://example.com',
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
  alt_text: null,
  photo_credit: null,
  status: 'draft' as const,
  linked_situation: null,
};

const NEWS_MOCK_LIST = {
  items: [NEWS_MOCK_ITEM],
  total: 1,
  page: 1,
  page_size: 20,
  country_counts: { cyprus: 0, greece: 1, world: 0 },
  audio_count: 0,
  b1_audio_count: 0,
  b1_pending_regen_count: 0,
};
const ADMIN_STATS_MOCK = { total_decks: 0, total_cards: 0, total_vocabulary_decks: 0, total_vocabulary_cards: 0, total_culture_decks: 0, total_culture_questions: 0 };
const TAB_COUNTS_MOCK = { inbox: 0, decks: 0, news: 1, situations: 0, exercises: 0, errors: 0, feedback: 0, changelog: 0, announcements: 0 };

async function setupNewsAdminRoutes(page: import('@playwright/test').Page) {
  await page.route('**/api/v1/admin/stats*', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ADMIN_STATS_MOCK) });
  });
  await page.route('**/api/v1/admin/tab-counts*', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(TAB_COUNTS_MOCK) });
  });
  await page.route('**/api/v1/admin/news*', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(NEWS_MOCK_LIST) });
  });
}

// English strings that must NOT appear verbatim in the ru-locale render
const EN_ONLY_STRINGS = ['Country', 'Level', 'Source', 'Publish date', 'Add News'];

test.describe.skip('News Admin i18n Smoke — list page', () => {
  test.beforeEach(async ({ page }) => {
    await loginForVisualTest(page);
    await page.evaluate(() => {
      const raw = localStorage.getItem('auth-storage');
      if (raw) {
        const s = JSON.parse(raw);
        s.state.user.role = 'admin';
        localStorage.setItem('auth-storage', JSON.stringify(s));
      }
    });
    await setupNewsAdminRoutes(page);
  });

  test('News list — English renders without missing keys', async ({ page }, testInfo) => {
    await page.evaluate(() => localStorage.setItem('i18nextLng', 'en'));
    await page.goto('/admin?tab=news');
    await waitForPageReady(page, '[data-testid="admin-page"]');
    await page.waitForTimeout(500);

    // Verify no i18n key leakage (raw keys look like "admin.news.xxx")
    const bodyText = await page.locator('body').innerText();
    const keyLeaks = bodyText.match(/\badmin\.\w+\.\w+/g) ?? [];
    expect(keyLeaks).toHaveLength(0);

    await takeSnapshot(page, 'News Admin List — English i18n', testInfo);
  });

  test('News list — Russian locale has no leaked English-only labels', async ({ page }, testInfo) => {
    await page.evaluate(() => localStorage.setItem('i18nextLng', 'ru'));
    await page.goto('/admin?tab=news');
    await waitForPageReady(page, '[data-testid="admin-page"]');
    await page.waitForTimeout(500);

    const bodyText = await page.locator('[data-testid="admin-page"]').innerText();

    for (const enStr of EN_ONLY_STRINGS) {
      // Allow partial matches only if inside a value field (not a label)
      expect(bodyText).not.toContain(enStr);
    }

    await takeSnapshot(page, 'News Admin List — Russian i18n', testInfo);
  });
});

test.describe.skip('News Admin i18n Smoke — drawer', () => {
  test.beforeEach(async ({ page }) => {
    await loginForVisualTest(page);
    await page.evaluate(() => {
      const raw = localStorage.getItem('auth-storage');
      if (raw) {
        const s = JSON.parse(raw);
        s.state.user.role = 'admin';
        localStorage.setItem('auth-storage', JSON.stringify(s));
      }
    });
    await setupNewsAdminRoutes(page);
    await page.setViewportSize(VIEWPORTS.desktop);
  });

  test('News drawer — English renders without missing keys', async ({ page }, testInfo) => {
    await page.evaluate(() => localStorage.setItem('i18nextLng', 'en'));
    await page.goto(`/admin?tab=news&edit=${NEWS_MOCK_ITEM.id}`);
    await waitForPageReady(page, '[data-testid="admin-page"]');
    await page.waitForSelector('[data-testid="news-edit-drawer"]');
    await page.waitForTimeout(500);

    const bodyText = await page.locator('[data-testid="news-edit-drawer"]').innerText();
    const keyLeaks = bodyText.match(/\badmin\.\w+\.\w+/g) ?? [];
    expect(keyLeaks).toHaveLength(0);

    await takeSnapshot(page, 'News Admin Drawer — English i18n', testInfo);
  });

  test('News drawer — Russian locale has no leaked English-only labels', async ({ page }, testInfo) => {
    await page.evaluate(() => localStorage.setItem('i18nextLng', 'ru'));
    await page.goto(`/admin?tab=news&edit=${NEWS_MOCK_ITEM.id}`);
    await waitForPageReady(page, '[data-testid="admin-page"]');
    await page.waitForSelector('[data-testid="news-edit-drawer"]');
    await page.waitForTimeout(500);

    const drawerText = await page.locator('[data-testid="news-edit-drawer"]').innerText();

    for (const enStr of EN_ONLY_STRINGS) {
      expect(drawerText).not.toContain(enStr);
    }

    await takeSnapshot(page, 'News Admin Drawer — Russian i18n', testInfo);
  });
});
