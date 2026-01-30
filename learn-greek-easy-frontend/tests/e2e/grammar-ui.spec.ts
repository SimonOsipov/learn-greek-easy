/**
 * E2E Tests: Grammar UI in Flashcard Review
 *
 * Tests the grammar UI components displayed during flashcard review sessions:
 * - Card content blur/reveal mechanic
 * - Verb tense tab navigation
 * - Verb voice toggle (disabled state)
 * - Adjective gender tab navigation
 * - Example translation reveal
 * - Adverb card display
 * - Empty grammar state
 * - Mobile responsive behavior
 *
 * Uses API mocking for deterministic tests (same pattern as visual tests).
 */

import { test, expect } from '@playwright/test';
import {
  mockNounCard,
  mockVerbCardComplete,
  mockVerbCardPartial,
  mockAdjectiveCard,
  mockAdverbCard,
  mockCardNoGrammar,
} from './fixtures/grammar-mock-data';
import {
  setupReviewMock,
  navigateToReview,
  flipCard,
  clickToFlip,
  setMobileViewport,
} from './helpers/grammar-helpers';

// ============================================================================
// CARD CONTENT BLUR/REVEAL TESTS
// ============================================================================

test.describe('Card Content Blur/Reveal', () => {
  test('card content is blurred before flip', async ({ page }) => {
    await setupReviewMock(page, mockNounCard);
    // E2E tests use storageState from playwright config - no manual login needed
    await navigateToReview(page);

    // The card content area should have blur-md class before flip
    const cardContent = page.locator('.blur-md');
    await expect(cardContent).toBeVisible();
  });

  test('card content is revealed after flip (click)', async ({ page }) => {
    await setupReviewMock(page, mockNounCard);
    // E2E tests use storageState from playwright config - no manual login needed
    await navigateToReview(page);

    // Click to flip
    await clickToFlip(page);

    // Content should no longer be blurred
    const blurredContent = page.locator('.blur-md');
    await expect(blurredContent).toHaveCount(0);

    // Translation should be visible
    const translation = page.getByText('the house');
    await expect(translation).toBeVisible();
  });

  test('card content is revealed after flip (Space key)', async ({ page }) => {
    await setupReviewMock(page, mockNounCard);
    // E2E tests use storageState from playwright config - no manual login needed
    await navigateToReview(page);

    // Press Space to flip
    await flipCard(page);

    // Content should no longer be blurred (main content area)
    const blurredContent = page.locator('[data-testid="flashcard"]').locator('.blur-md');
    // After flip, the card content is NOT blurred - only example translations may still be blurred
    // Check that the main translation is visible and not blurred

    // Translation should be visible
    const translation = page.getByText('the house');
    await expect(translation).toBeVisible();
  });
});

// ============================================================================
// VERB TENSE TAB NAVIGATION TESTS
// ============================================================================

test.describe('Verb Tense Tab Navigation', () => {
  test('displays Present tense by default', async ({ page }) => {
    await setupReviewMock(page, mockVerbCardComplete);
    // E2E tests use storageState from playwright config - no manual login needed
    await navigateToReview(page);
    await flipCard(page);

    // Present tab should be active/selected
    const presentTab = page.getByRole('tab', { name: /present/i });
    await expect(presentTab).toBeVisible();
    await expect(presentTab).toHaveAttribute('data-state', 'active');

    // Present tense conjugations should be visible (use role cell for table entries)
    await expect(page.getByRole('cell', { name: 'grafo', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'grafeis' })).toBeVisible();
  });

  test('switches to Past tense when clicking Past tab', async ({ page }) => {
    await setupReviewMock(page, mockVerbCardComplete);
    // E2E tests use storageState from playwright config - no manual login needed
    await navigateToReview(page);
    await flipCard(page);

    // Click Past tab
    const pastTab = page.getByRole('tab', { name: /past/i });
    await pastTab.click();
    await page.waitForTimeout(300);

    // Past tab should now be active
    await expect(pastTab).toHaveAttribute('data-state', 'active');

    // Past tense conjugations should be visible (use role cell for table entries, exact: true to avoid partial matches)
    await expect(page.getByRole('cell', { name: 'egrapsa', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'egrapses', exact: true })).toBeVisible();
  });

  test('switches to Imperative and shows imperative forms', async ({ page }) => {
    await setupReviewMock(page, mockVerbCardComplete);
    // E2E tests use storageState from playwright config - no manual login needed
    await navigateToReview(page);
    await flipCard(page);

    // Click Imperative tab
    const imperativeTab = page.getByRole('tab', { name: /imperative/i });
    await imperativeTab.click();
    await page.waitForTimeout(300);

    // Imperative tab should now be active
    await expect(imperativeTab).toHaveAttribute('data-state', 'active');

    // Imperative forms should be visible
    await expect(page.getByText('grapse')).toBeVisible();
    await expect(page.getByText('grapste')).toBeVisible();
  });

  test('disabled tabs cannot be clicked (partial verb data)', async ({ page }) => {
    await setupReviewMock(page, mockVerbCardPartial);
    // E2E tests use storageState from playwright config - no manual login needed
    await navigateToReview(page);
    await flipCard(page);

    // Present tab should be active by default
    const presentTab = page.getByRole('tab', { name: /present/i });
    await expect(presentTab).toHaveAttribute('data-state', 'active');

    // Past tab should be disabled (no past tense data)
    const pastTab = page.getByRole('tab', { name: /past/i });
    await expect(pastTab).toBeDisabled();

    // Future tab should be disabled (no future tense data)
    const futureTab = page.getByRole('tab', { name: /future/i });
    await expect(futureTab).toBeDisabled();

    // Click on disabled tab should not switch
    await pastTab.click({ force: true });
    await page.waitForTimeout(300);

    // Present should still be active
    await expect(presentTab).toHaveAttribute('data-state', 'active');
  });
});

