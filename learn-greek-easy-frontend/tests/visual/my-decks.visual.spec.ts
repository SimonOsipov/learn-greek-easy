/**
 * My Decks Visual Regression Tests
 *
 * Comprehensive visual tests for the My Decks feature covering:
 * - Page Content (with decks) - 7 scenarios
 * - Empty State - 7 scenarios
 * - Loading State - 2 scenarios
 * - Error State - 4 scenarios
 * - Access Denied Modal - 4 scenarios
 * - Navigation - 3 scenarios
 *
 * Total: 27 visual test scenarios
 *
 * Viewports:
 * - Desktop: 1280x720
 * - Tablet: 768x1024
 * - Mobile: 375x667
 */

import { test, expect } from '@chromatic-com/playwright';
import { Page } from '@playwright/test';

import {
  takeSnapshot,
  waitForPageReady,
  loginForVisualTest,
  VIEWPORTS,
} from './helpers/visual-helpers';

/**
 * Helper to set theme via localStorage
 */
async function setTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  await page.evaluate((t) => {
    localStorage.setItem('theme', t);
    document.documentElement.classList.toggle('dark', t === 'dark');
  }, theme);
}

/**
 * Helper to set language via localStorage
 */
async function setLanguage(page: Page, lang: 'en' | 'ru'): Promise<void> {
  await page.evaluate((l) => {
    localStorage.setItem('i18nextLng', l);
  }, lang);
}

// ============================================================================
// PAGE CONTENT TESTS (WITH DECKS) - 7 SCENARIOS
// ============================================================================

test.describe('My Decks - Page Content Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginForVisualTest(page);
  });

  // Scenario 1: Desktop EN Light
  test('My Decks - With Content - Desktop EN Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setTheme(page, 'light');
    await setLanguage(page, 'en');
    await page.goto('/my-decks');
    await waitForPageReady(page, '[data-testid="my-decks-title"]');
    await page.waitForTimeout(1000); // Wait for deck cards to render

    await takeSnapshot(page, 'My Decks - With Content - Desktop EN Light', testInfo);
  });

  // Scenario 2: Desktop EN Dark
  test('My Decks - With Content - Desktop EN Dark', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setTheme(page, 'dark');
    await setLanguage(page, 'en');
    await page.goto('/my-decks');
    await waitForPageReady(page, '[data-testid="my-decks-title"]');
    await page.waitForTimeout(1000);

    await takeSnapshot(page, 'My Decks - With Content - Desktop EN Dark', testInfo);
  });

  // Scenario 3: Desktop RU Light
  test('My Decks - With Content - Desktop RU Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setTheme(page, 'light');
    await setLanguage(page, 'ru');
    await page.goto('/my-decks');
    await page.reload(); // Reload to apply language
    await waitForPageReady(page, '[data-testid="my-decks-title"]');
    await page.waitForTimeout(1000);

    await takeSnapshot(page, 'My Decks - With Content - Desktop RU Light', testInfo);
  });

  // Scenario 4: Tablet EN Light
  test('My Decks - With Content - Tablet EN Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.tablet);
    await setTheme(page, 'light');
    await setLanguage(page, 'en');
    await page.goto('/my-decks');
    await waitForPageReady(page, '[data-testid="my-decks-title"]');
    await page.waitForTimeout(1000);

    await takeSnapshot(page, 'My Decks - With Content - Tablet EN Light', testInfo);
  });

  // Scenario 5: Tablet EN Dark
  test('My Decks - With Content - Tablet EN Dark', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.tablet);
    await setTheme(page, 'dark');
    await setLanguage(page, 'en');
    await page.goto('/my-decks');
    await waitForPageReady(page, '[data-testid="my-decks-title"]');
    await page.waitForTimeout(1000);

    await takeSnapshot(page, 'My Decks - With Content - Tablet EN Dark', testInfo);
  });

  // Scenario 6: Mobile EN Light
  test('My Decks - With Content - Mobile EN Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await setTheme(page, 'light');
    await setLanguage(page, 'en');
    await page.goto('/my-decks');
    await waitForPageReady(page, '[data-testid="my-decks-title"]');
    await page.waitForTimeout(1000);

    await takeSnapshot(page, 'My Decks - With Content - Mobile EN Light', testInfo);
  });

  // Scenario 7: Mobile EN Dark
  test('My Decks - With Content - Mobile EN Dark', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await setTheme(page, 'dark');
    await setLanguage(page, 'en');
    await page.goto('/my-decks');
    await waitForPageReady(page, '[data-testid="my-decks-title"]');
    await page.waitForTimeout(1000);

    await takeSnapshot(page, 'My Decks - With Content - Mobile EN Dark', testInfo);
  });
});

