import type { Theme } from '@/contexts/ThemeContext';
import type { SupportedLanguage } from '@/i18n';

import { getPosthogInstance } from './track';

/**
 * Register the current theme as a super property.
 * This will be included in all future PostHog events.
 */
export function registerTheme(theme: Theme): void {
  const posthog = getPosthogInstance();
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
  const posthog = getPosthogInstance();
  if (typeof posthog?.register === 'function') {
    posthog.register({
      interface_language: language,
    });
  }
}
