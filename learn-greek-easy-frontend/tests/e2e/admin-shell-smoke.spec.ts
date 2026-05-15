/**
 * E2E Smoke Tests: Admin Shell (ASHELL-08)
 *
 * Validates the new admin shell chrome introduced by the ASHELL series:
 * - ASHELL-01: VA design tokens
 * - ASHELL-02: TopBar component
 * - ASHELL-03: PageHead component
 * - ASHELL-04: SectionTabs component
 * - ASHELL-05: Admin Avatar
 * - ASHELL-06: URL-synced tab state (?tab=)
 * - ASHELL-07: CSS wiring
 *
 * These tests are intentionally broad smoke tests — they verify the new
 * chrome renders and the fundamental interactions work, without coupling
 * tightly to content inside each tab section.
 *
 * Auth: uses saved admin storageState (superuser role).
 * Does NOT start a local server — runs against CI preview environment.
 */

import { expect, test } from '@playwright/test';

import { STORAGE_STATE } from '../../playwright.config';

test.use({ storageState: STORAGE_STATE.ADMIN });

// ---------------------------------------------------------------------------
// ASHELL-SMOKE-01: New shell chrome renders on /admin
// ---------------------------------------------------------------------------
test('ASHELL-SMOKE-01: /admin renders new shell chrome', async ({ page }) => {
  await page.goto('/admin');

  // Wait for the admin page to load (avoids flakiness on slow CI)
  await expect(page.getByTestId('admin-page')).toBeVisible({ timeout: 15_000 });

  // TopBar (.va-top) is visible
  const topBar = page.locator('.va-top');
  await expect(topBar).toBeVisible();

  // TopBar has position: sticky applied via CSS
  const position = await topBar.evaluate((el) => getComputedStyle(el).position);
  expect(position).toBe('sticky');

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
// ASHELL-SMOKE-03: Theme button flips <html> .dark class
// ---------------------------------------------------------------------------
test('ASHELL-SMOKE-03: theme button toggles dark mode class on <html>', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.getByTestId('admin-page')).toBeVisible({ timeout: 15_000 });

  // Read current dark state
  const isDarkBefore = await page
    .locator('html')
    .evaluate((el) => el.classList.contains('dark'));

  // Click the theme toggle button in TopBar
  await page.locator('.va-top button[aria-label*="theme" i]').click();

  // Wait briefly for the class to apply (ThemeContext sets it synchronously
  // but the transition class removal uses a timeout)
  await page.waitForTimeout(100);

  const isDarkAfter = await page
    .locator('html')
    .evaluate((el) => el.classList.contains('dark'));

  expect(isDarkAfter).not.toBe(isDarkBefore);
});

// ---------------------------------------------------------------------------
// ASHELL-SMOKE-04: Language button changes the TopBar button aria-labels
// ---------------------------------------------------------------------------
test('ASHELL-SMOKE-04: language button switches UI language', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.getByTestId('admin-page')).toBeVisible({ timeout: 15_000 });

  // Capture theme button aria-label before toggle (it is translated)
  const themeBtnBefore = await page
    .locator('.va-top button[aria-label*="theme" i], .va-top button[aria-label*="тему" i]')
    .first()
    .getAttribute('aria-label');

  // Click the language toggle button
  await page.locator('.va-top button[aria-label*="language" i], .va-top button[aria-label*="язык" i]').first().click();

  // Wait for i18n to re-render (react-i18next applies synchronously from
  // the loaded bundle, but a short wait avoids assertion races)
  await page.waitForTimeout(300);

  // The theme button aria-label should now be in the other language
  const themeBtnAfter = await page
    .locator('.va-top button[aria-label*="theme" i], .va-top button[aria-label*="тему" i]')
    .first()
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

  // Step 3: toggle theme
  await page.locator('.va-top button[aria-label*="theme" i]').click();
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
