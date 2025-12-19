/**
 * Language Analytics for PostHog Integration
 *
 * Provides analytics tracking for i18n functionality:
 * - Registers interface_language as a super property (included in all events)
 * - Tracks language_switched events when users change language
 */

import posthog from 'posthog-js';

import type { SupportedLanguage } from '@/i18n';

/**
 * Register the current interface language as a super property.
 * This will be included in all future PostHog events.
 *
 * @param language - The current UI language code (e.g., "en", "el", "ru")
 */
export function registerInterfaceLanguage(language: SupportedLanguage): void {
  // Only register if PostHog is initialized
  if (typeof posthog?.register === 'function') {
    posthog.register({
      interface_language: language,
    });
  }
}

/**
 * Track a language switch event.
 *
 * @param fromLanguage - Previous language code
 * @param toLanguage - New language code
 * @param source - Where the change was initiated ("header" or "settings")
 * @param isAuthenticated - Whether the user is logged in
 */
export function trackLanguageSwitch(
  fromLanguage: SupportedLanguage,
  toLanguage: SupportedLanguage,
  source: 'header' | 'settings',
  isAuthenticated: boolean
): void {
  // Only capture if PostHog is initialized
  if (typeof posthog?.capture === 'function') {
    posthog.capture('language_switched', {
      from_language: fromLanguage,
      to_language: toLanguage,
      source,
      is_authenticated: isAuthenticated,
    });
  }
}
