// src/services/__tests__/api.test.ts

/**
 * API Client Tests
 *
 * Tests for the API client covering:
 * 1. Token Refresh Race Condition handling (mutex pattern)
 * 2. Transient error retry behavior (502, 503, 504)
 *
 * Token Refresh Background:
 * The backend uses token rotation for security - refresh tokens are single-use.
 * When a refresh token is used, it's deleted and a new one is issued. This means
 * if multiple requests try to refresh concurrently with the same refresh token,
 * only the first one succeeds; the others fail because their token was already rotated.
 *
 * The mutex pattern ensures:
 * 1. Only ONE refresh request is made when multiple 401s occur simultaneously
 * 2. All waiting requests receive the same result from the single refresh
 * 3. After the refresh completes, new refreshes can occur normally
 *
 * Retry Behavior:
 * Transient errors (502, 503, 504) are automatically retried with exponential backoff.
 * This helps recover from temporary server issues like:
 * - Cold starts in Railway
 * - Temporary network issues
 * - Load balancer timeouts during deployment
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, APIRequestError } from '../api';

// Mock Supabase client before any imports
vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));

// Get mocked functions after module is mocked
import { supabase } from '@/lib/supabaseClient';
const mockGetSession = vi.mocked(supabase.auth.getSession);
const mockSignOut = vi.mocked(supabase.auth.signOut);

// Mock the sleep function for retry tests to avoid slow tests
vi.mock('@/lib/retryUtils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/retryUtils')>();
  return {
    ...actual,
    // Keep original sleep for unit tests in retryUtils.test.ts
    // but override in api.test.ts to speed up integration tests
    sleep: vi.fn().mockImplementation(() => Promise.resolve()),
  };
});

describe('Supabase Token Injection', () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockSignOut.mockReset();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should inject Bearer token from Supabase session', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'test-supabase-token' } },
    });

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: 'test' }),
      headers: new Headers(),
    });

    await api.get('/api/v1/test');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-supabase-token',
        }),
      })
    );
  });

  it('should make unauthenticated request when no Supabase session', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
    });

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: 'test' }),
      headers: new Headers(),
    });

    await api.get('/api/v1/test');

    const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[1].headers).not.toHaveProperty('Authorization');
  });

  it('should skip auth when skipAuth option is true', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: 'test' }),
      headers: new Headers(),
    });

    await api.get('/api/v1/test', { skipAuth: true });

    expect(mockGetSession).not.toHaveBeenCalled();
  });

  it('should throw APIRequestError on 401 without retry', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'test-token' } },
    });

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({}),
      headers: new Headers(),
    });

    await expect(api.get('/api/v1/test')).rejects.toThrow(APIRequestError);
    await expect(api.get('/api/v1/test')).rejects.toMatchObject({
      status: 401,
    });
  });
});

// Deleted: Token Refresh Mutex tests (no longer applicable with Supabase auto-refresh)
// Deleted: Proactive Token Refresh tests (handled by Supabase SDK)

describe('Transient Error Retry', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    // Clear storage
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('retry on transient errors', () => {
    it('should retry on 502 and succeed on retry', async () => {
      let callCount = 0;

      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 502,
            statusText: 'Bad Gateway',
            json: () => Promise.resolve({ detail: 'Bad Gateway' }),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: 'success' }),
        });
      });

      const result = await api.get('/api/v1/test', { skipAuth: true });

      expect(callCount).toBe(2);
      expect(result).toEqual({ data: 'success' });
    });

    it('should retry on 503 and succeed on retry', async () => {
      let callCount = 0;

      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 503,
            statusText: 'Service Unavailable',
            json: () => Promise.resolve({ detail: 'Service Unavailable' }),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: 'success' }),
        });
      });

      const result = await api.get('/api/v1/test', { skipAuth: true });

      expect(callCount).toBe(2);
      expect(result).toEqual({ data: 'success' });
    });

    it('should retry on 504 and succeed on retry', async () => {
      let callCount = 0;

      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 504,
            statusText: 'Gateway Timeout',
            json: () => Promise.resolve({ detail: 'Gateway Timeout' }),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: 'success' }),
        });
      });

      const result = await api.get('/api/v1/test', { skipAuth: true });

      expect(callCount).toBe(2);
      expect(result).toEqual({ data: 'success' });
    });

    it('should throw error after max retries exhausted', async () => {
      global.fetch = vi.fn().mockImplementation(() => {
        return Promise.resolve({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
          json: () => Promise.resolve({ detail: 'Service Unavailable' }),
        });
      });

      await expect(api.get('/api/v1/test', { skipAuth: true })).rejects.toMatchObject({
        status: 503,
        statusText: 'Service Unavailable',
      });

      // Initial request + 3 retries = 4 total calls
      expect(fetch).toHaveBeenCalledTimes(4);
    });

    it('should retry multiple times if errors persist', async () => {
      let callCount = 0;

      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          return Promise.resolve({
            ok: false,
            status: 502,
            statusText: 'Bad Gateway',
            json: () => Promise.resolve({ detail: 'Bad Gateway' }),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: 'success after 3 attempts' }),
        });
      });

      const result = await api.get('/api/v1/test', { skipAuth: true });

      expect(callCount).toBe(3);
      expect(result).toEqual({ data: 'success after 3 attempts' });
    });
  });

  describe('no retry on non-transient errors', () => {
    it('should not retry on 400 Bad Request', async () => {
      global.fetch = vi.fn().mockImplementation(() => {
        return Promise.resolve({
          ok: false,
          status: 400,
          statusText: 'Bad Request',
          json: () => Promise.resolve({ detail: 'Bad Request' }),
        });
      });

      await expect(api.get('/api/v1/test', { skipAuth: true })).rejects.toMatchObject({
        status: 400,
      });

      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('should not retry on 404 Not Found', async () => {
      global.fetch = vi.fn().mockImplementation(() => {
        return Promise.resolve({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          json: () => Promise.resolve({ detail: 'Not Found' }),
        });
      });

      await expect(api.get('/api/v1/test', { skipAuth: true })).rejects.toMatchObject({
        status: 404,
      });

      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('should not retry on 500 Internal Server Error', async () => {
      global.fetch = vi.fn().mockImplementation(() => {
        return Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: () => Promise.resolve({ detail: 'Internal Server Error' }),
        });
      });

      await expect(api.get('/api/v1/test', { skipAuth: true })).rejects.toMatchObject({
        status: 500,
      });

      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('retry configuration options', () => {
    it('should respect retry: false option (disable retries)', async () => {
      global.fetch = vi.fn().mockImplementation(() => {
        return Promise.resolve({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
          json: () => Promise.resolve({ detail: 'Service Unavailable' }),
        });
      });

      await expect(api.get('/api/v1/test', { skipAuth: true, retry: false })).rejects.toMatchObject(
        {
          status: 503,
        }
      );

      // Should only make one request (no retries)
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('should respect custom maxRetries option', async () => {
      global.fetch = vi.fn().mockImplementation(() => {
        return Promise.resolve({
          ok: false,
          status: 502,
          statusText: 'Bad Gateway',
          json: () => Promise.resolve({ detail: 'Bad Gateway' }),
        });
      });

      await expect(
        api.get('/api/v1/test', {
          skipAuth: true,
          retry: { maxRetries: 1 },
        })
      ).rejects.toMatchObject({
        status: 502,
      });

      // Initial request + 1 retry = 2 total calls
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('should respect maxRetries: 0 (no retries)', async () => {
      global.fetch = vi.fn().mockImplementation(() => {
        return Promise.resolve({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
          json: () => Promise.resolve({ detail: 'Service Unavailable' }),
        });
      });

      await expect(
        api.get('/api/v1/test', {
          skipAuth: true,
          retry: { maxRetries: 0 },
        })
      ).rejects.toMatchObject({
        status: 503,
      });

      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('retry with POST requests', () => {
    it('should retry POST request on 503', async () => {
      let callCount = 0;
      const requestBody = { name: 'test' };

      global.fetch = vi.fn().mockImplementation((_url: string, options?: RequestInit) => {
        callCount++;

        // Verify body is sent on retry
        if (options?.body) {
          const body = JSON.parse(options.body as string);
          expect(body).toEqual(requestBody);
        }

        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 503,
            statusText: 'Service Unavailable',
            json: () => Promise.resolve({ detail: 'Service Unavailable' }),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ id: 1, name: 'test' }),
        });
      });

      const result = await api.post('/api/v1/items', requestBody, { skipAuth: true });

      expect(callCount).toBe(2);
      expect(result).toEqual({ id: 1, name: 'test' });
    });
  });

  describe('retry on network errors', () => {
    it('should retry on network error (fetch throws)', async () => {
      let callCount = 0;

      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new TypeError('Failed to fetch'));
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: 'success' }),
        });
      });

      const result = await api.get('/api/v1/test', { skipAuth: true });

      expect(callCount).toBe(2);
      expect(result).toEqual({ data: 'success' });
    });

    it('should throw after max retries for network errors', async () => {
      global.fetch = vi.fn().mockImplementation(() => {
        return Promise.reject(new TypeError('Failed to fetch'));
      });

      await expect(api.get('/api/v1/test', { skipAuth: true })).rejects.toMatchObject({
        status: 0,
        statusText: 'Network Error',
      });

      // Initial request + 3 retries = 4 total calls
      expect(fetch).toHaveBeenCalledTimes(4);
    });
  });

  describe('retry does not interfere with 401 handling', () => {
    it('should not retry 401 errors (handled by Supabase)', async () => {
      // Setup: Supabase session exists
      mockGetSession.mockResolvedValue({
        data: { session: { access_token: 'test-token' } },
      });

      global.fetch = vi.fn().mockImplementation(() => {
        return Promise.resolve({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          json: () => Promise.resolve({ detail: 'Token expired' }),
        });
      });

      await expect(api.get('/api/v1/test')).rejects.toMatchObject({
        status: 401,
      });

      // 401 should not trigger retry loop - Supabase handles refresh
      // Only one API call should be made (no retry)
      const fetchCalls = (fetch as ReturnType<typeof vi.fn>).mock.calls;
      expect(fetchCalls.length).toBe(1);
    });
  });
});

describe('Error Parsing', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('nested error structure parsing', () => {
    it('should extract nested error.details for 422 responses', async () => {
      global.fetch = vi.fn().mockImplementation(() => {
        return Promise.resolve({
          ok: false,
          status: 422,
          statusText: 'Unprocessable Entity',
          json: () =>
            Promise.resolve({
              error: {
                message: 'Validation failed',
                details: [
                  {
                    type: 'string_too_short',
                    loc: ['body', 'title_en'],
                    msg: 'String should have at least 1 character',
                    input: '',
                  },
                ],
              },
            }),
        });
      });

      const result = (await api
        .post('/api/v1/test', {}, { skipAuth: true })
        .catch((e) => e)) as APIRequestError;

      expect(result.status).toBe(422);
      expect(result.message).toBe('Validation failed');
      expect(result.detail).toEqual([
        {
          type: 'string_too_short',
          loc: ['body', 'title_en'],
          msg: 'String should have at least 1 character',
          input: '',
        },
      ]);
    });

    it('should extract nested error.message for non-422 errors', async () => {
      global.fetch = vi.fn().mockImplementation(() => {
        return Promise.resolve({
          ok: false,
          status: 400,
          statusText: 'Bad Request',
          json: () =>
            Promise.resolve({
              error: {
                message: 'Custom error message from backend',
                details: null,
              },
            }),
        });
      });

      const result = (await api
        .post('/api/v1/test', {}, { skipAuth: true })
        .catch((e) => e)) as APIRequestError;

      expect(result.status).toBe(400);
      expect(result.message).toBe('Custom error message from backend');
    });

    it('should fall back to top-level detail when error.details is not present', async () => {
      global.fetch = vi.fn().mockImplementation(() => {
        return Promise.resolve({
          ok: false,
          status: 400,
          statusText: 'Bad Request',
          json: () =>
            Promise.resolve({
              detail: 'Top level detail message',
            }),
        });
      });

      const result = (await api
        .post('/api/v1/test', {}, { skipAuth: true })
        .catch((e) => e)) as APIRequestError;

      expect(result.status).toBe(400);
      expect(result.message).toBe('Top level detail message');
      expect(result.detail).toBe('Top level detail message');
    });

    it('should handle empty error response gracefully', async () => {
      global.fetch = vi.fn().mockImplementation(() => {
        return Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: () => Promise.resolve({}),
        });
      });

      const result = (await api
        .post('/api/v1/test', {}, { skipAuth: true })
        .catch((e) => e)) as APIRequestError;

      expect(result.status).toBe(500);
      expect(result.message).toBe('Request failed with status 500');
    });

    it('should handle JSON parse failure gracefully', async () => {
      global.fetch = vi.fn().mockImplementation(() => {
        return Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: () => Promise.reject(new Error('Invalid JSON')),
        });
      });

      const result = (await api
        .post('/api/v1/test', {}, { skipAuth: true })
        .catch((e) => e)) as APIRequestError;

      expect(result.status).toBe(500);
      expect(result.message).toBe('Request failed with status 500');
    });
  });
});