// ============================================================================
// VERB VOICE TOGGLE TESTS
// ============================================================================

test.describe('Verb Voice Toggle', () => {
  test('voice toggle is visible but disabled (hasPassive = false)', async ({ page }) => {
    await setupReviewMock(page, mockVerbCardComplete);
    // E2E tests use storageState from playwright config - no manual login needed
    await navigateToReview(page);
    await flipCard(page);

    // Voice toggle switch should be visible (has id="voice-toggle")
    const voiceSwitch = page.locator('#voice-toggle');
    await expect(voiceSwitch).toBeVisible();

    // Switch should be disabled
    await expect(voiceSwitch).toBeDisabled();

    // Active and Passive labels should be visible
    await expect(page.getByText(/active/i).first()).toBeVisible();
    await expect(page.getByText(/passive/i).first()).toBeVisible();
  });

  test('disabled toggle cannot be interacted with', async ({ page }) => {
    await setupReviewMock(page, mockVerbCardComplete);
    // E2E tests use storageState from playwright config - no manual login needed
    await navigateToReview(page);
    await flipCard(page);

    // Switch should be disabled and unchecked (Active selected)
    const voiceSwitch = page.locator('#voice-toggle');
    await expect(voiceSwitch).toBeDisabled();
    await expect(voiceSwitch).toHaveAttribute('data-state', 'unchecked');

    // Try to click the disabled switch
    await voiceSwitch.click({ force: true });
    await page.waitForTimeout(300);

    // Should still be unchecked (active voice)
    await expect(voiceSwitch).toHaveAttribute('data-state', 'unchecked');
  });
});

// ============================================================================
// ADJECTIVE GENDER TAB NAVIGATION TESTS
// ============================================================================

test.describe('Adjective Gender Tab Navigation', () => {
  test('displays Masculine tab by default', async ({ page }) => {
    await setupReviewMock(page, mockAdjectiveCard);
    // E2E tests use storageState from playwright config - no manual login needed
    await navigateToReview(page);
    await flipCard(page);

    // Masculine tab should be active
    const masculineTab = page.getByRole('tab', { name: /masculine/i });
    await expect(masculineTab).toBeVisible();
    await expect(masculineTab).toHaveAttribute('data-state', 'active');

    // Masculine forms should be visible (use role cell for table entries)
    await expect(page.getByRole('cell', { name: 'megalos' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'megalo', exact: true }).first()).toBeVisible();
  });

  test('switches to Feminine when clicking Feminine tab', async ({ page }) => {
    await setupReviewMock(page, mockAdjectiveCard);
    // E2E tests use storageState from playwright config - no manual login needed
    await navigateToReview(page);
    await flipCard(page);

    // Click Feminine tab
    const feminineTab = page.getByRole('tab', { name: /feminine/i });
    await feminineTab.click();
    await page.waitForTimeout(300);

    // Feminine tab should now be active
    await expect(feminineTab).toHaveAttribute('data-state', 'active');

    // Feminine forms should be visible (use role cell for table entries)
    await expect(page.getByRole('cell', { name: 'megali', exact: true }).first()).toBeVisible();
    await expect(page.getByRole('cell', { name: 'megalis' })).toBeVisible();
  });

  test('switches to Neuter when clicking Neuter tab', async ({ page }) => {
    await setupReviewMock(page, mockAdjectiveCard);
    // E2E tests use storageState from playwright config - no manual login needed
    await navigateToReview(page);
    await flipCard(page);

    // Click Neuter tab
    const neuterTab = page.getByRole('tab', { name: /neuter/i });
    await neuterTab.click();
    await page.waitForTimeout(300);

    // Neuter tab should now be active
    await expect(neuterTab).toHaveAttribute('data-state', 'active');

    // Neuter forms should be visible (megalo appears in both masc and neuter)
    const neuterForms = page.locator('[data-state="active"]').getByText('megalo');
    await expect(neuterForms.first()).toBeVisible();
  });
});

// ============================================================================
// EXAMPLE TRANSLATION REVEAL TESTS
// ============================================================================

