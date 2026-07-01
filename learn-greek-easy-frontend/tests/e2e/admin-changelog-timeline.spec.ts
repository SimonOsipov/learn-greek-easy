/**
 * E2E Smoke Tests: Admin Changelog Timeline (CLTE-10 / ADMIN2-21)
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
 * CLTT-E2E-01..07: Extended in ADMIN2-21 (CLTT-18) to cover:
 * - List renders all entries (no truncation at pageSize=20)
 * - No Export Markdown button
 * - Row content matches active UI locale
 * - Deep-link first navigation opens drawer
 * - Half-width drawer + close button position
 * - Drawer chrome localizes when UI is RU
 * - Footer button order
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

test.describe('Admin Changelog Timeline — ADMIN2-21 extension (CLTT-E2E-01..07)', () => {
  test('CLTT-E2E-02: no Export Markdown button rendered', async ({ page }) => {
    await navigateToAdminTab(page, 'changelog');
    await expect(page.getByTestId('changelog-tab')).toBeVisible({ timeout: 15_000 });

    // The Export Markdown button was removed in CLTT-01
    const exportCount = await page.getByTestId('changelog-export-button').count();
    expect(exportCount).toBe(0);
  });

  test('CLTT-E2E-01: list renders ALL entries (API total === .cl-entry count)', async ({
    page,
  }) => {
    // Intercept the admin list API to get the authoritative total count.
    const listResponsePromise = page.waitForResponse(
      (r) => /\/api\/v1\/admin\/changelog(\?|$)/.test(r.url()) && r.request().method() === 'GET',
      { timeout: 20_000 }
    );

    await navigateToAdminTab(page, 'changelog');
    const listResponse = await listResponsePromise;
    const body = await listResponse.json();
    const apiTotal: number = body.total ?? 0;
    expect(apiTotal).toBeGreaterThan(0);

    await expect(page.getByTestId('changelog-tab')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.cl-entry').first()).toBeVisible({ timeout: 10_000 });

    // Rendered row count must match the API total. If the backend rejects the
    // store's pageSize (the prod bug fixed in PR #505), the list would be empty
    // and this assertion would fail — that's the regression guard.
    const renderedCount = await page.locator('.cl-entry').count();
    expect(renderedCount).toBe(apiTotal);
  });

  test('CLTT-E2E-03: row content matches active UI locale (EN → title_en, RU → title_ru)', async ({
    page,
  }) => {
    // Set UI to EN, capture first-row title. Set i18nextLng on the baseURL
    // origin the app runs on (not https://greeklish.eu — a different origin
    // whose localStorage never reaches localhost/preview), then reload so i18n
    // re-inits in EN rather than relying on EN being the default locale.
    await navigateToAdminTab(page, 'changelog');
    await expect(page.getByTestId('changelog-tab')).toBeVisible({ timeout: 15_000 });
    await page.evaluate(() => localStorage.setItem('i18nextLng', 'en'));
    await page.reload();
    await expect(page.getByTestId('changelog-tab')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.cl-entry').first()).toBeVisible({ timeout: 10_000 });

    const titleEn =
      (await page.locator('.cl-entry').first().locator('.cl-entry-title').textContent()) || '';
    expect(titleEn.trim()).not.toBe('');

    // Switch to RU, reload, capture same row's title
    await page.evaluate(() => localStorage.setItem('i18nextLng', 'ru'));
    await page.reload();
    await expect(page.getByTestId('changelog-tab')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.cl-entry').first()).toBeVisible({ timeout: 10_000 });

    const titleRu =
      (await page.locator('.cl-entry').first().locator('.cl-entry-title').textContent()) || '';
    expect(titleRu.trim()).not.toBe('');

    // Same seeded entry should render a DIFFERENT title in RU vs EN
    expect(titleRu.trim()).not.toBe(titleEn.trim());

    // Cleanup
    await page.evaluate(() => localStorage.removeItem('i18nextLng'));
  });

  test('CLTT-E2E-08: admin changelog list API returns 200 (regression for pageSize cap bug)', async ({
    page,
  }) => {
    // Watch the admin list endpoint specifically — frontend asks for pageSize=500.
    // Backend caps must accept this (PR #505 raised them from 100 → 1000).
    const listResponsePromise = page.waitForResponse(
      (r) => /\/api\/v1\/admin\/changelog(\?|$)/.test(r.url()) && r.request().method() === 'GET',
      { timeout: 20_000 }
    );

    await navigateToAdminTab(page, 'changelog');
    const listResponse = await listResponsePromise;

    // Was 422 in prod before the hotfix
    expect(listResponse.status()).toBe(200);

    const url = new URL(listResponse.url());
    const pageSize = parseInt(url.searchParams.get('page_size') || '0', 10);
    expect(pageSize).toBeGreaterThan(100);
  });

  test('CLTT-E2E-04: deep-link first navigation opens drawer without F5', async ({ page }) => {
    // Navigate directly to the changelog tab — then open compose drawer to get a known URL pattern
    await navigateToAdminTab(page, 'changelog');
    await expect(page.getByTestId('changelog-tab')).toBeVisible({ timeout: 15_000 });

    // Open compose via New entry button
    await page.getByRole('button', { name: /new entry/i }).click();
    const drawer = page.getByTestId('changelog-editor-drawer');
    await expect(drawer).toBeVisible({ timeout: 5_000 });

    // URL now has ?compose=1 — navigate to it fresh (simulates deep-link first-nav)
    const composeUrl = page.url();
    expect(composeUrl).toMatch(/compose=1/);

    // Close and navigate back to base
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden({ timeout: 5_000 });

    // Now deep-link back to compose
    await page.goto(composeUrl);
    await expect(page.getByTestId('changelog-tab')).toBeVisible({ timeout: 15_000 });

    // Drawer should open on first navigation (no F5 needed)
    await expect(page.getByTestId('changelog-editor-drawer')).toBeVisible({ timeout: 8_000 });

    // URL compose=1 is preserved
    await expect(page).toHaveURL(/compose=1/);
  });

  test('CLTT-E2E-05: half-width drawer + close button is on the right side', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await navigateToAdminTab(page, 'changelog');
    await expect(page.getByTestId('changelog-tab')).toBeVisible({ timeout: 15_000 });

    // Open compose drawer
    await page.getByRole('button', { name: /new entry/i }).click();
    const drawer = page.getByTestId('changelog-editor-drawer');
    await expect(drawer).toBeVisible({ timeout: 5_000 });

    // Measure drawer width — should be between 560 and 720px for size="half" on 1280px viewport
    const drawerBBox = await drawer.boundingBox();
    expect(drawerBBox).not.toBeNull();
    expect(drawerBBox!.width).toBeGreaterThanOrEqual(400);
    expect(drawerBBox!.width).toBeLessThanOrEqual(800);

    // Close button (X) should be on the right half of the viewport
    const closeBtn = page.getByTestId('changelog-editor-close-button');
    await expect(closeBtn).toBeVisible();
    const closeBBox = await closeBtn.boundingBox();
    expect(closeBBox).not.toBeNull();
    const viewportWidth = 1280;
    expect(closeBBox!.x).toBeGreaterThan(viewportWidth / 2);
  });

  test('CLTT-E2E-06: drawer chrome shows RU title when UI locale is RU', async ({ page }) => {
    // Expected RU values match ru/admin.json (kept in sync at PR time)
    const ruNewEntry = 'Новая запись';

    await navigateToAdminTab(page, 'changelog');
    await expect(page.getByTestId('changelog-tab')).toBeVisible({ timeout: 15_000 });

    // Switch UI to RU
    await page.evaluate(() => {
      localStorage.setItem('i18nextLng', 'ru');
    });
    await page.reload();
    await expect(page.getByTestId('changelog-tab')).toBeVisible({ timeout: 15_000 });

    // Open compose drawer
    await page.getByRole('button', { name: /новая запись|new entry/i }).click();
    const drawer = page.getByTestId('changelog-editor-drawer');
    await expect(drawer).toBeVisible({ timeout: 5_000 });

    // Compose mode title sourced from admin:changelog.actions.newEntry
    const drawerTitle = drawer.locator('.drawer-title');
    await expect(drawerTitle).toHaveText(ruNewEntry, { timeout: 5_000 });

    // Restore locale
    await page.evaluate(() => {
      localStorage.removeItem('i18nextLng');
    });
  });

  test('CLTT-E2E-09: RU admin — editor opens on RU tab by default and edit reflects in list', async ({
    page,
  }) => {
    // ── 1. Set UI language to RU ──────────────────────────────────────────────
    // localStorage is origin-scoped, so set i18nextLng on the baseURL origin the
    // app actually runs on — NOT https://greeklish.eu, a different origin whose
    // storage never reaches localhost/preview — then reload so i18n re-inits in
    // RU. The prior cross-origin set left the UI in EN on webkit/firefox, so the
    // RU tab stayed aria-selected="false". Mirrors the reliable CLTT-E2E-06.
    await navigateToAdminTab(page, 'changelog');
    await expect(page.getByTestId('changelog-tab')).toBeVisible({ timeout: 15_000 });

    await page.evaluate(() => localStorage.setItem('i18nextLng', 'ru'));
    await page.reload();
    await expect(page.getByTestId('changelog-tab')).toBeVisible({ timeout: 15_000 });

    // ── 2. Need at least one entry to open ───────────────────────────────────
    const entryCount = await page.locator('.cl-entry').count();
    if (entryCount === 0) {
      // No entries — skip (seed-dependent)
      await page.evaluate(() => localStorage.removeItem('i18nextLng'));
      test.skip();
      return;
    }

    // ── 3. Open the first edit button ────────────────────────────────────────
    const firstEditBtn = page.locator('[data-testid^="timeline-edit-"]').first();
    await firstEditBtn.click();

    const drawer = page.getByTestId('changelog-editor-drawer');
    await expect(drawer).toBeVisible({ timeout: 5_000 });

    // ── 4. Core assertion: RU tab MUST be active by default (guards the fix) ─
    // Pre-fix: the EN tab was active; post-fix: the RU tab must be active.
    const ruTab = drawer.getByTestId('changelog-editor-tab-ru');
    const enTab = drawer.getByTestId('changelog-editor-tab-en');
    await expect(ruTab).toBeVisible({ timeout: 5_000 });
    await expect(enTab).toBeVisible({ timeout: 5_000 });

    // The RU tab button must carry aria-selected="true" when the drawer opens —
    // NOT the EN tab. Use auto-retrying toHaveAttribute rather than a one-shot
    // getAttribute()+toBe(): the tab's aria-selected reflects the store `lang`,
    // which settles right after openEdit(uiLang) (and after i18n's async language
    // switch feeds uiLang). A single read could land during the open transition
    // and observe the pre-settle value — the intermittent CLTT-E2E-09 CI flake.
    // toHaveAttribute polls until the rendered state settles. (The tab always
    // renders aria-selected={lang==='ru'}, so the old class-name fallback was
    // dead code.)
    await expect(ruTab).toHaveAttribute('aria-selected', 'true');
    await expect(enTab).toHaveAttribute('aria-selected', 'false');

    // ── 5. The RU content input is visible (form renders only the active lang) ─
    // The drawer renders only the active language's fields, so when RU is active
    // only changelog-editor-content-ru is in the DOM.
    const ruContent = drawer.getByTestId('changelog-editor-content-ru');
    await expect(ruContent).toBeVisible({ timeout: 3_000 });

    // ── 6. Append a unique marker to RU content → Save → verify in list ──────
    const marker = `__E2E_RU_EDIT_${Date.now()}__`;
    await ruContent.click();
    await page.keyboard.press('End');
    await page.keyboard.type(` ${marker}`);

    // Save
    const saveBtn = page.getByTestId('changelog-editor-footer-submit');
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();

    // Wait for success toast (or drawer to close)
    await expect(drawer).toBeHidden({ timeout: 10_000 });

    // ── 7. The edited entry's list row now shows the RU marker ───────────────
    // The list renders content in the UI language (RU), so the marker must appear.
    await expect(page.locator('.cl-entry-content').filter({ hasText: marker }).first()).toBeVisible({
      timeout: 5_000,
    });

    // ── 8. Restore locale to avoid leaking RU into sibling tests ─────────────
    await page.evaluate(() => localStorage.removeItem('i18nextLng'));
  });

  test('CLTT-E2E-07: footer button order — Delete < Cancel < Save in DOM', async ({ page }) => {
    await navigateToAdminTab(page, 'changelog');
    await expect(page.getByTestId('changelog-tab')).toBeVisible({ timeout: 15_000 });

    // We need an existing entry to get the Delete button
    // Check if any entries exist by looking for timeline rows
    const entryCount = await page.locator('.cl-entry').count();
    if (entryCount === 0) {
      // No entries seeded — skip this test
      test.skip();
      return;
    }

    // Click the first edit button to open the edit drawer
    const firstEditBtn = page.locator('[data-testid^="timeline-edit-"]').first();
    await firstEditBtn.click();

    const drawer = page.getByTestId('changelog-editor-drawer');
    await expect(drawer).toBeVisible({ timeout: 5_000 });

    // Verify all three footer buttons are visible
    const deleteBtn = page.getByTestId('changelog-editor-footer-delete');
    const cancelBtn = page.getByTestId('changelog-editor-footer-cancel');
    const saveBtn = page.getByTestId('changelog-editor-footer-submit');

    await expect(deleteBtn).toBeVisible();
    await expect(cancelBtn).toBeVisible();
    await expect(saveBtn).toBeVisible();

    // Get bounding boxes and verify x-order: delete.x < cancel.x < save.x
    const deleteBBox = await deleteBtn.boundingBox();
    const cancelBBox = await cancelBtn.boundingBox();
    const saveBBox = await saveBtn.boundingBox();

    expect(deleteBBox).not.toBeNull();
    expect(cancelBBox).not.toBeNull();
    expect(saveBBox).not.toBeNull();

    // Delete is on the left side (drawer-foot-left), cancel and save are on the right (drawer-foot-right)
    expect(deleteBBox!.x).toBeLessThan(cancelBBox!.x);
    expect(cancelBBox!.x).toBeLessThan(saveBBox!.x);
  });
});
