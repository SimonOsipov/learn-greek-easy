import Constants from 'expo-constants';
import PostHog from 'posthog-react-native';

import { getPostHogConfig, getSentryConfig } from '@/lib/config';

const { apiKey, host } = getPostHogConfig();

// Singleton — undefined when PostHog is disabled (no API key).
// Observability must degrade to a no-op, never crash.
let _client: PostHog | undefined;

if (apiKey) {
  _client = new PostHog(apiKey, {
    host,
    // captureAppLifecycleEvents: default-on since v4.39.0; explicit here for clarity.
    captureAppLifecycleEvents: true,
    // RN form is camelCase: personProfiles (not web's person_profiles)
    personProfiles: 'identified_only',
  });
}

export function getPostHog(): PostHog | undefined {
  return _client;
}

/**
 * Register super properties that are attached to every subsequent event.
 * Called once on mount and again whenever colorScheme changes.
 * NO interface_language — mobile does not expose i18n preference.
 */
export function registerSuperProperties(theme: string): void {
  const client = getPostHog();
  if (typeof client?.register === 'function') {
    client.register({
      environment: getSentryConfig().environment,
      app_version: Constants.expoConfig?.version ?? '1.0.0',
      theme,
    });
  }
}
