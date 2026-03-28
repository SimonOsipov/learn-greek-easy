import posthog from 'posthog-js';

import type { Theme } from '@/contexts/ThemeContext';
import type { SupportedLanguage } from '@/i18n';

/**
 * Register the current theme as a super property.
 * This will be included in all future PostHog events.
 */
export function registerTheme(theme: Theme): void {
  if (typeof posthog?.register === 'function') {
    posthog.register({
      theme,
    });
  }
}

/**
 * Register the current interface language as a super property.
 * This will be included in all future PostHog events.
 */
export function registerInterfaceLanguage(language: SupportedLanguage): void {
  if (typeof posthog?.register === 'function') {
    posthog.register({
      interface_language: language,
    });
  }
}
