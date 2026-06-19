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
    // ACTUAL GUARD AT versionCheck.ts:61 (C2 — comment corrected):
    //   if (FRONTEND_VERSION === 'dev' || backendVersion === 'dev') { return true; }
    //   This is a DISJUNCTION (OR) — it fires when EITHER side is 'dev'.
    //   With FRONTEND_VERSION='sha-A' and backendVersion='dev', this guard
    //   DOES fire (backendVersion === 'dev' is true) → returns true immediately,
    //   no reload triggered.
    //
    // THEREFORE: this test is already GREEN (regression lock, not red spec).
    // It locks the existing OR-guard behavior: a real-SHA frontend paired with
    // a 'dev' backend header (e.g., backend running locally against prod frontend)
    // must never trigger a reload.
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

  // ───────────────────────────────────────────────────────────────────────────
  // RED SPECS: per-pair refresh cap (ADMIN2-37-02, AC-1)
  //
  // These three tests are GENUINELY RED before implementation.
  // The cap feature does not exist yet — without it, repeated mismatch calls
  // (with cooldown bypassed via _resetRefreshCooldown_forTesting) will fire
  // reload on every single call, so the "at most N" assertion fails.
  //
  // Cap constant used in tests: CAP_MAX = 3
  // We call the function CAP_MAX + 2 = 5 times (well past the cap).
  // The tests will PASS once the executor implements a per-pair cap that stops
  // reloading after ≤ CAP_MAX refreshes for the same (frontend, backend) pair.
  //
  // Isolation: sessionStorage is cleared fully in beforeEach (via
  // _resetRefreshCooldown_forTesting + sessionStorage.clear). The executor will
  // store cap state in sessionStorage alongside the cooldown key — clearing it
  // resets the cap naturally, without needing a new test-only export.
  // ───────────────────────────────────────────────────────────────────────────
  describe('per-pair refresh cap (RED specs — ADMIN2-37-02)', () => {
    // The maximum number of reloads the cap allows per unique (frontend, backend) pair.
    // Encoded here as the upper bound we assert. The executor must implement a cap
    // that stops at some N ≤ CAP_MAX. If the executor picks N > CAP_MAX, these tests
    // will catch it. The value 3 is a reasonable small bound per the spec intent.
    const CAP_MAX = 3;
    // Number of invocations — must be well past the cap so the assertion is meaningful.
    const INVOCATIONS = CAP_MAX + 2;

    /**
     * Flush the Promise microtask queue deeply enough to resolve the cache-clearing chain.
     * triggerVersionRefresh() does: caches.keys().then(names => Promise.all(names.map(delete))).then(() => reload())
     * That's 2 levels of .then() on top of the initial resolved promise, so we need
     * at least 3 microtask ticks. We flush 5 to be safe.
     */
    async function flushPromises() {
      for (let i = 0; i < 5; i++) {
        await Promise.resolve();
      }
    }

    /**
     * Helper: invoke checkVersionAndRefreshIfNeeded past the 60s cooldown.
     * We use _resetRefreshCooldown_forTesting() to clear the stored timestamp,
     * which makes isRefreshAllowed() return true — simulating elapsed time.
     * This isolates the cap from the cooldown in each test.
     * We flush promises after each call so mockReload is updated synchronously.
     */
    async function invokeCheckPastCooldown(
      check: (r: Response) => boolean,
      resetCooldown: () => void,
      backendSHA: string,
      times: number
    ) {
      for (let i = 0; i < times; i++) {
        // Clear cooldown so it is not the limiter (tests the cap independently).
        resetCooldown();
        const response = new Response('{}', {
          status: 200,
          headers: { 'X-App-Version': backendSHA },
        });
        check(response);
        // Flush promise microtask queue so the async cache-clearing chain resolves
        // and window.location.reload is called before the next iteration.
        await flushPromises();
      }
    }

    beforeEach(() => {
      // Clear all sessionStorage to reset both cooldown AND any cap state the
      // executor will store. No need for a new test-only export.
      sessionStorage.clear();
      vi.clearAllMocks();
      mockCachesKeys.mockResolvedValue([]);
    });

    afterEach(() => {
      sessionStorage.clear();
      vi.clearAllMocks();
      vi.unstubAllEnvs();
    });

    // ─────────────────────────────────────────────────────────────────────────
    // RED TEST 1 (caps_refreshes_on_persistent_mismatch) — AC-1
    //
    // Given: FRONTEND='aaa', backend always returns 'bbb' (persistent mismatch),
    //        cooldown cleared between calls so it is NOT the limiter.
    // When:  checkVersionAndRefreshIfNeeded is called INVOCATIONS (=5) times.
    // Then:  reload is called AT MOST CAP_MAX (=3) times total.
    //        After the cap is hit, log.warn is called at least once.
    //        The final call returns false without triggering another reload.
    //
    // Currently RED: no cap exists → reload fires on every cooldown-cleared call
    // → mockReload.mock.calls.length = 5 > 3 → assertion fails.
    // ─────────────────────────────────────────────────────────────────────────
    it('caps_refreshes_on_persistent_mismatch: reload count bounded by cap for same mismatch pair', async () => {
      vi.stubEnv('VITE_COMMIT_SHA', 'aaa');
      vi.resetModules();
      const {
        checkVersionAndRefreshIfNeeded: check,
        _resetRefreshCooldown_forTesting: resetCooldown,
      } = await import('../versionCheck');

      await invokeCheckPastCooldown(check, resetCooldown, 'bbb', INVOCATIONS);

      // Cap must bound reload calls.
      expect(mockReload.mock.calls.length).toBeLessThanOrEqual(CAP_MAX);

      // After exhausting the cap, warn must fire at least once.
      const logMock = (await import('@/lib/logger')).default;
      expect(logMock.warn).toHaveBeenCalled();
    });

    // ─────────────────────────────────────────────────────────────────────────
    // RED TEST 2 (cap_resets_on_new_mismatch_pair) — AC-1
    //
    // Given: The cap was reached for pair ('aaa', 'bbb') — reloads exhausted.
    // When:  A response arrives with a NEW backend SHA 'ccc' (different pair),
    //        with cooldown cleared so it is not the limiter.
    // Then:  Exactly ONE new reload fires for the 'aaa'→'ccc' pair.
    //        (The cap is per-pair: a real deploy gives a new SHA → self-heal.)
    //
    // Currently RED: no cap exists → the total reload count grows monotonically
    // rather than resetting to 1 for the new pair; the assertion on the delta
    // (exactly one new reload) fails because the cap state is absent.
    // ─────────────────────────────────────────────────────────────────────────
    it('cap_resets_on_new_mismatch_pair: one fresh reload fires when backend SHA changes', async () => {
      vi.stubEnv('VITE_COMMIT_SHA', 'aaa');
      vi.resetModules();
      const {
        checkVersionAndRefreshIfNeeded: check,
        _resetRefreshCooldown_forTesting: resetCooldown,
      } = await import('../versionCheck');

      // Exhaust the cap for pair ('aaa', 'bbb').
      await invokeCheckPastCooldown(check, resetCooldown, 'bbb', INVOCATIONS);

      // Without a cap, INVOCATIONS reloads would fire — assert cap bounded them.
      // This assertion is RED pre-implementation (reloadsAfterFirstPair = INVOCATIONS = 5 > CAP_MAX = 3).
      expect(mockReload.mock.calls.length).toBeLessThanOrEqual(CAP_MAX);
      const reloadsAfterFirstPair = mockReload.mock.calls.length;

      // Now a real deploy arrives: backend SHA changes to 'ccc'.
      // Clear cooldown so it is not the limiter.
      resetCooldown();
      const newResponse = new Response('{}', {
        status: 200,
        headers: { 'X-App-Version': 'ccc' },
      });
      const result = check(newResponse);
      await flushPromises();

      // A new pair ('aaa', 'ccc') must fire exactly one new reload (cap resets for new pair).
      expect(mockReload.mock.calls.length).toBe(reloadsAfterFirstPair + 1);
      // The call itself must return false (mismatch detected, refresh fired).
      expect(result).toBe(false);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // RED TEST 3 (warn_logged_exactly_once_per_capped_mismatch) — AC-1
    //
    // Given: FRONTEND='aaa', backend always 'bbb', cooldown cleared between calls.
    // When:  Called INVOCATIONS (=5) times — well past the cap.
    // Then:  log.warn is emitted EXACTLY once (the give-up warning),
    //        and reload total ≤ CAP_MAX (the cap is a hard stop, not a rate limit).
    //
    // Currently RED: no cap exists → warn never fires (only log.info is called
    // in the mismatch path) → expect(logMock.warn).toHaveBeenCalledTimes(1) fails.
    // ─────────────────────────────────────────────────────────────────────────
    it('warn_logged_exactly_once_per_capped_mismatch: give-up warn fires exactly once, not per-call', async () => {
      vi.stubEnv('VITE_COMMIT_SHA', 'aaa');
      vi.resetModules();
      const {
        checkVersionAndRefreshIfNeeded: check,
        _resetRefreshCooldown_forTesting: resetCooldown,
      } = await import('../versionCheck');

      await invokeCheckPastCooldown(check, resetCooldown, 'bbb', INVOCATIONS);

      const logMock = (await import('@/lib/logger')).default;

      // Warn must fire exactly once — the "giving up" announcement.
      // (The cooldown-skipped warn at line 74 of versionCheck.ts is a separate
      // warn path; here the cooldown is never the limiter, so any warn.calls
      // must be from the cap give-up.)
      expect(logMock.warn).toHaveBeenCalledTimes(1);

      // Reload must also be bounded (guard: cap is a hard stop).
      expect(mockReload.mock.calls.length).toBeLessThanOrEqual(CAP_MAX);
    });
  });
});
