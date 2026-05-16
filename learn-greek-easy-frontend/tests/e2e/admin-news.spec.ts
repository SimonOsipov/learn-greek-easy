// learn-greek-easy-frontend/tests/e2e/admin-news.spec.ts
//
// NEWS-10: E2E smoke covering the News card grid + drawer happy paths.

import { expect, test } from '@playwright/test';

import { STORAGE_STATE } from '../../playwright.config';

import { navigateToAdminTab } from './helpers/admin-helpers';

test.use({ storageState: STORAGE_STATE.ADMIN });

// ── Helpers ───────────────────────────────────────────────────────────────────

function getApiBaseUrl(): string {
  return process.env.E2E_API_URL || process.env.VITE_API_URL || 'http://localhost:8000';
}

// ── Seed ──────────────────────────────────────────────────────────────────────

// Capture a stable id for the direct deep-link test (set in beforeAll).
let firstItemId: string;

test.beforeAll(async ({ request }) => {
  const apiBaseUrl = getApiBaseUrl();
  const res = await request.post(`${apiBaseUrl}/api/v1/test/seed/news-feed`);
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  const items: Array<{ id: string; publication_date: string }> = body?.results?.news_items ?? [];
  expect(items.length).toBeGreaterThan(0);
  firstItemId = items[0].id;
});

// Run serially so seed / URL state does not cross-contaminate between cases.
test.describe.configure({ mode: 'serial' });

