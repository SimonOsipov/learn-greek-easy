// src/stores/__tests__/authStore.test.ts

import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest';

import { queryClient } from '@/lib/queryClient';
import { supabase } from '@/lib/supabaseClient';
import { authAPI } from '@/services/authAPI';
import { useAuthStore } from '@/stores/authStore';

/**
 * AuthStore Tests - SKIPPED (persist middleware)
 *
 * Rationale for Skipping Unit Tests:
 * ===================================
 *
 * The authStore uses Zustand's `persist` middleware, which captures the
 * localStorage instance at module load time. This creates a fundamental
 * limitation for unit testing:
 *
 * 1. **Module Load Time Capture**: When authStore.ts is imported, Zustand's
 *    persist middleware immediately captures `window.localStorage` and holds
 *    a closure reference to it. This happens BEFORE test setup runs.
 *
 * 2. **Mock Timing Issue**: In test-setup.ts, we mock localStorage using
 *    `global.localStorage = mockStorage`. However, this mock is created
 *    AFTER the authStore module has already loaded and captured the real
 *    (or initial) localStorage reference.
 *
 * 3. **Closure Immutability**: Even if we reassign `window.localStorage` in
 *    tests, the authStore's persist middleware still references the original
 *    localStorage via its closure. We cannot "re-inject" a new localStorage
 *    into an already-created Zustand store.
 *
 * Attempted Solutions (All Failed):
 * ================================
 *
 * - Dynamic imports: Still captures localStorage on first import
 * - beforeAll/beforeEach mocking: Too late, module already loaded
 * - vi.resetModules(): Breaks other test dependencies
 * - Manual state reset: Doesn't fix persist middleware's storage reference
 *
 * Testing Strategy:
 * ================
 *
 * 1. **Integration Tests** (Tasks 10.06-10.07):
 *    - Full end-to-end tests using Playwright
 *    - Tests auth flow: login → localStorage persistence → page reload → session recovery
 *    - Verifies "remember me" functionality works in real browser environment
 *
 * 2. **Service Layer Tests** (This task):
 *    - mockAuthAPI.test.ts provides comprehensive coverage of auth logic
 *    - Tests login, register, token refresh, profile updates
 *    - Ensures business logic correctness independent of store
 *
 * 3. **Component Tests** (Tasks 10.06-10.07):
 *    - Login.test.tsx and Register.test.tsx test UI integration
 *    - Verifies components correctly call store actions
 *
 * Future Refactoring Options:
 * ==========================
 *
 * If unit testing becomes critical, consider these architectural changes:
 *
 * Option A: Conditional Persistence
 * ```typescript
 * const isPersistEnabled = import.meta.env.MODE !== 'test';
 * const store = isPersistEnabled
 *   ? persist(storeConfig, { name: 'auth-storage' })
 *   : storeConfig;
 * ```
 *
 * Option B: Extract Business Logic
 * ```typescript
 * // Pure functions (easy to unit test)
 * export function handleLogin(state, email, password) { ... }
 *
 * // Store (tested via integration)
 * export const useAuthStore = create(persist((set, get) => ({
 *   login: async (email, password) => {
 *     set(handleLogin(get(), email, password));
 *   }
 * })));
 * ```
 *
 * Option C: Dependency Injection
 * ```typescript
 * export function createAuthStore(storage = localStorage) {
 *   return create(persist(storeConfig, {
 *     storage: createJSONStorage(() => storage)
 *   }));
 * }
 * ```
 *
 * Trade-offs:
 * - Option A: Simple but doesn't test persist logic
 * - Option B: Best separation of concerns, more refactoring
 * - Option C: Most flexible but breaks singleton pattern
 *
 * Current Decision:
 * ================
 *
 * Skip unit tests for authStore and rely on:
 * 1. Integration tests for full auth flow
 * 2. Service tests for business logic
 * 3. Component tests for UI integration
 *
 * This provides adequate coverage while avoiding architectural complexity
 * for MVP. Refactor to Option B if auth logic becomes more complex.
 *
 * See Also:
 * - .claude/01-MVP/frontend/10/10.04-component-testing.md (localStorage testing limitations)
 * - .claude/01-MVP/frontend/10/10.06-integration-testing-plan.md (auth flow tests)
 * - Architecture-Decisions.md (Testing strategy section)
 */