// ============================================================================
// EMPTY STATE TESTS - 7 SCENARIOS
// ============================================================================

test.describe('My Decks - Empty State Visual Tests', () => {
  // Note: For empty state, we use mock auth which doesn't have real decks
  // The mock user will see empty state by default since no API will return decks

  test.beforeEach(async ({ page }) => {
    // For empty state tests, we intercept the API to return empty decks
    await page.route('**/api/v1/decks/mine*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ decks: [], total: 0, page: 1, page_size: 50 }),
      });
    });
    await loginForVisualTest(page);
  });

  // Scenario 8: Desktop EN Light - Empty
  test('My Decks - Empty State - Desktop EN Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setTheme(page, 'light');
    await setLanguage(page, 'en');
    await page.goto('/my-decks');
    await waitForPageReady(page, '[data-testid="my-decks-title"]');
    await page.waitForTimeout(500);

    // Verify empty state is visible
    await expect(page.getByText(/You haven't created any decks yet/i)).toBeVisible({
      timeout: 5000,
    });

    await takeSnapshot(page, 'My Decks - Empty State - Desktop EN Light', testInfo);
  });

  // Scenario 9: Desktop EN Dark - Empty
  test('My Decks - Empty State - Desktop EN Dark', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setTheme(page, 'dark');
    await setLanguage(page, 'en');
    await page.goto('/my-decks');
    await waitForPageReady(page, '[data-testid="my-decks-title"]');
    await page.waitForTimeout(500);

    await expect(page.getByText(/You haven't created any decks yet/i)).toBeVisible({
      timeout: 5000,
    });

    await takeSnapshot(page, 'My Decks - Empty State - Desktop EN Dark', testInfo);
  });

  // Scenario 10: Desktop RU Light - Empty
  test('My Decks - Empty State - Desktop RU Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setTheme(page, 'light');
    await setLanguage(page, 'ru');
    await page.goto('/my-decks');
    await page.reload();
    await waitForPageReady(page, '[data-testid="my-decks-title"]');
    await page.waitForTimeout(500);

    await takeSnapshot(page, 'My Decks - Empty State - Desktop RU Light', testInfo);
  });

  // Scenario 11: Tablet EN Light - Empty
  test('My Decks - Empty State - Tablet EN Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.tablet);
    await setTheme(page, 'light');
    await setLanguage(page, 'en');
    await page.goto('/my-decks');
    await waitForPageReady(page, '[data-testid="my-decks-title"]');
    await page.waitForTimeout(500);

    await takeSnapshot(page, 'My Decks - Empty State - Tablet EN Light', testInfo);
  });

  // Scenario 12: Tablet EN Dark - Empty
  test('My Decks - Empty State - Tablet EN Dark', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.tablet);
    await setTheme(page, 'dark');
    await setLanguage(page, 'en');
    await page.goto('/my-decks');
    await waitForPageReady(page, '[data-testid="my-decks-title"]');
    await page.waitForTimeout(500);

    await takeSnapshot(page, 'My Decks - Empty State - Tablet EN Dark', testInfo);
  });

  // Scenario 13: Mobile EN Light - Empty
  test('My Decks - Empty State - Mobile EN Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await setTheme(page, 'light');
    await setLanguage(page, 'en');
    await page.goto('/my-decks');
    await waitForPageReady(page, '[data-testid="my-decks-title"]');
    await page.waitForTimeout(500);

    await takeSnapshot(page, 'My Decks - Empty State - Mobile EN Light', testInfo);
  });

  // Scenario 14: Mobile EN Dark - Empty
  test('My Decks - Empty State - Mobile EN Dark', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await setTheme(page, 'dark');
    await setLanguage(page, 'en');
    await page.goto('/my-decks');
    await waitForPageReady(page, '[data-testid="my-decks-title"]');
    await page.waitForTimeout(500);

    await takeSnapshot(page, 'My Decks - Empty State - Mobile EN Dark', testInfo);
  });
});

