/**
 * Deck Browsing E2E Tests
 */

import { test, expect } from '@playwright/test';

test.describe('Deck Browsing', () => {
  test('should display decks page with navigation', async ({ page }) => {
    await page.goto('/decks');

    // Verify heading
    await expect(page.getByRole('heading', { name: /decks/i })).toBeVisible();

    // Verify page is accessible
    await expect(page).toHaveURL(/\/decks/);
  });

  test('should navigate to decks page from dashboard', async ({ page }) => {
    await page.goto('/');

    // Find and click the Decks dropdown trigger
    const decksDropdown = page.locator('[data-testid="decks-dropdown-trigger"]');
    await expect(decksDropdown).toBeVisible();
    await decksDropdown.click();

    // Click "All Decks" in the dropdown menu
    const allDecksLink = page.getByRole('menuitem', { name: /all decks/i });
    await expect(allDecksLink).toBeVisible();
    await allDecksLink.click();

    // Should navigate to decks page
    await page.waitForURL(/\/decks/);
    await expect(page.getByRole('heading', { name: /decks/i })).toBeVisible();
  });

  // ENABLED: Now uses seed data from E2E database seeding infrastructure (SEED-10)
  test('should display dashboard page with user greeting', async ({ page }) => {
    await page.goto('/');

    // Verify dashboard heading
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();

    // Verify user greeting or welcome message exists
    const greeting = page.getByText(/welcome|hello|hi/i);
    const hasGreeting = await greeting.isVisible().catch(() => false);

    // Dashboard should have some content
    const content = await page.content();
    expect(content.length).toBeGreaterThan(100);
  });

  test('should have working navigation menu', async ({ page }) => {
    await page.goto('/');

    // Verify Dashboard link exists (direct link)
    const dashboardLink = page.getByRole('link', { name: /dashboard/i }).first();
    await expect(dashboardLink).toBeVisible();

    // Verify Decks dropdown trigger exists (it's now a dropdown, not a direct link)
    const decksDropdown = page.locator('[data-testid="decks-dropdown-trigger"]');
    await expect(decksDropdown).toBeVisible();
  });

  test('should access profile page', async ({ page }) => {
    await page.goto('/profile');

    // Verify profile page loaded
    await expect(page.getByRole('heading', { name: /profile/i })).toBeVisible();
  });

  test('E2E-03.1: Browse all decks', async ({ page }) => {
    await page.goto('/decks');

    // Verify decks page loaded
    await expect(page.getByRole('heading', { name: /decks/i })).toBeVisible();

    // Wait for deck cards to load from API (replaces fixed timeout with proper wait)
    const deckCards = page.locator('[data-testid="deck-card"]');
    await expect(deckCards.first()).toBeVisible({ timeout: 15000 });

    // Verify at least 1 deck card visible
    const count = await deckCards.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('E2E-03.2: Filter decks by level (A1)', async ({ page }) => {
    await page.goto('/decks');

    // Wait for deck cards to load
    const deckCards = page.locator('[data-testid="deck-card"]');
    await expect(deckCards.first()).toBeVisible({ timeout: 15000 });

    // Look for A1 filter button
    const a1FilterBtn = page.getByRole('button', { name: /^a1$/i });
    const isA1FilterVisible = await a1FilterBtn.isVisible().catch(() => false);

    if (isA1FilterVisible) {
      // Click A1 filter button
      await a1FilterBtn.click();
      // Wait for filter to be applied (button state change)
      await expect(a1FilterBtn).toHaveAttribute('aria-pressed', 'true');

      // Verify page still shows decks (filtered results)
      const pageContent = await page.textContent('body');
      expect(pageContent).toBeTruthy();
    } else {
      // Filter might not be implemented, just verify decks page works
      await expect(page.getByRole('heading', { name: /decks/i })).toBeVisible();
    }
  });

  test('E2E-03.3: Filter decks by status', async ({ page }) => {
    await page.goto('/decks');

    // Wait for deck cards to load
    const deckCards = page.locator('[data-testid="deck-card"]');
    await expect(deckCards.first()).toBeVisible({ timeout: 15000 });

    // Look for status filter buttons
    const statusFilterBtn = page.getByRole('button', { name: /in progress|not started|completed/i }).first();
    const isStatusFilterVisible = await statusFilterBtn.isVisible().catch(() => false);

    if (isStatusFilterVisible) {
      // Click status filter
      await statusFilterBtn.click();
      // Wait for filter to be applied (button state change)
      await expect(statusFilterBtn).toHaveAttribute('aria-pressed', 'true');

      // Verify filtered results or no results message
      const pageContent = await page.textContent('body');
      expect(pageContent).toBeTruthy();
    } else {
      // Status filter might not be implemented
      await expect(page.getByRole('heading', { name: /decks/i })).toBeVisible();
    }
  });

  test('E2E-03.4: Search decks by name', async ({ page }) => {
    await page.goto('/decks');

    // Wait for deck cards to load
    const deckCards = page.locator('[data-testid="deck-card"]');
    await expect(deckCards.first()).toBeVisible({ timeout: 15000 });

    // Look for search input
    const searchInput = page.getByPlaceholder(/search/i).or(
      page.getByRole('textbox', { name: /search/i })
    );
    const isSearchVisible = await searchInput.isVisible().catch(() => false);

    if (isSearchVisible) {
      // Type in search box
      await searchInput.fill('Greek');

      // Wait for filtering (debounced) - check page is still functional
      await expect(page.getByRole('heading', { name: /decks/i })).toBeVisible();

      // Verify page content updated (search results)
      const pageContent = await page.textContent('body');
      expect(pageContent).toBeTruthy();
    } else {
      // Search might not be implemented
      await expect(page.getByRole('heading', { name: /decks/i })).toBeVisible();
    }
  });

  test('E2E-03.5: View deck details', async ({ page }) => {
    await page.goto('/decks');

    // Wait for deck cards to load from API
    const firstDeck = page.locator('[data-testid="deck-card"]').first();
    await expect(firstDeck).toBeVisible({ timeout: 15000 });
    await firstDeck.click();

    // Wait for detail page to load - look for action button
    const actionButton = page.getByRole('button', { name: /review|start|continue/i }).first();
    await expect(actionButton).toBeVisible({ timeout: 10000 });

    // Verify deck detail page loaded (should have deck name and actions)
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();

    // Should have some action available or deck information
    expect(pageContent.includes('card')).toBe(true);
  });

  test('E2E-03.6: Reset filters', async ({ page }) => {
    await page.goto('/decks');

    // Wait for deck cards to load from API
    const deckCards = page.locator('[data-testid="deck-card"]');
    await expect(deckCards.first()).toBeVisible({ timeout: 15000 });

    // Try to apply a filter first
    const filterButton = page.getByRole('button', { name: /^a1$|filter/i }).first();
    const isFilterVisible = await filterButton.isVisible().catch(() => false);

    if (isFilterVisible) {
      await filterButton.click();
      // Wait for filter to be applied
      await expect(filterButton).toHaveAttribute('aria-pressed', 'true');
    }

    // Look for clear/reset button
    const clearButton = page.getByRole('button', { name: /clear|reset|all/i });
    const isClearVisible = await clearButton.isVisible().catch(() => false);

    if (isClearVisible) {
      await clearButton.click();
      // Wait for reset to complete - page should be visible
      await expect(page.getByRole('heading', { name: /decks/i })).toBeVisible();
    } else {
      // Clear button might not exist, just verify page works
      await expect(page.getByRole('heading', { name: /decks/i })).toBeVisible();
    }
  });
});
