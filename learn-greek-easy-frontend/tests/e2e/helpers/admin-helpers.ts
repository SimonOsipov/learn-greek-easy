import { Page } from '@playwright/test';

// ── E2E seed helpers for Card Errors (CER-56) ─────────────────────────────────

/**
 * Seed the canonical batch of 4 card error reports for E2E testing.
 * Creates: WORD-PENDING, CULTURE-PENDING, WORD-FIXED, WORD-DISMISSED.
 * Returns IDs in that stable order.
 * Requires TEST_SEED_ENABLED=true on the backend.
 */
export async function seedAdminCardErrorsBatch(page: Page): Promise<{ ids: string[] }> {
  const response = await page.request.post('/api/v1/test/seed/card-errors');
  if (!response.ok()) {
    throw new Error(
      `seedAdminCardErrorsBatch failed: ${response.status()} ${await response.text()}`
    );
  }
  return response.json();
}

/**
 * Tab keys accepted by the new admin shell URL pattern (?tab=<key>).
 * Maps 1:1 to AdminTabType in src/pages/admin/types.ts.
 */
type AdminTabKey =
  | 'dashboard'
  | 'inbox'
  | 'decks'
  | 'news'
  | 'situations'
  | 'exercises'
  | 'errors'
  | 'feedback'
  | 'changelog'
  | 'announcements';

/**
 * Navigate to an admin tab by setting the ?tab= URL search param.
 *
 * ASHELL-06 wired tab state to the URL, so the fastest and most reliable way
 * to reach a specific tab in E2E tests is to navigate directly.  The previous
 * implementation clicked on removed test-ids (admin-group-*, admin-tab-*) and
 * broke when those were removed as part of the admin shell redesign (ASHELL-08).
 */
export async function navigateToAdminTab(page: Page, tabKey: AdminTabKey): Promise<void> {
  await page.goto(`/admin?tab=${tabKey}`);
  // Wait until the SectionTabs tab button is marked active to confirm the tab
  // content has rendered.
  await page.locator('.va-tab[aria-selected="true"]').waitFor({ state: 'visible' });
}