// ============================================================================
// LOADING STATE TESTS - 2 SCENARIOS
// ============================================================================

test.describe('My Decks - Loading State Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept API to delay response and show loading state
    await page.route('**/api/v1/decks/mine*', async (route) => {
      // Delay response by 10 seconds (we'll take snapshot before it completes)
      await new Promise((resolve) => setTimeout(resolve, 10000));
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ decks: [], total: 0, page: 1, page_size: 50 }),
      });
    });
    await loginForVisualTest(page);
  });

  // Scenario 15: Desktop EN Light - Loading
  test('My Decks - Loading - Desktop EN Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setTheme(page, 'light');
    await setLanguage(page, 'en');

    // Navigate but don't wait for full load
    await page.goto('/my-decks', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="my-decks-title"]')).toBeVisible({ timeout: 5000 });

    // Wait a bit for loading skeleton to render
    await page.waitForTimeout(500);

    await takeSnapshot(page, 'My Decks - Loading - Desktop EN Light', testInfo);
  });

  // Scenario 16: Mobile EN Light - Loading
  test('My Decks - Loading - Mobile EN Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await setTheme(page, 'light');
    await setLanguage(page, 'en');

    await page.goto('/my-decks', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="my-decks-title"]')).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(500);

    await takeSnapshot(page, 'My Decks - Loading - Mobile EN Light', testInfo);
  });
});

// ============================================================================
// ERROR STATE TESTS - 4 SCENARIOS
// ============================================================================

test.describe('My Decks - Error State Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept API to return error
    await page.route('**/api/v1/decks/mine*', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          detail: 'Internal server error. Please try again later.',
        }),
      });
    });
    await loginForVisualTest(page);
  });

  // Scenario 17: Desktop EN Light - Error
  test('My Decks - Error - Desktop EN Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setTheme(page, 'light');
    await setLanguage(page, 'en');
    await page.goto('/my-decks');
    await waitForPageReady(page, '[data-testid="my-decks-title"]');

    // Wait for error state to render
    await page.waitForTimeout(1000);

    await takeSnapshot(page, 'My Decks - Error - Desktop EN Light', testInfo);
  });

  // Scenario 18: Desktop EN Dark - Error
  test('My Decks - Error - Desktop EN Dark', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setTheme(page, 'dark');
    await setLanguage(page, 'en');
    await page.goto('/my-decks');
    await waitForPageReady(page, '[data-testid="my-decks-title"]');
    await page.waitForTimeout(1000);

    await takeSnapshot(page, 'My Decks - Error - Desktop EN Dark', testInfo);
  });

  // Scenario 19: Mobile EN Light - Error
  test('My Decks - Error - Mobile EN Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await setTheme(page, 'light');
    await setLanguage(page, 'en');
    await page.goto('/my-decks');
    await waitForPageReady(page, '[data-testid="my-decks-title"]');
    await page.waitForTimeout(1000);

    await takeSnapshot(page, 'My Decks - Error - Mobile EN Light', testInfo);
  });

  // Scenario 20: Mobile EN Dark - Error
  test('My Decks - Error - Mobile EN Dark', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await setTheme(page, 'dark');
    await setLanguage(page, 'en');
    await page.goto('/my-decks');
    await waitForPageReady(page, '[data-testid="my-decks-title"]');
    await page.waitForTimeout(1000);

    await takeSnapshot(page, 'My Decks - Error - Mobile EN Dark', testInfo);
  });
});

// ============================================================================
// ACCESS DENIED MODAL TESTS - 4 SCENARIOS
// ============================================================================

