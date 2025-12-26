/**
 * Structured logger for the application using loglevel.
 *
 * Features:
 * - Leveled logging (trace, debug, info, warn, error)
 * - Timestamps on all log messages
 * - Environment-aware log levels (debug in dev, warn in prod)
 * - Sentry integration in production (errors captured, warnings as breadcrumbs)
 *
 * @example
 * // Default import (recommended)
 * import log from '@/lib/logger';
 *
 * log.debug('Debugging info', { data });
 * log.info('User action completed');
 * log.warn('Deprecated feature used');
 * log.error('Failed to fetch', error);
 *
 * @example
 * // Named imports for convenience
 * import { info, error } from '@/lib/logger';
 *
 * info('Component mounted');
 * error('API call failed', err);
 *
 * @example
 * // Runtime level adjustment (dev only)
 * log.setLevel('trace'); // Show all logs
 * log.setLevel('error'); // Only errors
 *
 * @see https://github.com/pimterry/loglevel
 * @module lib/logger
 */

import * as Sentry from '@sentry/react';
import log from 'loglevel';

// Store original factory before modification
const originalFactory = log.methodFactory;

// Add timestamp prefix and Sentry integration via methodFactory
log.methodFactory = function (
  methodName: string,
  logLevel: log.LogLevelNumbers,
  loggerName: string | symbol
) {
  const rawMethod = originalFactory(methodName, logLevel, loggerName);

  return function (...args: unknown[]) {
    const timestamp = new Date().toISOString();

    // Call original method with timestamp (existing behavior)
    rawMethod(`[${timestamp}]`, ...args);

    // Send to Sentry in production
    if (import.meta.env.PROD) {
      const message = args
        .map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg)))
        .join(' ');

      if (methodName === 'error') {
        // Capture errors as Sentry events
        Sentry.captureMessage(message, 'error');
      } else if (methodName === 'warn') {
        // Add warnings as breadcrumbs
        Sentry.addBreadcrumb({
          category: 'console',
          message,
          level: 'warning',
        });
      } else if (methodName === 'info') {
        // Add info logs as breadcrumbs for context
        Sentry.addBreadcrumb({
          category: 'console',
          message,
          level: 'info',
        });
      }
    }
  };
};

// Set log level based on environment
// Using setDefaultLevel instead of setLevel for better UX:
// - setDefaultLevel only applies if no level was previously persisted
// - This respects any user/developer overrides from localStorage
if (import.meta.env.PROD) {
  log.setDefaultLevel('warn'); // Only warnings and errors in production
} else {
  log.setDefaultLevel('debug'); // Full debugging in development
}

// Apply the methodFactory changes
// Must call rebuild() after modifying methodFactory
log.rebuild();

export default log;

// Named exports for convenience
export const { trace, debug, info, warn, error } = log;
