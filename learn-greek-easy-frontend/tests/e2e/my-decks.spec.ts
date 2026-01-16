/**
 * My Decks E2E Tests
 *
 * Tests for the My Decks feature including:
 * - Desktop and mobile navigation to My Decks page
 * - My Decks page content for users with decks
 * - Empty state for users without decks
 * - Disabled button tooltips
 * - Dropdown navigation highlighting
 * - Own deck detail access
 *
 * Test Users:
 * - e2e_learner: Has 3 user-owned decks (My Greek Basics, Travel Phrases, Practice Deck)
 * - e2e_beginner: Has 0 user-owned decks (empty state)
 * - e2e_admin: Has admin role
 */

import { test, expect } from '@playwright/test';
import { STORAGE_STATE } from '../../playwright.config';

// Storage state paths
const LEARNER_AUTH = 'playwright/.auth/learner.json';
const BEGINNER_AUTH = 'playwright/.auth/beginner.json';

// ============================================================================
// DESKTOP NAVIGATION TESTS
// ============================================================================

test.describe('My Decks - Desktop Navigation', () => {
  test.use({ storageState: LEARNER_AUTH });

  test('Flow 1: should navigate to My Decks via desktop dropdown', async ({ page }) => {
    // Start at dashboard
    await page.goto('/dashboard');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({
      timeout: 15000,
    });

    // Click the Decks dropdown trigger in top navigation
    const decksDropdown = page.locator('[data-testid="decks-dropdown-trigger"]');
    await expect(decksDropdown).toBeVisible();
    await decksDropdown.click();

    // Click "My Decks" in the dropdown
    const myDecksLink = page.getByRole('menuitem', { name: /my decks/i });
    await expect(myDecksLink).toBeVisible();
    await myDecksLink.click();

    // Should navigate to /my-decks
    await expect(page).toHaveURL(/\/my-decks/);

    // Page title should be visible
    await expect(page.locator('[data-testid="my-decks-title"]')).toBeVisible();
  });

  test('Flow 16: Decks dropdown should be highlighted on /decks', async ({ page }) => {
    await page.goto('/decks');

    // Wait for page to load
    await expect(page.locator('[data-testid="decks-title"]')).toBeVisible({ timeout: 15000 });

    // The Decks dropdown trigger should have active styling (text-primary class)
    const decksDropdown = page.locator('[data-testid="decks-dropdown-trigger"]');
    await expect(decksDropdown).toBeVisible();

    // Check that it has the active color (text-primary class indicates active state)
    await expect(decksDropdown).toHaveClass(/text-primary/);
  });

  test('Flow 17: Decks dropdown should be highlighted on /my-decks', async ({ page }) => {
    await page.goto('/my-decks');

    // Wait for page to load
    await expect(page.locator('[data-testid="my-decks-title"]')).toBeVisible({ timeout: 15000 });

    // The Decks dropdown trigger should have active styling (text-primary class)
    const decksDropdown = page.locator('[data-testid="decks-dropdown-trigger"]');
    await expect(decksDropdown).toBeVisible();

    // Check that it has the active color
    await expect(decksDropdown).toHaveClass(/text-primary/);
  });
});

// ============================================================================
// MOBILE NAVIGATION TESTS
// ============================================================================

test.describe('My Decks - Mobile Navigation', () => {
  test.use({
    storageState: LEARNER_AUTH,
    viewport: { width: 375, height: 667 }, // iPhone SE
  });

  test('Flow 2: should navigate to My Decks via mobile bottom navigation', async ({ page }) => {
    // Start at dashboard
    await page.goto('/dashboard');

    // Wait for mobile layout to render
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({
      timeout: 15000,
    });

    // Find the Decks button in mobile bottom navigation (has sub-menu with chevron)
    const decksNavButton = page.locator('nav button').filter({
      has: page.locator('span:text-matches("Decks", "i")'),
    });
    await expect(decksNavButton).toBeVisible();
    await decksNavButton.click();

    // Sub-menu should appear with "My Decks" option
    const myDecksLink = page.getByRole('menuitem', { name: /my decks/i });
    await expect(myDecksLink).toBeVisible();
    await myDecksLink.click();

    // Should navigate to /my-decks
    await expect(page).toHaveURL(/\/my-decks/);

    // Page title should be visible
    await expect(page.locator('[data-testid="my-decks-title"]')).toBeVisible();
  });
});