test.describe('My Decks - Access Denied Modal Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept API to return 403 Forbidden for deck detail
    await page.route('**/api/v1/decks/*', (route) => {
      // Only intercept single deck requests, not /mine
      const url = route.request().url();
      if (url.includes('/mine')) {
        route.continue();
        return;
      }
      route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({
          detail: 'You do not have access to this deck.',
        }),
      });
    });
    await loginForVisualTest(page);
  });

  // Scenario 21: Desktop EN Light - Access Denied
  test('My Decks - Access Denied - Desktop EN Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setTheme(page, 'light');
    await setLanguage(page, 'en');

    // Navigate to a deck that user doesn't own
    await page.goto('/my-decks/12345678-1234-1234-1234-123456789abc');

    // Wait for the access denied dialog to appear
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(500);

    await takeSnapshot(page, 'My Decks - Access Denied - Desktop EN Light', testInfo);
  });

  // Scenario 22: Desktop EN Dark - Access Denied
  test('My Decks - Access Denied - Desktop EN Dark', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setTheme(page, 'dark');
    await setLanguage(page, 'en');

    await page.goto('/my-decks/12345678-1234-1234-1234-123456789abc');

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(500);

    await takeSnapshot(page, 'My Decks - Access Denied - Desktop EN Dark', testInfo);
  });

  // Scenario 23: Mobile EN Light - Access Denied
  test('My Decks - Access Denied - Mobile EN Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await setTheme(page, 'light');
    await setLanguage(page, 'en');

    await page.goto('/my-decks/12345678-1234-1234-1234-123456789abc');

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(500);

    await takeSnapshot(page, 'My Decks - Access Denied - Mobile EN Light', testInfo);
  });

  // Scenario 24: Mobile EN Dark - Access Denied
  test('My Decks - Access Denied - Mobile EN Dark', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await setTheme(page, 'dark');
    await setLanguage(page, 'en');

    await page.goto('/my-decks/12345678-1234-1234-1234-123456789abc');

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(500);

    await takeSnapshot(page, 'My Decks - Access Denied - Mobile EN Dark', testInfo);
  });
});

// ============================================================================
// NAVIGATION TESTS - 3 SCENARIOS
// ============================================================================

test.describe('My Decks - Navigation Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginForVisualTest(page);
  });

  // Scenario 25: Decks Dropdown Open - Desktop
  test('Navigation - Decks Dropdown Open - Desktop EN Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setTheme(page, 'light');
    await setLanguage(page, 'en');
    await page.goto('/dashboard');
    await waitForPageReady(page);

    // Click the Decks dropdown trigger to open it
    const decksDropdown = page.locator('[data-testid="decks-dropdown-trigger"]');
    await expect(decksDropdown).toBeVisible();
    await decksDropdown.click();

    // Wait for dropdown to open
    await expect(page.getByRole('menuitem', { name: /my decks/i })).toBeVisible();
    await page.waitForTimeout(300);

    await takeSnapshot(page, 'Navigation - Decks Dropdown Open - Desktop EN Light', testInfo);
  });

  // Scenario 26: Decks Dropdown Active State - Desktop (on /my-decks page)
  test('Navigation - Decks Dropdown Active - Desktop EN Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setTheme(page, 'light');
    await setLanguage(page, 'en');
    await page.goto('/my-decks');
    await waitForPageReady(page, '[data-testid="my-decks-title"]');

    // The Decks dropdown should be highlighted (active state)
    const decksDropdown = page.locator('[data-testid="decks-dropdown-trigger"]');
    await expect(decksDropdown).toBeVisible();
    // Verify it has active styling
    await expect(decksDropdown).toHaveClass(/text-primary/);

    await takeSnapshot(page, 'Navigation - Decks Dropdown Active - Desktop EN Light', testInfo);
  });

  // Scenario 27: Mobile Decks Submenu - Mobile
  test('Navigation - Mobile Decks Submenu - Mobile EN Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await setTheme(page, 'light');
    await setLanguage(page, 'en');
    await page.goto('/dashboard');
    await waitForPageReady(page);

    // Find the Decks button in mobile bottom navigation
    const decksNavButton = page.locator('nav button').filter({
      has: page.locator('span:text-matches("Decks", "i")'),
    });
    await expect(decksNavButton).toBeVisible();
    await decksNavButton.click();

    // Wait for submenu to appear
    await expect(page.getByRole('menuitem', { name: /my decks/i })).toBeVisible();
    await page.waitForTimeout(300);

    await takeSnapshot(page, 'Navigation - Mobile Decks Submenu - Mobile EN Light', testInfo);
  });
});
