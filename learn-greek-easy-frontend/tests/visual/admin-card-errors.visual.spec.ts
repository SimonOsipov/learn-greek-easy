/**
 * Admin Card Errors — Visual Regression Tests (CER-58)
 *
 * Chromatic snapshots for the Card Errors rebuild (ADMIN2-22).
 * Tests use mocked API responses so they run without a live backend.
 *
 * Scenarios:
 *   1. Errors tab — list populated (WORD + CULTURE rows)
 *   2. Errors tab — empty state (no reports)
 *   3. CardErrorDrawer — Review tab (PENDING WORD report, no notes)
 *   4. CardErrorDrawer — Review tab (FIXED report, resolved banner visible)
 *   5. CardErrorDrawer — The card tab (full CardPreview, card-ID row)
 *   6. CardErrorDrawer — Meta tab (key/value grid)
 *   7. Delete confirmation AlertDialog
 */

import { test, expect } from '@chromatic-com/playwright';

import { navigateToAdminTab } from '../e2e/helpers/admin-helpers';
import {
  loginForVisualTest,
  takeSnapshot,
  waitForPageReady,
  VIEWPORTS,
} from './helpers/visual-helpers';

// ── Mock payloads ────────────────────────────────────────────────────────────

const WORD_PENDING = {
  id: 'cer-vis-001',
  card_id: 'card-uuid-vis-001',
  card_type: 'WORD',
  user_id: 'user-vis-001',
  description: 'The article for this word seems wrong — should be "η" not "ο".',
  status: 'PENDING',
  admin_notes: null,
  resolved_by: null,
  resolved_at: null,
  reporter: { id: 'user-vis-001', full_name: 'Maria Papadaki' },
  resolver: null,
  card: {
    word: 'αδερφή',
    article: 'η',
    translation_en: 'sister',
    translation_ru: 'сестра',
    gender: 'f',
    plural: 'αδερφές',
    ipa: 'aˈðerfi',
  },
  deck: { id: 'deck-vis-001', name: 'A1 Basics' },
  created_at: '2026-05-10T14:00:00Z',
  updated_at: '2026-05-10T14:00:00Z',
};

const CULTURE_PENDING = {
  id: 'cer-vis-002',
  card_id: 'card-uuid-vis-002',
  card_type: 'CULTURE',
  user_id: 'user-vis-002',
  description: 'Option B looks correct but is marked wrong.',
  status: 'PENDING',
  admin_notes: null,
  resolved_by: null,
  resolved_at: null,
  reporter: { id: 'user-vis-002', full_name: 'Nikos Stavros' },
  resolver: null,
  card: {
    question_en: 'What is the capital of Greece?',
    question_el: 'Ποια είναι η πρωτεύουσα της Ελλάδας;',
    options: ['Athens', 'Sparta', 'Thebes', 'Corinth'],
    correct_index: 0,
    level: 'A2',
  },
  deck: { id: 'deck-vis-002', name: 'Culture A2' },
  created_at: '2026-05-11T09:30:00Z',
  updated_at: '2026-05-11T09:30:00Z',
};

const WORD_FIXED = {
  id: 'cer-vis-003',
  card_id: 'card-uuid-vis-003',
  card_type: 'WORD',
  user_id: 'user-vis-003',
  description: 'IPA was missing for this entry.',
  status: 'FIXED',
  admin_notes: 'Added IPA transcription — thanks for reporting.',
  resolved_by: 'admin-vis-001',
  resolved_at: '2026-05-12T11:00:00Z',
  reporter: { id: 'user-vis-003', full_name: 'Elena Kostopoulou' },
  resolver: { id: 'admin-vis-001', full_name: 'Admin User' },
  card: {
    word: 'μήλο',
    article: 'το',
    translation_en: 'apple',
    translation_ru: 'яблоко',
    gender: 'n',
    plural: 'μήλα',
    ipa: 'ˈmilo',
  },
  deck: { id: 'deck-vis-001', name: 'A1 Basics' },
  created_at: '2026-05-09T08:00:00Z',
  updated_at: '2026-05-12T11:00:00Z',
};

const MOCK_LIST = {
  items: [WORD_PENDING, CULTURE_PENDING, WORD_FIXED],
  total: 3,
  page: 1,
  page_size: 20,
  total_pages: 1,
  pending_count: 2,
  fixed_count: 1,
  dismissed_count: 0,
  reviewed_count: 0,
};

const MOCK_EMPTY_LIST = {
  items: [],
  total: 0,
  page: 1,
  page_size: 20,
  total_pages: 0,
  pending_count: 0,
  fixed_count: 0,
  dismissed_count: 0,
  reviewed_count: 0,
};

// ── Helper: set up admin auth and mock card-errors API ───────────────────────

