/**
 * Playwright Setup Verification Test
 * Validates that Playwright is correctly installed and configured
 */

import { test, expect } from '@playwright/test';

test.describe('Playwright Installation & Configuration', () => {
  test('should load application homepage', async ({ page }) => {
    await page.goto('/');

    // Verify page title contains "Learn Greek Easy"
    await expect(page).toHaveTitle(/Learn Greek Easy/i);

    // Verify page loaded successfully
    const content = await page.content();
    expect(content.length).toBeGreaterThan(0);
  });

  test('should test on Chromium browser', async ({ page, browserName }) => {
    // Skip if not chromium
    test.skip(browserName !== 'chromium', 'Chromium-specific test');

    await page.goto('/');
    await expect(page).toHaveTitle(/Learn Greek Easy/i);
  });

  test('should test on Firefox browser', async ({ page, browserName }) => {
    // Skip if not firefox
    test.skip(browserName !== 'firefox', 'Firefox-specific test');

    await page.goto('/');
    await expect(page).toHaveTitle(/Learn Greek Easy/i);
  });

  test('should test on WebKit browser', async ({ page, browserName }) => {
    // Skip if not webkit
    test.skip(browserName !== 'webkit', 'WebKit-specific test');

    await page.goto('/');
    await expect(page).toHaveTitle(/Learn Greek Easy/i);
  });

  test('should capture viewport correctly', async ({ page }) => {
    await page.goto('/');

    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();
    expect(viewport?.width).toBe(1280);
    expect(viewport?.height).toBe(720);
  });

  test('should have configured baseURL', async ({ page, baseURL }) => {
    expect(baseURL).toBe('http://localhost:5173');

    // Navigate using relative path (uses baseURL)
    await page.goto('/');
    expect(page.url()).toContain('localhost:5173');
  });
});
