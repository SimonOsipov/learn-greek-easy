/**
 * WEDGE-13-03 (AC-1) — RED specs, authored pre-implementation.
 *
 * Verifies the eager `/ru` route: it must render the landing page (not the
 * `*` NotFound catch-all), for both `/ru` and `/ru/`, and must stay wrapped
 * by `LandingRoute` so an authenticated visitor is redirected to /dashboard
 * exactly as an authenticated visitor to `/` already is.
 *
 * Mechanism (Stage 2.5 Hard Constraint 3 / Defect A):
 * `App.tsx` exports only `App`, which renders its own `<BrowserRouter>` — a
 * `<MemoryRouter>` wrapped around it throws react-router's nested-Router
 * invariant. So the route is driven via `window.history.pushState(...)`
 * before `render(<App/>)`, unchanged from production. Real `<Helmet>` throws
 * under happy-dom (`@dr.pogodin/react-helmet` v3.0.5) and `App.tsx`'s own
 * top-level `<ErrorBoundary>` swallows that throw into a misleading fallback
 * UI — so Helmet is mocked out (precedent:
 * `src/pages/waitlist/__tests__/WaitlistConfirmPage.test.tsx:29-32`).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

import { useAuthStore } from '@/stores/authStore';
import App from '@/App';

// Defect A: real Helmet crashes under happy-dom; App's ErrorBoundary swallows
// the crash into a fallback UI, so `getByTestId('landing-page')` would fail
// with a misleading "Unable to find element" instead of the real error.
vi.mock('@dr.pogodin/react-helmet', () => ({
  Helmet: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));

// RouteGuard (mounted unconditionally by AppContent) calls checkAuth(), which
// calls authAPI.getProfile() only when a Supabase session exists. Mocked
// regardless, per the pinned precedent (LandingRoute.test.tsx:30-44), so no
// spec in this file makes a real network call.
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

// The authenticated spec flips isAuthenticated -> true, which un-gates
// NotificationProvider's fetch effect (NotificationContext.tsx:305-317).
// Mocked so that effect never fires an unmocked, real fetch.
vi.mock('@/services/notificationAPI', () => ({
  fetchNotifications: vi
    .fn()
    .mockResolvedValue({ notifications: [], unread_count: 0, has_more: false }),
  fetchUnreadCount: vi.fn().mockResolvedValue(0),
  markNotificationAsRead: vi.fn().mockResolvedValue({}),
  markAllNotificationsAsRead: vi.fn().mockResolvedValue({}),
  deleteNotification: vi.fn().mockResolvedValue({}),
  clearAllNotifications: vi.fn().mockResolvedValue({}),
}));

const setAuthenticated = () => {
  useAuthStore.setState({
    user: {
      id: 'test-user-123',
      email: 'test@example.com',
      name: 'Test User',
      role: 'free',
      preferences: {
        language: 'en',
        dailyGoal: 20,
        notifications: true,
        theme: 'light',
      },
      stats: {
        streak: 0,
        wordsLearned: 0,
        totalXP: 0,
        joinedDate: new Date('2025-01-01'),
      },
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-01'),
    },
    isAuthenticated: true,
    isLoading: false,
    error: null,
  });
};

const setUnauthenticated = () => {
  useAuthStore.setState({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
  });
};

describe('WEDGE-13-03 (AC-1): /ru SPA route', () => {
  beforeEach(() => {
    // jsdom/happy-dom shares one window.history per test file — never inherit
    // the previous test's path (Stage 2.5 Hard Constraint 3 hygiene).
    window.history.pushState({}, '', '/');
    setUnauthenticated();
    vi.clearAllMocks();
  });

  it('ru_route_renders_landing_not_notfound', async () => {
    window.history.pushState({}, '', '/ru');
    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('landing-page')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('not-found-page')).not.toBeInTheDocument();
  });

  it('ru_route_renders_landing_with_trailing_slash', async () => {
    window.history.pushState({}, '', '/ru/');
    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('landing-page')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('not-found-page')).not.toBeInTheDocument();
  });

  it('ru_route_redirects_authenticated_user_to_dashboard', async () => {
    setAuthenticated();
    window.history.pushState({}, '', '/ru');
    render(<App />);

    // The meaningful signal that /ru is wrapped by LandingRoute (and not
    // merely unmatched into the `*` NotFound catch-all, which never
    // navigates): the browser URL actually changes to /dashboard. Asserting
    // ONLY "landing-page absent" would pass vacuously today too — NotFound
    // has no `landing-page` testid, so an unauthenticated OR authenticated
    // visitor to today's unimplemented /ru already sees no landing-page,
    // regardless of LandingRoute ever running.
    await waitFor(() => {
      expect(window.location.pathname).toBe('/dashboard');
    });
    expect(screen.queryByTestId('landing-page')).not.toBeInTheDocument();
  });
});

// -----------------------------------------------------------------------------
// QA adversarial coverage (post-implementation) — the App-level counterpart to
// `detectRouteLocale('/rutabaga') === null` (already unit-pinned in
// siteLocales.test.ts:41). That test only proves the pure locale-detection
// function rejects a string that merely STARTS WITH "ru" — it says nothing
// about react-router's OWN, separate path-matching mechanism at the
// `<Route path="/ru">` declaration in App.tsx. This closes that gap: a naive
// route declaration (e.g. `path="/ru*"` or a future regression to prefix
// matching) would make `/rutabaga` wrongly render the landing page instead of
// NotFound, even though detectRouteLocale itself stayed correct.
// -----------------------------------------------------------------------------
describe('WEDGE-13-03 (QA): /ru route match is exact, not a string prefix', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/');
    setUnauthenticated();
    vi.clearAllMocks();
  });

  it('ru_route_does_not_prefix_match_rutabaga', async () => {
    window.history.pushState({}, '', '/rutabaga');
    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('not-found-page')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('landing-page')).not.toBeInTheDocument();
  });
});
