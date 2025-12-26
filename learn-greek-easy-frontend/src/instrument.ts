/**
 * Sentry initialization - MUST be imported before any other app code
 *
 * Only initializes in production environment.
 * Session replay is handled by PostHog, so not included here.
 */
import * as Sentry from '@sentry/react';

import log from '@/lib/logger';

// Only initialize Sentry in production
if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,

    // Environment and release info
    environment: 'production',
    release: import.meta.env.VITE_COMMIT_SHA || 'unknown',

    integrations: [
      // Performance monitoring - traces page loads and API calls
      Sentry.browserTracingIntegration(),
    ],

    // Performance monitoring sample rate
    // Capture 20% of transactions in production (adjust based on traffic)
    tracesSampleRate: 0.2,

    // Propagate traces to our backend API
    tracePropagationTargets: [
      /^\/api/, // Relative API calls
      /^https:\/\/learn-greek-frontend\.up\.railway\.app\/api/, // Production API
      /^https:\/\/backend-dev-bc44\.up\.railway\.app/, // Dev backend
    ],

    // Don't send PII by default
    sendDefaultPii: false,

    // Filter out noisy errors
    ignoreErrors: [
      // Browser extensions
      /^chrome-extension:\/\//,
      /^moz-extension:\/\//,
      // Network errors that are expected
      'Network request failed',
      'Failed to fetch',
      'Load failed',
      // User-initiated navigation
      'AbortError',
    ],

    // Before sending, add extra context
    beforeSend(event) {
      // Don't send events in development (extra safety)
      if (import.meta.env.DEV) {
        return null;
      }
      return event;
    },
  });

  // Log that Sentry is initialized (visible in browser console)
  log.info('[Sentry] Initialized for production');
} else if (import.meta.env.DEV) {
  log.info('[Sentry] Skipped - development environment');
}

export default Sentry;