test.describe('Admin News — drawer happy paths (NEWS-10)', () => {
  test('1. /admin?tab=news renders shell with page-head, 4 stat cards, toolbar, grid', async ({
    page,
  }) => {
    await navigateToAdminTab(page, 'news');
    await expect(page.locator('[data-testid="news-tab"]')).toBeVisible();
    // 4 StatCard elements — StatCard renders with CSS class "stat-card"
    await expect(page.locator('.stat-card')).toHaveCount(4, { timeout: 10_000 });
    // Toolbar: Country SegControl includes an "All" button
    await expect(page.getByRole('button', { name: 'All' }).first()).toBeVisible();
    // Grid: at least one card from the seed
    await expect(page.locator('.news-card').first()).toBeVisible();
  });

  test('2. Typing in search input adds ?q= and filters the grid', async ({ page }) => {
    await navigateToAdminTab(page, 'news');
    const search = page.getByTestId('news-toolbar-search');
    await search.fill('E2E');
    // Wait for debounce (250 ms) + URL write-back
    await expect.poll(() => page.url(), { timeout: 5_000 }).toContain('q=E2E');
    // Grid still has results (seed titles contain "E2E")
    await expect(page.locator('.news-card').first()).toBeVisible();
  });

  test('3. Clicking a country SegControl option adds ?country= and filters', async ({ page }) => {
    await navigateToAdminTab(page, 'news');
    // Click the Greece SegControl button by its visible label
    const greeceBtn = page.getByRole('button', { name: /🇬🇷 GR/ }).first();
    await greeceBtn.click();
    await expect.poll(() => page.url(), { timeout: 5_000 }).toContain('country=greece');
  });

  test('4. Click a card opens drawer on Translations tab + URL gains ?edit=', async ({ page }) => {
    await navigateToAdminTab(page, 'news');
    const firstCard = page.locator('.news-card').first();
    await firstCard.click();
    await expect(page.locator('[data-testid="news-edit-drawer"]')).toBeVisible();
    await expect.poll(() => page.url(), { timeout: 5_000 }).toContain('edit=');
    // Translations tab content is the default
    await expect(page.locator('[data-testid="news-drawer-tab-translations-content"]')).toBeVisible();
  });

  test('5. Audio tab: URL unchanged, B2 row renders 60 waveform bars, B1 Play disabled', async ({
    page,
  }) => {
    await navigateToAdminTab(page, 'news');
    await page.locator('.news-card').first().click();
    await expect(page.locator('[data-testid="news-edit-drawer"]')).toBeVisible();
    const urlBefore = page.url();
    await page.locator('[data-testid="news-drawer-tab-audio"]').click();
    // URL must NOT change on tab switch (inner-tab is local state)
    expect(page.url()).toBe(urlBefore);
    await expect(page.locator('[data-testid="news-drawer-tab-audio-content"]')).toBeVisible();
    // Scope to first .audio-row (B2) — 60 decorative waveform bars
    const b2Bars = page
      .locator('[data-testid="news-drawer-tab-audio-content"] .audio-row')
      .first()
      .locator('.audio-wave');
    await expect(b2Bars).toHaveCount(60);
    // B1 row is third .audio-row — Play button must be aria-disabled
    const b1Row = page
      .locator('[data-testid="news-drawer-tab-audio-content"] .audio-row')
      .nth(2);
    await expect(b1Row.locator('button[aria-disabled="true"]').first()).toBeVisible();
  });

  test('6. Linked situation tab: Generate button disabled with Tooltip "Coming soon"', async ({
    page,
  }) => {
    await navigateToAdminTab(page, 'news');
    await page.locator('.news-card').first().click();
    await expect(page.locator('[data-testid="news-edit-drawer"]')).toBeVisible();
    await page.locator('[data-testid="news-drawer-tab-linkedSituation"]').click();
    await expect(
      page.locator('[data-testid="news-drawer-tab-linkedSituation-content"]'),
    ).toBeVisible();
    const generateBtn = page.getByRole('button', { name: /Generate situation/ });
    await expect(generateBtn).toHaveAttribute('aria-disabled', 'true');
    // Hover to reveal tooltip
    await generateBtn.hover();
    await expect(page.getByText('Coming soon').first()).toBeVisible();
  });

  test('7. Edit EN title then Cancel → dirty Dialog → Discard & continue clears ?edit=', async ({
    page,
  }) => {
    await navigateToAdminTab(page, 'news');
    await page.locator('.news-card').first().click();
    await expect(page.locator('[data-testid="news-edit-drawer"]')).toBeVisible();
    // Dirty the form
    const titleEn = page.locator('[data-testid="news-drawer-translations-title-en"]');
    await titleEn.fill('Modified title for dirty test');
    // Click Cancel
    await page.locator('[data-testid="news-drawer-cancel"]').click();
    // Dirty ConfirmDialog opens — title is "Unsaved changes"
    await expect(page.getByText('Unsaved changes')).toBeVisible();
    // Click "Discard & continue" (cancel button on ConfirmDialog = onCancel = discard)
    await page.getByRole('button', { name: 'Discard & continue' }).click();
    await expect(page.locator('[data-testid="news-edit-drawer"]')).not.toBeVisible({
      timeout: 5_000,
    });
    await expect.poll(() => page.url(), { timeout: 5_000 }).not.toContain('edit=');
  });

  test('8. Hover Delete icon → delete dialog → no auto-focus on destructive → Esc closes', async ({
    page,
  }) => {
    await navigateToAdminTab(page, 'news');
    const firstCard = page.locator('.news-card').first();
    await firstCard.hover();
    // Click the Delete icon button (aria-label="Delete" set in NewsCard)
    const deleteBtn = firstCard.locator('button[aria-label="Delete"]');
    await deleteBtn.click();
    await expect(page.locator('[data-testid="news-delete-dialog"]')).toBeVisible();
    // Cancel button is focused (AlertDialog auto-focuses first action — AlertDialogCancel comes first)
    const cancelBtn = page.locator('[data-testid="news-delete-cancel"]');
    await expect(cancelBtn).toBeFocused();
    // Esc closes
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="news-delete-dialog"]')).not.toBeVisible({
      timeout: 5_000,
    });
  });

  test('9. Direct nav /admin?tab=news&edit=<id> opens drawer on Translations tab', async ({
    page,
  }) => {
    expect(firstItemId).toBeDefined();
    await page.goto(`/admin?tab=news&edit=${firstItemId}`);
    await expect(page.locator('[data-testid="news-edit-drawer"]')).toBeVisible();
    await expect(page.locator('[data-testid="news-drawer-tab-translations-content"]')).toBeVisible();
  });
});
