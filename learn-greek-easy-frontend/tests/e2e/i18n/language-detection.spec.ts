/**
 * Language Detection E2E Tests
 *
 * Tests for automatic language detection based on browser settings.
 * Uses storageState pattern - tests run with fresh contexts for language detection testing.
 */

import { test, expect } from '@playwright/test';

test.describe('Language Detection', () => {
  // Use empty storage state for all language detection tests (no auth, no saved language)
  test.use({ storageState: { cookies: [], origins: [] } });

  test('should detect English browser language and show English UI', async ({ browser }) => {
    const context = await browser.newContext({
      locale: 'en-US',
    });
    const page = await context.newPage();

    // Clear any localStorage that might have language preference
    await page.goto('/login');
    await page.evaluate(() => localStorage.removeItem('i18nextLng'));
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Check for English text on login page
    // Navigate to login page to see login form
    await expect(page.getByTestId('login-card')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('login-title')).toHaveText('Welcome Back');

    await context.close();
  });

  test('should detect Greek browser language and show Greek UI', async ({ browser }) => {
    const context = await browser.newContext({
      locale: 'el-GR',
    });
    const page = await context.newPage();

    // Clear localStorage to ensure detection happens
    await page.goto('/login');
    await page.evaluate(() => localStorage.removeItem('i18nextLng'));
    await page.reload();

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Check for Greek text on login page using test-id
    await expect(page.getByTestId('login-card')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('login-title')).toHaveText('Καλώς Ήρθατε');

    await context.close();
  });

  test('should detect Russian browser language and show Russian UI', async ({ browser }) => {
    const context = await browser.newContext({
      locale: 'ru-RU',
    });
    const page = await context.newPage();

    // Clear localStorage to ensure detection happens
    await page.goto('/login');
    await page.evaluate(() => localStorage.removeItem('i18nextLng'));
    await page.reload();

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Check for Russian text on login page using test-id
    await expect(page.getByTestId('login-card')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('login-title')).toHaveText('С возвращением');

    await context.close();
  });

  test('should fallback to English for unsupported browser language (French)', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      locale: 'fr-FR', // French - not supported
    });
    const page = await context.newPage();

    // Clear localStorage
    await page.goto('/login');
    await page.evaluate(() => localStorage.removeItem('i18nextLng'));
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Should fallback to English
    await expect(page.getByTestId('login-card')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('login-title')).toHaveText('Welcome Back');

    await context.close();
  });

  test('should fallback to English for unsupported browser language (German)', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      locale: 'de-DE', // German - not supported
    });
    const page = await context.newPage();

    // Clear localStorage
    await page.goto('/login');
    await page.evaluate(() => localStorage.removeItem('i18nextLng'));
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Should fallback to English
    await expect(page.getByTestId('login-card')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('login-title')).toHaveText('Welcome Back');

    await context.close();
  });

  test('should handle language codes with region (en-GB -> en)', async ({ browser }) => {
    const context = await browser.newContext({
      locale: 'en-GB', // British English
    });
    const page = await context.newPage();

    // Clear localStorage
    await page.goto('/login');
    await page.evaluate(() => localStorage.removeItem('i18nextLng'));
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Should use English (base language)
    await expect(page.getByTestId('login-card')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('login-title')).toHaveText('Welcome Back');

    await context.close();
  });

  test('should handle el-CY (Cypriot Greek) -> el', async ({ browser }) => {
    const context = await browser.newContext({
      locale: 'el-CY', // Cypriot Greek
    });
    const page = await context.newPage();

    // Clear localStorage
    await page.goto('/login');
    await page.evaluate(() => localStorage.removeItem('i18nextLng'));
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Should use Greek (base language)
    await expect(page.getByTestId('login-card')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('login-title')).toHaveText('Καλώς Ήρθατε');

    await context.close();
  });
});

test.describe('Language Priority', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('should prefer localStorage over browser language', async ({ browser }) => {
    const context = await browser.newContext({
      locale: 'el-GR', // Browser says Greek
    });
    const page = await context.newPage();

    // Navigate and set localStorage to English
    await page.goto('/login');
    await page.evaluate(() => localStorage.setItem('i18nextLng', 'en'));
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Should use English from localStorage despite Greek browser setting
    await expect(page.getByTestId('login-card')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('login-title')).toHaveText('Welcome Back');

    await context.close();
  });

  test('should use browser language when localStorage is cleared', async ({ browser }) => {
    const context = await browser.newContext({
      locale: 'el-GR',
    });
    const page = await context.newPage();

    // Navigate and clear any stored language
    await page.goto('/login');
    await page.evaluate(() => localStorage.removeItem('i18nextLng'));
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Should use Greek from browser
    await expect(page.getByTestId('login-card')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('login-title')).toHaveText('Καλώς Ήρθατε');

    await context.close();
  });
});
