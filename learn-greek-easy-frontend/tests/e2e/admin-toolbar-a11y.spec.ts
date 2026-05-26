/**
 * E2E Accessibility Tests: Admin toolbar keyboard tab-order (TBR2-25-12)
 *
 * After TBR2-25-02..05 moved search to the leading toolbar position on the
 * Card errors, Feedback, Changelog, and Announcements tabs, the keyboard
 * tab-order changed. This spec asserts the post-refactor order:
 *   search input → clear-X (when value present) → next focusable control
 *
 * It also asserts that pressing Escape clears the search and returns focus
 * to the input.
 *
 * Auth: admin storageState (STORAGE_STATE.ADMIN).
 * No seeding required — we only need the toolbar to render.
 *
 * Pragmatic adjustment: "search is first Tab stop" is brittle from a cold
 * page-body focus because earlier DOM elements (header, nav) also accept Tab.
 * Instead we focus the search programmatically then assert forward tab-order.
 */

import { expect, test } from '@playwright/test';

import { STORAGE_STATE } from '../../playwright.config';
import { navigateToAdminTab } from './helpers/admin-helpers';

test.use({ storageState: STORAGE_STATE.ADMIN });

interface ToolbarFixture {
  /** Human-readable label for describe block names */
  label: string;
  /** AdminTabKey passed to navigateToAdminTab */
  tabKey: Parameters<typeof navigateToAdminTab>[1];
  /** data-testid of the section/tab root to wait on before interacting */
  sectionTestid: string;
  /** data-testid of the search input */
  searchTestid: string;
  /**
   * data-testid of the clear-X button.
   * null → use aria-label "Clear search" to locate it.
   */
  clearXTestid: string | null;
}

const FIXTURES: ToolbarFixture[] = [
  {
    label: 'Card errors',
    tabKey: 'errors',
    sectionTestid: 'admin-card-error-section',
    searchTestid: 'card-error-search-input',
    clearXTestid: null, // no testid; located via aria-label "Clear search"
  },
  {
    label: 'Feedback',
    tabKey: 'feedback',
    sectionTestid: 'feedback-search-input', // search input visible = section loaded
    searchTestid: 'feedback-search-input',
    clearXTestid: null, // no testid; located via aria-label "Clear search"
  },
  {
    label: 'Changelog',
    tabKey: 'changelog',
    sectionTestid: 'changelog-tab',
    searchTestid: 'changelog-search-input',
    clearXTestid: null, // no testid; located via aria-label "Clear search"
  },
  {
    label: 'Announcements',
    tabKey: 'announcements',
    sectionTestid: 'announcements-tab',
    searchTestid: 'announcement-search-input',
    clearXTestid: 'announcement-search-clear',
  },
];

for (const fx of FIXTURES) {
  test.describe(`Admin toolbar a11y — ${fx.label}`, () => {
    test.beforeEach(async ({ page }) => {
      await navigateToAdminTab(page, fx.tabKey);
      // Wait for the section to render before asserting focus behaviour.
      await expect(page.getByTestId(fx.sectionTestid)).toBeVisible({ timeout: 15_000 });
    });

    test(`${fx.label}: Tab from search → clear-X when value present`, async ({ page }) => {
      const searchInput = page.getByTestId(fx.searchTestid);

      // Programmatically place focus on the search input.
      await searchInput.focus();
      await expect(searchInput).toBeFocused();

      // Type a value so the clear-X button appears.
      await searchInput.fill('test');

      // Locate the clear-X button.
      const clearX = fx.clearXTestid
        ? page.getByTestId(fx.clearXTestid)
        : page.getByRole('button', { name: /Clear search/i });

      // Wait for it to become visible (it is conditionally rendered).
      await expect(clearX).toBeVisible({ timeout: 5_000 });

      // One Tab press should land on the clear-X button.
      await page.keyboard.press('Tab');
      await expect(clearX).toBeFocused();

      // One more Tab should move focus away from the clear-X.
      await page.keyboard.press('Tab');
      await expect(clearX).not.toBeFocused();
    });

    test(`${fx.label}: Escape clears search and keeps focus on input`, async ({ page }) => {
      const searchInput = page.getByTestId(fx.searchTestid);

      await searchInput.focus();
      await searchInput.fill('hello');
      await expect(searchInput).toHaveValue('hello');

      await page.keyboard.press('Escape');

      await expect(searchInput).toHaveValue('');
      await expect(searchInput).toBeFocused();
    });
  });
}
