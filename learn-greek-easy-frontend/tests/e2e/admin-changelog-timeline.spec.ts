/**
 * E2E Smoke Tests: Admin Changelog Timeline (CLTE-10)
 *
 * Validates the ADMIN2-06 changelog timeline + editor drawer UI without
 * depending on pre-seeded entries. Mirrors the create-via-UI pattern used by
 * admin-announcements.spec.ts so the test is robust across CI environments
 * where the changelog seed may not have persisted.
 *
 * Coverage:
 * - Navigate to the Changelog admin tab via SectionTabs.
 * - Open the editor drawer via the "New entry" CTA (compose mode); URL syncs to ?compose=1.
 * - Drawer shell renders the SidePanel composition: Form/JSON mode tabs + EN/RU language tabs.
 * - EN title input and content textarea accept input.
 * - Switching to the RU tab swaps the title/content bindings without losing EN values.
 * - Form↔JSON mode toggle re-serializes the form into the JSON textarea.
 * - Pressing Escape closes the drawer and clears compose/lang URL params.
 *
 * Auth: admin storageState (STORAGE_STATE.ADMIN from playwright.config).
 */

import { test, expect } from '@playwright/test';

import { STORAGE_STATE } from '../../playwright.config';
import { navigateToAdminTab } from './helpers/admin-helpers';

test.use({ storageState: STORAGE_STATE.ADMIN });

// Run serially so URL state doesn't cross-contaminate between cases.
test.describe.configure({ mode: 'serial' });

test.describe('Admin Changelog Timeline (CLTE-10)', () => {
  test('CLTE-E2E-01: compose drawer opens via UI → Form/JSON + EN/RU swap → Esc clears URL', async ({
    page,
  }) => {
    // ── 1. Navigate to changelog tab ────────────────────────────────────────
    await navigateToAdminTab(page, 'changelog');
    await expect(page.getByTestId('changelog-tab')).toBeVisible({ timeout: 15_000 });

    // ── 2. PageHead "New entry" button opens the compose drawer ─────────────
    await page.getByRole('button', { name: /new entry/i }).click();

    const drawer = page.getByTestId('changelog-editor-drawer');
    await expect(drawer).toBeVisible({ timeout: 5_000 });

    // URL syncs to compose=1
    await expect(page).toHaveURL(/[?&]compose=1/);

    // ── 3. Drawer shell renders all four mode/language tab buttons ──────────
    await expect(drawer.getByTestId('changelog-editor-tab-form')).toBeVisible();
    await expect(drawer.getByTestId('changelog-editor-tab-json')).toBeVisible();
    await expect(drawer.getByTestId('changelog-editor-tab-en')).toBeVisible();
    await expect(drawer.getByTestId('changelog-editor-tab-ru')).toBeVisible();

    // ── 4. EN title input accepts input ─────────────────────────────────────
    const enTitle = drawer.getByTestId('changelog-editor-title-en');
    await expect(enTitle).toBeVisible();
    await enTitle.click();
    await page.keyboard.type('CLTE-10 E2E EN title');
    await expect(enTitle).toHaveValue('CLTE-10 E2E EN title');

    // ── 5. Switch to RU tab — RU title input visible, EN value preserved ────
    await drawer.getByTestId('changelog-editor-tab-ru').click();
    const ruTitle = drawer.getByTestId('changelog-editor-title-ru');
    await expect(ruTitle).toBeVisible();
    await expect(ruTitle).toHaveValue('');

    await ruTitle.click();
    await page.keyboard.type('CLTE-10 E2E RU title');
    await expect(ruTitle).toHaveValue('CLTE-10 E2E RU title');

    // Switch back to EN — EN value still there (lang swap rebinds without unmount)
    await drawer.getByTestId('changelog-editor-tab-en').click();
    await expect(enTitle).toHaveValue('CLTE-10 E2E EN title');

    // ── 6. Form↔JSON sync — entering JSON re-serializes form state ──────────
    await drawer.getByTestId('changelog-editor-tab-json').click();
    const jsonTextarea = drawer.getByTestId('changelog-editor-json-textarea');
    await expect(jsonTextarea).toBeVisible();
    const jsonValue = await jsonTextarea.inputValue();
    expect(jsonValue).toContain('CLTE-10 E2E EN title');
    expect(jsonValue).toContain('CLTE-10 E2E RU title');

    // ── 7. Press Escape to close drawer ─────────────────────────────────────
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden({ timeout: 5_000 });

    // ── 8. URL params cleared ───────────────────────────────────────────────
    const finalUrl = new URL(page.url());
    expect(finalUrl.searchParams.get('compose')).toBeNull();
    expect(finalUrl.searchParams.get('edit')).toBeNull();
    expect(finalUrl.searchParams.get('lang')).toBeNull();
  });
});
