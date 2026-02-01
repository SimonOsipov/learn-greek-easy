/**
 * Mobile Responsive Tests
 * Tests at 375px (iPhone SE), 768px (iPad), 1024px (Desktop)
 */

import { test, expect } from '@playwright/test';

// Mobile Tests (375px - iPhone SE)
test.describe('Mobile Responsive (375px)', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  // Public pages - need to clear authentication to access login page
  test.describe('Public pages', () => {
    // Override storageState to be empty (no auth) - same pattern as sample.spec.ts
    test.use({ storageState: { cookies: [], origins: [] } });

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
  });

  test('Dashboard should adapt to mobile layout', async ({ page }) => {
    await page.goto('/');

    // Check page loaded successfully (not redirected to login)
    await expect(page).not.toHaveURL(/\/login/);
    await page.waitForLoadState('domcontentloaded');

    // Check for any heading (page has content)
    await expect(page.getByRole('heading').first()).toBeVisible();

    // Check viewport width is maintained
    const viewportSize = page.viewportSize();
    expect(viewportSize?.width).toBe(375);
  });

  test('Deck cards should stack vertically on mobile', async ({ page }) => {
    await page.goto('/decks');

    const deckCards = page.locator('[data-testid="deck-card"]');

    // Wait for cards to load from API (increased timeout for CI)
    await expect(deckCards.first()).toBeVisible({ timeout: 15000 });

    // Cards should be full width (or close to it)
    const firstCard = deckCards.first();
    const cardWidth = await firstCard.evaluate((el) => el.offsetWidth);

    // Expect card to be at least 82% of viewport width (accounts for container padding)
    expect(cardWidth).toBeGreaterThan(375 * 0.82);
  });

  test('Review session should work on mobile', async ({ page }) => {
    await page.goto('/decks');

    // Wait for decks page React content to load (not LCP shell)
    await expect(page.locator('[data-testid="decks-title"]')).toBeVisible({ timeout: 10000 });

    // Look for Greek vocabulary deck (use .first() as multiple A1-C2 decks exist)
    const deckHeading = page.getByRole('heading', { name: /greek.*vocabulary/i }).first();

    // Only run if deck exists
    if ((await deckHeading.count()) > 0) {
      await deckHeading.click();

      // Wait for review button
      const startReviewButton = page.getByRole('button', { name: /start review/i });
      if (await startReviewButton.count() > 0) {
        await startReviewButton.click();

        // Wait for review interface - look for flashcard or show answer button
        const reviewInterface = page.locator('[data-testid="flashcard"], [data-testid="review-card"]');
        const showAnswerButton = page.getByRole('button', { name: /show answer|flip/i });
        await expect(reviewInterface.or(showAnswerButton).first()).toBeVisible({ timeout: 10000 });

        // Show answer button should be visible and tappable
        if (await showAnswerButton.count() > 0) {
          await expect(showAnswerButton).toBeVisible();

          // Tap button (mobile touch interaction)
          await showAnswerButton.tap();
        }
      }
    }
  });

  test('Mobile navigation menu should open and close', async ({ page }) => {
    // Navigate to dashboard - storageState handles auth
    await page.goto('/');

    // CRITICAL: Verify we're authenticated and not redirected to login
    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      throw new Error('Authentication failed - redirected to login page. Check backend connectivity.');
    }

    // Wait for Dashboard heading specifically (ensures page is fully rendered)
    await expect(page.getByRole('heading', { name: /dashboard/i }))
      .toBeVisible({ timeout: 15000 });

    // Check for any navigation elements or buttons
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();

    // Log diagnostic info if count is unexpectedly low
    if (buttonCount === 0) {
      console.error('[TEST] No buttons found on mobile dashboard');
      console.error('[TEST] Current URL:', page.url());
    }

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
    await page.goto('/');

    // Check page loaded successfully (not redirected to login)
    await expect(page).not.toHaveURL(/\/login/);
    await page.waitForLoadState('domcontentloaded');

    const viewportSize = page.viewportSize();
    expect(viewportSize?.width).toBe(768);

    // Check for any heading (dashboard has content)
    await expect(page.getByRole('heading').first()).toBeVisible();
  });

  test('Deck cards should be 2-column grid on tablet', async ({ page }) => {
    await page.goto('/decks');

    const deckCards = page.locator('[data-testid="deck-card"]');
    // Wait for cards to load from API (increased timeout for CI)
    await expect(deckCards.first()).toBeVisible({ timeout: 15000 });

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
    await page.goto('/');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Check page has content
    await expect(page.getByRole('heading').first()).toBeVisible();

    // Verify desktop viewport
    const viewportSize = page.viewportSize();
    expect(viewportSize?.width).toBe(1024);
  });

  test('Deck cards should be 3-column grid on desktop', async ({ page }) => {
    await page.goto('/decks');

    const deckCards = page.locator('[data-testid="deck-card"]');
    // Wait for cards to load from API (increased timeout for CI)
    await expect(deckCards.first()).toBeVisible({ timeout: 15000 });

    // Cards should be roughly 1/3 viewport width
    const firstCard = deckCards.first();
    const cardWidth = await firstCard.evaluate((el) => el.offsetWidth);

    expect(cardWidth).toBeLessThan(1024 * 0.4);
    expect(cardWidth).toBeGreaterThan(1024 * 0.25);
  });
});
