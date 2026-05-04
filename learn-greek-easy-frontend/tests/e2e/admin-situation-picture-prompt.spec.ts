/**
 * Admin Situation Picture Prompt E2E Tests
 *
 * Tests for the admin Picture tab inside SituationDetailModal covering:
 * - Happy path: edit scene_en + style_en, save, assert persisted values + recomposed image_prompt
 * - Negative path: situation without a picture row shows empty state, hides the form
 *
 * Test User:
 * - e2e_admin: Admin user with access to admin panel
 *
 * Seed data:
 * - POST /api/v1/test/seed/situations creates 3 situations.
 *   SITUATIONS[0] ("At the coffee shop") gets a SituationPicture row.
 *   SITUATIONS[1] ("On the bus") has no picture row.
 */

import { test, expect } from '@playwright/test';

import { navigateToAdminTab } from './helpers/admin-helpers';

// Storage state paths
const ADMIN_AUTH = 'playwright/.auth/admin.json';

// Seeded scene values for SITUATIONS[0]
const SEED_SCENE_EN =
  'A bustling coffee shop in central Athens, customers chatting at small tables';
const SEED_SCENE_EL =
  'Ένα γεμάτο καφέ στο κέντρο της Αθήνας, πελάτες συνομιλούν σε μικρά τραπέζια';
const SEED_SCENE_RU =
  'Оживлённое кафе в центре Афин, посетители беседуют за маленькими столиками';
const SEED_STYLE_EN = 'soft natural lighting, photorealistic';

// scenario_en values for the two situations we'll open
const COFFEE_SHOP_SCENARIO = 'At the coffee shop';
const BUS_SCENARIO = 'On the bus';

async function seedSituations(
  page: import('@playwright/test').Page
): Promise<{ situations: Array<{ id: string; scenario_en: string; picture_id: string | null }> }> {
  const apiBaseUrl = process.env.E2E_API_URL || process.env.VITE_API_URL || 'http://localhost:8000';
  const response = await page.request.post(`${apiBaseUrl}/api/v1/test/seed/situations`);
  if (!response.ok()) {
    console.warn('[TEST] Situations seeding failed:', response.status());
  }
  const body = await response.json();
  // results.situations is an array of { id, scenario_en, description_id, picture_id }
  return body.results as {
    situations: Array<{ id: string; scenario_en: string; picture_id: string | null }>;
  };
}

// ============================================================================
// HAPPY PATH: edit scene_en + style_en, persist, recompose image_prompt
// ============================================================================

