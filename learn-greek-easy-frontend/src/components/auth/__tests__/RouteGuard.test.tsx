/**
 * RouteGuard Tests
 *
 * Covers the app-shell auth lifecycle driven by Supabase's
 * onAuthStateChange listener and the two ref flags inside RouteGuard:
 *   - INITIAL_SESSION calls checkAuth once and ends the loading screen
 *   - SIGNED_IN fired right after INITIAL_SESSION (already authenticated)
 *     does NOT re-fetch
 *   - SIGNED_OUT clears the store directly without calling checkAuth
 *   - Unmount aborts the in-flight checkAuth request
 *
 * The Supabase client is mocked so we can capture the auth-state-change
 * callback and drive events manually. checkAuth is replaced with a spy on
 * the real store via setState so the component (which reads checkAuth from
 * the store on mount) picks it up.
 */

import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

import { act, render, screen, waitFor } from '@testing-library/react';

import { useAppStore } from '@/stores/appStore';
import { useAuthStore } from '@/stores/authStore';

import { RouteGuard } from '../RouteGuard';

// Capture the callback registered via onAuthStateChange so tests can
// emit auth events on demand.
let authStateCallback: ((event: string) => void) | null = null;
const unsubscribe = vi.fn();
const onAuthStateChange = vi.fn((cb: (event: string) => void) => {
  authStateCallback = cb;
  return { data: { subscription: { unsubscribe } } };
});

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      onAuthStateChange: (cb: (event: string) => void) => onAuthStateChange(cb),
    },
  },
}));

const Child = () => <div data-testid="route-guard-child">App Shell</div>;

const emit = (event: string) => {
  if (!authStateCallback) throw new Error('auth state callback not registered');
  authStateCallback(event);
};

