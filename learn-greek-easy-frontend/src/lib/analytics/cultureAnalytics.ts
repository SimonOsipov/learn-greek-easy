/**
 * Culture Exam Analytics for PostHog Integration
 *
 * Provides analytics tracking for culture exam features:
 * - Tracks culture question language preference changes
 * - Additional culture exam events will be added here
 */

import posthog from 'posthog-js';

import type { SupportedLanguage } from '@/i18n';

/**
 * Track when user changes culture question display language.
 *
 * This is separate from the main interface language change because:
 * - It's specific to question content, not UI chrome
 * - Users may prefer different languages for questions vs interface
 *
 * @param fromLang - Previous language code
 * @param toLang - New language code
 */
export function trackCultureLanguageChanged(
  fromLang: SupportedLanguage,
  toLang: SupportedLanguage
): void {
  // Only capture if PostHog is initialized
  if (typeof posthog?.capture === 'function') {
    posthog.capture('culture_language_changed', {
      from_lang: fromLang,
      to_lang: toLang,
    });
  }
}
