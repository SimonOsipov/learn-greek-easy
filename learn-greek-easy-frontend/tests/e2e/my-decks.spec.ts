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
 * - Security & Access Control:
 *   - Flow 8: Unauthorized deck access shows AlertDialog modal
 *   - Flow 8b: Modal cannot be dismissed with Escape key
 *   - Flow 9: Unauthenticated redirect for /my-decks
 *   - Flow 12: Unauthenticated redirect for /my-decks/:id
 *   - Flow 13: API returns 403 for unauthorized deck access
 * - Admin Flows:
 *   - Flow 10: Admin on My Decks page sees only their own deck (1 deck)
 *   - Flow 11: Admin Panel shows all decks (system + user-created)
 *
 * Test Users:
 * - e2e_learner: Has 3 user-owned decks (My Greek Basics, Travel Phrases, Practice Deck)
 * - e2e_beginner: Has 0 user-owned decks (empty state)
 * - e2e_admin: Has 1 user-owned deck (Admin's Personal Deck) + admin role
 */

import * as fs from 'fs';

import { test, expect } from '@playwright/test';

// Storage state paths
const LEARNER_AUTH = 'playwright/.auth/learner.json';
const BEGINNER_AUTH = 'playwright/.auth/beginner.json';
const ADMIN_AUTH = 'playwright/.auth/admin.json';

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

    // Wait for sub-menu to be visible with data-testid
    const subMenu = page.locator('[data-testid="mobile-submenu-decks"]');
    await expect(subMenu).toBeVisible({ timeout: 5000 });

    // Sub-menu should have "My Decks" option
    const myDecksLink = subMenu.getByRole('menuitem', { name: /my decks/i });
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

    // Should navigate to deck detail page (URL contains /my-decks/)
    await page.waitForURL(/\/my-decks\/[a-f0-9-]+/i);

    // Deck detail content should be visible - look for the deck detail container
    const deckDetail = page.locator('[data-testid="my-deck-detail"]');
    await expect(deckDetail).toBeVisible({ timeout: 10000 });

    // Verify breadcrumb navigation is present
    const breadcrumb = page.locator('[data-testid="breadcrumb"]');
    await expect(breadcrumb).toBeVisible();
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

    // Wait for loading to complete - either empty state OR decks grid OR error should appear
    // The skeleton disappears when loading completes
    const emptyState = page.locator('[data-testid="my-decks-empty-state"]');
    const decksGrid = page.locator('[data-testid="deck-card"]');
    const errorState = page.getByText(/error loading|try again/i);

    // Wait for one of the three states to appear
    await expect(
      emptyState.or(decksGrid.first()).or(errorState.first())
    ).toBeVisible({ timeout: 15000 });

    // Check what actually appeared
    const hasDecks = await decksGrid.count();
    const hasError = await errorState.count();
    const hasEmptyState = await emptyState.count();

    // Log what we found for debugging (will appear in test report)
    console.log(`[EMPTY-STATE-DEBUG] Found: decks=${hasDecks}, error=${hasError}, emptyState=${hasEmptyState}`);

    if (hasDecks > 0) {
      // Log the deck names we're seeing
      const deckNames = await page.locator('[data-testid="deck-card"]').allTextContents();
      console.log(`[EMPTY-STATE-DEBUG] Unexpected decks found: ${deckNames.join(', ')}`);
    }

    // Now verify it's the empty state specifically
    await expect(emptyState).toBeVisible({ timeout: 5000 });

    // Empty state message should be visible
    const emptyStateMessage = emptyState.getByText(/You haven't created any decks yet/i);
    await expect(emptyStateMessage).toBeVisible();

    // Create Deck CTA button within empty state should be visible and enabled
    // Use locator chain to target the button specifically within the empty state container
    const createDeckButton = emptyState.getByRole('button', { name: /create deck/i });
    await expect(createDeckButton).toBeVisible();
    await expect(createDeckButton).toBeEnabled();
  });

  test('should not show deck cards in empty state', async ({ page }) => {
    await page.goto('/my-decks');

    // Wait for page to load
    await expect(page.locator('[data-testid="my-decks-title"]')).toBeVisible({ timeout: 15000 });

    // Wait for loading to complete - either empty state, decks, or error should appear
    const emptyState = page.locator('[data-testid="my-decks-empty-state"]');
    const decksGrid = page.locator('[data-testid="deck-card"]');
    const errorState = page.getByText(/error loading|try again/i);

    await expect(
      emptyState.or(decksGrid.first()).or(errorState.first())
    ).toBeVisible({ timeout: 15000 });

    // Check what actually appeared
    const hasDecks = await decksGrid.count();
    const hasError = await errorState.count();
    const hasEmptyState = await emptyState.count();

    console.log(`[EMPTY-STATE-DEBUG] Found: decks=${hasDecks}, error=${hasError}, emptyState=${hasEmptyState}`);

    // Verify empty state is shown (not error or decks)
    await expect(emptyState).toBeVisible({ timeout: 5000 });

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

  test('Flow 5: Create Deck button should be enabled and clickable', async ({ page }) => {
    await page.goto('/my-decks');

    // Wait for page to load
    await expect(page.locator('[data-testid="my-decks-title"]')).toBeVisible({ timeout: 15000 });

    // Find the Create Deck button (now enabled)
    const createDeckButton = page.getByRole('button', { name: /create deck/i });
    await expect(createDeckButton).toBeVisible();
    await expect(createDeckButton).toBeEnabled();
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

    // Create Deck button should be enabled, Create Card button should be disabled
    await expect(createDeckButton).toBeEnabled();
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

// ============================================================================
// SECURITY & ACCESS CONTROL TESTS
// ============================================================================

/**
 * Helper function to read learner's auth state and extract access token
 */
function getLearnerAccessToken(): string | null {
  try {
    const learnerAuthState = JSON.parse(fs.readFileSync(LEARNER_AUTH, 'utf-8'));
    const learnerToken = learnerAuthState.origins?.[0]?.localStorage?.find(
      (item: { name: string; value: string }) => item.name === 'auth-storage'
    );
    if (learnerToken) {
      const authData = JSON.parse(learnerToken.value);
      return authData?.state?.accessToken || null;
    }
  } catch {
    // File might not exist or be invalid
  }
  return null;
}

/**
 * Helper function to read beginner's auth state and extract access token
 */
function getBeginnerAccessToken(): string | null {
  try {
    const beginnerAuthState = JSON.parse(fs.readFileSync(BEGINNER_AUTH, 'utf-8'));
    const beginnerToken = beginnerAuthState.origins?.[0]?.localStorage?.find(
      (item: { name: string; value: string }) => item.name === 'auth-storage'
    );
    if (beginnerToken) {
      const authData = JSON.parse(beginnerToken.value);
      return authData?.state?.accessToken || null;
    }
  } catch {
    // File might not exist or be invalid
  }
  return null;
}

test.describe('My Decks - Security & Access Control', () => {
  test.describe('Unauthorized Deck Access (Authenticated User)', () => {
    test.use({ storageState: BEGINNER_AUTH });

    test('Flow 8: should show access denied modal when accessing another user deck', async ({
      page,
      request,
    }) => {
      // Get learner's access token to fetch their decks
      const learnerAccessToken = getLearnerAccessToken();
      test.skip(!learnerAccessToken, 'Learner auth state not available');
      if (!learnerAccessToken) return;

      // Fetch learner's decks using their token
      const decksResponse = await request.get('/api/v1/decks/mine', {
        headers: {
          Authorization: `Bearer ${learnerAccessToken}`,
        },
      });

      test.skip(!decksResponse.ok(), 'Could not fetch learner decks');
      if (!decksResponse.ok()) return;

      const decksData = await decksResponse.json();
      test.skip(!decksData.decks?.length, 'Learner has no decks');
      if (!decksData.decks?.length) return;

      const learnerDeckId = decksData.decks[0].id;

      // Navigate to the learner's deck as beginner (should trigger 403 -> modal)
      await page.goto(`/my-decks/${learnerDeckId}`);

      // Wait for the AlertDialog modal to appear
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: 15000 });

      // Assert modal shows "Access Denied" title
      const title = dialog.getByRole('heading', { name: /access denied/i });
      await expect(title).toBeVisible();

      // Assert modal shows "This is not your deck" message
      const description = dialog.getByText(/this is not your deck/i);
      await expect(description).toBeVisible();

      // Assert modal has "Ok" button
      const okButton = dialog.getByRole('button', { name: /ok/i });
      await expect(okButton).toBeVisible();

      // Click "Ok" → should navigate to /my-decks
      await okButton.click();
      await expect(page).toHaveURL(/\/my-decks$/);
    });

    test('Flow 8b: access denied modal cannot be dismissed by pressing Escape', async ({
      page,
      request,
    }) => {
      // Get learner's access token to fetch their decks
      const learnerAccessToken = getLearnerAccessToken();
      test.skip(!learnerAccessToken, 'Learner auth state not available');
      if (!learnerAccessToken) return;

      // Fetch learner's decks using their token
      const decksResponse = await request.get('/api/v1/decks/mine', {
        headers: {
          Authorization: `Bearer ${learnerAccessToken}`,
        },
      });

      test.skip(!decksResponse.ok(), 'Could not fetch learner decks');
      if (!decksResponse.ok()) return;

      const decksData = await decksResponse.json();
      test.skip(!decksData.decks?.length, 'Learner has no decks');
      if (!decksData.decks?.length) return;

      const learnerDeckId = decksData.decks[0].id;

      // Navigate to the learner's deck as beginner
      await page.goto(`/my-decks/${learnerDeckId}`);

      // Wait for the AlertDialog modal to appear
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: 15000 });

      // Press Escape - modal should NOT close (non-dismissible)
      await page.keyboard.press('Escape');

      // Modal should still be visible after pressing Escape
      await expect(dialog).toBeVisible();

      // Title should still be visible
      await expect(dialog.getByRole('heading', { name: /access denied/i })).toBeVisible();
    });
  });

  test.describe('Unauthenticated Access', () => {
    // Use empty storage state to simulate unauthenticated user
    test.use({ storageState: { cookies: [], origins: [] } });

    test('Flow 9: should redirect to login when accessing /my-decks unauthenticated', async ({
      page,
    }) => {
      // Navigate directly to /my-decks without authentication
      await page.goto('/my-decks');

      // Should be redirected to login page
      await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    });

    test('Flow 12: should redirect to login when accessing /my-decks/:id unauthenticated', async ({
      page,
    }) => {
      // Navigate directly to a specific deck detail page without authentication
      // Use a random UUID to simulate accessing a deck
      const randomUuid = '12345678-1234-1234-1234-123456789abc';
      await page.goto(`/my-decks/${randomUuid}`);

      // Should be redirected to login page
      await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    });
  });

  test.describe('API Access Control', () => {
    test.use({ storageState: BEGINNER_AUTH });

    test('Flow 13: API should return 403 for unauthorized deck access', async ({ request }) => {
      // Get both users' access tokens
      const learnerAccessToken = getLearnerAccessToken();
      const beginnerAccessToken = getBeginnerAccessToken();

      test.skip(
        !learnerAccessToken || !beginnerAccessToken,
        'Auth states not available for both users'
      );
      if (!learnerAccessToken || !beginnerAccessToken) return;

      // Fetch learner's decks to get a deck ID
      const decksResponse = await request.get('/api/v1/decks/mine', {
        headers: {
          Authorization: `Bearer ${learnerAccessToken}`,
        },
      });

      test.skip(!decksResponse.ok(), 'Could not fetch learner decks');
      if (!decksResponse.ok()) return;

      const decksData = await decksResponse.json();
      test.skip(!decksData.decks?.length, 'Learner has no decks');
      if (!decksData.decks?.length) return;

      const learnerDeckId = decksData.decks[0].id;

      // Make API request as beginner to access learner's deck
      const response = await request.get(`/api/v1/decks/${learnerDeckId}`, {
        headers: {
          Authorization: `Bearer ${beginnerAccessToken}`,
        },
      });

      // Assert 403 status code
      expect(response.status()).toBe(403);

      // Assert error response includes appropriate error detail
      const errorData = await response.json();
      expect(errorData.detail).toBeDefined();
    });
  });
});

