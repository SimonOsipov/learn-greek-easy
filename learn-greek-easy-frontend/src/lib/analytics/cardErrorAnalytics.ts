/**
 * Card Error Analytics for PostHog Integration
 *
 * Tracks user interactions with the card error reporting feature.
 */

import posthog from 'posthog-js';

// ============================================================================
// Event Property Types
// ============================================================================

export interface CardErrorReportedProperties {
  /** Type of card: 'WORD' or 'CULTURE' */
  cardType: string;
  /** UUID of the reported card */
  cardId: string;
}

export interface CardErrorModalOpenedProperties {
  /** Type of card: 'WORD' or 'CULTURE' */
  cardType: string;
  /** UUID of the card */
  cardId: string;
  /** Where the modal was opened from */
  source: 'flashcard' | 'culture_feedback' | 'word_reference';
}

export interface CardErrorModalClosedProperties {
  /** Type of card: 'WORD' or 'CULTURE' */
  cardType: string;
  /** UUID of the card */
  cardId: string;
  /** Whether the report was submitted before closing */
  wasSubmitted: boolean;
}

// ============================================================================
// Event Tracking Functions
// ============================================================================

/**
 * Track when a card error report is successfully submitted.
 */
export function trackCardErrorReported(properties: CardErrorReportedProperties): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('card_error_reported', properties);
  }
}

/**
 * Track when the error report modal is opened.
 */
export function trackCardErrorModalOpened(properties: CardErrorModalOpenedProperties): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('card_error_modal_opened', properties);
  }
}

/**
 * Track when the error report modal is closed.
 */
export function trackCardErrorModalClosed(properties: CardErrorModalClosedProperties): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('card_error_modal_closed', properties);
  }
}
