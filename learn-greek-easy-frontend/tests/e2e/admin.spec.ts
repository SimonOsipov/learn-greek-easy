/**
 * E2E Tests: Admin Panel
 *
 * Tests the admin panel access control and statistics display.
 * Uses Playwright's storageState pattern for authentication.
 *
 * Test Coverage:
 * - Unauthenticated access (redirect to login)
 * - Regular user access (redirect to unauthorized)
 * - Superuser access (full access to admin panel)
 * - Admin page content display
 *
 * NOTE: Do NOT add beforeEach seed calls - the auth setup already seeds
 * the database and authenticates users. Re-seeding would invalidate
 * the cached auth tokens since user UUIDs would change.
 */

import { test, expect } from '@playwright/test';
import { loginViaUI, SEED_USERS, waitForAppReady } from './helpers/auth-helpers';

// =============================================================================
// Unauthenticated Access Tests
// =============================================================================

test.describe('Admin Panel - Unauthenticated', () => {
  // Clear auth state to simulate unauthenticated user
  test.use({ storageState: { cookies: [], origins: [] } });

  test('E2E-ADMIN-01: Unauthenticated user redirected to login', async ({ page }) => {
    // Navigate to admin panel
    await page.goto('/admin');

    // Should be redirected to login page
    await page.waitForURL(/\/login/, { timeout: 15000 });
    await expect(page.getByTestId('login-card')).toBeVisible();
  });
});

// =============================================================================
// Regular User Access Tests
// =============================================================================

test.describe('Admin Panel - Regular User', () => {
  // Use default learner storage state (regular user, not superuser)
  // This is automatically set via playwright.config.ts

  test('E2E-ADMIN-02: Regular user redirected to unauthorized', async ({ page }) => {
    // Navigate to admin panel as regular user
    await page.goto('/admin');

    // Should be redirected to unauthorized page
    // The route guard should detect non-superuser and redirect
    await page.waitForLoadState('networkidle');

    // Wait a bit for auth check and redirect
    await page.waitForTimeout(2000);

    // Check if we were redirected away from /admin
    const currentUrl = page.url();

    // Should NOT be on admin page - either on /unauthorized or somewhere else
    const isOnAdmin = currentUrl.endsWith('/admin') || currentUrl.includes('/admin?');

    // If still on admin, check for error/unauthorized message
    if (isOnAdmin) {
      // Page might show forbidden error instead of redirecting
      const body = await page.textContent('body');
      const hasUnauthorized =
        body?.toLowerCase().includes('unauthorized') ||
        body?.toLowerCase().includes('forbidden') ||
        body?.toLowerCase().includes('access denied') ||
        body?.toLowerCase().includes('not allowed');

      expect(hasUnauthorized).toBe(true);
    } else {
      // Successfully redirected away from admin
      expect(currentUrl).not.toContain('/admin');
    }
  });
});

// =============================================================================
// Superuser Access Tests
// =============================================================================

