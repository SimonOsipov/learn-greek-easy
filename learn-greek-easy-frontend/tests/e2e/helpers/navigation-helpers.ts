/**
 * Navigation Helpers for E2E Tests
 */

import { Page, expect } from '@playwright/test';

/**
 * Navigate to a route and wait for it to load
 * @param page - Playwright page object
 * @param path - Route path (e.g., '/dashboard')
 */
export async function navigateTo(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}

/**
 * Wait for element to be visible
 * @param page - Playwright page object
 * @param selector - CSS selector or text
 */
export async function waitForElement(
  page: Page,
  selector: string
): Promise<void> {
  await page.waitForSelector(selector, { state: 'visible' });
}

/**
 * Check if page contains text
 * @param page - Playwright page object
 * @param text - Text to search for (case-insensitive)
 * @returns True if found, false otherwise
 */
export async function pageContainsText(
  page: Page,
  text: string | RegExp
): Promise<boolean> {
  try {
    await expect(page.getByText(text)).toBeVisible({ timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}
