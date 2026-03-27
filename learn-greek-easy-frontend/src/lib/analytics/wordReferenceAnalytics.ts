/**
 * Word Reference Analytics for PostHog Integration
 *
 * Tracks user interactions on the Word Reference page:
 * - Tab switching between word info and cards
 * - Card flipping to reveal content
 */

import posthog from 'posthog-js';

// ============================================================================
// Type Interfaces
// ============================================================================

export interface WordReferenceTabSwitchedProperties {
  tab: 'word_info' | 'cards';
  word_entry_id: string;
  deck_id: string;
}

export interface WordReferenceCardFlippedProperties {
  card_type: string;
  word_entry_id: string;
  deck_id: string;
  direction: 'to_back' | 'to_front';
}

// ============================================================================
// Tracking Functions
// ============================================================================

/**
 * Track when user switches tabs on the Word Reference page.
 */
export function trackWordReferenceTabSwitched(
  properties: WordReferenceTabSwitchedProperties
): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('word_reference_tab_switched', properties);
  }
}

/**
 * Track when user flips a card to reveal its content.
 */
export function trackWordReferenceCardFlipped(
  properties: WordReferenceCardFlippedProperties
): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('word_reference_card_flipped', properties);
  }
}
