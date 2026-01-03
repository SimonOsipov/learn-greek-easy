import { type ReactNode, useEffect, useState } from 'react';

import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';

import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, type SupportedLanguage } from '@/i18n';
import { reportAPIError } from '@/lib/errorReporting';
import { isTestUser, shouldInitializePostHog } from '@/utils/analytics';

/**
 * Get the current language from localStorage (set by i18next-browser-languagedetector).
 * Falls back to DEFAULT_LANGUAGE if not found or invalid.
 */
function getStoredLanguage(): SupportedLanguage {
  try {
    const storedLang = localStorage.getItem('i18nextLng');
    if (storedLang) {
      // Handle language codes with region (e.g., 'en-US' -> 'en')
      const baseLang = storedLang.split('-')[0] as SupportedLanguage;
      if (SUPPORTED_LANGUAGES.includes(baseLang)) {
        return baseLang;
      }
    }
  } catch {
    // localStorage may not be available in some contexts
  }
  return DEFAULT_LANGUAGE;
}

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';
const ENVIRONMENT = import.meta.env.VITE_ENVIRONMENT || 'development';

interface PostHogProviderProps {
  children: ReactNode;
}

/**
 * PostHog Analytics Provider
 *
 * Wraps the application with PostHog analytics tracking.
 * Features:
 * - Graceful degradation: Works without API key (no-op)
 * - Test environment filtering: Disabled when VITE_ENVIRONMENT=test
 * - Test user filtering: Blocks events from test_*, e2e_*, *@test.* users
 * - Super properties: Attaches environment, app_version, interface_language to all events
 *
 * Configuration:
 * - person_profiles: 'identified_only' - Only create profiles for identified users
 * - autocapture: false - Manual events only for precise control
 * - disable_session_recording: true - Enable later if needed
 */
export function PostHogProvider({ children }: PostHogProviderProps) {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    // Initialize only if conditions are met
    if (!shouldInitializePostHog(POSTHOG_KEY, ENVIRONMENT)) {
      return;
    }

    try {
      // POSTHOG_KEY is guaranteed to be defined here due to shouldInitializePostHog check
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      posthog.init(POSTHOG_KEY!, {
        api_host: POSTHOG_HOST,
        person_profiles: 'identified_only',
        capture_pageview: true,
        capture_pageleave: true,
        autocapture: false, // Manual events only for control
        disable_session_recording: true, // Enable later if needed
        loaded: (posthogInstance) => {
          // Register super properties that will be included in all events
          posthogInstance.register({
            environment: ENVIRONMENT,
            app_version: import.meta.env.VITE_APP_VERSION || '1.0.0',
            interface_language: getStoredLanguage(),
          });
          setInitialized(true);
        },
        before_send: (event) => {
          // Filter out test users
          const userId = event?.properties?.$user_id;
          if (isTestUser(userId)) {
            return null; // Don't send
          }
          return event;
        },
      });
    } catch (error) {
      reportAPIError(error, { operation: 'initializePostHog' });
      // Continue without PostHog - graceful degradation
    }
  }, []);

  // Always render children, provider is optional
  if (!shouldInitializePostHog(POSTHOG_KEY, ENVIRONMENT) || !initialized) {
    return <>{children}</>;
  }

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
