/**
 * DIAGNOSTIC TEST: Verify PublicRoute rendering issue
 * This test helps confirm that PublicRoute blocks rendering when authenticated
 */

import { test, expect } from '@playwright/test';
import { loginViaLocalStorage } from './helpers/auth-helpers';

test.describe('DIAGNOSTIC: PublicRoute Rendering', () => {
  test('should render login form even with auth state set', async ({ page }) => {
    // Set auth state via localStorage (simulating residual state)
    await loginViaLocalStorage(page);

    // Now try to navigate to login page
    await page.goto('/login');
    await page.waitForTimeout(2000); // Give it time to render

    // Check if PublicRoute component exists in DOM
    const html = await page.content();
    console.log('Page HTML length:', html.length);
    console.log('Contains "login":', html.toLowerCase().includes('login'));
    console.log('Contains form:', html.toLowerCase().includes('<form'));

    // Check auth state
    const authState = await page.evaluate(() => {
      return {
        localStorage: localStorage.getItem('auth-storage'),
        isAuthenticated: localStorage.getItem('auth-storage')?.includes('"isAuthenticated":true'),
      };
    });
    console.log('Auth state:', authState);

    // Try to find login form
    const loginForm = page.locator('form').first();
    const isVisible = await loginForm.isVisible().catch(() => false);
    console.log('Login form visible:', isVisible);

    // This will likely fail, confirming our hypothesis
    await expect(loginForm).toBeVisible({ timeout: 5000 });
  });
});
