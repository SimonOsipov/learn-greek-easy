/**
 * i18n Visual Regression Tests
 *
 * Visual tests for internationalization features.
 * Captures snapshots in both English and Greek to detect UI regressions
 * when translations change or layout issues occur with different text lengths.
 */

import { test, expect } from '@chromatic-com/playwright';
import {
  takeSnapshot,
  waitForPageReady,
  loginForVisualTest,
  VIEWPORTS,
} from './helpers/visual-helpers';

test.describe('Language Switcher Visual Tests', () => {
  test('Language Switcher Dropdown - English', async ({ page }, testInfo) => {
    await page.goto('/login');
    await page.evaluate(() => localStorage.setItem('i18nextLng', 'en'));
    await page.reload();
    await waitForPageReady(page, '[data-testid="login-card"]');

    // Open the language switcher dropdown
    await page.getByTestId('language-switcher-trigger').click();
    await page.waitForTimeout(300);

    await takeSnapshot(page, 'Language Switcher Dropdown - English', testInfo);
  });

  test('Language Switcher Dropdown - Greek', async ({ page }, testInfo) => {
    await page.goto('/login');
    await page.evaluate(() => localStorage.setItem('i18nextLng', 'el'));
    await page.reload();
    await waitForPageReady(page, '[data-testid="login-card"]');

    // Open the language switcher dropdown
    await page.getByTestId('language-switcher-trigger').click();
    await page.waitForTimeout(300);

    await takeSnapshot(page, 'Language Switcher Dropdown - Greek', testInfo);
  });
});

test.describe('Login Page - Multi-language Visual Tests', () => {
  test('Login Page - English', async ({ page }, testInfo) => {
    await page.goto('/login');
    await page.evaluate(() => localStorage.setItem('i18nextLng', 'en'));
    await page.reload();
    await expect(page.getByTestId('login-card')).toBeVisible();
    await waitForPageReady(page, '[data-testid="login-card"]');

    await takeSnapshot(page, 'Login Page - English', testInfo);
  });

  test('Login Page - Greek', async ({ page }, testInfo) => {
    await page.goto('/login');
    await page.evaluate(() => localStorage.setItem('i18nextLng', 'el'));
    await page.reload();
    await expect(page.getByTestId('login-card')).toBeVisible();
    await waitForPageReady(page, '[data-testid="login-card"]');

    await takeSnapshot(page, 'Login Page - Greek', testInfo);
  });

  test('Login Page - Greek Mobile', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto('/login');
    await page.evaluate(() => localStorage.setItem('i18nextLng', 'el'));
    await page.reload();
    await expect(page.getByTestId('login-card')).toBeVisible();
    await waitForPageReady(page, '[data-testid="login-card"]');

    await takeSnapshot(page, 'Login Page - Greek Mobile', testInfo);
  });
});

test.describe('Register Page - Multi-language Visual Tests', () => {
  test('Register Page - English', async ({ page }, testInfo) => {
    await page.goto('/register');
    await page.evaluate(() => localStorage.setItem('i18nextLng', 'en'));
    await page.reload();
    await expect(page.getByTestId('register-card')).toBeVisible();
    await waitForPageReady(page, '[data-testid="register-card"]');

    await takeSnapshot(page, 'Register Page - English', testInfo);
  });

  test('Register Page - Greek', async ({ page }, testInfo) => {
    await page.goto('/register');
    await page.evaluate(() => localStorage.setItem('i18nextLng', 'el'));
    await page.reload();
    await expect(page.getByTestId('register-card')).toBeVisible();
    await waitForPageReady(page, '[data-testid="register-card"]');

    await takeSnapshot(page, 'Register Page - Greek', testInfo);
  });
});

test.describe('Authenticated Pages - Multi-language Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginForVisualTest(page);
  });

  test('Dashboard - English', async ({ page }, testInfo) => {
    await page.evaluate(() => localStorage.setItem('i18nextLng', 'en'));
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await waitForPageReady(page);
    await page.waitForTimeout(500);

    await takeSnapshot(page, 'Dashboard - English', testInfo);
  });

  test('Dashboard - Greek', async ({ page }, testInfo) => {
    await page.evaluate(() => localStorage.setItem('i18nextLng', 'el'));
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await waitForPageReady(page);
    await page.waitForTimeout(500);

    await takeSnapshot(page, 'Dashboard - Greek', testInfo);
  });

  test('Decks Page - English', async ({ page }, testInfo) => {
    await page.evaluate(() => localStorage.setItem('i18nextLng', 'en'));
    await page.goto('/decks');
    await page.waitForLoadState('networkidle');
    await waitForPageReady(page);
    await page.waitForTimeout(500);

    await takeSnapshot(page, 'Decks Page - English', testInfo);
  });

  test('Decks Page - Greek', async ({ page }, testInfo) => {
    await page.evaluate(() => localStorage.setItem('i18nextLng', 'el'));
    await page.goto('/decks');
    await page.waitForLoadState('networkidle');
    await waitForPageReady(page);
    await page.waitForTimeout(500);

    await takeSnapshot(page, 'Decks Page - Greek', testInfo);
  });

});

test.describe('Navigation - Multi-language Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginForVisualTest(page);
  });

  test('Navigation Menu - English', async ({ page }, testInfo) => {
    await page.evaluate(() => localStorage.setItem('i18nextLng', 'en'));
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await waitForPageReady(page);

    // Focus on navigation area
    await takeSnapshot(page, 'Navigation - English', testInfo);
  });

  test('Navigation Menu - Greek', async ({ page }, testInfo) => {
    await page.evaluate(() => localStorage.setItem('i18nextLng', 'el'));
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await waitForPageReady(page);

    // Focus on navigation area
    await takeSnapshot(page, 'Navigation - Greek', testInfo);
  });

  test('Mobile Navigation - English', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.evaluate(() => localStorage.setItem('i18nextLng', 'en'));
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await waitForPageReady(page);

    await takeSnapshot(page, 'Mobile Navigation - English', testInfo);
  });

  test('Mobile Navigation - Greek', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.evaluate(() => localStorage.setItem('i18nextLng', 'el'));
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await waitForPageReady(page);

    await takeSnapshot(page, 'Mobile Navigation - Greek', testInfo);
  });
});
