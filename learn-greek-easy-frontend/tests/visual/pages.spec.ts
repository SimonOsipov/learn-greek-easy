/**
 * Public Pages Visual Tests
 *
 * Visual regression tests for pages that don't require authentication.
 * These tests capture snapshots of login, register, and home pages.
 */

import { test, expect } from '@chromatic-com/playwright';
import { takeSnapshot, waitForPageReady } from './helpers/visual-helpers';

test.describe('Public Pages Visual Tests', () => {
  test('Login Page', async ({ page }, testInfo) => {
    await page.goto('/login');
    await expect(page.getByTestId('login-card')).toBeVisible();
    await waitForPageReady(page, '[data-testid="login-card"]');
    await takeSnapshot(page, 'Login Page', testInfo);
  });

  test('Register Page', async ({ page }, testInfo) => {
    await page.goto('/register');
    await expect(page.getByTestId('register-card')).toBeVisible();
    await waitForPageReady(page, '[data-testid="register-card"]');
    await takeSnapshot(page, 'Register Page', testInfo);
  });

  test('Home Page (Unauthenticated)', async ({ page }, testInfo) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Home page may redirect to login for unauthenticated users
    // or show a landing page - capture whatever state we're in
    await page.waitForTimeout(500);
    await takeSnapshot(page, 'Home Page', testInfo);
  });
});
