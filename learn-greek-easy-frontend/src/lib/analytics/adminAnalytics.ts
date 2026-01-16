/**
 * Admin Analytics for PostHog Integration
 *
 * Provides analytics tracking for admin features:
 * - Deck editing (open, save, cancel, fail)
 * - Deck activation/deactivation status changes
 */

import posthog from 'posthog-js';

// ============================================================================
// Type Interfaces
// ============================================================================

export interface AdminDeckEditOpenedProperties {
  deck_id: string;
  deck_type: string;
  deck_name: string;
}

export interface AdminDeckEditSavedProperties {
  deck_id: string;
  deck_type: string;
  deck_name: string;
  fields_changed: string[];
}

export interface AdminDeckEditCancelledProperties {
  deck_id: string;
  deck_type: string;
}

export interface AdminDeckEditFailedProperties {
  deck_id: string;
  deck_type: string;
  error_message: string;
}

export interface AdminDeckDeactivatedProperties {
  deck_id: string;
  deck_type: string;
  deck_name: string;
}

export interface AdminDeckReactivatedProperties {
  deck_id: string;
  deck_type: string;
  deck_name: string;
}

export interface AdminDeckPremiumEnabledProperties {
  deck_id: string;
  deck_type: string;
  deck_name: string;
}

export interface AdminDeckPremiumDisabledProperties {
  deck_id: string;
  deck_type: string;
  deck_name: string;
}

// ============================================================================
// Tracking Functions
// ============================================================================

/**
 * Track when admin opens the deck edit modal.
 */
export function trackAdminDeckEditOpened(properties: AdminDeckEditOpenedProperties): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('admin_deck_edit_opened', properties);
  }
}

/**
 * Track when admin successfully saves deck changes.
 */
export function trackAdminDeckEditSaved(properties: AdminDeckEditSavedProperties): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('admin_deck_edit_saved', properties);
  }
}

/**
 * Track when admin cancels/closes the edit modal without saving.
 */
export function trackAdminDeckEditCancelled(properties: AdminDeckEditCancelledProperties): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('admin_deck_edit_cancelled', properties);
  }
}

/**
 * Track when deck edit fails due to API error.
 */
export function trackAdminDeckEditFailed(properties: AdminDeckEditFailedProperties): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('admin_deck_edit_failed', properties);
  }
}

/**
 * Track when admin deactivates a deck (sets is_active to false).
 */
export function trackAdminDeckDeactivated(properties: AdminDeckDeactivatedProperties): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('admin_deck_deactivated', properties);
  }
}

/**
 * Track when admin reactivates a deck (sets is_active to true).
 */
export function trackAdminDeckReactivated(properties: AdminDeckReactivatedProperties): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('admin_deck_reactivated', properties);
  }
}

/**
 * Track when admin enables premium status on a deck.
 */
export function trackAdminDeckPremiumEnabled(properties: AdminDeckPremiumEnabledProperties): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('admin_deck_premium_enabled', properties);
  }
}

/**
 * Track when admin disables premium status on a deck.
 */
export function trackAdminDeckPremiumDisabled(
  properties: AdminDeckPremiumDisabledProperties
): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('admin_deck_premium_disabled', properties);
  }
}
