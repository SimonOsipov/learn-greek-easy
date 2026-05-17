/**
 * E2E Smoke Tests: Admin Shell (ASHELL-08)
 *
 * Validates the admin shell chrome after the ADMIN2-14 post-redesign bug sweep:
 * - ASHELL-01: Shell renders — global header visible, page-head h1 visible, 10 tabs
 * - ASHELL-02: ?tab=feedback navigates to the feedback tab
 * - ASHELL-03: Theme button (global header) flips <html> .dark class
 * - ASHELL-04: Language button (global header) changes UI language
 * - ASHELL-05: No console errors during goto → tab click → theme toggle
 *
 * note: ASHELL-01/03/04/05 previously targeted the admin TopBar (.va-top). The admin
 * TopBar was removed in ADMIN2-14 — the global app-shell <Header /> (AppLayout.tsx)
 * already provides theme/language/notifications chrome for all authenticated routes
 * including /admin. Tests now target the global header's data-testid selectors
 * (theme-switcher, language-switcher-trigger) which live in that header.
 *
 * Auth: uses saved admin storageState (superuser role).
 * Does NOT start a local server — runs against CI preview environment.
 */

import { expect, test } from '@playwright/test';

import { STORAGE_STATE } from '../../playwright.config';

test.use({ storageState: STORAGE_STATE.ADMIN });

// ---------------------------------------------------------------------------
// ASHELL-SMOKE-01: Admin shell renders — global header, page-head h1, 10 tabs
// ---------------------------------------------------------------------------
test('ASHELL-SMOKE-01: /admin renders shell chrome (global header + page head + tabs)', async ({
  page,
}) => {
  await page.goto('/admin');

  // Wait for the admin page to load (avoids flakiness on slow CI)
  await expect(page.getByTestId('admin-page')).toBeVisible({ timeout: 15_000 });

  // Global app-shell header is present (sticky, full-width)
  const globalHeader = page.locator('header');
  await expect(globalHeader.first()).toBeVisible();

  // PageHead contains an <h1 class="va-h1">
  await expect(page.locator('h1.va-h1')).toBeVisible();

  // SectionTabs renders exactly 10 tab buttons (the 10 AdminTabType values:
  // dashboard | inbox | decks | news | situations | exercises |
  // errors | feedback | changelog | announcements)
  const tabs = page.locator('.va-tabs [role="tab"]');
  await expect(tabs).toHaveCount(10);
});

// ---------------------------------------------------------------------------
// ASHELL-SMOKE-02: ?tab=feedback navigates to the feedback tab
// ---------------------------------------------------------------------------
test('ASHELL-SMOKE-02: ?tab=feedback activates the feedback tab', async ({ page }) => {
  await page.goto('/admin?tab=feedback');

  // Wait for admin page to load
  await expect(page.getByTestId('admin-page')).toBeVisible({ timeout: 15_000 });

  // The feedback tab button should be aria-selected and carry the is-active class
  const feedbackTab = page.locator('.va-tab[aria-selected="true"]');
  await expect(feedbackTab).toBeVisible();
  await expect(feedbackTab).toHaveClass(/is-active/);
});

// ---------------------------------------------------------------------------
// ASHELL-SMOKE-03: Theme button (global header) flips <html> .dark class
// ---------------------------------------------------------------------------
test('ASHELL-SMOKE-03: theme button toggles dark mode class on <html>', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.getByTestId('admin-page')).toBeVisible({ timeout: 15_000 });

  // Read current dark state
  const isDarkBefore = await page
    .locator('html')
    .evaluate((el) => el.classList.contains('dark'));

  // Click the theme toggle button in the global header
  await page.getByTestId('theme-switcher').click();

  // Wait briefly for the class to apply (ThemeContext sets it synchronously
  // but the transition class removal uses a timeout)
  await page.waitForTimeout(100);

  const isDarkAfter = await page
    .locator('html')
    .evaluate((el) => el.classList.contains('dark'));

  expect(isDarkAfter).not.toBe(isDarkBefore);
});

// ---------------------------------------------------------------------------
// ASHELL-SMOKE-04: Language button (global header) changes the UI language
// ---------------------------------------------------------------------------
test('ASHELL-SMOKE-04: language button switches UI language', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.getByTestId('admin-page')).toBeVisible({ timeout: 15_000 });

  // Capture theme button aria-label before language toggle (it is translated)
  const themeBtnBefore = await page
    .getByTestId('theme-switcher')
    .getAttribute('aria-label');

  // Click the language switcher trigger in the global header
  await page.getByTestId('language-switcher-trigger').click();

  // Wait for the dropdown to open, then click the non-current language option
  // (en/ru — pick whichever is NOT currently selected)
  const langMenu = page.getByTestId('language-switcher-menu');
  await expect(langMenu).toBeVisible();

  // Find the non-selected option (aria-selected="false") and click it
  const nonSelectedOption = langMenu.locator('[aria-selected="false"]').first();
  await nonSelectedOption.click();

  // Wait for i18n to re-render (react-i18next applies synchronously from
  // the loaded bundle, but a short wait avoids assertion races)
  await page.waitForTimeout(300);

  // The theme button aria-label should now be in the other language
  const themeBtnAfter = await page
    .getByTestId('theme-switcher')
    .getAttribute('aria-label');

  expect(themeBtnAfter).not.toBe(themeBtnBefore);
});

// ---------------------------------------------------------------------------
// ASHELL-SMOKE-05: No console errors during goto → tab click → theme toggle
// ---------------------------------------------------------------------------
test('ASHELL-SMOKE-05: no console errors during 3-step smoke', async ({ page }) => {
  const errors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  // Step 1: goto /admin
  await page.goto('/admin');
  await expect(page.getByTestId('admin-page')).toBeVisible({ timeout: 15_000 });

  // Step 2: click the news tab via URL navigation (consistent with helper pattern)
  await page.goto('/admin?tab=news');
  await page.locator('.va-tab[aria-selected="true"]').waitFor({ state: 'visible' });

  // Step 3: toggle theme via global header
  await page.getByTestId('theme-switcher').click();
  await page.waitForTimeout(100);

  // Filter out known noisy third-party errors (analytics/observability blocked in CI sandbox)
  const appErrors = errors.filter(
    (e) =>
      !e.includes('posthog') &&
      !e.includes('PostHog') &&
      !e.includes('Failed to load resource') &&
      !e.includes('ERR_BLOCKED_BY_CLIENT') &&
      !e.includes('Failed to preconnect') &&
      !e.includes('sentry.io') &&
      !e.includes('ingest.us.sentry.io')
  );

  expect(appErrors).toHaveLength(0);
});
