/**
 * Structured logger for the application using loglevel.
 *
 * Features:
 * - Leveled logging (trace, debug, info, warn, error)
 * - Timestamps on all log messages
 * - Environment-aware log levels (debug in dev, warn in prod)
 * - Sentry integration in production (errors captured, warnings as breadcrumbs)
 *
 * Note: Sentry is loaded asynchronously for better LCP. Logs before Sentry
 * initializes are queued and flushed once Sentry is ready.
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

import log from 'loglevel';

import { queueBreadcrumb, queueLog, queueMessage } from './sentry-queue';

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

    // Send to Sentry queue in production
    // Queue handles both pre-init and post-init scenarios
    if (import.meta.env.PROD) {
      const message = args
        .map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg)))
        .join(' ');

      if (methodName === 'error') {
        // DUAL APPROACH: Send to Sentry Logs AND create Issue
        // 1. Send to Sentry Logs for searching/correlation
        queueLog('error', message);
        // 2. Create Sentry Issue for alerting/tracking (existing behavior)
        queueMessage(message, 'error');
        // 3. Add as breadcrumb for error context
        queueBreadcrumb({
          category: 'console',
          message,
          level: 'error',
        });
      } else if (methodName === 'warn') {
        // Send to Sentry Logs + breadcrumb
        queueLog('warn', message);
        queueBreadcrumb({
          category: 'console',
          message,
          level: 'warning',
        });
      } else if (methodName === 'info') {
        // Send to Sentry Logs + breadcrumb
        queueLog('info', message);
        queueBreadcrumb({
          category: 'console',
          message,
          level: 'info',
        });
      }
      // debug/trace: no Sentry in production (local console only)
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
