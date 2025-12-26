// src/services/__tests__/api.test.ts

/**
 * Token Refresh Race Condition Tests
 *
 * These tests verify that when multiple concurrent requests receive 401 errors,
 * only ONE refresh request is made to the server, and all waiting requests
 * receive the same refreshed token.
 *
 * Background:
 * The backend uses token rotation for security - refresh tokens are single-use.
 * When a refresh token is used, it's deleted and a new one is issued. This means
 * if multiple requests try to refresh concurrently with the same refresh token,
 * only the first one succeeds; the others fail because their token was already rotated.
 *
 * The mutex pattern ensures:
 * 1. Only ONE refresh request is made when multiple 401s occur simultaneously
 * 2. All waiting requests receive the same result from the single refresh
 * 3. After the refresh completes, new refreshes can occur normally
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, _resetRefreshState_forTesting, _getRefreshPromise_forTesting } from '../api';

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

      // Setup auth storage
      localStorage.setItem(
        'auth-storage',
        JSON.stringify({
          state: {
            token: 'token-1',
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
                access_token: `new-token-${newTokenNum}`,
                refresh_token: `new-refresh-${newTokenNum}`,
              }),
          });
        }

        // First request with each token returns 401
        if (authHeader === 'Bearer token-1' || authHeader === 'Bearer new-token-1') {
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

      // First refresh cycle
      await api.get('/api/v1/test1').catch(() => null);
      expect(refreshCallCount).toBe(1);

      // Update storage to simulate next expiration
      localStorage.setItem(
        'auth-storage',
        JSON.stringify({
          state: {
            token: 'new-token-1',
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
        api.get('/api/v1/xp/unnotified-achievements').catch((e) => e),
      ]);

      // CRITICAL: Only ONE refresh request should be made
      expect(refreshCallCount).toBe(1);

      // All requests should succeed eventually
      const successCount = results.filter((r) => r?.success === true).length;
      expect(successCount).toBe(3);
    });
  });
});