async function setupAdminWithMockedErrors(
  page: Parameters<typeof loginForVisualTest>[0],
  listPayload = MOCK_LIST
) {
  await loginForVisualTest(page);

  // Override localStorage role to admin
  await page.evaluate(() => {
    const authStorage = localStorage.getItem('auth-storage');
    if (authStorage) {
      const s = JSON.parse(authStorage);
      if (s?.state?.user) s.state.user.role = 'admin';
      localStorage.setItem('auth-storage', JSON.stringify(s));
    }
  });

  // Mock the card-errors list endpoint
  await page.route('**/api/v1/admin/card-errors*', (route) => {
    const url = route.request().url();
    // Detail endpoint — returns first WORD_PENDING by default
    if (url.match(/\/card-errors\/[^/?#]+$/)) {
      const id = url.split('/').pop();
      const found = [WORD_PENDING, CULTURE_PENDING, WORD_FIXED].find((r) => r.id === id);
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(found ?? WORD_PENDING),
      });
      return;
    }
    // List endpoint
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(listPayload),
    });
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe('Admin Card Errors — Visual (CER-58)', () => {
  // 1. Populated list ──────────────────────────────────────────────────────────

  test('Card errors list — populated (WORD + CULTURE rows)', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setupAdminWithMockedErrors(page);

    await page.goto('/admin');
    await waitForPageReady(page, '[data-testid="admin-page"]');
    await navigateToAdminTab(page, 'errors');

    await expect(page.getByTestId('admin-card-error-section')).toBeVisible({ timeout: 10_000 });
    // Wait for rows
    await expect(page.locator('[data-testid="admin-card-error-card"]').first()).toBeVisible({
      timeout: 10_000,
    });
    await page.waitForTimeout(300);

    await takeSnapshot(page, 'Card errors list — populated', testInfo);
  });

  // 2. Empty list ──────────────────────────────────────────────────────────────

  test('Card errors list — empty state', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setupAdminWithMockedErrors(page, MOCK_EMPTY_LIST);

    await page.goto('/admin');
    await waitForPageReady(page, '[data-testid="admin-page"]');
    await navigateToAdminTab(page, 'errors');

    await expect(page.getByTestId('admin-card-error-section')).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(300);

    await takeSnapshot(page, 'Card errors list — empty state', testInfo);
  });

  // 3. Drawer — Review tab PENDING ────────────────────────────────────────────

  test('CardErrorDrawer — Review tab (PENDING WORD, no notes)', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setupAdminWithMockedErrors(page);

    await page.goto('/admin');
    await waitForPageReady(page, '[data-testid="admin-page"]');
    await navigateToAdminTab(page, 'errors');

    await expect(page.locator('[data-testid="admin-card-error-card"]').first()).toBeVisible({
      timeout: 10_000,
    });
    await page.locator('[data-testid="admin-card-error-card"]').first().click();

    await expect(page.getByTestId('card-error-drawer')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('drawer-tab-review')).toBeVisible();
    await page.waitForTimeout(300);

    await takeSnapshot(page, 'CardErrorDrawer — Review tab PENDING', testInfo);
  });

  // 4. Drawer — Review tab FIXED (resolved banner) ────────────────────────────

  test('CardErrorDrawer — Review tab (FIXED, resolved banner)', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setupAdminWithMockedErrors(page);

    await page.goto('/admin');
    await waitForPageReady(page, '[data-testid="admin-page"]');
    await navigateToAdminTab(page, 'errors');

    // Click the 3rd card (WORD_FIXED)
    await expect(page.locator('[data-testid="admin-card-error-card"]').nth(2)).toBeVisible({
      timeout: 10_000,
    });
    await page.locator('[data-testid="admin-card-error-card"]').nth(2).click();

    await expect(page.getByTestId('card-error-drawer')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('resolved-banner')).toBeVisible({ timeout: 5_000 });
    await page.waitForTimeout(300);

    await takeSnapshot(page, 'CardErrorDrawer — Review tab FIXED resolved banner', testInfo);
  });

  // 5. Drawer — The card tab ──────────────────────────────────────────────────

  test('CardErrorDrawer — The card tab (full CardPreview + card-ID row)', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setupAdminWithMockedErrors(page);

    await page.goto('/admin');
    await waitForPageReady(page, '[data-testid="admin-page"]');
    await navigateToAdminTab(page, 'errors');

    await expect(page.locator('[data-testid="admin-card-error-card"]').first()).toBeVisible({
      timeout: 10_000,
    });
    await page.locator('[data-testid="admin-card-error-card"]').first().click();

    await expect(page.getByTestId('card-error-drawer')).toBeVisible({ timeout: 5_000 });
    await page.getByTestId('card-error-drawer-tab-theCard').click();
    await expect(page.getByTestId('drawer-tab-theCard')).toBeVisible();
    await page.waitForTimeout(300);

    await takeSnapshot(page, 'CardErrorDrawer — The card tab', testInfo);
  });

  // 6. Drawer — Meta tab ─────────────────────────────────────────────────────

  test('CardErrorDrawer — Meta tab (key/value grid)', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setupAdminWithMockedErrors(page);

    await page.goto('/admin');
    await waitForPageReady(page, '[data-testid="admin-page"]');
    await navigateToAdminTab(page, 'errors');

    await expect(page.locator('[data-testid="admin-card-error-card"]').first()).toBeVisible({
      timeout: 10_000,
    });
    await page.locator('[data-testid="admin-card-error-card"]').first().click();

    await expect(page.getByTestId('card-error-drawer')).toBeVisible({ timeout: 5_000 });
    await page.getByTestId('card-error-drawer-tab-meta').click();
    await expect(page.getByTestId('drawer-tab-meta')).toBeVisible();
    await page.waitForTimeout(300);

    await takeSnapshot(page, 'CardErrorDrawer — Meta tab', testInfo);
  });

  // 7. Delete confirmation AlertDialog ────────────────────────────────────────

  test('CardErrorDrawer — Delete confirmation dialog', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setupAdminWithMockedErrors(page);

    await page.goto('/admin');
    await waitForPageReady(page, '[data-testid="admin-page"]');
    await navigateToAdminTab(page, 'errors');

    await expect(page.locator('[data-testid="admin-card-error-card"]').first()).toBeVisible({
      timeout: 10_000,
    });
    await page.locator('[data-testid="admin-card-error-card"]').first().click();

    await expect(page.getByTestId('card-error-drawer')).toBeVisible({ timeout: 5_000 });
    await page.getByTestId('delete-button').click();
    await expect(page.getByTestId('delete-confirm-button')).toBeVisible({ timeout: 5_000 });
    await page.waitForTimeout(300);

    await takeSnapshot(page, 'CardErrorDrawer — Delete confirmation dialog', testInfo);
  });
});
