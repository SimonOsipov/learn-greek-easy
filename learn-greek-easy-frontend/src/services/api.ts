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
 * Attempt to refresh the access token
 */
async function refreshAccessToken(): Promise<string | null> {
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
}

/**
 * Make an authenticated API request
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
  } = options;

  const url = `${API_BASE_URL}${path}`;

  // Build headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...customHeaders,
  };

  // Add auth token if not skipped
  if (!skipAuth) {
    const { accessToken } = getAuthTokens();
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
  }

  // Create abort controller for timeout
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

    // Handle 401 - try token refresh
    if (response.status === 401 && !skipAuth) {
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

    // Handle other errors
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
