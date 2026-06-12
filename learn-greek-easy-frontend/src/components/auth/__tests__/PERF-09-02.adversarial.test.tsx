/**
 * PERF-09-02 Adversarial Security & Redirect Coverage
 *
 * Tests NOT included in the RED specs that must hold under the new contract
 * (RouteGuard de-gated; ProtectedRoute owns security boundary).
 *
 * (a) Protected route with an unauthenticated no-session visitor:
 *     RouteGuard renders children immediately → ProtectedRoute intercepts →
 *     still redirects to /login. No protected content is exposed.
 *
 * (b) Background checkAuth resolves to authenticated mid-session on landing:
 *     User starts as unauthenticated → landing renders → checkAuth runs in
 *     background → auth store flips to authenticated → LandingRoute redirect fires.
 *
 * (c) Pre-hydration window (_hasHydrated=false) visiting a protected route:
 *     RouteGuard passes children through immediately. ProtectedRoute sees
 *     _hasHydrated=false → renders its own spinner (not a leak of protected content).
 *
 * (d) RouteGuard de-gate does NOT bypass ProtectedRoute role gate:
 *     Authenticated visitor with 'free' role hitting a 'premium' route →
 *     still redirected to /unauthorized.
 */

import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { act, render as rtlRender, screen, waitFor } from '@testing-library/react';

import { useAppStore } from '@/stores/appStore';
import { useAuthStore } from '@/stores/authStore';

import { LandingRoute } from '../LandingRoute';
import { ProtectedRoute } from '../ProtectedRoute';
import { RouteGuard } from '../RouteGuard';

// ---------------------------------------------------------------------------
// Module-level Supabase mock (mirrors RouteGuard.test.tsx pattern)
// ---------------------------------------------------------------------------

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
  getSupabase: vi.fn(() =>
    Promise.resolve({
      auth: {
        onAuthStateChange: (cb: (event: string) => void) => onAuthStateChange(cb),
      },
    })
  ),
}));

vi.mock('@/services/authAPI', () => ({
  authAPI: {
    getProfile: vi.fn().mockResolvedValue({
      id: 'test-user-123',
      email: 'test@example.com',
      full_name: 'Test User',
      is_superuser: false,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
      settings: { daily_goal: 20, email_notifications: true },
    }),
    logout: vi.fn().mockResolvedValue(undefined),
  },
  clearAuthTokens: vi.fn(),
}));

/** Emit an auth event. Waits for the subscription to register first. */
const emit = async (event: string) => {
  await waitFor(() => {
    if (!authStateCallback) throw new Error('subscription not yet registered');
  });
  authStateCallback!(event);
};

// ---------------------------------------------------------------------------
// Page stubs
// ---------------------------------------------------------------------------
const LandingContent = () => <div data-testid="landing-content">Landing Page</div>;
const ProtectedContent = () => <div data-testid="protected-content">Protected Content</div>;
const PremiumContent = () => <div data-testid="premium-content">Premium Content</div>;
const LoginPage = () => <div data-testid="login-page">Login</div>;
const DashboardPage = () => <div data-testid="dashboard-page">Dashboard</div>;
const UnauthorizedPage = () => <div data-testid="unauthorized-page">Unauthorized</div>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const seedUnauthenticated = () => {
  useAuthStore.setState({
    _hasHydrated: true,
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
    checkAuth: vi.fn().mockResolvedValue(undefined),
  });
};

const seedAuthenticated = (role: 'free' | 'premium' | 'admin' = 'free') => {
  useAuthStore.setState({
    _hasHydrated: true,
    user: {
      id: 'u1',
      email: 'test@example.com',
      name: 'Test User',
      role,
      preferences: { language: 'en', dailyGoal: 20, notifications: true, theme: 'light' },
      stats: { streak: 0, wordsLearned: 0, totalXP: 0, joinedDate: new Date('2025-01-01') },
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-01'),
    },
    isAuthenticated: true,
    isLoading: false,
    error: null,
    checkAuth: vi.fn().mockResolvedValue(undefined),
  });
};

