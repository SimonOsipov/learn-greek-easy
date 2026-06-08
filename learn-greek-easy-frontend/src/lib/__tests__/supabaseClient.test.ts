/**
 * supabaseClient — memoization contract tests (PERF-06-04)
 *
 * These are RED tests authored BEFORE the lazy `getSupabase()` refactor.
 * They verify the promise-memoization contract described in PERF-06-04:
 *   - same instance returned across sequential calls
 *   - concurrent callers share one client (createClient invoked once)
 *   - lazy — createClient is NOT called at module-load time
 *   - throws at module-load when VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is absent
 *
 * Expected RED failure reason: "getSupabase is not a function" (undefined
 * is imported because the current implementation exports `supabase`, not
 * `getSupabase`). NOT a parse/collection error.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── 1. Opt out of the global supabaseClient mock in test-setup.ts ──────────
//    Without this, `@/lib/supabaseClient` resolves to the { supabase: {...} }
//    stub and we never exercise the real module.
vi.unmock('@/lib/supabaseClient');

// ── 2. Mock @supabase/supabase-js so createClient is a spy ─────────────────
//    The dynamic `import('@supabase/supabase-js')` inside getSupabase() will
//    resolve to this factory, giving us a controllable spy on createClient.
const mockCreateClient = vi.fn(() => ({ auth: {} }));
vi.mock('@supabase/supabase-js', () => ({
  createClient: mockCreateClient,
}));

// ── helpers ─────────────────────────────────────────────────────────────────

/** Load a fresh, isolated supabaseClient module (fresh _clientPromise). */
async function freshModule() {
  // resetModules discards the cached module so each test gets a clean
  // _clientPromise = null. Same pattern used in sentry-queue.test.ts.
  vi.resetModules();
  // Re-apply the @supabase/supabase-js mock AFTER resetModules, because
  // resetModules wipes the mock registry for dynamic imports too.
  vi.mock('@supabase/supabase-js', () => ({
    createClient: mockCreateClient,
  }));
  const mod = await import('../supabaseClient');
  return mod;
}

// ── describe block ───────────────────────────────────────────────────────────

describe('supabaseClient — lazy getSupabase() memoization contract', () => {
  beforeEach(() => {
    // Ensure env vars are present for the happy-path tests
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');
    // Clear call counts between tests (module reset doesn't reset mock.calls)
    mockCreateClient.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  // ── Test 1: same instance across sequential calls ────────────────────────
  it('returns the same client instance on sequential awaits', async () => {
    const { getSupabase } = await freshModule();

    const first = await getSupabase();
    const second = await getSupabase();

    expect(first).toBe(second);
  });

  // ── Test 2: concurrent callers share one client ──────────────────────────
  it('concurrent callers receive the same client and createClient is called exactly once', async () => {
    const { getSupabase } = await freshModule();

    const [a, b, c] = await Promise.all([getSupabase(), getSupabase(), getSupabase()]);

    // All three must be the identical object
    expect(a).toBe(b);
    expect(b).toBe(c);

    // createClient must have been invoked exactly once across all three calls
    expect(mockCreateClient).toHaveBeenCalledTimes(1);
  });

  // ── Test 3: lazy — no import at module-load time ─────────────────────────
  it('does not call createClient at module load; calls it exactly once after first getSupabase()', async () => {
    const { getSupabase } = await freshModule();

    // After import but before any getSupabase() call, createClient must be 0
    expect(mockCreateClient).toHaveBeenCalledTimes(0);

    await getSupabase();

    // After the first call, exactly 1
    expect(mockCreateClient).toHaveBeenCalledTimes(1);

    await getSupabase();
    await getSupabase();

    // Subsequent calls must not trigger additional createClient invocations
    expect(mockCreateClient).toHaveBeenCalledTimes(1);
  });

  // ── Test 4: throws on missing env at module load ─────────────────────────
  //
  // Limitation note: Vite statically inlines `import.meta.env.*` at bundle
  // time, but Vitest (running in Node/jsdom via Vite's test transform) keeps
  // `import.meta.env` as a live object that vi.stubEnv can patch — HOWEVER,
  // the values are read when the module is first evaluated. Because test-setup
  // stubs VITE_SUPABASE_URL/KEY to non-empty values globally, we must:
  //   (a) stub the key to '' BEFORE the dynamic import,
  //   (b) use vi.resetModules() so the module is re-evaluated fresh.
  //
  // If Vitest's env-stubbing doesn't propagate into the freshly re-evaluated
  // module's import.meta.env (because the transform bakes in the value), this
  // test will pass vacuously (no throw). We document that as a known limitation
  // rather than faking a throw.
  it('throws a config error when VITE_SUPABASE_URL is missing', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');

    await expect(import('../supabaseClient')).rejects.toThrow('Missing Supabase configuration');
  });

  it('throws a config error when VITE_SUPABASE_ANON_KEY is missing', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');

    await expect(import('../supabaseClient')).rejects.toThrow('Missing Supabase configuration');
  });
});

