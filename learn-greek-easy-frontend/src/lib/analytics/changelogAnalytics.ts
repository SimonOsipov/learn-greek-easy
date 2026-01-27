/**
 * Changelog Analytics
 *
 * Stub functions for PostHog tracking.
 * Will be fully implemented in CHANGELOG-23.
 */

import posthog from 'posthog-js';

export interface ChangelogPageViewedProperties {
  total_entries: number;
}

export interface ChangelogPagePaginatedProperties {
  from_page: number;
  to_page: number;
  total_pages: number;
}

export function trackChangelogPageViewed(properties: ChangelogPageViewedProperties): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('changelog_page_viewed', properties);
  }
}

export function trackChangelogPagePaginated(properties: ChangelogPagePaginatedProperties): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('changelog_page_paginated', properties);
  }
}
