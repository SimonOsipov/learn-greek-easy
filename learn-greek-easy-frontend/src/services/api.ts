// src/services/api.ts

/**
 * Base API Client
 *
 * Centralized HTTP client for backend API communication.
 * Features:
 * - Automatic auth token injection
 * - Token refresh on 401 errors
 * - Request/response error handling
 * - Type-safe request methods
 */

import log from '@/lib/logger';
import {
  type RetryConfig,
  DEFAULT_RETRY_CONFIG,
  isRetryableStatusCode,
  calculateBackoffDelay,
  sleep,
  logRetryAttempt,
} from '@/lib/retryUtils';
import { supabase } from '@/lib/supabaseClient';
import { checkVersionAndRefreshIfNeeded } from '@/lib/versionCheck';

// API base URL - relative URL for nginx proxy in production, or VITE_API_URL for dev
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

/**
 * API error response structure
 */
export interface APIError {
  status: number;
  statusText: string;
  message: string;
  detail?: string | Record<string, unknown>[];
}

/**
 * Custom error class for API errors
 */
export class APIRequestError extends Error {
  status: number;
  statusText: string;
  detail?: string | Record<string, unknown>[];

  constructor(error: APIError) {
    super(error.message);
    this.name = 'APIRequestError';
    this.status = error.status;
    this.statusText = error.statusText;
    this.detail = error.detail;
  }
}

/**
 * Clear auth tokens (on logout or auth failure).
 * Signs out of Supabase locally and cleans up legacy storage.
 */
export function clearAuthTokens(): void {
  supabase.auth.signOut({ scope: 'local' });
  localStorage.removeItem('auth-storage');
  sessionStorage.removeItem('auth-token');
}

/**
 * Request options for API calls
 */
interface RequestOptions {
  /** Skip automatic auth token injection */
  skipAuth?: boolean;
  /** Custom headers */
  headers?: Record<string, string>;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** AbortSignal for request cancellation */
  signal?: AbortSignal;
  /**
   * Retry configuration for transient errors.
   * - undefined: Use default retry config (3 retries with exponential backoff)
   * - false: Disable retries entirely
   * - Partial<RetryConfig>: Override specific retry settings
   */
  retry?: Partial<RetryConfig> | false;
}

/**
 * Make an authenticated API request with retry support for transient errors.
 */
async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  options: RequestOptions = {}
): Promise<T> {
  const {
    skipAuth = false,
    headers: customHeaders = {},
    timeout = 30000,
    signal: externalSignal,
    retry: retryOption,
  } = options;

  const url = `${API_BASE_URL}${path}`;

  // Build headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...customHeaders,
  };

  // Add auth token if not skipped
  if (!skipAuth) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const accessToken = session?.access_token ?? null;

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
  }

  // Determine retry configuration
  const retryConfig: RetryConfig | null =
    retryOption === false
      ? null
      : {
          ...DEFAULT_RETRY_CONFIG,
          ...(retryOption || {}),
        };

  // Track retry attempts for transient errors
  let lastError: Error | null = null;
  const maxAttempts = retryConfig ? retryConfig.maxRetries + 1 : 1; // +1 for initial request

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Create fresh abort controller for each attempt
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), timeout);

    // Combine external signal with timeout signal if both exist
    // Use AbortSignal.any() if available (modern browsers), otherwise prioritize external signal
    let combinedSignal: AbortSignal;
    if (externalSignal && typeof AbortSignal.any === 'function') {
      combinedSignal = AbortSignal.any([externalSignal, timeoutController.signal]);
    } else if (externalSignal) {
      // Fallback for older browsers: prefer external signal, but also listen to timeout
      combinedSignal = externalSignal;
      // Set up manual abort on timeout if external signal is used
      const handleTimeout = () => {
        // External signal will be aborted by caller if needed
        // We can't easily combine signals in older browsers, so timeout is handled separately
      };
      timeoutController.signal.addEventListener('abort', handleTimeout);
    } else {
      combinedSignal = timeoutController.signal;
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: combinedSignal,
      });

      clearTimeout(timeoutId);

      // Check for retryable transient errors (502, 503, 504)
      if (
        retryConfig &&
        isRetryableStatusCode(response.status, retryConfig.retryOnStatusCodes) &&
        attempt < retryConfig.maxRetries
      ) {
        const delay = calculateBackoffDelay(
          attempt,
          retryConfig.baseDelayMs,
          retryConfig.maxDelayMs
        );
        logRetryAttempt(attempt + 1, retryConfig.maxRetries, response.status, delay, url);
        await sleep(delay);
        continue; // Retry the request
      }

      // Handle 401 - session is invalid (Supabase auto-refresh couldn't recover)
      if (response.status === 401 && !skipAuth) {
        log.warn('Received 401 - session may be invalid or expired');
        throw new APIRequestError({
          status: 401,
          statusText: 'Unauthorized',
          message: 'Session expired. Please log in again.',
        });
      }

      // Handle other errors (non-retryable)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const detail = errorData.error?.details || errorData.detail;
        const message =
          errorData.error?.message ||
          errorData.detail ||
          `Request failed with status ${response.status}`;
        throw new APIRequestError({
          status: response.status,
          statusText: response.statusText,
          message,
          detail,
        });
      }

      // Check for version mismatch and refresh if needed (stale client detection)
      // This runs on every successful response to detect outdated frontend code
      checkVersionAndRefreshIfNeeded(response);

      // Return response (handle 204 No Content)
      if (response.status === 204) {
        return undefined as T;
      }

      return response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      // Check if this is a network error (fetch threw) and we should retry
      if (
        retryConfig &&
        attempt < retryConfig.maxRetries &&
        error instanceof Error &&
        error.name !== 'AbortError' &&
        !(error instanceof APIRequestError)
      ) {
        // Network error - retry with backoff
        const delay = calculateBackoffDelay(
          attempt,
          retryConfig.baseDelayMs,
          retryConfig.maxDelayMs
        );
        logRetryAttempt(attempt + 1, retryConfig.maxRetries, 0, delay, url);
        lastError = error;
        await sleep(delay);
        continue; // Retry the request
      }

      if (error instanceof APIRequestError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new APIRequestError({
            status: 408,
            statusText: 'Request Timeout',
            message: 'Request timed out. Please try again.',
          });
        }

        throw new APIRequestError({
          status: 0,
          statusText: 'Network Error',
          message: error.message || 'Network error. Please check your connection.',
        });
      }

      throw new APIRequestError({
        status: 0,
        statusText: 'Unknown Error',
        message: 'An unexpected error occurred.',
      });
    }
  }

  // If we've exhausted all retries, throw the last error
  // This should not normally be reached due to the throw in the catch block above
  throw (
    lastError ||
    new APIRequestError({
      status: 0,
      statusText: 'Unknown Error',
      message: 'Request failed after maximum retries.',
    })
  );
}

/**
 * API client with typed methods
 */
export const api = {
  /**
   * GET request
   */
  get: <T>(path: string, options?: RequestOptions) => request<T>('GET', path, undefined, options),

  /**
   * POST request
   */
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('POST', path, body, options),

  /**
   * PUT request
   */
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('PUT', path, body, options),

  /**
   * PATCH request
   */
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('PATCH', path, body, options),

  /**
   * DELETE request
   */
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>('DELETE', path, undefined, options),
};

/**
 * Build query string from params object
 */
export function buildQueryString(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  });

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}