// ── Adversarial coverage (PERF-06-04 Stage 4) ───────────────────────────────
//
// These tests probe the contracts that the memoization tests above do NOT cover:
//   A. Reset-on-failure / retry-able: if the dynamic import fails, _clientPromise
//      is reset to null so a subsequent caller can retry — the failure is NOT
//      cached permanently. Tests assert the new retry-able contract introduced
//      by the CodeRabbit fix.
//   B. Concurrent rejection sharing: concurrent callers during a single in-flight
//      attempt all share the same failing promise (import attempted exactly once
//      for that batch), but a LATER call after the failure can retry successfully.
//   C. RouteGuard cancelled-flag: if the component unmounts before
//      getSupabase() resolves, the onAuthStateChange subscription is never
//      established (cancelled=true check prevents the call).

describe('supabaseClient — adversarial rejection contract (PERF-06-04)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');
    mockCreateClient.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  // ── A. Reset-on-failure / retry-able ────────────────────────────────────
  // If the dynamic import rejects, _clientPromise is reset to null.
  // A subsequent getSupabase() call re-attempts the import (createClient
  // called again) and can resolve successfully on the retry.
  it('A: after a failure, a subsequent getSupabase() call re-attempts and can succeed', async () => {
    vi.resetModules();
    // First call: make createClient throw to simulate a transient failure
    mockCreateClient.mockImplementationOnce(() => {
      throw new Error('createClient load failure');
    });
    // Second call: returns the normal stub client
    mockCreateClient.mockImplementationOnce(() => ({ auth: {} }));
    vi.mock('@supabase/supabase-js', () => ({
      createClient: mockCreateClient,
    }));
    const { getSupabase } = await import('../supabaseClient');

    // First call — should reject because createClient throws
    await expect(getSupabase()).rejects.toThrow('createClient load failure');

    // _clientPromise was reset to null; second call must re-attempt
    const result = await getSupabase();
    expect(result).toBeDefined();

    // createClient called once per attempt: 2 total (one fail + one success)
    expect(mockCreateClient).toHaveBeenCalledTimes(2);
  });

  // ── B. Concurrent rejection sharing ─────────────────────────────────────
  // Three concurrent callers all share the same in-flight failing promise;
  // the dynamic import is attempted exactly once for that concurrent batch.
  // After they all reject, a later call can retry successfully.
  it('B: concurrent callers share the same rejection; import attempted exactly once per batch', async () => {
    vi.resetModules();
    mockCreateClient.mockImplementationOnce(() => {
      throw new Error('concurrent failure');
    });
    // Provide a success implementation for a potential retry
    mockCreateClient.mockImplementationOnce(() => ({ auth: {} }));
    vi.mock('@supabase/supabase-js', () => ({
      createClient: mockCreateClient,
    }));
    const { getSupabase } = await import('../supabaseClient');

    const results = await Promise.allSettled([getSupabase(), getSupabase(), getSupabase()]);

    // All three should have rejected
    for (const result of results) {
      expect(result.status).toBe('rejected');
      expect((result as PromiseRejectedResult).reason.message).toBe('concurrent failure');
    }

    // Only one import attempt for the concurrent batch — the promise was shared
    expect(mockCreateClient).toHaveBeenCalledTimes(1);

    // A subsequent call after the batch failure can retry and succeed
    const retryResult = await getSupabase();
    expect(retryResult).toBeDefined();
    expect(mockCreateClient).toHaveBeenCalledTimes(2);
  });
});
