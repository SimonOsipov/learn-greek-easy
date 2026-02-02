/**
 * User Card Analytics for PostHog Integration
 *
 * Tracks user interactions with user-created vocabulary cards.
 */

import posthog from 'posthog-js';

// ============================================================================
// Event Property Types
// ============================================================================

export interface UserCardCreateStartedProperties {
  deck_id: string;
  source: 'create_button' | 'empty_state_cta';
}

export interface UserCardCreateCompletedProperties {
  deck_id: string;
  card_id: string;
  has_grammar: boolean;
  part_of_speech?: string;
  has_examples: boolean;
  example_count: number;
}

export interface UserCardCreateCancelledProperties {
  deck_id: string;
  source: 'create_button' | 'empty_state_cta';
}

export interface UserCardEditStartedProperties {
  card_id: string;
  deck_id: string;
}

export interface UserCardEditCompletedProperties {
  card_id: string;
  deck_id: string;
  fields_changed: string[];
}

export interface UserCardEditCancelledProperties {
  card_id: string;
  deck_id: string;
}

export interface UserCardDeleteStartedProperties {
  card_id: string;
  deck_id: string;
}

export interface UserCardDeleteCompletedProperties {
  card_id: string;
  deck_id: string;
}

export interface UserCardDeleteCancelledProperties {
  card_id: string;
  deck_id: string;
}

// ============================================================================
// Event Tracking Functions
// ============================================================================

/**
 * Track when user starts creating a card (opens create modal).
 */
export function trackUserCardCreateStarted(properties: UserCardCreateStartedProperties): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('user_card_create_started', properties);
  }
}

/**
 * Track when card creation completes successfully.
 */
export function trackUserCardCreateCompleted(properties: UserCardCreateCompletedProperties): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('user_card_create_completed', properties);
  }
}

/**
 * Track when user cancels card creation.
 */
export function trackUserCardCreateCancelled(properties: UserCardCreateCancelledProperties): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('user_card_create_cancelled', properties);
  }
}

/**
 * Track when user starts editing a card (opens edit modal).
 */
export function trackUserCardEditStarted(properties: UserCardEditStartedProperties): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('user_card_edit_started', properties);
  }
}

/**
 * Track when card edit completes successfully.
 */
export function trackUserCardEditCompleted(properties: UserCardEditCompletedProperties): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('user_card_edit_completed', properties);
  }
}

/**
 * Track when user cancels card edit.
 */
export function trackUserCardEditCancelled(properties: UserCardEditCancelledProperties): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('user_card_edit_cancelled', properties);
  }
}

/**
 * Track when user starts deleting a card (opens delete dialog).
 */
export function trackUserCardDeleteStarted(properties: UserCardDeleteStartedProperties): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('user_card_delete_started', properties);
  }
}

/**
 * Track when card deletion completes successfully.
 */
export function trackUserCardDeleteCompleted(properties: UserCardDeleteCompletedProperties): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('user_card_delete_completed', properties);
  }
}

/**
 * Track when user cancels card deletion.
 */
export function trackUserCardDeleteCancelled(properties: UserCardDeleteCancelledProperties): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('user_card_delete_cancelled', properties);
  }
}
