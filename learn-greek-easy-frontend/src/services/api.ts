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
import { shouldRefreshToken } from '@/lib/tokenUtils';

// API base URL - relative URL for nginx proxy in production, or VITE_API_URL for dev
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

/**
 * Check if Auth0 authentication is enabled via feature flag.
 * Duplicated here to avoid circular dependency with hooks.
 */
function isAuth0Enabled(): boolean {
  return import.meta.env.VITE_AUTH0_ENABLED === 'true';
}

/**
 * Auth0 token getter function type.
 * This matches the signature of Auth0's getAccessTokenSilently.
 */
type Auth0TokenGetter = () => Promise<string>;

/**
 * Registered Auth0 token getter.
 * Set by Auth0TokenInjector when Auth0 is enabled and user is authenticated.
 */
let auth0TokenGetter: Auth0TokenGetter | null = null;

/**
 * Register the Auth0 getAccessTokenSilently function.
 * Called by Auth0TokenInjector when Auth0 is enabled.
 */
export function registerAuth0TokenGetter(getter: Auth0TokenGetter): void {
  auth0TokenGetter = getter;
}

/**
 * Unregister the Auth0 token getter.
 * Called when Auth0TokenInjector unmounts or user logs out.
 */
export function unregisterAuth0TokenGetter(): void {
  auth0TokenGetter = null;
}

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
 * Get stored auth tokens
 */
function getAuthTokens(): { accessToken: string | null; refreshToken: string | null } {
  // Check localStorage first (for "remember me" users)
  const authStorage = localStorage.getItem('auth-storage');
  if (authStorage) {
    try {
      const parsed = JSON.parse(authStorage);
      if (parsed.state?.token) {
        return {
          accessToken: parsed.state.token,
          refreshToken: parsed.state.refreshToken || null,
        };
      }
    } catch {
      // Invalid JSON, continue to sessionStorage
    }
  }

  // Check sessionStorage (for non-"remember me" users)
  const sessionToken = sessionStorage.getItem('auth-token');
  return {
    accessToken: sessionToken,
    refreshToken: null,
  };
}

/**
 * Update stored auth tokens
 */
function updateAuthTokens(accessToken: string, refreshToken?: string): void {
  // Update localStorage if it exists
  const authStorage = localStorage.getItem('auth-storage');
  if (authStorage) {
    try {
      const parsed = JSON.parse(authStorage);
      parsed.state.token = accessToken;
      if (refreshToken) {
        parsed.state.refreshToken = refreshToken;
      }
      localStorage.setItem('auth-storage', JSON.stringify(parsed));
    } catch {
      // Ignore errors
    }
  }

  // Always update sessionStorage
  sessionStorage.setItem('auth-token', accessToken);
}

/**
 * Clear auth tokens (on logout or auth failure)
 */
export function clearAuthTokens(): void {
  localStorage.removeItem('auth-storage');
  sessionStorage.removeItem('auth-token');
}

/**
 * Singleton promise for token refresh operation.
 * Prevents race conditions when multiple requests trigger refresh simultaneously.
 *
 * When multiple concurrent requests receive 401 errors, they all attempt to refresh
 * the token. With token rotation (refresh tokens are single-use), only the first
 * refresh succeeds - subsequent attempts fail because the old refresh token was
 * already rotated. This mutex ensures only ONE refresh request is made, and all
 * waiting requests share the result.
 */
let refreshPromise: Promise<string | null> | null = null;

/**
 * Internal function that performs the actual token refresh.
 * Called only by refreshAccessToken() to ensure single execution.
 */
async function performTokenRefresh(): Promise<string | null> {
  const { refreshToken } = getAuthTokens();

  if (!refreshToken) {
    return null;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      // Refresh failed, clear tokens
      clearAuthTokens();
      return null;
    }

    const data = await response.json();
    updateAuthTokens(data.access_token, data.refresh_token);
    return data.access_token;
  } catch {
    clearAuthTokens();
    return null;
  }
}

