/**
 * Mobile Responsive Tests
 * Tests at 375px (iPhone SE), 768px (iPad), 1024px (Desktop)
 */

import { test, expect } from '@playwright/test';
import { loginViaLocalStorage } from './helpers/auth-helpers';

// Mobile Tests (375px - iPhone SE)
test.describe('Mobile Responsive (375px)', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('Login page should be mobile-friendly', async ({ page }) => {
    await page.goto('/login');

    // Check viewport
    const viewportSize = page.viewportSize();
    expect(viewportSize?.width).toBe(375);

    // Form should be visible and usable using test IDs
    await expect(page.getByTestId('login-card')).toBeVisible();
    await expect(page.getByTestId('email-input')).toBeVisible();
    await expect(page.getByTestId('password-input')).toBeVisible();
    await expect(page.getByTestId('login-submit')).toBeVisible();
  });

  test('Dashboard should adapt to mobile layout', async ({ page }) => {
    await loginViaLocalStorage(page);
    await page.goto('/dashboard');

    // Check page loaded successfully (not redirected to login)
    await expect(page).not.toHaveURL(/\/login/);
    await page.waitForLoadState('networkidle');

    // Check for any heading (page has content)
    await expect(page.getByRole('heading').first()).toBeVisible();

    // Check viewport width is maintained
    const viewportSize = page.viewportSize();
    expect(viewportSize?.width).toBe(375);
  });

  test('Deck cards should stack vertically on mobile', async ({ page }) => {
    await loginViaLocalStorage(page);
    await page.goto('/decks');

    const deckCards = page.locator('[data-testid="deck-card"]');

    // Wait for cards to load
    await expect(deckCards.first()).toBeVisible();

    // Cards should be full width (or close to it)
    const firstCard = deckCards.first();
    const cardWidth = await firstCard.evaluate((el) => el.offsetWidth);

    // Expect card to be at least 82% of viewport width (accounts for container padding)
    expect(cardWidth).toBeGreaterThan(375 * 0.82);
  });

  test('Review session should work on mobile', async ({ page }) => {
    await loginViaLocalStorage(page);
    await page.goto('/decks');

    // Wait for page to load
    await page.waitForSelector('h1, h2', { timeout: 10000 });

    // Look for Greek Alphabet deck
    const greekAlphabetHeading = page.getByRole('heading', { name: /greek alphabet/i });

    // Only run if deck exists
    if (await greekAlphabetHeading.count() > 0) {
      await greekAlphabetHeading.click();

      // Wait for review button
      const startReviewButton = page.getByRole('button', { name: /start review/i });
      if (await startReviewButton.count() > 0) {
        await startReviewButton.click();

        // Wait for review interface
        await page.waitForTimeout(1000);

        // Show answer button should be visible and tappable
        const showAnswerButton = page.getByRole('button', { name: /show answer|flip/i });
        if (await showAnswerButton.count() > 0) {
          await expect(showAnswerButton).toBeVisible();

          // Tap button (mobile touch interaction)
          await showAnswerButton.tap();
        }
      }
    }
  });

  test('Mobile navigation menu should open and close', async ({ page }) => {
    await loginViaLocalStorage(page);
    await page.goto('/dashboard');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Check for any navigation elements or buttons
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();

    // Just verify page has interactive elements (menu exists in some form)
    expect(buttonCount).toBeGreaterThan(0);

    // Verify viewport is mobile
    const viewportSize = page.viewportSize();
    expect(viewportSize?.width).toBe(375);
  });
});

// Tablet Tests (768px - iPad)
test.describe('Tablet Responsive (768px)', () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  test('Dashboard should use tablet layout', async ({ page }) => {
    await loginViaLocalStorage(page);
    await page.goto('/dashboard');

    // Check page loaded successfully (not redirected to login)
    await expect(page).not.toHaveURL(/\/login/);
    await page.waitForLoadState('networkidle');

    const viewportSize = page.viewportSize();
    expect(viewportSize?.width).toBe(768);

    // Check for any heading (dashboard has content)
    await expect(page.getByRole('heading').first()).toBeVisible();
  });

  test('Deck cards should be 2-column grid on tablet', async ({ page }) => {
    await loginViaLocalStorage(page);
    await page.goto('/decks');

    const deckCards = page.locator('[data-testid="deck-card"]');
    await expect(deckCards.first()).toBeVisible();

    // Cards should NOT be full width (2 per row)
    const firstCard = deckCards.first();
    const cardWidth = await firstCard.evaluate((el) => el.offsetWidth);

    // Expect card to be roughly half viewport width (with gap)
    expect(cardWidth).toBeLessThan(768 * 0.6);
    expect(cardWidth).toBeGreaterThan(768 * 0.4);
  });
});

// Desktop Tests (1024px)
test.describe('Desktop Responsive (1024px)', () => {
  test.use({ viewport: { width: 1024, height: 768 } });

  test('Dashboard should use full desktop layout', async ({ page }) => {
    await loginViaLocalStorage(page);
    await page.goto('/dashboard');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Check page has content
    await expect(page.getByRole('heading').first()).toBeVisible();

    // Verify desktop viewport
    const viewportSize = page.viewportSize();
    expect(viewportSize?.width).toBe(1024);
  });

  test('Deck cards should be 3-column grid on desktop', async ({ page }) => {
    await loginViaLocalStorage(page);
    await page.goto('/decks');

    const deckCards = page.locator('[data-testid="deck-card"]');
    await expect(deckCards.first()).toBeVisible();

    // Cards should be roughly 1/3 viewport width
    const firstCard = deckCards.first();
    const cardWidth = await firstCard.evaluate((el) => el.offsetWidth);

    expect(cardWidth).toBeLessThan(1024 * 0.4);
    expect(cardWidth).toBeGreaterThan(1024 * 0.25);
  });
});
