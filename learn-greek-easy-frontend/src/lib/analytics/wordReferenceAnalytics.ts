/**
 * Word Reference Analytics for PostHog Integration
 *
 * Tracks user interactions on the Word Reference page:
 * - Tab switching between word info and cards
 * - Card expansion to reveal content
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

export interface WordReferenceCardExpandedProperties {
  card_type: string;
  word_entry_id: string;
  deck_id: string;
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
 * Track when user expands a card to reveal its content.
 */
export function trackWordReferenceCardExpanded(
  properties: WordReferenceCardExpandedProperties
): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('word_reference_card_expanded', properties);
  }
}