describe('RouteGuard', () => {
  let checkAuthSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    authStateCallback = null;

    // Install a controllable checkAuth on the real store. The component
    // reads state.checkAuth on mount, so this spy will be used.
    checkAuthSpy = vi.fn().mockResolvedValue(undefined);
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      checkAuth: checkAuthSpy,
    });

    useAppStore.getState().reset();
  });

  afterEach(() => {
    useAppStore.getState().reset();
  });

  it('shows the loading screen until INITIAL_SESSION resolves', async () => {
    render(
      <RouteGuard>
        <Child />
      </RouteGuard>
    );

    // Before any auth event, the loading screen is shown.
    expect(screen.getByTestId('auth-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('route-guard-child')).not.toBeInTheDocument();

    emit('INITIAL_SESSION');

    await waitFor(() => {
      expect(screen.getByTestId('route-guard-child')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('auth-loading')).not.toBeInTheDocument();
  });

  it('calls checkAuth exactly once on INITIAL_SESSION and marks auth initialized', async () => {
    render(
      <RouteGuard>
        <Child />
      </RouteGuard>
    );

    emit('INITIAL_SESSION');

    await waitFor(() => {
      expect(checkAuthSpy).toHaveBeenCalledTimes(1);
    });

    // checkAuth is invoked with an AbortSignal.
    const arg = checkAuthSpy.mock.calls[0][0];
    expect(arg.signal).toBeInstanceOf(AbortSignal);
    expect(arg.signal.aborted).toBe(false);

    // The finally block flips the app store to initialized.
    await waitFor(() => {
      expect(useAppStore.getState().authInitialized).toBe(true);
    });
  });

  it('does NOT re-fetch on SIGNED_IN that follows INITIAL_SESSION for an authenticated user', async () => {
    render(
      <RouteGuard>
        <Child />
      </RouteGuard>
    );

    emit('INITIAL_SESSION');

    await waitFor(() => {
      expect(checkAuthSpy).toHaveBeenCalledTimes(1);
    });

    // Simulate the user becoming authenticated (as checkAuth would).
    useAuthStore.setState({ isAuthenticated: true });

    // Supabase fires the redundant SIGNED_IN right after INITIAL_SESSION.
    emit('SIGNED_IN');

    // No additional checkAuth call should occur.
    await Promise.resolve();
    expect(checkAuthSpy).toHaveBeenCalledTimes(1);
  });

  it('DOES re-fetch on SIGNED_IN that represents an actual login (not yet authenticated)', async () => {
    render(
      <RouteGuard>
        <Child />
      </RouteGuard>
    );

    emit('INITIAL_SESSION');

    await waitFor(() => {
      expect(checkAuthSpy).toHaveBeenCalledTimes(1);
    });

    // Still unauthenticated => a genuine login event must trigger checkAuth.
    emit('SIGNED_IN');

    await waitFor(() => {
      expect(checkAuthSpy).toHaveBeenCalledTimes(2);
    });
  });

  it('clears the auth store on SIGNED_OUT without calling checkAuth', async () => {
    render(
      <RouteGuard>
        <Child />
      </RouteGuard>
    );

    emit('INITIAL_SESSION');

    await waitFor(() => {
      expect(checkAuthSpy).toHaveBeenCalledTimes(1);
    });

    // Pretend the user was authenticated.
    useAuthStore.setState({
      user: { id: 'u1' } as never,
      isAuthenticated: true,
      isLoading: false,
    });

    emit('SIGNED_OUT');

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().isLoading).toBe(false);

    // SIGNED_OUT must not trigger another auth fetch.
    expect(checkAuthSpy).toHaveBeenCalledTimes(1);
  });

  it('aborts the in-flight checkAuth request and unsubscribes on unmount', async () => {
    // Capture the signal handed to checkAuth so we can assert it aborts.
    let capturedSignal: AbortSignal | undefined;
    checkAuthSpy.mockImplementation((options?: { signal?: AbortSignal }) => {
      capturedSignal = options?.signal;
      // Never-resolving promise simulates an in-flight request.
      return new Promise<void>(() => {});
    });

    const { unmount } = render(
      <RouteGuard>
        <Child />
      </RouteGuard>
    );

    emit('INITIAL_SESSION');

    await waitFor(() => {
      expect(capturedSignal).toBeInstanceOf(AbortSignal);
    });
    expect(capturedSignal?.aborted).toBe(false);

    unmount();

    expect(capturedSignal?.aborted).toBe(true);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// PERF-02-03: de-gated persisted-session render tests (stale-while-revalidate)
// ---------------------------------------------------------------------------
//
// NEW behavior contract (not yet implemented):
//   When selectHasPersistedSession is true at mount, isInitializing starts
//   FALSE => children render immediately WITHOUT awaiting checkAuth.
//   checkAuth still runs in the background (exactly once on INITIAL_SESSION).
//   setAuthInitialized() stays in the finally AFTER checkAuth settles, so
//   appStore.authInitialized stays false while children are mounted but
//   checkAuth is still pending.
//   For unknown/unauthenticated sessions (selector false) the behavior is
//   unchanged: auth-loading shows, children do not render.
//
// RED tests: AC-1 and AC-5 fail today (children don't render until checkAuth
// resolves -- with a never-resolving spy the child never appears).
// AC-2 and AC-3 document unchanged behavior (expected to pass today).
// AC-5b locks the post-condition (also expected to pass today since both
// children + authInitialized come after resolve in the current impl).
// ---------------------------------------------------------------------------

describe('RouteGuard — de-gated persisted-session render (PERF-02)', () => {
  let checkAuthSpy: ReturnType<typeof vi.fn>;

  /** Seed a fully-hydrated, authenticated persisted session. */
  const seedPersistedSession = (spy: ReturnType<typeof vi.fn>) => {
    useAuthStore.setState({
      _hasHydrated: true,
      isAuthenticated: true,
      user: { id: 'u1', email: 'test@example.com' } as never,
      isLoading: false,
      error: null,
      checkAuth: spy,
    });
  };

  /** Seed an unauthenticated / hydrated session (no persisted user). */
  const seedUnauthedSession = (spy: ReturnType<typeof vi.fn>) => {
    useAuthStore.setState({
      _hasHydrated: true,
      isAuthenticated: false,
      user: null,
      isLoading: false,
      error: null,
      checkAuth: spy,
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    authStateCallback = null;
    useAppStore.getState().reset();
  });

  afterEach(() => {
    useAppStore.getState().reset();
  });

  // AC-1: children render BEFORE checkAuth resolves (the core behavioral change)
  it('AC-1: renders children immediately for persisted session (no await checkAuth)', async () => {
    // DEFERRED: never-resolving promise -- children must appear without it settling.
    checkAuthSpy = vi.fn(() => new Promise<void>(() => {}));
    seedPersistedSession(checkAuthSpy);

    render(
      <RouteGuard>
        <Child />
      </RouteGuard>
    );

    emit('INITIAL_SESSION');

    // Children must appear even though checkAuth has NOT resolved.
    // findBy uses implicit waitFor with a short timeout.
    const child = await screen.findByTestId('route-guard-child');
    expect(child).toBeInTheDocument();

    // Loading screen must NOT be shown once children are visible.
    expect(screen.queryByTestId('auth-loading')).not.toBeInTheDocument();
  });

  // AC-2: revalidation still fires (unchanged behavior, documents it stays)
  it('AC-2: checkAuth still runs in background exactly once', async () => {
    checkAuthSpy = vi.fn(() => new Promise<void>(() => {}));
    seedPersistedSession(checkAuthSpy);

    render(
      <RouteGuard>
        <Child />
      </RouteGuard>
    );

    emit('INITIAL_SESSION');

    // Give the event loop a chance to schedule the async call.
    await act(async () => {
      await Promise.resolve();
    });

    expect(checkAuthSpy).toHaveBeenCalledTimes(1);
  });

  // AC-5: authInitialized stays false while children are mounted but checkAuth pending
  it('AC-5: authInitialized stays false while children are mounted and checkAuth is pending', async () => {
    checkAuthSpy = vi.fn(() => new Promise<void>(() => {}));
    seedPersistedSession(checkAuthSpy);

    render(
      <RouteGuard>
        <Child />
      </RouteGuard>
    );

    emit('INITIAL_SESSION');

    // Children must be present (persisted session => immediate render).
    const child = await screen.findByTestId('route-guard-child');
    expect(child).toBeInTheDocument();

    // BUT authInitialized must still be false -- setAuthInitialized() fires
    // only in the finally block after checkAuth settles.
    expect(useAppStore.getState().authInitialized).toBe(false);
  });

  // AC-5b: authInitialized flips true only after checkAuth settles
  it('AC-5b: authInitialized flips true only after checkAuth resolves', async () => {
    // Use a manually-controlled deferred so we can resolve it in the test.
    let resolveCheckAuth!: () => void;
    checkAuthSpy = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveCheckAuth = resolve;
        })
    );
    seedPersistedSession(checkAuthSpy);

    render(
      <RouteGuard>
        <Child />
      </RouteGuard>
    );

    emit('INITIAL_SESSION');

    // Wait for children to be present (should be immediate for persisted session).
    await screen.findByTestId('route-guard-child');

    // authInitialized must still be false while checkAuth is pending.
    expect(useAppStore.getState().authInitialized).toBe(false);

    // Now resolve checkAuth -- the finally block should flip authInitialized.
    await act(async () => {
      resolveCheckAuth();
      // Drain the microtask queue so the finally block runs.
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(useAppStore.getState().authInitialized).toBe(true);
    });
  });

  // AC-3: unknown/unauthenticated session still shows loading (unchanged behavior)
  it('AC-3: unknown session still shows loading screen, no auth bypass', async () => {
    checkAuthSpy = vi.fn(() => new Promise<void>(() => {}));
    seedUnauthedSession(checkAuthSpy);

    render(
      <RouteGuard>
        <Child />
      </RouteGuard>
    );

    emit('INITIAL_SESSION');

    // Give the event loop a tick.
    await act(async () => {
      await Promise.resolve();
    });

    // Loading must be shown -- selector is false, so isInitializing starts true.
    expect(screen.getByTestId('auth-loading')).toBeInTheDocument();

    // Children must NOT be visible -- no bypass for unauthenticated sessions.
    expect(screen.queryByTestId('route-guard-child')).not.toBeInTheDocument();
  });

  // ADVERSARIAL — pre-hydration no-flash guard
  // Seed _hasHydrated:false with stale authed fields. selectHasPersistedSession
  // must return false, so isInitializing starts true and children do NOT paint.
  // This guards the pre-hydration flash: persisted fields in localStorage could
  // be truthy while Zustand hasn't yet finished rehydration.
  it('ADVERSARIAL: pre-hydration store (_hasHydrated=false) shows loading, not children', async () => {
    // Stale authed fields but NOT yet hydrated — selectHasPersistedSession
    // requires _hasHydrated:true, so it returns false here.
    checkAuthSpy = vi.fn(() => new Promise<void>(() => {}));
    useAuthStore.setState({
      _hasHydrated: false,
      isAuthenticated: true,
      user: { id: 'u1' } as never,
      isLoading: false,
      error: null,
      checkAuth: checkAuthSpy,
    });

    render(
      <RouteGuard>
        <Child />
      </RouteGuard>
    );

    // At this point isInitializing was set by the lazy initializer BEFORE any
    // INITIAL_SESSION event, so the loading screen must be showing immediately.
    expect(screen.getByTestId('auth-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('route-guard-child')).not.toBeInTheDocument();

    emit('INITIAL_SESSION');

    // Give the event loop a tick — checkAuth still never resolves.
    await act(async () => {
      await Promise.resolve();
    });

    // Children must STILL not be shown: isInitializing was true at mount
    // (selector was false) and checkAuth hasn't resolved to flip it.
    expect(screen.getByTestId('auth-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('route-guard-child')).not.toBeInTheDocument();
  });
});
