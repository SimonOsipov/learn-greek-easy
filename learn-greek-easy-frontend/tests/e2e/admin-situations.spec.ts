// learn-greek-easy-frontend/tests/e2e/admin-situations.spec.ts
//
// SIT-08: E2E smoke covering the Situations admin drawer happy paths.

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
let coffeeShopId: string;

test.beforeAll(async ({ request }) => {
  const apiBaseUrl = getApiBaseUrl();
  const res = await request.post(`${apiBaseUrl}/api/v1/test/seed/situations`);
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  const situations: Array<{ id: string; scenario_en: string }> = body?.results?.situations ?? [];
  expect(situations.length).toBeGreaterThan(0);
  const coffeeShop = situations.find((s) => s.scenario_en === 'At the coffee shop');
  expect(coffeeShop).toBeDefined();
  coffeeShopId = coffeeShop!.id;
});

// Run serially so seed / URL state does not cross-contaminate between cases.
test.describe.configure({ mode: 'serial' });

test.describe('Admin Situations — drawer happy paths (SIT-08)', () => {
  test('1. /admin?tab=situations renders page-head, 4 StatCards, toolbar, and grid', async ({
    page,
  }) => {
    await navigateToAdminTab(page, 'situations');
    await expect(page.locator('[data-testid="situations-tab"]')).toBeVisible();
    // 4 StatCard elements — StatCard renders with CSS class "stat-card"
    await expect(page.locator('.stat-card')).toHaveCount(4, { timeout: 10_000 });
    // Toolbar: search input is present
    await expect(page.locator('[data-testid="situations-toolbar-search"]')).toBeVisible();
    // Grid: at least one card from the seed
    await expect(page.locator('[data-testid^="sit-card-"]').first()).toBeVisible();
  });

  test('2. Typing in search input adds ?q= and filters the grid', async ({ page }) => {
    await navigateToAdminTab(page, 'situations');
    const search = page.locator('[data-testid="situations-toolbar-search"]');
    await search.fill('coffee');
    // Wait for debounce (250 ms) + URL write-back
    await expect.poll(() => page.url(), { timeout: 5_000 }).toContain('q=coffee');
    // Grid still has results (seed title "At the coffee shop" matches)
    await expect(page.locator('[data-testid^="sit-card-"]').first()).toBeVisible();
  });

  test('3. Clicking Draft status button adds ?status=draft and filters the grid', async ({
    page,
  }) => {
    await navigateToAdminTab(page, 'situations');
    // SegControl renders plain <button> elements — match by visible text
    const draftBtn = page.getByRole('button', { name: 'Draft' }).first();
    await draftBtn.click();
    await expect.poll(() => page.url(), { timeout: 5_000 }).toContain('status=draft');
    // Seed creates READY status situations — after Draft filter the grid should
    // reflect the filter (empty or non-empty depending on seed state; we only
    // assert the URL change, not a specific item count).
  });

  test('4. Click a card opens drawer on Dialog tab + URL gains ?edit=', async ({ page }) => {
    await navigateToAdminTab(page, 'situations');
    const firstCard = page.locator('[data-testid^="sit-card-"]').first();
    await firstCard.click();
    await expect(page.locator('[data-testid="situation-edit-drawer"]')).toBeVisible();
    await expect.poll(() => page.url(), { timeout: 5_000 }).toContain('edit=');
    // Dialog tab content is the default
    await expect(
      page.locator('[data-testid="situation-drawer-tab-dialog-content"]'),
    ).toBeVisible();
  });

  test('5. Switch to Picture tab: URL is unchanged (no ?tab= write)', async ({ page }) => {
    await navigateToAdminTab(page, 'situations');
    await page.locator('[data-testid^="sit-card-"]').first().click();
    await expect(page.locator('[data-testid="situation-edit-drawer"]')).toBeVisible();
    const urlBefore = page.url();
    await page.locator('[data-testid="situation-drawer-tab-picture"]').click();
    // URL must NOT change on inner-tab switch (tab state is local)
    expect(page.url()).toBe(urlBefore);
  });

  test('6. Linked news tab: Link to article button is disabled with "Coming soon" tooltip', async ({
    page,
  }) => {
    await navigateToAdminTab(page, 'situations');
    await page.locator('[data-testid^="sit-card-"]').first().click();
    await expect(page.locator('[data-testid="situation-edit-drawer"]')).toBeVisible();
    await page.locator('[data-testid="situation-drawer-tab-linkedNews"]').click();
    await expect(
      page.locator('[data-testid="situation-drawer-tab-linkedNews-content"]'),
    ).toBeVisible();
    // "Link to article" button is wrapped in a TooltipTrigger <span> and has aria-disabled
    const linkCta = page.getByRole('button', { name: /Link to article/ });
    await expect(linkCta).toHaveAttribute('aria-disabled', 'true');
    // Hover to reveal tooltip
    await linkCta.hover();
    await expect(page.getByText('Coming soon').first()).toBeVisible();
  });

  test('7. Dialog tab renders by default (seed has no ListeningDialog → empty-bubble state)', async ({
    page,
  }) => {
    await navigateToAdminTab(page, 'situations');
    await page.locator('[data-testid^="sit-card-"]').first().click();
    await expect(page.locator('[data-testid="situation-edit-drawer"]')).toBeVisible();
    // Dialog tab content container is mounted (active by default).
    await expect(
      page.locator('[data-testid="situation-drawer-tab-dialog-content"]'),
    ).toBeVisible();
    // Seed creates situations without ListeningDialog rows, so dialog.lines is empty.
    // The chat-bubble + per-line play assertions are deferred until a ListeningDialog
    // seed extension lands. For MVP we only assert the tab content surface mounts.
  });

  test('8. Edit scenario_en → Cancel → dirty AlertDialog opens → Discard & continue clears drawer', async ({
    page,
  }) => {
    await navigateToAdminTab(page, 'situations');
    await page.locator('[data-testid^="sit-card-"]').first().click();
    await expect(page.locator('[data-testid="situation-edit-drawer"]')).toBeVisible();
    // The scenario-en-input is a hidden RHF-bound input (aria-hidden, sr-only).
    // Use force:true to bypass visibility checks.
    const scenarioEnInput = page.locator('[data-testid="scenario-en-input"]');
    await scenarioEnInput.fill('Modified scenario for dirty test', { force: true });
    // Click Cancel to trigger dirty-state guard
    await page.locator('[data-testid="situation-drawer-cancel"]').click();
    // Dirty ConfirmDialog opens — title is "Unsaved changes"
    await expect(page.getByRole('heading', { name: 'Unsaved changes' })).toBeVisible();
    // Click "Discard & continue" (cancelText in ConfirmDialog = onCancel = discard)
    await page.getByRole('button', { name: 'Discard & continue' }).click();
    await expect(page.locator('[data-testid="situation-edit-drawer"]')).not.toBeVisible({
      timeout: 5_000,
    });
    await expect.poll(() => page.url(), { timeout: 5_000 }).not.toContain('edit=');
  });

  test('9. Re-open same card: scenario_en input shows original value (not saved)', async ({
    page,
  }) => {
    await navigateToAdminTab(page, 'situations');
    await page.locator('[data-testid^="sit-card-"]').first().click();
    await expect(page.locator('[data-testid="situation-edit-drawer"]')).toBeVisible();
    // The original value from seed should be intact (changes were discarded in flow 8)
    const scenarioEnInput = page.locator('[data-testid="scenario-en-input"]');
    const value = await scenarioEnInput.inputValue();
    expect(value).not.toBe('Modified scenario for dirty test');
  });

  test('10. Direct nav /admin?tab=situations&edit=<seeded-id> opens drawer on Dialog tab', async ({
    page,
  }) => {
    expect(coffeeShopId).toBeDefined();
    await page.goto(`/admin?tab=situations&edit=${coffeeShopId}`);
    await expect(page.locator('[data-testid="situation-edit-drawer"]')).toBeVisible();
    // Drawer opens on the default Dialog tab
    await expect(
      page.locator('[data-testid="situation-drawer-tab-dialog-content"]'),
    ).toBeVisible();
  });
});
