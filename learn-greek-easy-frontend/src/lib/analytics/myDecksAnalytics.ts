/**
 * My Decks Analytics for PostHog Integration
 *
 * Tracks user interactions with the My Decks feature.
 */

import posthog from 'posthog-js';

// ============================================================================
// Event Property Types
// ============================================================================

export interface MyDecksPageViewedProperties {
  user_deck_count: number;
  has_decks: boolean;
}

export interface MyDecksCreateDeckClickedProperties {
  button_state: 'disabled' | 'enabled';
}

export interface MyDecksCreateCardClickedProperties {
  button_state: 'disabled';
}

export interface MyDecksAccessDeniedProperties {
  attempted_deck_id: string;
  redirect_destination: '/my-decks';
}

// ============================================================================
// Event Tracking Functions
// ============================================================================

/**
 * Track when the My Decks page is viewed (after decks loaded).
 */
export function trackMyDecksPageViewed(properties: MyDecksPageViewedProperties): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('my_decks_page_viewed', properties);
  }
}

/**
 * Track when user clicks the Create Deck button (currently disabled).
 */
export function trackMyDecksCreateDeckClicked(
  properties: MyDecksCreateDeckClickedProperties
): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('my_decks_create_deck_clicked', properties);
  }
}

/**
 * Track when user clicks the Create Card button (currently disabled).
 */
export function trackMyDecksCreateCardClicked(
  properties: MyDecksCreateCardClickedProperties
): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('my_decks_create_card_clicked', properties);
  }
}

/**
 * Track when access denied dialog is shown for a deck the user doesn't own.
 */
export function trackMyDecksAccessDenied(properties: MyDecksAccessDeniedProperties): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('my_decks_access_denied', properties);
  }
}
