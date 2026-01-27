/**
 * Changelog Analytics for PostHog Integration
 *
 * Provides analytics tracking for changelog-related events:
 * - Tracks changelog_page_viewed when users view the changelog page
 * - Tracks changelog_page_paginated when users navigate between pages
 * - Tracks changelog_entry_viewed when users view individual entries
 */

import posthog from 'posthog-js';

/**
 * Properties for tracking when user views the Changelog page
 */
export interface ChangelogPageViewedProperties {
  /** Current page number (1-indexed) */
  page_number: number;
  /** Total number of changelog entries */
  total_items: number;
  /** Number of items displayed on current page */
  items_on_page: number;
  /** User's interface language */
  language: string;
}

/**
 * Properties for tracking pagination on the Changelog page
 */
export interface ChangelogPagePaginatedProperties {
  /** Page number user navigated from (1-indexed) */
  from_page: number;
  /** Page number user navigated to (1-indexed) */
  to_page: number;
  /** Total number of pages available */
  total_pages: number;
}

/**
 * Properties for tracking when user views a changelog entry
 */
export interface ChangelogEntryViewedProperties {
  /** UUID of the changelog entry */
  entry_id: string;
  /** Tag/category of the entry (e.g., "feature", "bugfix", "improvement") */
  tag: string;
  /** 0-indexed position of entry on the current page */
  position: number;
  /** Current page number (1-indexed) */
  page_number: number;
}

/**
 * Track when user views the Changelog page
 */
export function trackChangelogPageViewed(properties: ChangelogPageViewedProperties): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('changelog_page_viewed', properties);
  }
}

/**
 * Track when user navigates between pages on the Changelog page
 */
export function trackChangelogPagePaginated(properties: ChangelogPagePaginatedProperties): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('changelog_page_paginated', properties);
  }
}

/**
 * Track when user views a changelog entry
 */
export function trackChangelogEntryViewed(properties: ChangelogEntryViewedProperties): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('changelog_entry_viewed', properties);
  }
}
