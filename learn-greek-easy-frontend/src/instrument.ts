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

    // Enable Sentry Logs for centralized log aggregation
    enableLogs: true,

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

    // Filter out noisy errors that are never actionable
    ignoreErrors: [
      // Browser extensions - never actionable
      /^chrome-extension:\/\//,
      /^moz-extension:\/\//,
      // User-initiated abort - expected behavior
      'AbortError',
      // ResizeObserver - browser quirk, not actionable
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
    ],

    // Intelligent filtering based on network state
    beforeSend(event, hint) {
      // Don't send events in development
      if (import.meta.env.DEV) {
        return null;
      }

      const originalException = hint?.originalException;
      const errorMessage =
        originalException instanceof Error
          ? originalException.message
          : String(originalException || '');
      const errorName = originalException instanceof Error ? originalException.name : '';

      // Brave browser workaround - navigator.onLine always returns false
      const isBraveBrowser = (navigator as unknown as { brave?: unknown }).brave !== undefined;
      const isOffline = !isBraveBrowser && typeof navigator !== 'undefined' && !navigator.onLine;

      // Network error patterns
      const networkErrorPatterns = [
        'Failed to fetch',
        'Network request failed',
        'Load failed',
        'NetworkError when attempting to fetch resource',
        'The Internet connection appears to be offline',
        'net::ERR_INTERNET_DISCONNECTED',
        'net::ERR_NETWORK_CHANGED',
      ];

      const isNetworkError = networkErrorPatterns.some((pattern) => errorMessage.includes(pattern));

      // Chunk errors - let through (ChunkErrorBoundary handles UI)
      const isChunkError =
        errorMessage.toLowerCase().includes('loading chunk') ||
        errorMessage.toLowerCase().includes('dynamically imported module') ||
        errorName === 'ChunkLoadError';

      // Only filter network errors when user is DEFINITELY offline
      // When online but network fails, it's likely a backend issue worth tracking
      if (isNetworkError && isOffline && !isChunkError) {
        return null;
      }

      // Add network context for debugging
      if (isNetworkError || isChunkError) {
        event.contexts = event.contexts || {};
        event.contexts.network = {
          online: !isOffline,
          effectiveType:
            (navigator as unknown as { connection?: { effectiveType?: string } }).connection
              ?.effectiveType || 'unknown',
        };
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
