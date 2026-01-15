/**
 * Premium Badge E2E Tests
 *
 * Tests for the Premium Badge feature on vocabulary and culture decks.
 * Verifies:
 * - Premium badge displays on premium decks
 * - Lock icon shows for premium decks (free tier users)
 * - Admin can see crown indicator in deck list
 * - Admin can toggle premium status on/off
 *
 * Test Users:
 * - Learner (free tier): Should see premium badge + lock icon, deck not clickable
 * - Admin: Can toggle premium status, sees crown indicator in list
 *
 * Seed Data:
 * - Premium vocabulary decks: C1, C2
 * - Premium culture decks: History, Traditions
 * - Free decks: A1, A2, B1, B2, Geography, Politics, Culture
 */

import { test, expect } from '@playwright/test';
import { STORAGE_STATE } from '../../playwright.config';

// Storage state paths
const ADMIN_AUTH = 'playwright/.auth/admin.json';
const LEARNER_AUTH = 'playwright/.auth/learner.json';

test.describe('Premium Badge - Learner View', () => {
  // Use learner auth (free tier) - default for most tests
  test.use({ storageState: LEARNER_AUTH });

  test('should display premium badge on premium vocabulary deck', async ({ page }) => {
    await page.goto('/decks');

    // Wait for decks to load
    await expect(page.locator('[data-testid="deck-card"]').first()).toBeVisible({
      timeout: 15000,
    });

    // Find deck cards - premium decks should have the "Premium" badge with crown
    // Premium vocabulary decks are C1 and C2
    const premiumBadge = page.locator('text=Premium').first();
    await expect(premiumBadge).toBeVisible({ timeout: 5000 });
  });

  test('should display lock icon on premium vocabulary deck for free user', async ({ page }) => {
    await page.goto('/decks');

    // Wait for decks to load
    await expect(page.locator('[data-testid="deck-card"]').first()).toBeVisible({
      timeout: 15000,
    });

    // Premium decks should show lock icon
    // The lock icon has aria-label="Premium locked"
    const lockIcon = page.locator('[aria-label="Premium locked"]').first();
    await expect(lockIcon).toBeVisible({ timeout: 5000 });
  });

  test('should display premium badge on premium culture deck', async ({ page }) => {
    await page.goto('/decks');

    // Wait for decks to load
    await expect(page.locator('[data-testid="deck-card"]').first()).toBeVisible({
      timeout: 15000,
    });

    // Click on culture filter to see culture decks
    await page.getByRole('button', { name: 'Culture', exact: true }).click();

    // Wait for filtered results
    await page.waitForTimeout(500);

    // Premium culture decks (History, Traditions) should have the premium badge
    const premiumBadge = page.locator('text=Premium').first();
    await expect(premiumBadge).toBeVisible({ timeout: 5000 });
  });

  test('should have non-premium decks without premium badge', async ({ page }) => {
    await page.goto('/decks');

    // Wait for decks to load
    await expect(page.locator('[data-testid="deck-card"]').first()).toBeVisible({
      timeout: 15000,
    });

    // Count all deck cards
    const deckCards = page.locator('[data-testid="deck-card"]');
    const totalDecks = await deckCards.count();

    // Count premium badges
    const premiumBadges = page.locator('text=Premium');
    const premiumCount = await premiumBadges.count();

    // Not all decks should be premium (we have A1, A2, B1, B2 as free)
    expect(premiumCount).toBeLessThan(totalDecks);
    expect(premiumCount).toBeGreaterThan(0);
  });

  test('premium deck should not be clickable for free user', async ({ page }) => {
    await page.goto('/decks');

    // Wait for decks to load
    await expect(page.locator('[data-testid="deck-card"]').first()).toBeVisible({
      timeout: 15000,
    });

    // Get the URL before clicking
    const urlBefore = page.url();

    // Find a deck card with the lock icon (premium deck)
    const lockedDeck = page.locator('[data-testid="deck-card"]').filter({
      has: page.locator('[aria-label="Premium locked"]'),
    }).first();

    // Try to click the locked deck
    await lockedDeck.click();

    // URL should not change since locked decks are not clickable
    await expect(page).toHaveURL(urlBefore);
  });
});

