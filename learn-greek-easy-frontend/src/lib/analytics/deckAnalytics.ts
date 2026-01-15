/**
 * Deck Analytics for PostHog Integration
 *
 * Tracks user interactions with decks, including premium content.
 */

import posthog from 'posthog-js';

export interface PremiumDeckLockedViewedProperties {
  deck_id: string;
  deck_name: string;
  deck_type: 'vocabulary' | 'culture';
}

export interface PremiumDeckLockedClickedProperties {
  deck_id: string;
  deck_name: string;
  deck_type: 'vocabulary' | 'culture';
}

/**
 * Track when a user views a locked premium deck in the list.
 */
export function trackPremiumDeckLockedViewed(properties: PremiumDeckLockedViewedProperties): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('premium_deck_locked_viewed', properties);
  }
}

/**
 * Track when a user clicks on a locked premium deck.
 */
export function trackPremiumDeckLockedClicked(
  properties: PremiumDeckLockedClickedProperties
): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('premium_deck_locked_clicked', properties);
  }
}
