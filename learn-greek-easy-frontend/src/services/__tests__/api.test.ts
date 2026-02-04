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
import {
  api,
  APIRequestError,
  _resetRefreshState_forTesting,
  _getRefreshPromise_forTesting,
} from '../api';

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

describe('Token Refresh Mutex', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    // Reset module state
    _resetRefreshState_forTesting();

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

  describe('refreshAccessToken mutex behavior', () => {
    it('should only make ONE refresh request when multiple 401s trigger refresh simultaneously', async () => {
      let refreshCallCount = 0;
      let requestCallCount = 0;

      // Setup auth storage with tokens
      localStorage.setItem(
        'auth-storage',
        JSON.stringify({
          state: {
            token: 'expired-access-token',
            refreshToken: 'valid-refresh-token',
          },
        })
      );

      // Mock fetch to track calls and simulate 401 -> refresh -> retry flow
      global.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
        const authHeader = (options?.headers as Record<string, string>)?.['Authorization'];

        // Track refresh endpoint calls
        if (url.includes('/auth/refresh')) {
          refreshCallCount++;
          // Simulate network delay to allow concurrent requests to "pile up"
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                ok: true,
                json: () =>
                  Promise.resolve({
                    access_token: 'new-access-token',
                    refresh_token: 'new-refresh-token',
                  }),
              });
            }, 50); // 50ms delay
          });
        }

        // Track regular endpoint calls
        requestCallCount++;

        // First call with expired token returns 401
        if (authHeader === 'Bearer expired-access-token') {
          return Promise.resolve({
            ok: false,
            status: 401,
            statusText: 'Unauthorized',
            json: () => Promise.resolve({ detail: 'Token expired' }),
          });
        }

        // Retry with new token succeeds
        if (authHeader === 'Bearer new-access-token') {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ data: 'success' }),
          });
        }

        // Default response
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({}),
        });
      });

      // Trigger 3 concurrent API calls that will all get 401
      const results = await Promise.all([
        api.get('/api/v1/endpoint1').catch((e) => e),
        api.get('/api/v1/endpoint2').catch((e) => e),
        api.get('/api/v1/endpoint3').catch((e) => e),
      ]);

      // KEY ASSERTION: Only ONE refresh call should have been made
      // This is the core of the mutex behavior
      expect(refreshCallCount).toBe(1);

      // All 3 requests should have been made (initial 401s)
      expect(requestCallCount).toBeGreaterThanOrEqual(3);

      // Results should include successful responses (after refresh + retry)
      const successResults = results.filter((r) => r?.data === 'success');
      expect(successResults.length).toBe(3);
    });

    it('should return the same result to all concurrent callers', async () => {
      const tokens: (string | null)[] = [];

      // Setup auth storage
      localStorage.setItem(
        'auth-storage',
        JSON.stringify({
          state: {
            token: 'expired-token',
            refreshToken: 'valid-refresh-token',
          },
        })
      );

      // Track what each concurrent request receives
      global.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
        const authHeader = (options?.headers as Record<string, string>)?.['Authorization'];

        if (url.includes('/auth/refresh')) {
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                ok: true,
                json: () =>
                  Promise.resolve({
                    access_token: 'shared-new-token-12345',
                    refresh_token: 'shared-new-refresh',
                  }),
              });
            }, 30);
          });
        }

        if (authHeader === 'Bearer expired-token') {
          return Promise.resolve({
            ok: false,
            status: 401,
            statusText: 'Unauthorized',
            json: () => Promise.resolve({ detail: 'Token expired' }),
          });
        }

        // Capture the token used in retry requests
        if (authHeader?.startsWith('Bearer ')) {
          tokens.push(authHeader.replace('Bearer ', ''));
        }

        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true }),
        });
      });

      // Trigger concurrent requests
      await Promise.all([
        api.get('/api/v1/test1').catch(() => null),
        api.get('/api/v1/test2').catch(() => null),
        api.get('/api/v1/test3').catch(() => null),
      ]);

      // All retry requests should use the SAME new token
      expect(tokens.length).toBeGreaterThan(0);
      expect(tokens.every((t) => t === 'shared-new-token-12345')).toBe(true);
    });

    it('should allow new refresh after previous one completes', async () => {
      let refreshCallCount = 0;

      // Helper to create a mock JWT token that won't trigger proactive refresh
      // (valid for 20 minutes, so proactive refresh threshold of 5 min won't apply)
      function createValidToken(id: string): string {
        const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
        const payload = btoa(
          JSON.stringify({
            sub: 'user-123',
            exp: Math.floor(Date.now() / 1000) + 1200, // 20 minutes from now
            id: id,
          })
        );
        return `${header}.${payload}.mock_signature`;
      }

      const token1 = createValidToken('1');
      const token2 = createValidToken('2');

      // Setup auth storage
      localStorage.setItem(
        'auth-storage',
        JSON.stringify({
          state: {
            token: token1,
            refreshToken: 'refresh-1',
          },
        })
      );

      global.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
        const authHeader = (options?.headers as Record<string, string>)?.['Authorization'];

        if (url.includes('/auth/refresh')) {
          refreshCallCount++;
          const newTokenNum = refreshCallCount;
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                access_token: newTokenNum === 1 ? token2 : createValidToken(`${newTokenNum + 1}`),
                refresh_token: `new-refresh-${newTokenNum}`,
              }),
          });
        }

        // First request with each token returns 401 (simulating backend invalidation)
        if (authHeader === `Bearer ${token1}` || authHeader === `Bearer ${token2}`) {
          return Promise.resolve({
            ok: false,
            status: 401,
            statusText: 'Unauthorized',
            json: () => Promise.resolve({ detail: 'Token revoked by server' }),
          });
        }

        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true }),
        });
      });

      // First refresh cycle (401 handler will trigger refresh since token is valid but server rejects)
      await api.get('/api/v1/test1').catch(() => null);
      expect(refreshCallCount).toBe(1);

      // Update storage to simulate having the second token
      localStorage.setItem(
        'auth-storage',
        JSON.stringify({
          state: {
            token: token2,
            refreshToken: 'new-refresh-1',
          },
        })
      );

      // Second refresh cycle (should be allowed since first completed)
      await api.get('/api/v1/test2').catch(() => null);
      expect(refreshCallCount).toBe(2);
    });

    it('should clear the promise after refresh failure', async () => {
      let refreshAttempts = 0;

      // Setup auth storage
      localStorage.setItem(
        'auth-storage',
        JSON.stringify({
          state: {
            token: 'expired-token',
            refreshToken: 'invalid-refresh-token',
          },
        })
      );

      global.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
        const authHeader = (options?.headers as Record<string, string>)?.['Authorization'];

        if (url.includes('/auth/refresh')) {
          refreshAttempts++;
          // First attempt fails
          if (refreshAttempts === 1) {
            return Promise.resolve({
              ok: false,
              status: 401,
              json: () => Promise.resolve({ detail: 'Invalid refresh token' }),
            });
          }
          // Second attempt succeeds (after storage is reset)
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                access_token: 'recovered-token',
                refresh_token: 'recovered-refresh',
              }),
          });
        }

        if (authHeader === 'Bearer expired-token' || authHeader === 'Bearer another-expired') {
          return Promise.resolve({
            ok: false,
            status: 401,
            statusText: 'Unauthorized',
            json: () => Promise.resolve({ detail: 'Token expired' }),
          });
        }

        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true }),
        });
      });

      // First attempt should fail
      await api.get('/api/v1/test1').catch(() => null);
      expect(refreshAttempts).toBe(1);

      // Verify promise was cleared (can check via testing export)
      expect(_getRefreshPromise_forTesting()).toBeNull();

      // Set up valid tokens for second attempt
      localStorage.setItem(
        'auth-storage',
        JSON.stringify({
          state: {
            token: 'another-expired',
            refreshToken: 'valid-refresh-now',
          },
        })
      );

      // Second attempt should be allowed (promise was cleared after failure)
      await api.get('/api/v1/test2').catch(() => null);
      expect(refreshAttempts).toBe(2);
    });

    it('should handle no refresh token gracefully', async () => {
      let refreshCalled = false;

      // Setup auth storage WITHOUT refresh token
      localStorage.setItem(
        'auth-storage',
        JSON.stringify({
          state: {
            token: 'expired-token',
            // No refreshToken!
          },
        })
      );

      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/auth/refresh')) {
          refreshCalled = true;
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                access_token: 'new-token',
                refresh_token: 'new-refresh',
              }),
          });
        }

        return Promise.resolve({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          json: () => Promise.resolve({ detail: 'Token expired' }),
        });
      });

      // Should fail without attempting refresh (no refresh token)
      const result = await api.get('/api/v1/test').catch((e) => e);

      expect(refreshCalled).toBe(false);
      expect(result.status).toBe(401);
    });
  });

  describe('concurrent 401 handling', () => {
    it('should handle the real-world scenario of multiple polling requests', async () => {
      let refreshCallCount = 0;
      const requestOrder: string[] = [];

      // Setup auth storage
      localStorage.setItem(
        'auth-storage',
        JSON.stringify({
          state: {
            token: 'expired-30min-token',
            refreshToken: 'valid-refresh',
          },
        })
      );

      global.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
        const authHeader = (options?.headers as Record<string, string>)?.['Authorization'];

        // Extract endpoint name for tracking
        const endpoint = url.split('/').pop();
        requestOrder.push(`${endpoint}-${authHeader?.substring(0, 20) || 'none'}`);

        if (url.includes('/auth/refresh')) {
          refreshCallCount++;
          // Simulate realistic network delay
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                ok: true,
                json: () =>
                  Promise.resolve({
                    access_token: 'fresh-token-after-30min',
                    refresh_token: 'rotated-refresh-token',
                  }),
              });
            }, 100);
          });
        }

        // Simulate the real scenario: multiple endpoints return 401 simultaneously
        if (authHeader === 'Bearer expired-30min-token') {
          return Promise.resolve({
            ok: false,
            status: 401,
            statusText: 'Unauthorized',
            json: () => Promise.resolve({ detail: 'Access token has expired' }),
          });
        }

        // After refresh, requests succeed
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true }),
        });
      });

      // Simulate the real scenario: Dashboard loads and triggers multiple API calls
      // These are the actual endpoints that were causing the race condition
      const results = await Promise.all([
        api.get('/api/v1/notifications/unread-count').catch((e) => e),
        api.get('/api/v1/xp/stats').catch((e) => e),
        api.get('/api/v1/xp/achievements').catch((e) => e),
      ]);

      // CRITICAL: Only ONE refresh request should be made
      expect(refreshCallCount).toBe(1);

      // All requests should succeed eventually
      const successCount = results.filter((r) => r?.success === true).length;
      expect(successCount).toBe(3);
    });
  });

  describe('Proactive Token Refresh', () => {
    // Helper to create a mock JWT token
    function createMockToken(payload: Record<string, unknown>): string {
      const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
      const body = btoa(JSON.stringify(payload));
      const signature = 'mock_signature';
      return `${header}.${body}.${signature}`;
    }

    it('refreshes token before request if expiring within 5 minutes', async () => {
      // Setup: token expiring in 2 minutes (within 5-minute buffer)
      const expiringToken = createMockToken({
        sub: 'user-123',
        exp: Math.floor(Date.now() / 1000) + 120, // 2 minutes from now
      });

      localStorage.setItem(
        'auth-storage',
        JSON.stringify({
          state: {
            token: expiringToken,
            refreshToken: 'valid-refresh-token',
          },
        })
      );

      let refreshCalled = false;

      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/auth/refresh')) {
          refreshCalled = true;
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                access_token: 'new-fresh-token',
                refresh_token: 'new-refresh-token',
              }),
          });
        }

        // The actual API request should use the new token
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: 'success' }),
        });
      });

      await api.get('/api/v1/test');

      // Refresh should have been called BEFORE the main request
      expect(refreshCalled).toBe(true);
      expect(fetch).toHaveBeenCalledTimes(2);
      // First call should be refresh
      expect((fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]).toContain('/auth/refresh');
      // Second call should be the actual request
      expect((fetch as ReturnType<typeof vi.fn>).mock.calls[1][0]).toContain('/api/v1/test');
    });

    it('does not refresh token if not expiring soon (more than 5 minutes remaining)', async () => {
      // Setup: token valid for 20 more minutes
      const validToken = createMockToken({
        sub: 'user-123',
        exp: Math.floor(Date.now() / 1000) + 1200, // 20 minutes from now
      });

      localStorage.setItem(
        'auth-storage',
        JSON.stringify({
          state: {
            token: validToken,
            refreshToken: 'valid-refresh-token',
          },
        })
      );

      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/auth/refresh')) {
          throw new Error('Refresh should not be called for fresh token');
        }

        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: 'success' }),
        });
      });

      await api.get('/api/v1/test');

      // Only the actual request should be made, no refresh
      expect(fetch).toHaveBeenCalledTimes(1);
      expect((fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]).toContain('/api/v1/test');
    });

    it('clears auth and continues if proactive refresh fails', async () => {
      // Setup: token expiring soon
      const expiringToken = createMockToken({
        sub: 'user-123',
        exp: Math.floor(Date.now() / 1000) + 60, // 1 minute from now
      });

      localStorage.setItem(
        'auth-storage',
        JSON.stringify({
          state: {
            token: expiringToken,
            refreshToken: 'invalid-refresh-token',
          },
        })
      );

      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/auth/refresh')) {
          // Refresh fails
          return Promise.resolve({
            ok: false,
            status: 401,
            json: () => Promise.resolve({ detail: 'Invalid refresh token' }),
          });
        }

        // Request proceeds without auth (no token after failed refresh)
        return Promise.resolve({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          json: () => Promise.resolve({ detail: 'Unauthorized' }),
        });
      });

      // Request should throw 401 error
      const result = await api.get('/api/v1/test').catch((e) => e);

      expect(result.status).toBe(401);
      // Auth should be cleared
      expect(localStorage.getItem('auth-storage')).toBeNull();
    });

    it('shares refresh between concurrent requests (mutex behavior with proactive refresh)', async () => {
      let refreshCount = 0;

      // Setup: token expiring soon
      const expiringToken = createMockToken({
        sub: 'user-123',
        exp: Math.floor(Date.now() / 1000) + 60, // 1 minute from now
      });

      localStorage.setItem(
        'auth-storage',
        JSON.stringify({
          state: {
            token: expiringToken,
            refreshToken: 'valid-refresh-token',
          },
        })
      );

      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/auth/refresh')) {
          refreshCount++;
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                ok: true,
                json: () =>
                  Promise.resolve({
                    access_token: 'new-fresh-token',
                    refresh_token: 'new-refresh-token',
                  }),
              });
            }, 50); // Delay to allow concurrent requests to pile up
          });
        }

        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: 'success' }),
        });
      });

      // Trigger 3 concurrent requests - all should see expiring token
      await Promise.all([
        api.get('/api/v1/endpoint1'),
        api.get('/api/v1/endpoint2'),
        api.get('/api/v1/endpoint3'),
      ]);

      // Only ONE refresh should have been made despite 3 concurrent requests
      expect(refreshCount).toBe(1);
    });

    it('does not attempt proactive refresh when skipAuth is true', async () => {
      // Setup: token expiring soon
      const expiringToken = createMockToken({
        sub: 'user-123',
        exp: Math.floor(Date.now() / 1000) + 60, // 1 minute from now
      });

      localStorage.setItem(
        'auth-storage',
        JSON.stringify({
          state: {
            token: expiringToken,
            refreshToken: 'valid-refresh-token',
          },
        })
      );

      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/auth/refresh')) {
          throw new Error('Refresh should not be called when skipAuth is true');
        }

        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: 'success' }),
        });
      });

      // Request with skipAuth: true
      await api.get('/api/v1/public-endpoint', { skipAuth: true });

      // Only the actual request should be made, no refresh
      expect(fetch).toHaveBeenCalledTimes(1);
      expect((fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]).toContain(
        '/api/v1/public-endpoint'
      );
    });
  });
});

describe('Transient Error Retry', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    // Reset module state
    _resetRefreshState_forTesting();

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
    it('should not retry 401 errors (handled by token refresh)', async () => {
      // Setup: no refresh token to force 401 failure
      localStorage.setItem(
        'auth-storage',
        JSON.stringify({
          state: {
            token: 'expired-token',
            // No refreshToken - refresh will fail
          },
        })
      );

      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/auth/refresh')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                access_token: 'new-token',
                refresh_token: 'new-refresh',
              }),
          });
        }
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

      // 401 should not trigger retry loop - it has its own handling
      // Calls: initial request (401) -> refresh attempt -> retry with new token (401)
      const fetchCalls = (fetch as ReturnType<typeof vi.fn>).mock.calls;
      const apiCalls = fetchCalls.filter((call) => !call[0].includes('/auth/refresh'));
      expect(apiCalls.length).toBeLessThanOrEqual(2);
    });
  });
});

describe('Error Parsing', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    _resetRefreshState_forTesting();
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