test.describe('Admin Situation Picture Prompt - Happy Path', () => {
  test.use({ storageState: ADMIN_AUTH });

  let coffeeShopId: string;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: ADMIN_AUTH });
    const page = await context.newPage();
    const seed = await seedSituations(page);
    const coffeeShop = seed.situations.find((s) => s.scenario_en === COFFEE_SHOP_SCENARIO);
    if (coffeeShop) {
      coffeeShopId = coffeeShop.id;
    }
    await page.close();
    await context.close();
  });

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: ADMIN_AUTH });
    const page = await context.newPage();
    await seedSituations(page);
    await page.close();
    await context.close();
  });

  test('edit scene_en + style_en, save, assert persisted + recomposed image_prompt', async ({
    page,
  }) => {
    if (!coffeeShopId) {
      test.skip();
      return;
    }

    // Navigate to admin situations tab
    await page.goto('/admin');
    await expect(page.getByTestId('admin-page')).toBeVisible({ timeout: 15000 });
    await navigateToAdminTab(page, 'situations');

    // Click the coffee shop situation row
    await expect(
      page.getByTestId(`situation-row-${coffeeShopId}`)
    ).toBeVisible({ timeout: 10000 });
    await page.getByTestId(`situation-row-${coffeeShopId}`).click();

    // Situation detail modal opens
    const modal = page.getByTestId('situation-detail-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Switch to Picture tab
    await page.getByTestId('situation-tab-picture').click();

    // PicturePromptForm should be visible (situation has a picture row)
    await expect(page.getByTestId('picture-prompt-form')).toBeVisible({ timeout: 5000 });

    // Assert hydrated values match the seed
    await expect(page.getByTestId('picture-prompt-scene-en')).toHaveValue(SEED_SCENE_EN);
    await expect(page.getByTestId('picture-prompt-scene-el')).toHaveValue(SEED_SCENE_EL);
    await expect(page.getByTestId('picture-prompt-scene-ru')).toHaveValue(SEED_SCENE_RU);
    await expect(page.getByTestId('picture-prompt-style-en')).toHaveValue(SEED_STYLE_EN);

    // New values to type
    const uniqueId = Date.now();
    const NEW_SCENE_EN = `E2E test scene EN ${uniqueId}`;
    const NEW_STYLE_EN = `E2E test style EN ${uniqueId}`;

    // Set up response interception BEFORE clicking Save
    const patchResponsePromise = page.waitForResponse(
      (r) =>
        /\/api\/v1\/admin\/situations\/[^/]+\/picture$/.test(r.url()) &&
        r.request().method() === 'PATCH',
      { timeout: 10000 }
    );

    // Clear and fill scene_en
    await page.getByTestId('picture-prompt-scene-en').clear();
    await page.getByTestId('picture-prompt-scene-en').fill(NEW_SCENE_EN);

    // Clear and fill style_en
    await page.getByTestId('picture-prompt-style-en').clear();
    await page.getByTestId('picture-prompt-style-en').fill(NEW_STYLE_EN);

    // Click Save
    await page.getByTestId('picture-prompt-save').click();

    // Assert PATCH response
    const patchResponse = await patchResponsePromise;
    expect(patchResponse.status()).toBe(200);
    const body = await patchResponse.json();
    expect(body.scene_en).toBe(NEW_SCENE_EN);
    expect(body.style_en).toBe(NEW_STYLE_EN);
    expect(body.image_prompt).toBe(`${NEW_SCENE_EN}\n\n${NEW_STYLE_EN}`);

    // Success toast should appear
    await expect(page.getByText('Picture prompt saved')).toBeVisible({ timeout: 5000 });

    // Reload and re-open the same situation to assert persistence
    await page.reload();
    await expect(page.getByTestId('admin-page')).toBeVisible({ timeout: 15000 });
    await navigateToAdminTab(page, 'situations');

    await expect(
      page.getByTestId(`situation-row-${coffeeShopId}`)
    ).toBeVisible({ timeout: 10000 });
    await page.getByTestId(`situation-row-${coffeeShopId}`).click();

    await expect(modal).toBeVisible({ timeout: 5000 });
    await page.getByTestId('situation-tab-picture').click();
    await expect(page.getByTestId('picture-prompt-form')).toBeVisible({ timeout: 5000 });

    // scene_en and style_en should reflect saved values
    await expect(page.getByTestId('picture-prompt-scene-en')).toHaveValue(NEW_SCENE_EN);
    await expect(page.getByTestId('picture-prompt-style-en')).toHaveValue(NEW_STYLE_EN);

    // scene_el and scene_ru should remain unchanged from seed
    await expect(page.getByTestId('picture-prompt-scene-el')).toHaveValue(SEED_SCENE_EL);
    await expect(page.getByTestId('picture-prompt-scene-ru')).toHaveValue(SEED_SCENE_RU);
  });
});

// ============================================================================
// NEGATIVE PATH: situation without picture row hides the form
// ============================================================================

test.describe('Admin Situation Picture Prompt - Negative Path', () => {
  test.use({ storageState: ADMIN_AUTH });

  let busId: string;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: ADMIN_AUTH });
    const page = await context.newPage();
    const seed = await seedSituations(page);
    const bus = seed.situations.find((s) => s.scenario_en === BUS_SCENARIO);
    if (bus) {
      busId = bus.id;
    }
    await page.close();
    await context.close();
  });

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: ADMIN_AUTH });
    const page = await context.newPage();
    await seedSituations(page);
    await page.close();
    await context.close();
  });

  test('situation without picture row shows empty state, hides form', async ({ page }) => {
    if (!busId) {
      test.skip();
      return;
    }

    // Navigate to admin situations tab
    await page.goto('/admin');
    await expect(page.getByTestId('admin-page')).toBeVisible({ timeout: 15000 });
    await navigateToAdminTab(page, 'situations');

    // Click the bus situation row (no picture row)
    await expect(page.getByTestId(`situation-row-${busId}`)).toBeVisible({ timeout: 10000 });
    await page.getByTestId(`situation-row-${busId}`).click();

    // Situation detail modal opens
    const modal = page.getByTestId('situation-detail-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Switch to Picture tab
    await page.getByTestId('situation-tab-picture').click();

    // Empty-state placeholder should be visible
    await expect(page.getByTestId('situation-picture-empty')).toBeVisible({ timeout: 5000 });

    // PicturePromptForm must NOT be in the DOM
    await expect(page.getByTestId('picture-prompt-form')).toHaveCount(0);
  });
});
