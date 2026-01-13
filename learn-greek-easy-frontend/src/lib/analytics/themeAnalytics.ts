/**
 * Theme Analytics for PostHog Integration
 */
import posthog from 'posthog-js';

import type { Theme } from '@/contexts/ThemeContext';

/**
 * Register the current theme as a super property.
 */
export function registerTheme(theme: Theme): void {
  if (typeof posthog?.register === 'function') {
    posthog.register({
      theme,
    });
  }
}

/**
 * Track a theme change event.
 */
export function trackThemeChange(
  fromTheme: Theme,
  toTheme: Theme,
  source: 'header' | 'settings',
  isAuthenticated: boolean
): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('theme_changed', {
      from_theme: fromTheme,
      to_theme: toTheme,
      source,
      is_authenticated: isAuthenticated,
    });
  }
}

/**
 * Track when theme preference is loaded.
 */
export function trackThemePreferenceLoaded(
  theme: Theme,
  source: 'localStorage' | 'api' | 'default'
): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('theme_preference_loaded', {
      theme,
      source,
    });
  }
}

/**
 * Track when guest theme is migrated to account.
 */
export function trackThemeMigration(theme: Theme): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('theme_migration_completed', {
      theme,
    });
  }
}
