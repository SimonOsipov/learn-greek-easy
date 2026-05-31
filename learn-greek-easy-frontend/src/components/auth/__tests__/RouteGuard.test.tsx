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

import { render, screen, waitFor } from '@testing-library/react';

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
