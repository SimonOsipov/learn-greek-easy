/**
 * Retry utilities for transient error handling.
 *
 * Provides exponential backoff retry logic for API requests
 * that fail due to transient server errors (502, 503, 504).
 *
 * Features:
 * - Configurable retry attempts and delays
 * - Exponential backoff with jitter to prevent thundering herd
 * - Customizable status codes to retry on
 *
 * @example
 * import { DEFAULT_RETRY_CONFIG, isRetryableStatusCode, calculateBackoffDelay } from '@/lib/retryUtils';
 *
 * if (isRetryableStatusCode(response.status, TRANSIENT_ERROR_CODES)) {
 *   const delay = calculateBackoffDelay(attempt, config.baseDelayMs, config.maxDelayMs);
 *   await sleep(delay);
 *   // retry request
 * }
 *
 * @module lib/retryUtils
 */

import log from './logger';

/**
 * HTTP status codes that indicate transient server errors.
 * These are errors where retrying is likely to succeed.
 *
 * - 502 Bad Gateway: Server acting as gateway received invalid response
 * - 503 Service Unavailable: Server temporarily overloaded or down for maintenance
 * - 504 Gateway Timeout: Server acting as gateway didn't receive timely response
 */
export const TRANSIENT_ERROR_CODES = [502, 503, 504] as const;

/**
 * Configuration for retry behavior.
 */
export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries: number;
  /** Base delay in milliseconds for first retry (default: 1000) */
  baseDelayMs: number;
  /** Maximum delay in milliseconds (caps exponential growth) (default: 10000) */
  maxDelayMs: number;
  /** HTTP status codes that trigger retry (default: [502, 503, 504]) */
  retryOnStatusCodes: readonly number[];
}

/**
 * Default retry configuration.
 * Provides sensible defaults for most API retry scenarios.
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  retryOnStatusCodes: TRANSIENT_ERROR_CODES,
};

/**
 * Check if a status code should trigger a retry.
 *
 * @param status - HTTP status code to check
 * @param codes - Array of status codes that should trigger retry
 * @returns true if the status code is in the retry list
 *
 * @example
 * isRetryableStatusCode(503, TRANSIENT_ERROR_CODES); // true
 * isRetryableStatusCode(404, TRANSIENT_ERROR_CODES); // false
 */
export function isRetryableStatusCode(status: number, codes: readonly number[]): boolean {
  return codes.includes(status);
}

/**
 * Calculate the backoff delay for a retry attempt using exponential backoff with jitter.
 *
 * Formula: min(maxDelay, baseDelay * 2^attempt) * (1 + random(0, 0.25))
 *
 * The jitter (0-25% random addition) helps prevent thundering herd problem
 * when multiple clients retry simultaneously.
 *
 * @param attempt - Current retry attempt (0-indexed, so first retry is attempt 0)
 * @param baseDelay - Base delay in milliseconds
 * @param maxDelay - Maximum delay cap in milliseconds
 * @returns Delay in milliseconds to wait before retry
 *
 * @example
 * // First retry (attempt 0): baseDelay * 1 * jitter = ~1000-1250ms
 * calculateBackoffDelay(0, 1000, 10000);
 *
 * // Second retry (attempt 1): baseDelay * 2 * jitter = ~2000-2500ms
 * calculateBackoffDelay(1, 1000, 10000);
 *
 * // Third retry (attempt 2): baseDelay * 4 * jitter = ~4000-5000ms
 * calculateBackoffDelay(2, 1000, 10000);
 */
export function calculateBackoffDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number
): number {
  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = baseDelay * Math.pow(2, attempt);

  // Cap at maxDelay
  const cappedDelay = Math.min(exponentialDelay, maxDelay);

  // Add jitter: 0-25% random addition to prevent thundering herd
  const jitter = 1 + Math.random() * 0.25;

  return Math.floor(cappedDelay * jitter);
}

/**
 * Sleep for a specified number of milliseconds.
 *
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after the delay
 *
 * @example
 * await sleep(1000); // Wait 1 second
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Log a retry attempt for debugging purposes.
 *
 * @param attempt - Current retry attempt number (1-indexed for logging)
 * @param maxRetries - Maximum retries configured
 * @param status - HTTP status code that triggered retry
 * @param delay - Delay in ms before next retry
 * @param url - Request URL (for context)
 */
export function logRetryAttempt(
  attempt: number,
  maxRetries: number,
  status: number,
  delay: number,
  url: string
): void {
  log.debug(
    `API retry ${attempt}/${maxRetries} after ${status} error, waiting ${delay}ms before retry`,
    { url, status, attempt, delay }
  );
}