/**
 * Attempt to refresh the access token.
 * Uses a singleton pattern to prevent race conditions when multiple
 * concurrent requests receive 401 errors simultaneously.
 *
 * If a refresh is already in progress, subsequent calls will wait for
 * that refresh to complete rather than starting a new one.
 */
async function refreshAccessToken(): Promise<string | null> {
  // If a refresh is already in progress, wait for it
  if (refreshPromise) {
    return refreshPromise;
  }

  // Start a new refresh operation
  refreshPromise = performTokenRefresh();

  try {
    const result = await refreshPromise;
    return result;
  } finally {
    // Clear the promise so future refreshes can occur
    refreshPromise = null;
  }
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
    // Use Auth0 token when Auth0 is enabled, otherwise use legacy auth
    if (isAuth0Enabled() && auth0TokenGetter) {
      try {
        const auth0Token = await auth0TokenGetter();
        if (auth0Token) {
          headers['Authorization'] = `Bearer ${auth0Token}`;
        }
      } catch (error) {
        // Auth0 token retrieval failed - log and continue without auth
        // The SDK will handle token refresh automatically
        log.warn('Failed to get Auth0 token', { error });
      }
    } else {
      // Legacy auth: use stored tokens with proactive refresh
      let { accessToken } = getAuthTokens();

      // PROACTIVE REFRESH: Check if token is expired or expiring soon
      // This is the key fix - refresh BEFORE the request, not after 401
      if (accessToken && shouldRefreshToken(accessToken)) {
        log.debug('Token expiring soon, proactively refreshing');
        const newToken = await refreshAccessToken();
        if (newToken) {
          accessToken = newToken;
          log.debug('Proactive token refresh successful');
        } else {
          // Refresh failed - clear tokens and let request proceed without auth
          // The 401 handler will trigger login redirect
          log.warn('Proactive token refresh failed, clearing auth');
          clearAuthTokens();
          accessToken = null;
        }
      }

      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }
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

      // Handle 401 - This should be RARE after proactive refresh
      // If we get here, something is actually wrong (revoked token, security issue)
      if (response.status === 401 && !skipAuth) {
        // When Auth0 is enabled, don't try legacy refresh - Auth0 SDK handles this
        // Just throw the error and let the UI redirect to login
        if (isAuth0Enabled()) {
          log.warn('Received 401 with Auth0 - token may have expired or been revoked');
          throw new APIRequestError({
            status: 401,
            statusText: 'Unauthorized',
            message: 'Session expired. Please log in again.',
          });
        }

        // Legacy auth: try to refresh the token
        log.warn('Received 401 despite proactive refresh - token may have been revoked');
        const newToken = await refreshAccessToken();

        if (newToken) {
          // Retry with new token
          headers['Authorization'] = `Bearer ${newToken}`;
          const retryResponse = await fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
          });

          if (!retryResponse.ok) {
            const errorData = await retryResponse.json().catch(() => ({}));
            throw new APIRequestError({
              status: retryResponse.status,
              statusText: retryResponse.statusText,
              message: errorData.detail || `Request failed with status ${retryResponse.status}`,
              detail: errorData.detail,
            });
          }

          // Return response (handle 204 No Content)
          if (retryResponse.status === 204) {
            return undefined as T;
          }
          return retryResponse.json();
        }

        // Token refresh failed
        throw new APIRequestError({
          status: 401,
          statusText: 'Unauthorized',
          message: 'Session expired. Please log in again.',
        });
      }

      // Handle other errors (non-retryable)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new APIRequestError({
          status: response.status,
          statusText: response.statusText,
          message: errorData.detail || `Request failed with status ${response.status}`,
          detail: errorData.detail,
        });
      }

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

/**
 * Reset refresh promise state - FOR TESTING ONLY.
 * This allows tests to reset the module state between test runs.
 */
export function _resetRefreshState_forTesting(): void {
  refreshPromise = null;
}

/**
 * Get the current refresh promise - FOR TESTING ONLY.
 * This allows tests to verify the mutex behavior.
 */
export function _getRefreshPromise_forTesting(): Promise<string | null> | null {
  return refreshPromise;
}