describe.skip('authStore (uses persist middleware)', () => {
  it('should be tested via integration tests', () => {
    // This test suite is intentionally skipped
    // See documentation above for rationale and testing alternatives
  });
});

// ---------------------------------------------------------------------------
// Shared mocks (apply to all describe blocks below)
// ---------------------------------------------------------------------------

vi.mock('@/lib/supabaseClient', () => {
  const mockSupabase = {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  };
  return {
    supabase: mockSupabase,
    getSupabase: vi.fn(() => Promise.resolve(mockSupabase)),
  };
});

vi.mock('posthog-js', () => ({
  default: { capture: vi.fn(), reset: vi.fn(), identify: vi.fn() },
}));

vi.mock('@/lib/errorReporting', () => ({
  reportAPIError: vi.fn(),
}));

vi.mock('@/services/authAPI', () => ({
  authAPI: {
    getProfile: vi.fn(),
    updateProfile: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// AC #6: logout removes analytics cache entries from the singleton queryClient
//
// authStore.logout() calls queryClient.removeQueries({ queryKey: ['analytics'] })
// on the SINGLETON queryClient from @/lib/queryClient. We must test against
// that same singleton — createTestQueryClient would be a different instance.
//
// Supabase sign-out is mocked so no network call is made. PostHog is also
// mocked to prevent warnings.
// ---------------------------------------------------------------------------

describe('authStore — logout cache-clear (AC #6)', () => {
  const seedKey = ['analytics', 'user-A', 'last7'] as const;
  const seedData = { overview: { totalReviews: 5 } };

  beforeEach(() => {
    // Seed the singleton with a known analytics entry
    queryClient.setQueryData(seedKey, seedData);
  });

  afterEach(() => {
    // Clean up so we don't pollute other tests in the suite
    queryClient.removeQueries({ queryKey: ['analytics'] });
  });

  it('removes analytics cache on logout', async () => {
    // Verify seed is present
    expect(queryClient.getQueryData(seedKey)).toEqual(seedData);

    // Trigger logout on the real store (uses the singleton queryClient internally)
    await useAuthStore.getState().logout();

    // Analytics cache entry should be gone
    expect(queryClient.getQueryData(seedKey)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// PERF-03: checkAuth in-flight guard + freshness window
//
// We test the dedup logic against the real store singleton (same approach as
// the logout cache-clear tests above). The persist middleware's localStorage
// side-effects don't affect these tests — we only care about how many times
// authAPI.getProfile is called.
// ---------------------------------------------------------------------------

// Minimal profile response for checkAuth
const minimalProfile = {
  id: 'user-dedup',
  email: 'dedup@test.com',
  full_name: 'Dedup User',
  avatar_url: null,
  is_active: true,
  is_superuser: false,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

describe('authStore — checkAuth in-flight dedup (PERF-03)', () => {
  const getSession = supabase.auth.getSession as ReturnType<typeof vi.fn>;
  const getProfile = authAPI.getProfile as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store to unauthenticated state
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
    // Provide a valid session so checkAuth doesn't bail out at the session guard
    getSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } });
    // Default: profile fetch succeeds
    getProfile.mockResolvedValue(minimalProfile);
  });

  it('two concurrent checkAuth() calls result in exactly one getProfile() request', async () => {
    // Fire two concurrent calls — neither has awaited yet, so the second
    // should latch onto the first's in-flight Promise.
    await Promise.all([useAuthStore.getState().checkAuth(), useAuthStore.getState().checkAuth()]);

    expect(getProfile).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('a subsequent checkAuth() within the freshness window skips the fetch', async () => {
    // First call — populates store + stamps _profileFetchedAt
    await useAuthStore.getState().checkAuth();
    expect(getProfile).toHaveBeenCalledTimes(1);

    // Second call immediately after — should be a no-op (freshness window)
    await useAuthStore.getState().checkAuth();
    expect(getProfile).toHaveBeenCalledTimes(1); // still 1
  });
});

// ---------------------------------------------------------------------------
// PERF-02-04: checkAuth logout-race epoch guard
//
// The NOT-YET-IMPLEMENTED contract:
//   - A module-level _authEpoch counter (starts at 0).
//   - logout() increments it alongside the existing reset block.
//   - checkAuth IIFE captures const epoch = _authEpoch at entry and
//     guards every state-mutating set with if (epoch !== _authEpoch) return.
//   - The finally release of _checkAuthInflight is NOT epoch-gated.
//
// RED tests today (no epoch guard): the two logout-race cases. The late
// success-set fires and re-authenticates the user, so those assertions fail.
// GREEN tests today (guard must not break): happy-path and transient-5xx.
//
// Fake-timer strategy: same as the PERF-02 block below — each beforeEach
// advances perf04FakeEpoch by EPOCH_STEP_04 (60 s) so any _profileFetchedAt
// stamped by a prior test is already stale, preventing the freshness guard
// from short-circuiting tests that seed an authed user.
// ---------------------------------------------------------------------------

const EPOCH_STEP_04 = 60_000; // 60 s > PROFILE_FRESHNESS_MS (30 s)
let perf04FakeEpoch = Date.now() + 10_000_000; // offset from perf02 to avoid cross-contamination

const minimalProfile04 = {
  id: 'user-epoch04',
  email: 'epoch04@test.com',
  full_name: 'Epoch User',
  avatar_url: null,
  is_active: true,
  is_superuser: false,
  created_at: '2025-06-01T00:00:00Z',
  updated_at: '2025-06-01T00:00:00Z',
};

const preservedUser04 = {
  id: 'user-epoch04',
  email: 'epoch04@test.com',
  name: 'Epoch User',
  avatar: undefined,
  role: 'free' as const,
  preferences: {
    language: 'en' as const,
    dailyGoal: 20,
    notifications: true,
    theme: 'light' as const,
  },
  stats: {
    streak: 0,
    wordsLearned: 0,
    totalXP: 0,
    joinedDate: new Date('2025-06-01'),
  },
  createdAt: new Date('2025-06-01'),
  updatedAt: new Date('2025-06-01'),
};

describe('authStore — logout-race epoch guard (PERF-02-04)', () => {
  const getSession = supabase.auth.getSession as ReturnType<typeof vi.fn>;
  const getProfile = authAPI.getProfile as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Advance fake clock so _profileFetchedAt from any previous test is stale.
    perf04FakeEpoch += EPOCH_STEP_04;
    vi.useFakeTimers();
    vi.setSystemTime(perf04FakeEpoch);

    vi.clearAllMocks();

    // Reset to unauthenticated baseline; individual tests seed state as needed.
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -----------------------------------------------------------------------
  // AC #3 — epoch discards stale success set after logout
  //
  // Sequence: authed user -> getProfile held pending -> logout() runs
  // (epoch++) -> getProfile resolves SUCCESS -> success set must be skipped.
  //
  // [EXPECT RED] Without the epoch guard the stale set fires and
  // re-authenticates the user (isAuthenticated flips to true).
  // -----------------------------------------------------------------------
  it('epoch discards stale success set after logout', async () => {
    // Seed store: user is currently logged in
    useAuthStore.setState({
      user: preservedUser04,
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });

    // Provide a valid session so checkAuth proceeds past the session guard
    getSession.mockResolvedValue({ data: { session: { access_token: 'tok-epoch' } } });

    // Hold getProfile pending so we can interleave logout() in-flight
    let resolveProfile!: (v: typeof minimalProfile04) => void;
    const profilePromise = new Promise<typeof minimalProfile04>((res) => {
      resolveProfile = res;
    });
    getProfile.mockReturnValueOnce(profilePromise);

    // Start checkAuth — it will await getProfile and be suspended
    const checkAuthPromise = useAuthStore.getState().checkAuth();

    // While checkAuth is suspended, logout() — this should increment the epoch
    await useAuthStore.getState().logout();

    // Verify logout cleared state immediately
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();

    // Now resolve the pending getProfile with a valid profile response
    resolveProfile(minimalProfile04);

    // Await the suspended checkAuth to complete
    await checkAuthPromise;

    // Epoch guard must have blocked the stale success set — state stays logged out
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
  });

  // -----------------------------------------------------------------------
  // AC #2 — logout during in-flight revalidation ends logged out
  //
  // Identical race from a different angle: start from authed state, trigger
  // checkAuth, then logout before getProfile resolves. Final state: logged out.
  //
  // [EXPECT RED] Without epoch guard the success set fires and user is
  // re-authenticated.
  // -----------------------------------------------------------------------
  it('logout during in-flight revalidation ends logged out', async () => {
    useAuthStore.setState({
      user: preservedUser04,
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });

    getSession.mockResolvedValue({ data: { session: { access_token: 'tok-race' } } });

    let resolveProfile!: (v: typeof minimalProfile04) => void;
    const profilePromise = new Promise<typeof minimalProfile04>((res) => {
      resolveProfile = res;
    });
    getProfile.mockReturnValueOnce(profilePromise);

    // Fire checkAuth but do NOT await it yet
    const p = useAuthStore.getState().checkAuth();

    // Logout resolves before getProfile does
    await useAuthStore.getState().logout();

    // Now let the deferred getProfile resolve
    resolveProfile(minimalProfile04);
    await p;

    // Must stay logged out regardless of the resolved profile
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
  });

  // -----------------------------------------------------------------------
  // AC #4 — post-checkout checkAuth with no logout sets normally
  //
  // Happy path: start unauthed, valid session + 200 profile, NO intervening
  // logout. The epoch guard must not interfere — success set must apply.
  //
  // [EXPECT GREEN] The guard only fires when epoch changes (i.e. logout ran).
  // -----------------------------------------------------------------------
  it('post-checkout checkAuth with no logout sets normally', async () => {
    // Start unauthed
    getSession.mockResolvedValue({ data: { session: { access_token: 'tok-happy' } } });
    getProfile.mockResolvedValue(minimalProfile04);

    await useAuthStore.getState().checkAuth();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user).not.toBeNull();
    expect(state.user?.id).toBe('user-epoch04');
    expect(state.isLoading).toBe(false);
  });

  // -----------------------------------------------------------------------
  // AC #3 — finally releases inflight guard even after logout
  //
  // After a mid-flight logout that discards the success set, the
  // _checkAuthInflight guard must be released (finally runs) so a
  // subsequent checkAuth() is not stuck behind a stale promise.
  //
  // [EXPECT GREEN] The finally block is NOT epoch-gated so it runs.
  // -----------------------------------------------------------------------
  it('finally releases inflight guard even after logout', async () => {
    useAuthStore.setState({
      user: preservedUser04,
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });

    getSession.mockResolvedValue({ data: { session: { access_token: 'tok-finally' } } });

    let resolveProfile!: (v: typeof minimalProfile04) => void;
    const profilePromise = new Promise<typeof minimalProfile04>((res) => {
      resolveProfile = res;
    });
    getProfile.mockReturnValueOnce(profilePromise);
    // Second call (after the race) needs to succeed too
    getProfile.mockResolvedValue(minimalProfile04);

    const p = useAuthStore.getState().checkAuth();

    // Logout mid-flight
    await useAuthStore.getState().logout();

    // Resolve the first (stale) getProfile call
    resolveProfile(minimalProfile04);
    await p;

    // At this point _checkAuthInflight must be null (finally ran).
    // Verify by issuing a second checkAuth — it must issue a fresh getProfile.
    // Advance the clock so the freshness window does not suppress the second call.
    perf04FakeEpoch += EPOCH_STEP_04;
    vi.setSystemTime(perf04FakeEpoch);

    await useAuthStore.getState().checkAuth();

    // getProfile was called at least twice: once for the raced call, once for the fresh call
    expect(getProfile).toHaveBeenCalledTimes(2);
  });

  // -----------------------------------------------------------------------
  // AC #5 — transient 5xx during revalidation keeps persisted session
  //
  // Re-affirms PERF-02 behavior under this suite: a 500 from getProfile
  // (no logout) must preserve the existing authed user. The epoch guard
  // must not incorrectly discard the preserved state here.
  //
  // [EXPECT GREEN] Covered by PERF-02 but re-checked to ensure this suite
  // setup does not break the preserve path.
  // -----------------------------------------------------------------------
  it('transient 5xx during revalidation keeps persisted session', async () => {
    useAuthStore.setState({
      user: preservedUser04,
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });

    getSession.mockResolvedValue({ data: { session: { access_token: 'tok-5xx' } } });
    getProfile.mockRejectedValue(
      new APIRequestError({
        status: 500,
        statusText: 'Internal Server Error',
        message: 'Internal Server Error',
      })
    );

    await useAuthStore.getState().checkAuth();

    const state = useAuthStore.getState();
    expect(state.user).not.toBeNull();
    expect(state.user?.id).toBe('user-epoch04');
    expect(state.isAuthenticated).toBe(true);
  });

  // -----------------------------------------------------------------------
  // ADVERSARIAL-1 — epoch guard is generational, not a permanent latch
  //
  // Sequence:
  //   1. Authed user — checkAuth fires, getProfile held pending.
  //   2. logout() increments epoch (race #1). Late getProfile resolves.
  //      success-set is blocked by epoch guard. User stays logged out.
  //   3. A FRESH checkAuth (new epoch captured) fires and resolves success.
  //      The guard must NOT block it — the store is usable again.
  //
  // Proves the guard does not permanently latch the store after a race.
  // A naive "once burned, always blocked" implementation would fail here.
  // -----------------------------------------------------------------------
  it('ADVERSARIAL: epoch guard is generational — fresh checkAuth after logout-race sets normally', async () => {
    // --- Phase 1: seed an authed user and stage the first race ---
    useAuthStore.setState({
      user: preservedUser04,
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });

    getSession.mockResolvedValue({ data: { session: { access_token: 'tok-gen' } } });

    let resolveProfile!: (v: typeof minimalProfile04) => void;
    const racedProfilePromise = new Promise<typeof minimalProfile04>((res) => {
      resolveProfile = res;
    });
    getProfile.mockReturnValueOnce(racedProfilePromise);

    // Start checkAuth #1 — suspended at getProfile
    const racedCheckAuth = useAuthStore.getState().checkAuth();

    // --- Phase 2: logout mid-flight (increments epoch) ---
    await useAuthStore.getState().logout();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);

    // Resolve the stale getProfile — epoch guard must discard the set
    resolveProfile(minimalProfile04);
    await racedCheckAuth;

    // Still logged out — epoch guard worked
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();

    // --- Phase 3: fresh checkAuth after the race — must succeed ---
    // Advance clock so freshness window does not suppress the new call
    perf04FakeEpoch += EPOCH_STEP_04;
    vi.setSystemTime(perf04FakeEpoch);

    // Fresh session + fresh profile mock for the post-logout call
    getSession.mockResolvedValue({ data: { session: { access_token: 'tok-gen-2' } } });
    getProfile.mockResolvedValueOnce(minimalProfile04);

    await useAuthStore.getState().checkAuth();

    // The guard is generational — it captures a NEW epoch (post-logout), so
    // this fresh checkAuth must complete its success set normally.
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user?.id).toBe('user-epoch04');
    expect(state.isLoading).toBe(false);
  });

  // -----------------------------------------------------------------------
  // ADVERSARIAL-2 — epoch guard does not block the no-session clear
  //
  // When getSession() returns no session with NO intervening logout, epoch
  // is unchanged, so `epoch !== _authEpoch` is false — the guard does NOT
  // fire, and the no-session clear (isAuthenticated: false) still applies.
  //
  // Ensures the guard is not accidentally inverted to fire when epoch is
  // unchanged (which would block legitimate clears).
  // -----------------------------------------------------------------------
  it('ADVERSARIAL: epoch guard does not block no-session clear when no logout occurred', async () => {
    // Seed authed state — simulates a stale persisted session the server no
    // longer recognises (the session cookie expired).
    useAuthStore.setState({
      user: preservedUser04,
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });

    // getSession returns no session — the "revoked token" path
    getSession.mockResolvedValue({ data: { session: null } });

    // No logout call — epoch is unchanged throughout
    await useAuthStore.getState().checkAuth();

    const state = useAuthStore.getState();
    // No-session set must have applied normally (guard did NOT fire)
    expect(state.isAuthenticated).toBe(false);
    // getProfile must NOT have been called (short-circuited at no-session guard)
    expect(getProfile).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// PERF-02-02: checkAuth background revalidation — error-disposition allow-list
//
// The NEW (unimplemented) contract:
//   - Clears auth ONLY on: getSession() returns no session, OR getProfile()
//     rejects with APIRequestError{status:401}.
//   - PRESERVES user/isAuthenticated on EVERY other failure: offline (0),
//     timeout (408), 5xx, or a thrown getSession() (network error).
//
// Most "preserve" rows go RED today because the current catch block clears
// auth on ANY error — that is the exact behaviour being changed by PERF-02.
//
// Fake-timer strategy: each beforeEach advances the fake clock by another
// EPOCH_STEP (60 s), guaranteeing that _profileFetchedAt stamped in any
// preceding test is always > 30 s in the past. This prevents the freshness
// guard from short-circuiting tests that seed user:U before calling checkAuth.
// ---------------------------------------------------------------------------

import { APIRequestError } from '@/services/api';

const preservedUser = {
  id: 'user-perf02',
  email: 'preserved@test.com',
  name: 'Preserved User',
  avatar: undefined,
  role: 'free' as const,
  preferences: {
    language: 'en' as const,
    dailyGoal: 20,
    notifications: true,
    theme: 'light' as const,
  },
  stats: {
    streak: 0,
    wordsLearned: 0,
    totalXP: 0,
    joinedDate: new Date('2025-01-01'),
  },
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

const minimalProfile02 = {
  id: 'user-perf02',
  email: 'preserved@test.com',
  full_name: 'Preserved User',
  avatar_url: null,
  is_active: true,
  is_superuser: false,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

// Each test advances fake clock by EPOCH_STEP ms so _profileFetchedAt
// from the previous test is always > PROFILE_FRESHNESS_MS (30 s) in the past.
const EPOCH_STEP = 60_000; // 60 s > 30 s freshness window
let perf02FakeEpoch = Date.now(); // start at real time, incremented each beforeEach

describe('authStore — checkAuth background revalidation (PERF-02)', () => {
  const getSession = supabase.auth.getSession as ReturnType<typeof vi.fn>;
  const getProfile = authAPI.getProfile as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Advance the epoch by one step so any _profileFetchedAt from the prior
    // test is now stale (more than 30 s ago from the new fake "now").
    perf02FakeEpoch += EPOCH_STEP;
    vi.useFakeTimers();
    vi.setSystemTime(perf02FakeEpoch);

    vi.clearAllMocks();

    // Reset store to unauthenticated baseline before each test.
    // Tests that need a seeded authed user call setState explicitly.
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -----------------------------------------------------------------------
  // AC #2 — success path (start unauthed): session valid, profile 200 ->
  // store reflects fresh user, isAuthenticated:true, isLoading:false
  // -----------------------------------------------------------------------
  it('success updates state (unauthed start, valid session + 200 profile)', async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } });
    getProfile.mockResolvedValue(minimalProfile02);

    await useAuthStore.getState().checkAuth();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user).not.toBeNull();
    expect(state.user?.email).toBe('preserved@test.com');
    expect(state.isLoading).toBe(false);
  });

  // -----------------------------------------------------------------------
  // AC #3, #5 — confirmed-invalid: 401 from /auth/me -> clears auth
  // -----------------------------------------------------------------------
  it('401 from /auth/me clears auth', async () => {
    useAuthStore.setState({
      user: preservedUser,
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });
    getSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } });
    getProfile.mockRejectedValue(
      new APIRequestError({ status: 401, statusText: 'Unauthorized', message: 'Unauthorized' })
    );

    await useAuthStore.getState().checkAuth();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  // -----------------------------------------------------------------------
  // AC #3, #5 — confirmed-invalid: no session -> clears auth, getProfile not called
  // -----------------------------------------------------------------------
  it('no-session clears auth and does not call getProfile', async () => {
    useAuthStore.setState({
      user: preservedUser,
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });
    getSession.mockResolvedValue({ data: { session: null } });

    await useAuthStore.getState().checkAuth();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(getProfile).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // AC #4, #6 — transient: offline (status 0) -> PRESERVES session
  // [EXPECT RED] Current catch clears auth on any non-abort error
  // -----------------------------------------------------------------------
  it('offline (status 0) preserves user and isAuthenticated', async () => {
    useAuthStore.setState({
      user: preservedUser,
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });
    getSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } });
    getProfile.mockRejectedValue(
      new APIRequestError({ status: 0, statusText: 'Network Error', message: 'Network Error' })
    );

    await useAuthStore.getState().checkAuth();

    const state = useAuthStore.getState();
    expect(state.user).not.toBeNull();
    expect(state.user?.id).toBe('user-perf02');
    expect(state.isAuthenticated).toBe(true);
  });

  // -----------------------------------------------------------------------
  // AC #4, #6 — transient: timeout (status 408) -> PRESERVES session
  // [EXPECT RED] Current catch clears auth on any non-abort error
  // -----------------------------------------------------------------------
  it('timeout (status 408) preserves user and isAuthenticated', async () => {
    useAuthStore.setState({
      user: preservedUser,
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });
    getSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } });
    getProfile.mockRejectedValue(
      new APIRequestError({
        status: 408,
        statusText: 'Request Timeout',
        message: 'Request Timeout',
      })
    );

    await useAuthStore.getState().checkAuth();

    const state = useAuthStore.getState();
    expect(state.user).not.toBeNull();
    expect(state.user?.id).toBe('user-perf02');
    expect(state.isAuthenticated).toBe(true);
  });

  // -----------------------------------------------------------------------
  // AC #4, #6 — transient: 5xx (status 500) -> PRESERVES session
  // [EXPECT RED] Current catch clears auth on any non-abort error
  // -----------------------------------------------------------------------
  it('5xx (status 500) preserves user and isAuthenticated', async () => {
    useAuthStore.setState({
      user: preservedUser,
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });
    getSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } });
    getProfile.mockRejectedValue(
      new APIRequestError({
        status: 500,
        statusText: 'Internal Server Error',
        message: 'Internal Server Error',
      })
    );

    await useAuthStore.getState().checkAuth();

    const state = useAuthStore.getState();
    expect(state.user).not.toBeNull();
    expect(state.user?.id).toBe('user-perf02');
    expect(state.isAuthenticated).toBe(true);
  });

  // -----------------------------------------------------------------------
  // AC #6 — transient: getSession() throws a network error -> PRESERVES session
  // [EXPECT RED] Current catch clears auth on any non-abort error
  // -----------------------------------------------------------------------
  it('getSession() throw (network error) preserves user and isAuthenticated', async () => {
    useAuthStore.setState({
      user: preservedUser,
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });
    getSession.mockRejectedValue(new Error('Network failure'));

    await useAuthStore.getState().checkAuth();

    const state = useAuthStore.getState();
    expect(state.user).not.toBeNull();
    expect(state.user?.id).toBe('user-perf02');
    expect(state.isAuthenticated).toBe(true);
  });

  // -----------------------------------------------------------------------
  // AC #1 — fire-and-forget: checkAuth() called without await returns a Promise;
  // awaiting it shows the updated state
  // -----------------------------------------------------------------------
  it('fire-and-forget: checkAuth() returns a Promise; awaited state is updated', async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } });
    getProfile.mockResolvedValue(minimalProfile02);

    const result = useAuthStore.getState().checkAuth();

    // Immediately after call (before await): result must be a Promise
    expect(result).toBeInstanceOf(Promise);

    // After awaiting: store must reflect the fetched user
    await result;
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user?.email).toBe('preserved@test.com');
  });

  // -----------------------------------------------------------------------
  // ADVERSARIAL — QA Mode B additions
  //
  // These three cases probe the allow-list boundary directly.
  // A loose impl (clears on 4xx, or clears on !instanceof APIRequestError)
  // would fail at least one of these.
  // -----------------------------------------------------------------------

  // ADV-1: 403 is NOT in the allow-list (only 401 is). A 403 from /auth/me
  // (Forbidden / insufficient role) is not a "your session is invalid" signal —
  // it means the session IS valid but the resource is off-limits. Must preserve.
  it('ADVERSARIAL: 403 from /auth/me preserves user and isAuthenticated (allow-list is exactly 401)', async () => {
    useAuthStore.setState({
      user: preservedUser,
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });
    getSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } });
    getProfile.mockRejectedValue(
      new APIRequestError({ status: 403, statusText: 'Forbidden', message: 'Forbidden' })
    );

    await useAuthStore.getState().checkAuth();

    const state = useAuthStore.getState();
    expect(state.user).not.toBeNull();
    expect(state.user?.id).toBe('user-perf02');
    expect(state.isAuthenticated).toBe(true);
  });

  // ADV-2: A plain Error (not an APIRequestError) thrown from getProfile must
  // preserve the session. Guards against an impl that clears on
  // !(error instanceof APIRequestError) rather than only on status===401.
  it('ADVERSARIAL: plain Error (non-APIRequestError) from getProfile preserves session', async () => {
    useAuthStore.setState({
      user: preservedUser,
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });
    getSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } });
    getProfile.mockRejectedValue(new Error('boom — unexpected JS error'));

    await useAuthStore.getState().checkAuth();

    const state = useAuthStore.getState();
    expect(state.user).not.toBeNull();
    expect(state.user?.id).toBe('user-perf02');
    expect(state.isAuthenticated).toBe(true);
  });

  // ADV-3: isLoading is released on a transient failure for the UNAUTHENTICATED path.
  // Scenario: store starts !isAuthenticated, getSession returns a valid session
  // (so isLoading:true is written at authStore.ts:250), then getProfile rejects with 500.
  // The spinner must not be stuck — isLoading must end false.
  it('ADVERSARIAL: isLoading released on transient 500 when started from unauthenticated state', async () => {
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
    getSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } });
    getProfile.mockRejectedValue(
      new APIRequestError({
        status: 500,
        statusText: 'Internal Server Error',
        message: 'Internal Server Error',
      })
    );

    await useAuthStore.getState().checkAuth();

    const state = useAuthStore.getState();
    // Spinner MUST be released.
    expect(state.isLoading).toBe(false);
    // isAuthenticated was already false — confirm it stays false (not toggled).
    expect(state.isAuthenticated).toBe(false);
  });
});
