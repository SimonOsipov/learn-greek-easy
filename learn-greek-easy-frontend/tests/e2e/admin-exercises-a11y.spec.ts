/**
 * E2E Accessibility Tests: Admin Exercises Tab (EXR-78)
 *
 * Runs axe-core WCAG 2.1 AA scan on the exercises tab.
 * Requires @axe-core/playwright (already installed — see accessibility.spec.ts).
 *
 * Auth: admin storageState (STORAGE_STATE.ADMIN).
 */

import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

import { STORAGE_STATE } from '../../playwright.config';
import { navigateToAdminTab } from './helpers/admin-helpers';

test.use({ storageState: STORAGE_STATE.ADMIN });

test.describe('Admin Exercises Tab — a11y (EXR-78)', () => {
  test('EXR-A11Y-01: exercises tab has no WCAG 2.1 AA violations', async ({ page }) => {
    await navigateToAdminTab(page, 'exercises');

    // Wait for the exercises section to fully load
    await expect(page.getByTestId('admin-exercises-list')).toBeVisible({ timeout: 15_000 });

    // Scope axe to the exercises section only — the surrounding admin shell
    // (breadcrumb, kicker, subtitle, tab counts) is owned by other stories and
    // has pre-existing color-contrast issues this story isn't chartered to fix.
    const results = await new AxeBuilder({ page })
      .include('[data-testid="admin-exercises-list"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      // Disable best-practice rules not required for WCAG AA compliance
      .disableRules(['landmark-one-main', 'page-has-heading-one', 'region'])
      .analyze();

    expect(results.violations).toEqual([]);
  });
});
