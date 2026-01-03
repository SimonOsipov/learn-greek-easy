/**
 * Error Reporting Utilities
 *
 * Provides standardized error reporting to Sentry with full exception
 * objects (including stack traces) rather than just string messages.
 *
 * This solves the issue where `log.error('message', err)` was converting
 * errors to strings via `queueMessage()`, losing stack traces and error
 * properties in Sentry.
 *
 * @module lib/errorReporting
 */

import { APIRequestError } from '@/services/api';

import { queueException } from './sentry-queue';

/**
 * Context information to attach to error reports
 */
export interface ErrorContext {
  /** API endpoint that was called */
  endpoint?: string;
  /** Operation being performed (e.g., 'submitAnswer', 'fetchDecks') */
  operation?: string;
  /** HTTP method used */
  method?: string;
  /** Additional context properties */
  [key: string]: unknown;
}

/**
 * Report an API error to Sentry with full exception details.
 *
 * Unlike `log.error()`, this function:
 * - Preserves the full stack trace
 * - Extracts API-specific error properties (status, statusText, detail)
 * - Attaches contextual information for debugging
 *
 * NOTE: Do NOT call `log.error()` alongside this function to avoid
 * duplicate Sentry events.
 *
 * @param error - The error to report (typically an APIRequestError or Error)
 * @param context - Optional context information to attach to the report
 *
 * @example
 * ```typescript
 * try {
 *   await api.post('/endpoint', data);
 * } catch (err) {
 *   reportAPIError(err, { operation: 'submitAnswer', endpoint: '/endpoint' });
 * }
 * ```
 */
export function reportAPIError(error: unknown, context?: ErrorContext): void {
  // Build Sentry context
  const sentryContext: Record<string, unknown> = {
    ...context,
    timestamp: new Date().toISOString(),
  };

  // Extract API-specific details if available
  if (error instanceof APIRequestError) {
    sentryContext.apiError = {
      status: error.status,
      statusText: error.statusText,
      message: error.message,
      detail: error.detail,
    };
  }

  // Capture to Sentry with full exception (preserves stack trace)
  queueException(error, sentryContext);
}