// ============================================================================
// MY DECKS PAGE CONTENT TESTS (Learner - Has Decks)
// ============================================================================

test.describe('My Decks - Page Content', () => {
  test.use({ storageState: LEARNER_AUTH });

  test('Flow 3: should display user-owned decks for learner', async ({ page }) => {
    await page.goto('/my-decks');

    // Wait for page title
    await expect(page.locator('[data-testid="my-decks-title"]')).toBeVisible({ timeout: 15000 });

    // Wait for deck cards to load
    const deckCards = page.locator('[data-testid="deck-card"]');
    await expect(deckCards.first()).toBeVisible({ timeout: 15000 });

    // Should display exactly 3 decks for e2e_learner
    // (My Greek Basics, Travel Phrases, Practice Deck)
    const count = await deckCards.count();
    expect(count).toBe(3);
  });

  test('should display correct deck names for learner', async ({ page }) => {
    await page.goto('/my-decks');

    // Wait for page title
    await expect(page.locator('[data-testid="my-decks-title"]')).toBeVisible({ timeout: 15000 });

    // Wait for deck cards to load
    await expect(page.locator('[data-testid="deck-card"]').first()).toBeVisible({ timeout: 15000 });

    // Verify expected deck names are visible
    const expectedDeckNames = ['My Greek Basics', 'Travel Phrases', 'Practice Deck'];

    for (const deckName of expectedDeckNames) {
      const deckTitle = page.locator('[data-testid="deck-card-title"]', { hasText: deckName });
      await expect(deckTitle).toBeVisible();
    }
  });

  test('Flow 15: should navigate to own deck detail page', async ({ page }) => {
    await page.goto('/my-decks');

    // Wait for deck cards to load
    const firstDeck = page.locator('[data-testid="deck-card"]').first();
    await expect(firstDeck).toBeVisible({ timeout: 15000 });

    // Click on the first deck
    await firstDeck.click();

    // Should navigate to deck detail page (URL contains /deck/ or /decks/)
    await page.waitForURL(/\/(deck|decks)\/[a-f0-9-]+/i);

    // Deck detail content should be visible - look for action buttons or deck info
    const deckContent = page.getByRole('button', { name: /start|continue|review/i }).first();
    await expect(deckContent).toBeVisible({ timeout: 10000 });
  });
});

// ============================================================================
// EMPTY STATE TESTS (Beginner - No Decks)
// ============================================================================

