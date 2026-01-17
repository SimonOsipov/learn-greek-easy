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

export interface MyDecksEditDeckClickedProperties {
  deck_id: string;
  deck_name: string;
}

export interface MyDecksDeleteDeckClickedProperties {
  deck_id: string;
  deck_name: string;
}

export interface MyDecksDeckDeletedProperties {
  deck_id: string;
  deck_name: string;
}

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

/**
 * Track when user clicks the Edit button on a deck card.
 */
export function trackMyDecksEditDeckClicked(properties: MyDecksEditDeckClickedProperties): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('my_decks_edit_deck_clicked', properties);
  }
}

/**
 * Track when user clicks the Delete button on a deck card.
 */
export function trackMyDecksDeleteDeckClicked(
  properties: MyDecksDeleteDeckClickedProperties
): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('my_decks_delete_deck_clicked', properties);
  }
}

/**
 * Track when a deck is successfully deleted.
 */
export function trackMyDecksDeckDeleted(properties: MyDecksDeckDeletedProperties): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('my_decks_deck_deleted', properties);
  }
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