test.describe('Premium Badge - Admin View', () => {
  // Use admin auth for these tests
  test.use({ storageState: ADMIN_AUTH });

  test('should show crown indicator for premium decks in admin list', async ({ page }) => {
    await page.goto('/admin');

    // Wait for admin page to load
    await expect(page.getByRole('heading', { name: /Admin/i })).toBeVisible({
      timeout: 15000,
    });

    // Wait for deck list to load
    await page.waitForTimeout(1000);

    // Look for crown indicators (premium-indicator-{id})
    const crownIndicator = page.locator('[data-testid^="premium-indicator-"]').first();
    await expect(crownIndicator).toBeVisible({ timeout: 5000 });
  });

  test('should toggle premium on vocabulary deck', async ({ page }) => {
    await page.goto('/admin');

    // Wait for admin page to load
    await expect(page.getByRole('heading', { name: /Admin/i })).toBeVisible({
      timeout: 15000,
    });

    // Click edit on a deck (any deck will work)
    const editButton = page.locator('button:has-text("Edit")').first();
    await editButton.click();

    // Wait for the edit form to appear
    const premiumToggle = page.getByTestId('deck-edit-is-premium');
    await expect(premiumToggle).toBeVisible({ timeout: 5000 });

    // Get the current state of the toggle
    const isCurrentlyChecked = await premiumToggle.isChecked();

    // Toggle the premium switch
    await premiumToggle.click();

    // Verify the toggle changed
    const isNowChecked = await premiumToggle.isChecked();
    expect(isNowChecked).toBe(!isCurrentlyChecked);

    // Find and click the save button
    const saveButton = page.locator('button:has-text("Save")');
    await saveButton.click();

    // Wait for the save to complete (form should close or show success)
    await page.waitForTimeout(1000);
  });

  test('should toggle premium on culture deck', async ({ page }) => {
    await page.goto('/admin');

    // Wait for admin page to load
    await expect(page.getByRole('heading', { name: /Admin/i })).toBeVisible({
      timeout: 15000,
    });

    // Click on Culture tab to switch to culture decks
    const cultureTab = page.getByRole('tab', { name: /Culture/i });
    await cultureTab.click();

    // Wait for culture decks to load
    await page.waitForTimeout(1000);

    // Click edit on a culture deck
    const editButton = page.locator('button:has-text("Edit")').first();
    await editButton.click();

    // Wait for the edit form to appear
    const premiumToggle = page.getByTestId('deck-edit-is-premium');
    await expect(premiumToggle).toBeVisible({ timeout: 5000 });

    // Get the current state of the toggle
    const isCurrentlyChecked = await premiumToggle.isChecked();

    // Toggle the premium switch
    await premiumToggle.click();

    // Verify the toggle changed
    const isNowChecked = await premiumToggle.isChecked();
    expect(isNowChecked).toBe(!isCurrentlyChecked);

    // Find and click the save button
    const saveButton = page.locator('button:has-text("Save")');
    await saveButton.click();

    // Wait for the save to complete
    await page.waitForTimeout(1000);
  });

  test('crown indicator appears after toggling premium on', async ({ page }) => {
    await page.goto('/admin');

    // Wait for admin page to load
    await expect(page.getByRole('heading', { name: /Admin/i })).toBeVisible({
      timeout: 15000,
    });

    // Wait for deck list to load
    await page.waitForTimeout(1000);

    // Find a free deck (without crown indicator) and get its name
    // Click edit on the first deck
    const editButton = page.locator('button:has-text("Edit")').first();
    await editButton.click();

    // Wait for the edit form
    const premiumToggle = page.getByTestId('deck-edit-is-premium');
    await expect(premiumToggle).toBeVisible({ timeout: 5000 });

    // Ensure premium is ON
    if (!(await premiumToggle.isChecked())) {
      await premiumToggle.click();
    }

    // Save changes
    const saveButton = page.locator('button:has-text("Save")');
    await saveButton.click();

    // Wait for save to complete and list to refresh
    await page.waitForTimeout(1500);

    // Verify crown indicator is visible
    const crownIndicator = page.locator('[data-testid^="premium-indicator-"]').first();
    await expect(crownIndicator).toBeVisible();
  });

  test('premium toggle works independently of active toggle', async ({ page }) => {
    await page.goto('/admin');

    // Wait for admin page to load
    await expect(page.getByRole('heading', { name: /Admin/i })).toBeVisible({
      timeout: 15000,
    });

    // Click edit on a deck
    const editButton = page.locator('button:has-text("Edit")').first();
    await editButton.click();

    // Wait for the edit form
    const premiumToggle = page.getByTestId('deck-edit-is-premium');
    const activeToggle = page.getByTestId('deck-edit-is-active');

    await expect(premiumToggle).toBeVisible({ timeout: 5000 });
    await expect(activeToggle).toBeVisible();

    // Get initial states
    const initialPremium = await premiumToggle.isChecked();
    const initialActive = await activeToggle.isChecked();

    // Toggle only premium
    await premiumToggle.click();

    // Verify premium changed but active did not
    expect(await premiumToggle.isChecked()).toBe(!initialPremium);
    expect(await activeToggle.isChecked()).toBe(initialActive);

    // Toggle premium back
    await premiumToggle.click();

    // Verify both are back to initial state
    expect(await premiumToggle.isChecked()).toBe(initialPremium);
    expect(await activeToggle.isChecked()).toBe(initialActive);
  });
});
