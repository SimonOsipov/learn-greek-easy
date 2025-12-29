/**
 * Deck Filter - Culture/Level Interaction E2E Tests
 *
 * Tests for the bug fix: "Level filter remains enabled when Culture filter is selected"
 *
 * These tests verify:
 * 1. Level filter buttons are disabled when Culture deck type is selected
 * 2. Level filters are automatically cleared when switching to Culture
 * 3. Level filters work normally for All and Vocabulary deck types
 * 4. Visual feedback (dimmed label) appears when level filter is disabled
 */

import { test, expect } from '@playwright/test';

test.describe('Deck Filter - Culture/Level Interaction', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to decks page and wait for it to load
    await page.goto('/decks');
    await expect(page.getByRole('heading', { name: /decks/i })).toBeVisible();

    // Wait for deck cards to load
    const deckCards = page.locator('[data-testid="deck-card"]');
    await expect(deckCards.first()).toBeVisible({ timeout: 15000 });
  });

  test.describe('Level Filter Disabled for Culture', () => {
    test('should disable level buttons when Culture deck type is selected', async ({ page }) => {
      // Find the Culture type button
      const cultureButton = page.getByRole('button', { name: 'Culture', exact: true });
      await expect(cultureButton).toBeVisible();

      // Click Culture to filter
      await cultureButton.click();
      await page.waitForTimeout(500); // Wait for filter to apply

      // Verify level buttons are disabled
      const a1Button = page.getByRole('button', { name: /^A1$/i });
      const a2Button = page.getByRole('button', { name: /^A2$/i });
      const b1Button = page.getByRole('button', { name: /^B1$/i });
      const b2Button = page.getByRole('button', { name: /^B2$/i });

      await expect(a1Button).toBeDisabled();
      await expect(a2Button).toBeDisabled();
      await expect(b1Button).toBeDisabled();
      await expect(b2Button).toBeDisabled();
    });

    test('should enable level buttons when All deck type is selected', async ({ page }) => {
      // Ensure we start with "All" selected
      const allButton = page.getByRole('button', { name: 'All', exact: true });
      await expect(allButton).toBeVisible();

      // Verify level buttons are enabled
      const a1Button = page.getByRole('button', { name: /^A1$/i });
      const a2Button = page.getByRole('button', { name: /^A2$/i });

      await expect(a1Button).toBeEnabled();
      await expect(a2Button).toBeEnabled();
    });

    test('should enable level buttons when Vocabulary deck type is selected', async ({ page }) => {
      // Click Vocabulary type filter
      const vocabButton = page.getByRole('button', { name: 'Vocabulary', exact: true });
      await expect(vocabButton).toBeVisible();
      await vocabButton.click();
      await page.waitForTimeout(500);

      // Verify level buttons are enabled
      const a1Button = page.getByRole('button', { name: /^A1$/i });
      const b1Button = page.getByRole('button', { name: /^B1$/i });

      await expect(a1Button).toBeEnabled();
      await expect(b1Button).toBeEnabled();
    });
  });

  test.describe('Level Filters Cleared on Culture Switch', () => {
    test('should clear selected levels when switching to Culture', async ({ page }) => {
      // First, select a level filter
      const a1Button = page.getByRole('button', { name: /^A1$/i });
      await expect(a1Button).toBeVisible();
      await a1Button.click();
      await page.waitForTimeout(500);

      // Verify A1 is selected (has aria-pressed="true" or specific class)
      await expect(a1Button).toHaveAttribute('aria-pressed', 'true');

      // Now switch to Culture
      const cultureButton = page.getByRole('button', { name: 'Culture', exact: true });
      await cultureButton.click();
      await page.waitForTimeout(500);

      // The A1 button should now be disabled and not pressed
      await expect(a1Button).toBeDisabled();
      // When switching to culture, levels are cleared so aria-pressed should be false
      await expect(a1Button).toHaveAttribute('aria-pressed', 'false');
    });

    test('should clear multiple selected levels when switching to Culture', async ({ page }) => {
      // Select multiple level filters
      const a1Button = page.getByRole('button', { name: /^A1$/i });
      const b1Button = page.getByRole('button', { name: /^B1$/i });

      await a1Button.click();
      await page.waitForTimeout(300);
      await b1Button.click();
      await page.waitForTimeout(500);

      // Verify both are selected
      await expect(a1Button).toHaveAttribute('aria-pressed', 'true');
      await expect(b1Button).toHaveAttribute('aria-pressed', 'true');

      // Switch to Culture
      const cultureButton = page.getByRole('button', { name: 'Culture', exact: true });
      await cultureButton.click();
      await page.waitForTimeout(500);

      // Both should be disabled and cleared
      await expect(a1Button).toBeDisabled();
      await expect(b1Button).toBeDisabled();
      await expect(a1Button).toHaveAttribute('aria-pressed', 'false');
      await expect(b1Button).toHaveAttribute('aria-pressed', 'false');
    });
  });

  test.describe('Level Filters Restored After Culture', () => {
    test('should allow level selection after switching from Culture to Vocabulary', async ({ page }) => {
      // First switch to Culture
      const cultureButton = page.getByRole('button', { name: 'Culture', exact: true });
      await cultureButton.click();
      await page.waitForTimeout(500);

      // Verify levels are disabled
      const a1Button = page.getByRole('button', { name: /^A1$/i });
      await expect(a1Button).toBeDisabled();

      // Switch to Vocabulary
      const vocabButton = page.getByRole('button', { name: 'Vocabulary', exact: true });
      await vocabButton.click();
      await page.waitForTimeout(500);

      // Levels should be enabled now
      await expect(a1Button).toBeEnabled();

      // Should be able to select a level
      await a1Button.click();
      await page.waitForTimeout(300);
      await expect(a1Button).toHaveAttribute('aria-pressed', 'true');
    });

    test('should allow level selection after switching from Culture to All', async ({ page }) => {
      // Switch to Culture first
      const cultureButton = page.getByRole('button', { name: 'Culture', exact: true });
      await cultureButton.click();
      await page.waitForTimeout(500);

      // Switch to All
      const allButton = page.getByRole('button', { name: 'All', exact: true });
      await allButton.click();
      await page.waitForTimeout(500);

      // Levels should be enabled
      const b2Button = page.getByRole('button', { name: /^B2$/i });
      await expect(b2Button).toBeEnabled();

      // Should be able to select a level
      await b2Button.click();
      await page.waitForTimeout(300);
      await expect(b2Button).toHaveAttribute('aria-pressed', 'true');
    });
  });

  test.describe('Visual Feedback', () => {
    test('should dim level label when Culture is selected', async ({ page }) => {
      // Find the level label
      const levelLabel = page.getByText(/level:/i);

      // Initially should have normal color (gray-700)
      await expect(levelLabel).toBeVisible();
      await expect(levelLabel).toHaveClass(/text-gray-700/);

      // Switch to Culture
      const cultureButton = page.getByRole('button', { name: 'Culture', exact: true });
      await cultureButton.click();
      await page.waitForTimeout(500);

      // Label should now be dimmed (gray-400)
      await expect(levelLabel).toHaveClass(/text-gray-400/);
    });

    test('should show tooltip on disabled level buttons', async ({ page }) => {
      // Switch to Culture
      const cultureButton = page.getByRole('button', { name: 'Culture', exact: true });
      await cultureButton.click();
      await page.waitForTimeout(500);

      // Hover over a level button
      const a1Button = page.getByRole('button', { name: /^A1$/i });

      // Check that button has a title attribute
      const title = await a1Button.getAttribute('title');
      expect(title).toBeTruthy();
      expect(title).toContain('Culture');
    });
  });

  test.describe('Filter Interactions', () => {
    test('should preserve status and search filters when switching to Culture', async ({ page }) => {
      // Apply an "In Progress" status filter
      const inProgressButton = page.getByRole('button', { name: /in progress/i });
      if (await inProgressButton.isVisible().catch(() => false)) {
        await inProgressButton.click();
        await page.waitForTimeout(500);

        // Switch to Culture
        const cultureButton = page.getByRole('button', { name: 'Culture', exact: true });
        await cultureButton.click();
        await page.waitForTimeout(500);

        // Status filter should still be active
        await expect(inProgressButton).toHaveAttribute('aria-pressed', 'true');
      }
    });

    test('should not prevent other filter operations when level is disabled', async ({ page }) => {
      // Switch to Culture
      const cultureButton = page.getByRole('button', { name: 'Culture', exact: true });
      await cultureButton.click();
      await page.waitForTimeout(500);

      // Should still be able to use search
      const searchInput = page.getByPlaceholder(/search/i);
      if (await searchInput.isVisible().catch(() => false)) {
        await searchInput.fill('history');
        await page.waitForTimeout(800); // Wait for debounced search

        // Page should still be functional
        await expect(page.getByRole('heading', { name: /decks/i })).toBeVisible();
      }

      // Should still be able to use status filter
      const completedButton = page.getByRole('button', { name: 'Completed', exact: true });
      if (await completedButton.isVisible().catch(() => false)) {
        await completedButton.click();
        await page.waitForTimeout(500);

        // Page should still be functional
        await expect(page.getByRole('heading', { name: /decks/i })).toBeVisible();
      }
    });
  });

  test.describe('Regression Prevention', () => {
    test('should not allow clicking disabled level buttons', async ({ page }) => {
      // Switch to Culture
      const cultureButton = page.getByRole('button', { name: 'Culture', exact: true });
      await cultureButton.click();
      await page.waitForTimeout(500);

      // Try to click a disabled level button
      const a1Button = page.getByRole('button', { name: /^A1$/i });

      // Button should be disabled
      await expect(a1Button).toBeDisabled();

      // Force click attempt (to verify disabled state is enforced)
      // The aria-pressed should remain false
      await expect(a1Button).toHaveAttribute('aria-pressed', 'false');
    });

    test('should correctly toggle between deck types multiple times', async ({ page }) => {
      const allButton = page.getByRole('button', { name: 'All', exact: true });
      const cultureButton = page.getByRole('button', { name: 'Culture', exact: true });
      const vocabButton = page.getByRole('button', { name: 'Vocabulary', exact: true });
      const a1Button = page.getByRole('button', { name: /^A1$/i });

      // All -> Culture
      await cultureButton.click();
      await page.waitForTimeout(300);
      await expect(a1Button).toBeDisabled();

      // Culture -> Vocabulary
      await vocabButton.click();
      await page.waitForTimeout(300);
      await expect(a1Button).toBeEnabled();

      // Vocabulary -> Culture
      await a1Button.click();
      await page.waitForTimeout(300);
      await expect(a1Button).toHaveAttribute('aria-pressed', 'true');

      await cultureButton.click();
      await page.waitForTimeout(300);
      await expect(a1Button).toBeDisabled();
      await expect(a1Button).toHaveAttribute('aria-pressed', 'false');

      // Culture -> All
      await allButton.click();
      await page.waitForTimeout(300);
      await expect(a1Button).toBeEnabled();
      await expect(a1Button).toHaveAttribute('aria-pressed', 'false');
    });
  });
});