// ---------------------------------------------------------------------------
// (a) Protected route — unauthenticated no-session visitor → /login
//
// SECURITY CRITICAL: RouteGuard now renders children immediately (no spinner).
// This must NOT cause protected content to leak to an unauthenticated visitor.
// ProtectedRoute (L22) guards _hasHydrated AND isAuthenticated — that boundary
// must remain intact regardless of RouteGuard's de-gate change.
// ---------------------------------------------------------------------------
describe('PERF-09-02 adversarial (a): protected route + unauthenticated visitor → /login (no leak)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authStateCallback = null;
    seedUnauthenticated();
    useAppStore.getState().reset();
  });

  afterEach(() => {
    useAppStore.getState().reset();
  });

  it('RouteGuard de-gate does NOT expose protected content — ProtectedRoute redirects to /login', async () => {
    rtlRender(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/dashboard"
            element={
              // RouteGuard wraps the entire app in production; here we test
              // the boundary in isolation around a single ProtectedRoute.
              <RouteGuard>
                <ProtectedRoute>
                  <ProtectedContent />
                </ProtectedRoute>
              </RouteGuard>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    // RouteGuard renders immediately (no spinner). ProtectedRoute intercepts.
    // _hasHydrated=true, isAuthenticated=false → Navigate to /login.
    await waitFor(() => {
      expect(screen.getByTestId('login-page')).toBeInTheDocument();
    });

    // Protected content must NEVER appear.
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('ProtectedRoute /login redirect carries the originating path as state.from', async () => {
    // Regression guard: the return-URL mechanism must survive the de-gate.
    let capturedState: { from?: string } | null = null;
    const LoginWithState = () => {
      const location = useLocation();
      capturedState = location.state;
      return <LoginPage />;
    };

    rtlRender(
      <MemoryRouter initialEntries={['/dashboard?tab=stats']}>
        <Routes>
          <Route path="/login" element={<LoginWithState />} />
          <Route
            path="/dashboard"
            element={
              <RouteGuard>
                <ProtectedRoute>
                  <ProtectedContent />
                </ProtectedRoute>
              </RouteGuard>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('login-page')).toBeInTheDocument();
    });

    expect((capturedState as { from?: string } | null)?.from).toBe('/dashboard?tab=stats');
  });
});

// ---------------------------------------------------------------------------
// (b) Background checkAuth resolves to authenticated mid-session on landing
//
// Scenario: user starts unauthenticated → landing renders → INITIAL_SESSION fires
// → checkAuth runs background and resolves to authenticated → LandingRoute
// redirect fires.
// ---------------------------------------------------------------------------
describe('PERF-09-02 adversarial (b): background checkAuth resolves to authed on landing → redirect fires', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authStateCallback = null;
    useAppStore.getState().reset();
  });

  afterEach(() => {
    useAppStore.getState().reset();
  });

  it('checkAuth resolving to authenticated mid-session triggers LandingRoute redirect to /dashboard', async () => {
    // Start unauthenticated.
    let resolveCheckAuth!: () => void;
    const checkAuthSpy = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveCheckAuth = resolve;
        })
    );
    useAuthStore.setState({
      _hasHydrated: true,
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      checkAuth: checkAuthSpy,
    });

    rtlRender(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route
            path="/"
            element={
              <RouteGuard>
                <LandingRoute>
                  <LandingContent />
                </LandingRoute>
              </RouteGuard>
            }
          />
          <Route path="/dashboard" element={<DashboardPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Landing renders immediately (RouteGuard de-gated, unauthenticated → landing).
    expect(screen.getByTestId('landing-content')).toBeInTheDocument();

    // Fire INITIAL_SESSION → checkAuth runs in background.
    await emit('INITIAL_SESSION');
    await waitFor(() => expect(checkAuthSpy).toHaveBeenCalledTimes(1));

    // Landing still visible while checkAuth is pending.
    expect(screen.getByTestId('landing-content')).toBeInTheDocument();

    // checkAuth resolves → simulate the store update that checkAuth would make.
    await act(async () => {
      resolveCheckAuth();
      await Promise.resolve();
      await Promise.resolve();
    });

    // Now simulate the authStore update that checkAuth performs on success.
    await act(async () => {
      seedAuthenticated();
    });

    // LandingRoute useEffect fires because isAuthenticated changed → redirect.
    await waitFor(() => {
      expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('landing-content')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// (c) Pre-hydration window (_hasHydrated=false) on a protected route
//
// RouteGuard now renders children immediately regardless of hydration state.
// ProtectedRoute (L22) must still show its spinner — NOT expose protected content.
// ---------------------------------------------------------------------------
describe('PERF-09-02 adversarial (c): pre-hydration window (_hasHydrated=false) on protected route shows spinner, not content', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authStateCallback = null;
    useAppStore.getState().reset();
  });

  afterEach(() => {
    useAppStore.getState().reset();
  });

  it('_hasHydrated=false: RouteGuard passes children, ProtectedRoute shows spinner (no leak)', () => {
    // Pre-hydration state: _hasHydrated is false (Zustand rehydration not yet complete).
    // isAuthenticated may be stale/true from a previous persisted session.
    useAuthStore.setState({
      _hasHydrated: false,
      isAuthenticated: true, // stale persisted value
      user: { id: 'u1' } as never,
      isLoading: false,
      error: null,
      checkAuth: vi.fn().mockResolvedValue(undefined),
    });

    rtlRender(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/dashboard"
            element={
              <RouteGuard>
                <ProtectedRoute>
                  <ProtectedContent />
                </ProtectedRoute>
              </RouteGuard>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    // RouteGuard passes through immediately.
    // ProtectedRoute's `!_hasHydrated` guard (L22) shows the spinner.
    expect(screen.getByText(/checking authentication/i)).toBeInTheDocument();

    // Protected content must NOT be visible during pre-hydration window.
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    // Login page must NOT flash either (spinner, not redirect).
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
  });

  it('_hasHydrated=false → _hasHydrated=true (unauthenticated): spinner clears and redirects to /login', async () => {
    useAuthStore.setState({
      _hasHydrated: false,
      isAuthenticated: false,
      user: null,
      isLoading: false,
      error: null,
      checkAuth: vi.fn().mockResolvedValue(undefined),
    });

    rtlRender(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/dashboard"
            element={
              <RouteGuard>
                <ProtectedRoute>
                  <ProtectedContent />
                </ProtectedRoute>
              </RouteGuard>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    // Pre-hydration spinner.
    expect(screen.getByText(/checking authentication/i)).toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();

    // Hydration completes: _hasHydrated flips to true, still unauthenticated.
    await act(async () => {
      useAuthStore.setState({ _hasHydrated: true });
    });

    // ProtectedRoute re-evaluates: isAuthenticated=false → redirect.
    await waitFor(() => {
      expect(screen.getByTestId('login-page')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// (d) Role gate: RouteGuard de-gate does NOT bypass ProtectedRoute role check
//
// An authenticated 'free' user hitting a 'premium' route must still be
// redirected to /unauthorized — the de-gate does not affect role enforcement.
// ---------------------------------------------------------------------------
describe('PERF-09-02 adversarial (d): role gate preserved after de-gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authStateCallback = null;
    useAppStore.getState().reset();
  });

  afterEach(() => {
    useAppStore.getState().reset();
  });

  it('free-role visitor on premium route → /unauthorized (role gate not bypassed)', async () => {
    seedAuthenticated('free');

    rtlRender(
      <MemoryRouter initialEntries={['/premium']}>
        <Routes>
          <Route path="/unauthorized" element={<UnauthorizedPage />} />
          <Route
            path="/premium"
            element={
              <RouteGuard>
                <ProtectedRoute requiredRole="premium">
                  <PremiumContent />
                </ProtectedRoute>
              </RouteGuard>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('unauthorized-page')).toBeInTheDocument();
    });

    // Premium content must NOT be visible.
    expect(screen.queryByTestId('premium-content')).not.toBeInTheDocument();
  });

  it('premium-role visitor on premium route → content rendered (role gate passes correctly)', async () => {
    seedAuthenticated('premium');

    rtlRender(
      <MemoryRouter initialEntries={['/premium']}>
        <Routes>
          <Route path="/unauthorized" element={<UnauthorizedPage />} />
          <Route
            path="/premium"
            element={
              <RouteGuard>
                <ProtectedRoute requiredRole="premium">
                  <PremiumContent />
                </ProtectedRoute>
              </RouteGuard>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('premium-content')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('unauthorized-page')).not.toBeInTheDocument();
  });
});
