/**
 * E2E Smoke Tests: Admin Changelog Timeline (CLTE-10)
 *
 * Validates the ADMIN2-06 changelog timeline + editor drawer UI:
 * - Timeline renders with month headers after seed
 * - Clicking a row opens the editor drawer with prefilled EN fields
 * - Switching to RU tab reveals the RU title input
 * - Typing in RU title is reflected; URL contains edit=<id>&lang=ru
 * - Pressing Escape closes the drawer and URL params are cleared
 *
 * Auth: admin storageState (STORAGE_STATE.ADMIN from playwright.config).
 * Does NOT start a local server — runs against CI preview / production-like environment.
 */

import { test, expect } from '@playwright/test';

import { STORAGE_STATE } from '../../playwright.config';
import { navigateToAdminTab } from './helpers/admin-helpers';

// ─── Auth ────────────────────────────────────────────────────────────────────

test.use({ storageState: STORAGE_STATE.ADMIN });

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getApiBaseUrl(): string {
  return process.env.E2E_API_URL || process.env.VITE_API_URL || 'http://localhost:8000';
}

async function seedChangelog(
  request: import('@playwright/test').APIRequestContext
): Promise<void> {
  const apiBaseUrl = getApiBaseUrl();
  const response = await request.post(`${apiBaseUrl}/api/v1/test/seed/changelog`);
  if (!response.ok()) {
    throw new Error(`Seeding failed: ${response.status()} ${await response.text()}`);
  }
}

// ─── Test suite ───────────────────────────────────────────────────────────────

// Run serially so seed / URL state doesn't cross-contaminate between cases.
test.describe.configure({ mode: 'serial' });

test.describe('Admin Changelog Timeline (CLTE-10)', () => {
  test.beforeAll(async ({ request }) => {
    await seedChangelog(request);
  });

  test('CLTE-E2E-01: timeline → row click → drawer prefilled → RU tab → type → Esc → URL cleared', async ({
    page,
  }) => {
    // ── 1. Navigate to changelog tab ────────────────────────────────────────
    await navigateToAdminTab(page, 'changelog');
    await expect(page.getByTestId('changelog-tab')).toBeVisible({ timeout: 15_000 });

    // ── 2. Timeline renders ──────────────────────────────────────────────────
    const timeline = page.locator('.cl-timeline');
    await expect(timeline).toBeVisible();

    // ── 3. At least one month header is visible ──────────────────────────────
    await expect(timeline.locator('.cl-month-head').first()).toBeVisible();

    // ── 4. Click the first clickable row ────────────────────────────────────
    const firstRow = timeline.locator('.cl-entry.is-clickable').first();
    await expect(firstRow).toBeVisible();
    await firstRow.click();

    // ── 5. Editor drawer opens ───────────────────────────────────────────────
    const drawer = page.getByTestId('changelog-editor-drawer');
    await expect(drawer).toBeVisible({ timeout: 5_000 });

    // ── 6. EN title input is prefilled ──────────────────────────────────────
    const enTitle = drawer.getByTestId('changelog-editor-title-en');
    await expect(enTitle).toBeVisible();
    await expect(enTitle).not.toHaveValue('');

    // ── 7. URL reflects the open entry ──────────────────────────────────────
    await expect(page).toHaveURL(/[?&]edit=/);

    // ── 8. Switch to RU tab ─────────────────────────────────────────────────
    await drawer.getByTestId('changelog-editor-tab-ru').click();

    // ── 9. RU title input is now visible ────────────────────────────────────
    const ruTitle = drawer.getByTestId('changelog-editor-title-ru');
    await expect(ruTitle).toBeVisible();

    // ── 10. Type into RU title ───────────────────────────────────────────────
    await ruTitle.click();
    await page.keyboard.type(' E2E');
    await expect(ruTitle).toHaveValue(/ E2E$/);

    // ── 11. URL contains edit=<id>&lang=ru ───────────────────────────────────
    await expect(page).toHaveURL(/[?&]lang=ru/);
    const urlAfterRu = new URL(page.url());
    expect(urlAfterRu.searchParams.get('edit')).toBeTruthy();
    expect(urlAfterRu.searchParams.get('lang')).toBe('ru');

    // ── 12. Press Escape to close drawer ────────────────────────────────────
    await page.keyboard.press('Escape');

    // ── 13. Drawer is no longer visible ─────────────────────────────────────
    await expect(drawer).toBeHidden({ timeout: 5_000 });

    // ── 14. URL params cleared ───────────────────────────────────────────────
    const urlAfterClose = new URL(page.url());
    expect(urlAfterClose.searchParams.get('edit')).toBeNull();
    expect(urlAfterClose.searchParams.get('lang')).toBeNull();
  });
});