test.describe('My Decks - Empty State', () => {
  test.use({ storageState: BEGINNER_AUTH });

  test('Flow 4: should display empty state for user without decks', async ({ page }) => {
    await page.goto('/my-decks');

    // Wait for page title
    await expect(page.locator('[data-testid="my-decks-title"]')).toBeVisible({ timeout: 15000 });

    // Empty state should be visible (contains the BookOpen icon and message)
    const emptyStateMessage = page.getByText(/You haven't created any decks yet/i);
    await expect(emptyStateMessage).toBeVisible({ timeout: 10000 });

    // Create Deck CTA button should be visible but disabled
    const createDeckButton = page.getByRole('button', { name: /create deck/i });
    await expect(createDeckButton).toBeVisible();
    await expect(createDeckButton).toBeDisabled();
  });

  test('should not show deck cards in empty state', async ({ page }) => {
    await page.goto('/my-decks');

    // Wait for page to load
    await expect(page.locator('[data-testid="my-decks-title"]')).toBeVisible({ timeout: 15000 });

    // Wait for empty state to render (give API time to respond)
    await page.waitForTimeout(2000);

    // No deck cards should be visible
    const deckCards = page.locator('[data-testid="deck-card"]');
    await expect(deckCards).toHaveCount(0);
  });
});

// ============================================================================
// DISABLED BUTTON TOOLTIP TESTS
// ============================================================================

test.describe('My Decks - Disabled Button Tooltips', () => {
  test.use({ storageState: LEARNER_AUTH });

  test('Flow 5: should show "Coming soon" tooltip on Create Deck button hover', async ({
    page,
  }) => {
    await page.goto('/my-decks');

    // Wait for page to load
    await expect(page.locator('[data-testid="my-decks-title"]')).toBeVisible({ timeout: 15000 });

    // Find the Create Deck button (disabled)
    const createDeckButtonWrapper = page.locator('span').filter({
      has: page.getByRole('button', { name: /create deck/i }),
    });
    await expect(createDeckButtonWrapper).toBeVisible();

    // Hover over the button wrapper to trigger tooltip
    await createDeckButtonWrapper.hover();

    // Tooltip with "Coming soon" should appear
    const tooltip = page.getByRole('tooltip').getByText(/coming soon/i);
    await expect(tooltip).toBeVisible({ timeout: 5000 });
  });

  test('should show "Coming soon" tooltip on Create Card button hover', async ({ page }) => {
    await page.goto('/my-decks');

    // Wait for page to load
    await expect(page.locator('[data-testid="my-decks-title"]')).toBeVisible({ timeout: 15000 });

    // Find the Create Card button (disabled)
    const createCardButtonWrapper = page.locator('span').filter({
      has: page.getByRole('button', { name: /create card/i }),
    });
    await expect(createCardButtonWrapper).toBeVisible();

    // Hover over the button wrapper to trigger tooltip
    await createCardButtonWrapper.hover();

    // Tooltip with "Coming soon" should appear
    const tooltip = page.getByRole('tooltip').getByText(/coming soon/i);
    await expect(tooltip).toBeVisible({ timeout: 5000 });
  });
});

// ============================================================================
// STATISTICS DROPDOWN HIGHLIGHTING (Gap Coverage)
// ============================================================================

test.describe('My Decks - Statistics Dropdown Highlighting', () => {
  test.use({ storageState: LEARNER_AUTH });

  test('Flow 18: Statistics dropdown should be highlighted on /statistics', async ({ page }) => {
    await page.goto('/statistics');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // The Statistics dropdown trigger should have active styling
    const statsDropdown = page.locator('[data-testid="statistics-dropdown-trigger"]');
    await expect(statsDropdown).toBeVisible();

    // Check that it has the active color
    await expect(statsDropdown).toHaveClass(/text-primary/);
  });

  test('Statistics dropdown should be highlighted on /achievements', async ({ page }) => {
    await page.goto('/achievements');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // The Statistics dropdown trigger should have active styling
    const statsDropdown = page.locator('[data-testid="statistics-dropdown-trigger"]');
    await expect(statsDropdown).toBeVisible();

    // Check that it has the active color
    await expect(statsDropdown).toHaveClass(/text-primary/);
  });
});

// ============================================================================
// PAGE STRUCTURE TESTS
// ============================================================================

test.describe('My Decks - Page Structure', () => {
  test.use({ storageState: LEARNER_AUTH });

  test('should have proper page structure with action buttons card', async ({ page }) => {
    await page.goto('/my-decks');

    // Wait for page to load
    await expect(page.locator('[data-testid="my-decks-title"]')).toBeVisible({ timeout: 15000 });

    // Action buttons card should be visible
    const createDeckButton = page.getByRole('button', { name: /create deck/i });
    const createCardButton = page.getByRole('button', { name: /create card/i });

    await expect(createDeckButton).toBeVisible();
    await expect(createCardButton).toBeVisible();

    // Both buttons should be disabled
    await expect(createDeckButton).toBeDisabled();
    await expect(createCardButton).toBeDisabled();
  });

  test('should display decks in a grid layout', async ({ page }) => {
    await page.goto('/my-decks');

    // Wait for deck cards to load
    const deckCards = page.locator('[data-testid="deck-card"]');
    await expect(deckCards.first()).toBeVisible({ timeout: 15000 });

    // On desktop viewport, check that cards are in a grid (multiple cards visible)
    const count = await deckCards.count();
    expect(count).toBeGreaterThan(0);

    // Each card should have a title
    for (let i = 0; i < count; i++) {
      const card = deckCards.nth(i);
      const title = card.locator('[data-testid="deck-card-title"]');
      await expect(title).toBeVisible();
    }
  });
});