test.describe('Admin Panel - Superuser', () => {
  // Use admin storage state (superuser)
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test('E2E-ADMIN-03: Superuser can access admin panel', async ({ page }) => {
    // Navigate to admin panel
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    // Should stay on admin page (not redirected)
    expect(page.url()).toContain('/admin');

    // Admin page should be visible
    await expect(page.getByTestId('admin-page')).toBeVisible({ timeout: 15000 });

    // Should see the Admin Dashboard heading (using data-testid for i18n compatibility)
    await expect(page.getByTestId('admin-title')).toBeVisible({ timeout: 10000 });
  });

  test('E2E-ADMIN-04: Admin page displays statistics cards', async ({ page }) => {
    // Navigate to admin panel
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('admin-page')).toBeVisible({ timeout: 15000 });

    // Should display Total Decks card (using data-testid for i18n compatibility)
    await expect(page.getByTestId('total-decks-card')).toBeVisible({ timeout: 10000 });

    // Should display Total Cards card (using data-testid for i18n compatibility)
    await expect(page.getByTestId('total-cards-card')).toBeVisible({ timeout: 10000 });
  });

  test('E2E-ADMIN-05: Admin page displays deck list', async ({ page }) => {
    // Navigate to admin panel
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('admin-page')).toBeVisible({ timeout: 15000 });

    // Should display "Decks by Level" title (using data-testid for i18n compatibility)
    await expect(page.getByTestId('decks-by-level-title')).toBeVisible({ timeout: 10000 });

    // Should display deck list description (using data-testid for i18n compatibility)
    await expect(page.getByTestId('decks-by-level-description')).toBeVisible({ timeout: 10000 });
  });

  test('E2E-ADMIN-06: Admin page shows CEFR level badges', async ({ page }) => {
    // Navigate to admin panel
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('admin-page')).toBeVisible({ timeout: 15000 });

    // Wait for content to load
    await page.waitForTimeout(1000);

    // Should show at least one CEFR level badge
    // Look for badges with level text (CEFR levels are not translated)
    const levelBadges = page.locator('text=/^(A1|A2|B1|B2|C1|C2)$/');
    await expect(levelBadges.first()).toBeVisible({ timeout: 10000 });
  });

  test('E2E-ADMIN-07: Admin page shows card counts', async ({ page }) => {
    // Navigate to admin panel
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('admin-page')).toBeVisible({ timeout: 15000 });

    // Wait for content to load
    await page.waitForTimeout(1000);

    // Should show card counts - look for numbers which are language-independent
    // The format varies by language, but numbers are always present
    const deckCards = page.locator('[class*="text-muted-foreground"]');
    await expect(deckCards.first()).toBeVisible({ timeout: 10000 });
  });
});

// =============================================================================
// Navigation Tests
// =============================================================================

test.describe('Admin Panel - Navigation', () => {
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test('E2E-ADMIN-08: Admin can navigate to admin panel from dashboard', async ({ page }) => {
    // Start from dashboard
    await page.goto('/');
    await waitForAppReady(page);

    // Navigate directly to admin
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    // Should be on admin page
    expect(page.url()).toContain('/admin');
    await expect(page.getByTestId('admin-page')).toBeVisible({ timeout: 15000 });
  });
});

// =============================================================================
// Error State Tests
// =============================================================================

test.describe('Admin Panel - Error Handling', () => {
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test('E2E-ADMIN-09: Admin page handles loading state gracefully', async ({ page }) => {
    // Navigate to admin panel
    await page.goto('/admin');

    // Page should render without errors
    // Either show loading state or content
    await expect(page.getByTestId('admin-page')).toBeVisible({ timeout: 15000 });

    // Should eventually show content (not stuck in loading) - using data-testid
    await expect(page.getByTestId('admin-title')).toBeVisible({ timeout: 15000 });
  });
});

// =============================================================================
// Fresh Login Tests (for users not in storageState)
// =============================================================================

test.describe('Admin Panel - Fresh Login', () => {
  // Clear auth state to test fresh login flow
  test.use({ storageState: { cookies: [], origins: [] } });

  test('E2E-ADMIN-10: Admin can login and access admin panel', async ({ page }) => {
    // Login as admin user
    await loginViaUI(page, SEED_USERS.ADMIN);

    // Navigate to admin panel
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    // Should be able to access admin page
    expect(page.url()).toContain('/admin');
    await expect(page.getByTestId('admin-page')).toBeVisible({ timeout: 15000 });
  });

  test('E2E-ADMIN-11: Regular user login cannot access admin', async ({ page }) => {
    // Login as regular learner user
    await loginViaUI(page, SEED_USERS.LEARNER);

    // Try to navigate to admin panel
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Should be redirected or shown unauthorized
    const currentUrl = page.url();
    const isOnAdmin = currentUrl.endsWith('/admin') || currentUrl.includes('/admin?');

    if (isOnAdmin) {
      // If still on admin page, should show error
      const body = await page.textContent('body');
      const hasUnauthorized =
        body?.toLowerCase().includes('unauthorized') ||
        body?.toLowerCase().includes('forbidden') ||
        body?.toLowerCase().includes('access denied');

      expect(hasUnauthorized).toBe(true);
    } else {
      // Redirected away from admin
      expect(currentUrl).not.toContain('/admin');
    }
  });
});