// ============================================================================
// ADMIN FLOW TESTS
// ============================================================================

test.describe('My Decks - Admin Flows', () => {
  test.use({ storageState: ADMIN_AUTH });

  test('Flow 10: admin sees only their own deck on My Decks page', async ({ page }) => {
    // Navigate to My Decks page
    await page.goto('/my-decks');

    // Wait for page to load
    await expect(page.locator('[data-testid="my-decks-title"]')).toBeVisible({
      timeout: 15000,
    });

    // Wait for deck cards to load (or empty state)
    const deckCards = page.locator('[data-testid="deck-card"]');
    await expect(deckCards.first()).toBeVisible({ timeout: 15000 });

    // Admin should see exactly 1 deck - their own personal deck
    // (NOT system decks, NOT other users' decks)
    const count = await deckCards.count();
    expect(count).toBe(1);

    // Assert it's the admin's personal deck (use the title element specifically)
    await expect(
      page.locator('[data-testid="deck-card-title"]', { hasText: "Admin's Personal Deck" })
    ).toBeVisible();

    // System decks should NOT be shown (A1, A2, B1, B2, C1, C2)
    await expect(
      page.locator('[data-testid="deck-card-title"]', { hasText: 'Greek A1 Vocabulary' })
    ).toHaveCount(0);
    await expect(
      page.locator('[data-testid="deck-card-title"]', { hasText: 'Greek A2 Vocabulary' })
    ).toHaveCount(0);

    // Other users' decks should NOT be shown
    await expect(
      page.locator('[data-testid="deck-card-title"]', { hasText: 'My Greek Basics' })
    ).toHaveCount(0);
    await expect(
      page.locator('[data-testid="deck-card-title"]', { hasText: 'Travel Phrases' })
    ).toHaveCount(0);
  });

  test('Flow 11: admin panel shows all decks (system + user-created)', async ({ page }) => {
    // Navigate to Admin page
    await page.goto('/admin');

    // Wait for admin page to load
    await expect(page.locator('[data-testid="admin-title"]')).toBeVisible({
      timeout: 15000,
    });

    // Find the All Decks section
    const allDecksSection = page.locator('[data-testid="all-decks-title"]');
    await expect(allDecksSection).toBeVisible({ timeout: 10000 });

    // Wait for decks to load in the All Decks list
    // The admin panel lists all decks with pagination
    await page.waitForLoadState('networkidle');

    // Find the search input within the All Decks section to scope our searches
    const searchInput = page.locator('[data-testid="deck-search-input"]');
    await expect(searchInput).toBeVisible({ timeout: 10000 });

    // The pagination is near the search input - find it in the same section
    // Look for the pagination section that has the pagination buttons
    const allDecksCard = page.locator('section', {
      has: page.locator('[data-testid="all-decks-title"]'),
    });

    // Wait for pagination to appear in All Decks section
    const paginationText = allDecksCard.locator('text=/Showing \\d+-\\d+ of \\d+/');
    await expect(paginationText).toBeVisible({ timeout: 10000 });

    // Get the pagination text and verify total count
    const paginationContent = await paginationText.textContent();
    // Extract total from "Showing X-Y of TOTAL"
    const totalMatch = paginationContent?.match(/of (\d+)/);
    const totalDecks = totalMatch ? parseInt(totalMatch[1], 10) : 0;

    // Should have at least 10 decks (6 system vocabulary + 5 culture + 4 user-created = 15)
    // Note: The actual count is 15 (6 vocab + 5 culture + 4 user decks)
    expect(totalDecks).toBeGreaterThanOrEqual(10);

    // Verify we can see system decks by searching for A1 vocabulary deck
    await searchInput.fill('Greek A1');
    await page.waitForTimeout(500); // Wait for debounce

    // Should find the A1 system deck
    await expect(allDecksCard.getByText('Greek A1 Vocabulary')).toBeVisible({ timeout: 5000 });

    // Clear search and search for user deck
    await searchInput.clear();
    await searchInput.fill("Admin's Personal");
    await page.waitForTimeout(500);

    // Should find the admin's personal deck
    await expect(allDecksCard.getByText("Admin's Personal Deck")).toBeVisible({ timeout: 5000 });

    // Clear search and search for learner's deck
    await searchInput.clear();
    await searchInput.fill('My Greek Basics');
    await page.waitForTimeout(500);

    // Admin can see learner's deck in admin panel (all user decks are visible to admin)
    await expect(allDecksCard.getByText('My Greek Basics')).toBeVisible({ timeout: 5000 });
  });
});