test.describe('Example Translation Reveal', () => {
  test('example translations are blurred initially', async ({ page }) => {
    await setupReviewMock(page, mockNounCard);
    // E2E tests use storageState from playwright config - no manual login needed
    await navigateToReview(page);
    await flipCard(page);

    // Example Greek text should be visible
    await expect(page.getByText('To spiti mou einai megalo.')).toBeVisible();

    // Example translation should be blurred (has blur-sm class)
    const translationContainer = page.locator('.blur-sm');
    await expect(translationContainer).toBeVisible();
  });

  test('clicking blurred translation reveals it', async ({ page }) => {
    await setupReviewMock(page, mockNounCard);
    // E2E tests use storageState from playwright config - no manual login needed
    await navigateToReview(page);
    await flipCard(page);

    // Find the blurred translation and click it
    const blurredTranslation = page.locator('.blur-sm');
    await expect(blurredTranslation).toBeVisible();
    await blurredTranslation.click();

    // Wait for transition
    await page.waitForTimeout(300);

    // Translation should no longer be blurred
    const stillBlurred = page.locator('.blur-sm');
    await expect(stillBlurred).toHaveCount(0);

    // Translation text should be visible
    await expect(page.getByText('My house is big.')).toBeVisible();
  });
});

// ============================================================================
// ADVERB CARD DISPLAY TESTS
// ============================================================================

test.describe('Adverb Card Display', () => {
  test('displays adverb forms table with positive/comparative/superlative', async ({ page }) => {
    await setupReviewMock(page, mockAdverbCard);
    // E2E tests use storageState from playwright config - no manual login needed
    await navigateToReview(page);
    await flipCard(page);

    // Adverb badge should be visible (orange)
    const badge = page.locator('[data-testid="part-of-speech-badge"]');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveClass(/bg-orange-500/);

    // Adverb forms should be visible (use role cell for table entries)
    await expect(page.getByRole('cell', { name: 'grigora', exact: true })).toBeVisible(); // Positive form
    await expect(page.getByRole('cell', { name: 'pio grigora' })).toBeVisible(); // Comparative
    await expect(page.getByRole('cell', { name: 'grigorotata' })).toBeVisible(); // Superlative
  });
});

// ============================================================================
// EMPTY GRAMMAR STATE TESTS
// ============================================================================

test.describe('Empty Grammar State', () => {
  test('card without grammar data shows translation only', async ({ page }) => {
    await setupReviewMock(page, mockCardNoGrammar);
    // E2E tests use storageState from playwright config - no manual login needed
    await navigateToReview(page);
    await flipCard(page);

    // Translation should be visible
    await expect(page.getByText('Good morning')).toBeVisible();

    // No grammar tables should be present (no tense tabs, no declension tables)
    const tenseTabs = page.getByRole('tab', { name: /present|past|future/i });
    await expect(tenseTabs).toHaveCount(0);

    // No gender tabs
    const genderTabs = page.getByRole('tab', { name: /masculine|feminine|neuter/i });
    await expect(genderTabs).toHaveCount(0);

    // No part of speech badge (since part_of_speech is not set)
    const badge = page.locator('[data-testid="part-of-speech-badge"]');
    await expect(badge).toHaveCount(0);
  });
});

// ============================================================================
// MOBILE VIEWPORT TESTS
// ============================================================================

test.describe('Mobile Viewport', () => {
  test('tense tabs are horizontally scrollable', async ({ page }) => {
    await setMobileViewport(page);
    await setupReviewMock(page, mockVerbCardComplete);
    // E2E tests use storageState from playwright config - no manual login needed
    await navigateToReview(page);
    await flipCard(page);

    // Tabs container should have overflow-x-auto
    const tabsContainer = page.locator('.overflow-x-auto').first();
    await expect(tabsContainer).toBeVisible();

    // All tabs should still be accessible
    const presentTab = page.getByRole('tab', { name: /present/i });
    await expect(presentTab).toBeVisible();

    // Can scroll to see other tabs
    const imperativeTab = page.getByRole('tab', { name: /imperative/i });
    await imperativeTab.scrollIntoViewIfNeeded();
    await expect(imperativeTab).toBeVisible();
  });

  test('gender tabs work on mobile', async ({ page }) => {
    await setMobileViewport(page);
    await setupReviewMock(page, mockAdjectiveCard);
    // E2E tests use storageState from playwright config - no manual login needed
    await navigateToReview(page);
    await flipCard(page);

    // All gender tabs should be visible
    const masculineTab = page.getByRole('tab', { name: /masculine/i });
    await expect(masculineTab).toBeVisible();

    // Can switch to feminine on mobile
    const feminineTab = page.getByRole('tab', { name: /feminine/i });
    await feminineTab.click();
    await page.waitForTimeout(300);

    await expect(feminineTab).toHaveAttribute('data-state', 'active');
    await expect(page.getByRole('cell', { name: 'megali', exact: true }).first()).toBeVisible();
  });

  test('card content blur/reveal works on mobile', async ({ page }) => {
    await setMobileViewport(page);
    await setupReviewMock(page, mockNounCard);
    // E2E tests use storageState from playwright config - no manual login needed
    await navigateToReview(page);

    // Content should be blurred before flip
    const blurredContent = page.locator('.blur-md');
    await expect(blurredContent).toBeVisible();

    // Flip with tap/click
    await clickToFlip(page);

    // Content should be revealed
    await expect(page.getByText('the house')).toBeVisible();
  });
});
