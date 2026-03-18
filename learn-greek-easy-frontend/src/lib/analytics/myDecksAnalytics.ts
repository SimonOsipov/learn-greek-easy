/**
 * My Decks Analytics for PostHog Integration
 *
 * Tracks user_deck_* modal lifecycle events for the My Decks feature.
 */

import posthog from 'posthog-js';

// ============================================================================
// Modal Lifecycle Event Property Types
// ============================================================================

export type UserDeckSource = 'my_decks_button' | 'empty_state_cta' | 'grid_card' | 'detail_page';

export interface UserDeckCreateStartedProperties {
  source: 'my_decks_button' | 'empty_state_cta';
}

export interface UserDeckCreateCompletedProperties {
  deck_id: string;
  deck_name: string;
  level: string;
  has_description: boolean;
  source: 'my_decks_button' | 'empty_state_cta';
}

export interface UserDeckCreateCancelledProperties {
  source: 'my_decks_button' | 'empty_state_cta';
}

export interface UserDeckEditStartedProperties {
  deck_id: string;
  deck_name: string;
  source: 'grid_card' | 'detail_page';
}

export interface UserDeckEditCompletedProperties {
  deck_id: string;
  deck_name: string;
  fields_changed: string[];
  source: 'grid_card' | 'detail_page';
}

export interface UserDeckEditCancelledProperties {
  deck_id: string;
  deck_name: string;
  source: 'grid_card' | 'detail_page';
}

export interface UserDeckDeleteStartedProperties {
  deck_id: string;
  deck_name: string;
  source: 'grid_card' | 'detail_page';
}

export interface UserDeckDeleteCancelledProperties {
  deck_id: string;
  deck_name: string;
  source: 'grid_card' | 'detail_page';
}

// ============================================================================
// Modal Lifecycle Tracking Functions
// ============================================================================

/**
 * Track when user starts creating a deck (opens create modal).
 */
export function trackUserDeckCreateStarted(properties: UserDeckCreateStartedProperties): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('user_deck_create_started', properties);
  }
}

/**
 * Track when deck creation completes successfully.
 */
export function trackUserDeckCreateCompleted(properties: UserDeckCreateCompletedProperties): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('user_deck_create_completed', properties);
  }
}

/**
 * Track when user cancels deck creation.
 */
export function trackUserDeckCreateCancelled(properties: UserDeckCreateCancelledProperties): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('user_deck_create_cancelled', properties);
  }
}

/**
 * Track when user starts editing a deck (opens edit modal).
 */
export function trackUserDeckEditStarted(properties: UserDeckEditStartedProperties): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('user_deck_edit_started', properties);
  }
}

/**
 * Track when deck edit completes successfully.
 */
export function trackUserDeckEditCompleted(properties: UserDeckEditCompletedProperties): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('user_deck_edit_completed', properties);
  }
}

/**
 * Track when user cancels deck edit.
 */
export function trackUserDeckEditCancelled(properties: UserDeckEditCancelledProperties): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('user_deck_edit_cancelled', properties);
  }
}

/**
 * Track when user starts deleting a deck (opens delete dialog).
 */
export function trackUserDeckDeleteStarted(properties: UserDeckDeleteStartedProperties): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('user_deck_delete_started', properties);
  }
}

/**
 * Track when user cancels deck deletion.
 */
export function trackUserDeckDeleteCancelled(properties: UserDeckDeleteCancelledProperties): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('user_deck_delete_cancelled', properties);
  }
}
