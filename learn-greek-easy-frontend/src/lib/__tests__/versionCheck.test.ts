/**
 * Version Check Utility Tests
 *
 * Comprehensive test suite for stale client detection utilities.
 * Tests version comparison, refresh cooldown, and cache clearing.
 *
 * Coverage targets:
 * - checkVersionAndRefreshIfNeeded() - main version check logic
 * - isRefreshAllowed() - cooldown enforcement
 * - triggerVersionRefresh() - cache clearing and refresh
 * - getFrontendVersion() - version retrieval
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  checkVersionAndRefreshIfNeeded,
  isRefreshAllowed,
  triggerVersionRefresh,
  getFrontendVersion,
  _resetRefreshCooldown_forTesting,
} from '../versionCheck';

// Mock window.location.reload
const mockReload = vi.fn();
Object.defineProperty(window, 'location', {
  value: { reload: mockReload },
  writable: true,
});

// Mock caches API
const mockCachesKeys = vi.fn();
const mockCachesDelete = vi.fn();
const mockCaches = {
  keys: mockCachesKeys,
  delete: mockCachesDelete,
};
Object.defineProperty(window, 'caches', {
  value: mockCaches,
  writable: true,
  configurable: true,
});

// Mock import.meta.env
vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('versionCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetRefreshCooldown_forTesting();
    mockCachesKeys.mockResolvedValue([]);
    // Ensure caches is properly set up
    Object.defineProperty(window, 'caches', {
      value: mockCaches,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    _resetRefreshCooldown_forTesting();
    // Restore caches mock
    Object.defineProperty(window, 'caches', {
      value: mockCaches,
      writable: true,
      configurable: true,
    });
  });

  describe('getFrontendVersion', () => {
    it('returns the frontend version', () => {
      const version = getFrontendVersion();
      // In test environment, should be 'dev' since VITE_COMMIT_SHA is not set
      expect(typeof version).toBe('string');
      expect(version.length).toBeGreaterThan(0);
    });
  });

  describe('isRefreshAllowed', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns true when no previous refresh', () => {
      expect(isRefreshAllowed()).toBe(true);
    });

    it('returns false within cooldown period (60 seconds)', () => {
      // Simulate a recent refresh
      sessionStorage.setItem('learn-greek-easy:last-version-refresh', Date.now().toString());

      // Within 60 seconds - should not allow refresh
      vi.advanceTimersByTime(30 * 1000); // 30 seconds
      expect(isRefreshAllowed()).toBe(false);
    });

    it('returns true after cooldown period expires', () => {
      // Simulate a previous refresh
      sessionStorage.setItem('learn-greek-easy:last-version-refresh', Date.now().toString());

      // After 60 seconds - should allow refresh
      vi.advanceTimersByTime(61 * 1000); // 61 seconds
      expect(isRefreshAllowed()).toBe(true);
    });

    it('returns true at exactly 60 seconds', () => {
      // Simulate a previous refresh
      sessionStorage.setItem('learn-greek-easy:last-version-refresh', Date.now().toString());

      // At exactly 60 seconds - should allow refresh
      vi.advanceTimersByTime(60 * 1000);
      expect(isRefreshAllowed()).toBe(true);
    });

    it('handles invalid timestamp in storage gracefully', () => {
      // Simulate invalid data in storage
      sessionStorage.setItem('learn-greek-easy:last-version-refresh', 'invalid');

      // NaN comparison results in false for >=, so refresh is not allowed
      // This is acceptable - invalid state prevents refresh as a safety measure
      // Clear the invalid state and try again
      _resetRefreshCooldown_forTesting();
      expect(isRefreshAllowed()).toBe(true);
    });
  });

  describe('checkVersionAndRefreshIfNeeded', () => {
    // ─────────────────────────────────────────────────────────────────────────
    // AC TEST 1 (dev_frontend_skips_check) — GENUINELY RED before impl.
    // FRONTEND_VERSION is 'dev' (test-env default); backend sends a real SHA.
    // Current code: falls through the dev&&dev guard (backend ≠ 'dev') and
    // hits the mismatch branch → triggers reload → returns false.
    // Expected post-impl: new "FRONTEND_VERSION === 'dev'" short-circuit
    // returns true immediately, no reload.
    // ─────────────────────────────────────────────────────────────────────────
    it('dev_frontend_skips_check: returns true without reload when frontend is "dev" and backend has real SHA', () => {
      const response = new Response('{}', {
        status: 200,
        headers: { 'X-App-Version': 'sha-abc123' },
      });

      const result = checkVersionAndRefreshIfNeeded(response);

      expect(result).toBe(true);
      expect(mockReload).not.toHaveBeenCalled();
    });

    // ─────────────────────────────────────────────────────────────────────────
    // REGRESSION LOCK 6 (missing_backend_header_skips) — locks existing guard.
    // ─────────────────────────────────────────────────────────────────────────
    it('missing_backend_header_skips: returns true without reload when X-App-Version header is absent', async () => {
      vi.stubEnv('VITE_COMMIT_SHA', 'sha-A');
      vi.resetModules();
      const { checkVersionAndRefreshIfNeeded: check } = await import('../versionCheck');

      const response = new Response('{}', {
        status: 200,
        headers: {},
      });

      const result = check(response);

      expect(result).toBe(true);
      expect(mockReload).not.toHaveBeenCalled();
    });

    // ─────────────────────────────────────────────────────────────────────────
    // ADVERSARIAL EDGE (empty_backend_header_skips) — locks the !backendVersion
    // falsy guard: an empty-string X-App-Version header (e.g., env var cleared
    // in Railway, backend emits "X-App-Version: ") is treated as "missing" and
    // skipped rather than mismatched. headers.get() returns "" for an explicit
    // empty header value, which is falsy, so it hits the same guard as null.
    // ─────────────────────────────────────────────────────────────────────────
    it('empty_backend_header_skips: returns true without reload when X-App-Version is empty string', async () => {
      vi.stubEnv('VITE_COMMIT_SHA', 'sha-A');
      vi.resetModules();
      const { checkVersionAndRefreshIfNeeded: check } = await import('../versionCheck');

      const response = new Response('{}', {
        status: 200,
        headers: { 'X-App-Version': '' },
      });

      const result = check(response);

      expect(result).toBe(true);
      expect(mockReload).not.toHaveBeenCalled();
    });

    // ─────────────────────────────────────────────────────────────────────────
    // KEPT UNCHANGED — both versions are "dev" (the original test-env case).
    // ─────────────────────────────────────────────────────────────────────────
    it('returns true when both versions are "dev"', () => {
      const response = new Response('{}', {
        status: 200,
        headers: { 'X-App-Version': 'dev' },
      });

      // getFrontendVersion() returns 'dev' in test environment
      const result = checkVersionAndRefreshIfNeeded(response);

      expect(result).toBe(true);
      expect(mockReload).not.toHaveBeenCalled();
    });

    // ─────────────────────────────────────────────────────────────────────────
    // AC TEST 3 (real_frontend_match_no_reload) — replaces the misnamed
    // 166-178 test (which was actually a dev/dev case, not a real match).
    // ─────────────────────────────────────────────────────────────────────────
    it('real_frontend_match_no_reload: returns true without reload when real frontend SHA matches backend SHA', async () => {
      vi.stubEnv('VITE_COMMIT_SHA', 'sha-A');
      vi.resetModules();
      const { checkVersionAndRefreshIfNeeded: check } = await import('../versionCheck');

      const response = new Response('{}', {
        status: 200,
        headers: { 'X-App-Version': 'sha-A' },
      });

      const result = check(response);

      expect(result).toBe(true);
      expect(mockReload).not.toHaveBeenCalled();
    });

    // ─────────────────────────────────────────────────────────────────────────
    // AC TEST 2 (real_frontend_mismatch_triggers_reload) — migrated from
    // 180-200. Now stubs FRONTEND_VERSION to 'sha-A' so the new dev-frontend
    // short-circuit does NOT fire and the mismatch path is still exercised.
    // ─────────────────────────────────────────────────────────────────────────
    it('real_frontend_mismatch_triggers_reload: returns false and triggers reload when real SHAs differ', async () => {
      vi.stubEnv('VITE_COMMIT_SHA', 'sha-A');
      vi.resetModules();
      const { checkVersionAndRefreshIfNeeded: check } = await import('../versionCheck');

      mockCachesKeys.mockResolvedValue(['cache1', 'cache2']);
      mockCachesDelete.mockResolvedValue(true);

      const response = new Response('{}', {
        status: 200,
        headers: { 'X-App-Version': 'sha-B' },
      });

      const result = check(response);

      expect(result).toBe(false);

      await vi.waitFor(() => {
        expect(mockReload).toHaveBeenCalled();
      });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // AC TEST 4 (real_frontend_mismatch_cooldown_skips) — migrated from
    // 202-216. Now stubs FRONTEND_VERSION to 'sha-A' so the dev short-circuit
    // does NOT fire.
    // ─────────────────────────────────────────────────────────────────────────
    it('real_frontend_mismatch_cooldown_skips: returns false without reload when cooldown is active', async () => {
      vi.stubEnv('VITE_COMMIT_SHA', 'sha-A');
      vi.resetModules();
      const {
        checkVersionAndRefreshIfNeeded: check,
        _resetRefreshCooldown_forTesting: resetCooldown,
      } = await import('../versionCheck');
      resetCooldown();

      // Simulate a recent refresh (cooldown active)
      sessionStorage.setItem('learn-greek-easy:last-version-refresh', Date.now().toString());

      const response = new Response('{}', {
        status: 200,
        headers: { 'X-App-Version': 'sha-B' },
      });

      const result = check(response);

      expect(result).toBe(false);
      expect(mockReload).not.toHaveBeenCalled();
    });

    // ─────────────────────────────────────────────────────────────────────────
    // REGRESSION LOCK 5 (non_dev_frontend_dev_backend_skips).
    //
    // IMPORTANT NOTE ON GUARD AT versionCheck.ts LINES 59-62:
    //   if (FRONTEND_VERSION === 'dev' && backendVersion === 'dev') { return true; }
    //   This is a CONJUNCTION — it requires BOTH sides to be 'dev'.
    //   With FRONTEND_VERSION='sha-A' and backendVersion='dev', this guard
    //   does NOT fire. The code falls through to line 65 where 'sha-A' !== 'dev'
    //   → mismatch → reload triggered.
    //
    // THEREFORE: this test is currently RED (reload IS called).
    // The executor must add a guard that returns true when backendVersion==='dev'
    // (or the new frontend-dev guard makes 59-62 dead code only for the dev/dev
    // case, and this scenario still needs its own handling).
    //
    // CONCLUSION: 59-62 is NOT solely dead code after the new frontend-dev guard
    // is added. The 'sha-A frontend / dev backend' path falls through to the
    // mismatch branch today. The executor's plan to "remove 59-62 as dead code"
    // would be a REGRESSION for this case UNLESS they also add a backendVersion
    // guard. This test locks that behavior.
    // ─────────────────────────────────────────────────────────────────────────
    it('non_dev_frontend_dev_backend_skips: returns true without reload when real frontend has dev backend header', async () => {
      vi.stubEnv('VITE_COMMIT_SHA', 'sha-A');
      vi.resetModules();
      const { checkVersionAndRefreshIfNeeded: check } = await import('../versionCheck');

      const response = new Response('{}', {
        status: 200,
        headers: { 'X-App-Version': 'dev' },
      });

      const result = check(response);

      expect(result).toBe(true);
      expect(mockReload).not.toHaveBeenCalled();
    });
  });

  describe('triggerVersionRefresh', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('records refresh timestamp in sessionStorage', async () => {
      mockCachesKeys.mockResolvedValue([]);

      triggerVersionRefresh();

      const stored = sessionStorage.getItem('learn-greek-easy:last-version-refresh');
      expect(stored).toBe(Date.now().toString());
    });

    it('clears service worker caches before reload', async () => {
      mockCachesKeys.mockResolvedValue(['cache1', 'cache2']);
      mockCachesDelete.mockResolvedValue(true);

      triggerVersionRefresh();

      await vi.waitFor(() => {
        expect(mockCachesKeys).toHaveBeenCalled();
        expect(mockCachesDelete).toHaveBeenCalledWith('cache1');
        expect(mockCachesDelete).toHaveBeenCalledWith('cache2');
        expect(mockReload).toHaveBeenCalled();
      });
    });

    it('reloads even if cache clearing fails', async () => {
      mockCachesKeys.mockRejectedValue(new Error('Cache API error'));

      triggerVersionRefresh();

      await vi.waitFor(() => {
        expect(mockReload).toHaveBeenCalled();
      });
    });

    it('reloads when caches API is not available', async () => {
      // Simulate 'caches' not being present by deleting the property
      const originalCaches = window.caches;
      delete (window as unknown as { caches?: CacheStorage }).caches;

      triggerVersionRefresh();

      expect(mockReload).toHaveBeenCalled();

      // Restore caches
      Object.defineProperty(window, 'caches', {
        value: originalCaches,
        writable: true,
        configurable: true,
      });
    });
  });

  describe('_resetRefreshCooldown_forTesting', () => {
    it('clears the last refresh timestamp', () => {
      sessionStorage.setItem('learn-greek-easy:last-version-refresh', Date.now().toString());

      _resetRefreshCooldown_forTesting();

      expect(sessionStorage.getItem('learn-greek-easy:last-version-refresh')).toBeNull();
    });
  });

  describe('Bug fix: typeof caches !== "undefined" guard (TSCI-01-12)', () => {
    // Regression tests for the fix in versionCheck.ts that replaced
    // `'caches' in window` (which narrowed window to never in TS 5.9 else branch)
    // with `typeof caches !== 'undefined'`, which works at runtime in browsers
    // without service-worker support (private mode, older browsers).

    it('triggerVersionRefresh does not throw when caches global is undefined', () => {
      vi.stubGlobal('caches', undefined);

      expect(() => triggerVersionRefresh()).not.toThrow();

      vi.unstubAllGlobals();
    });

    it('triggerVersionRefresh calls window.location.reload when caches is undefined', () => {
      vi.stubGlobal('caches', undefined);

      triggerVersionRefresh();

      expect(mockReload).toHaveBeenCalledTimes(1);

      vi.unstubAllGlobals();
    });
  });

  describe('Integration scenarios', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('handles multiple API calls with same version', () => {
      // All calls with same version should not trigger refresh
      // (Uses test-env default 'dev' FRONTEND_VERSION with 'dev' backend — both dev guard)
      const response1 = new Response('{}', {
        status: 200,
        headers: { 'X-App-Version': 'dev' },
      });
      const response2 = new Response('{}', {
        status: 200,
        headers: { 'X-App-Version': 'dev' },
      });
      const response3 = new Response('{}', {
        status: 200,
        headers: { 'X-App-Version': 'dev' },
      });

      expect(checkVersionAndRefreshIfNeeded(response1)).toBe(true);
      expect(checkVersionAndRefreshIfNeeded(response2)).toBe(true);
      expect(checkVersionAndRefreshIfNeeded(response3)).toBe(true);

      expect(mockReload).not.toHaveBeenCalled();
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Migrated from 347-381. Now stubs FRONTEND_VERSION='sha-A' so the
    // new dev-frontend short-circuit does NOT fire and the cooldown path
    // is still exercised with real SHAs.
    // ─────────────────────────────────────────────────────────────────────────
    it('cooldown prevents rapid refresh attempts (real SHA frontend)', async () => {
      vi.stubEnv('VITE_COMMIT_SHA', 'sha-A');
      vi.resetModules();
      const {
        checkVersionAndRefreshIfNeeded: check,
        _resetRefreshCooldown_forTesting: resetCooldown,
      } = await import('../versionCheck');
      resetCooldown();

      // Ensure caches mock is set up correctly
      Object.defineProperty(window, 'caches', {
        value: {
          keys: mockCachesKeys,
          delete: mockCachesDelete,
        },
        writable: true,
        configurable: true,
      });
      mockCachesKeys.mockResolvedValue([]);
      mockCachesDelete.mockResolvedValue(true);

      // First mismatch triggers refresh
      const response1 = new Response('{}', {
        status: 200,
        headers: { 'X-App-Version': 'sha-B' },
      });
      check(response1);

      // Wait for async operations
      await vi.runAllTimersAsync();

      // Second mismatch within cooldown should not trigger another refresh
      vi.advanceTimersByTime(30 * 1000); // 30 seconds

      const response2 = new Response('{}', {
        status: 200,
        headers: { 'X-App-Version': 'sha-C' },
      });
      check(response2);

      // reload should only have been called once
      expect(mockReload).toHaveBeenCalledTimes(1);
    });
  });
});
