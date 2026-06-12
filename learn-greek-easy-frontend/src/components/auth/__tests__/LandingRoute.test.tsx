/**
 * LandingRoute Tests — PERF-09-02 RED specs
 *
 * Covers the gate-removal change:
 *   OLD: if (isLoading) return <PageLoader/> blocks the landing page for every
 *        visitor (including anonymous) until auth resolves.
 *   NEW: the isLoading gate is removed. Landing renders immediately for anonymous
 *        visitors regardless of auth loading state. The redirect (authenticated →
 *        /dashboard) is preserved via the useEffect.
 *
 * RED criteria (pre-implementation):
 *   AC-1 / AC-3 gate-removal: isLoading:true + anonymous → currently returns
 *   <PageLoader/>, so the landing child is ABSENT. After the change it must be
 *   PRESENT.
 *
 * GREEN already (regression guards that must stay green pre+post):
 *   AC-2 / AC-4: authenticated visitor → redirect to /dashboard fires.
 *   Auth flips to authenticated after mount → redirect fires.
 */

import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { render as rtlRender, screen, waitFor } from '@testing-library/react';

import { useAuthStore } from '@/stores/authStore';
import { LandingRoute } from '../LandingRoute';

// Prevent real network calls originating from authStore / supabase client.
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

// ---------------------------------------------------------------------------
// State seeders (mirror PublicRoute.test.tsx convention)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Route tree helpers
// ---------------------------------------------------------------------------

const LandingContent = () => <div data-testid="landing-content">Landing Page</div>;
const DashboardPage = () => <div data-testid="dashboard-page">Dashboard Page</div>;

const renderLandingRoute = (initialPath = '/') =>
  rtlRender(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/"
          element={
            <LandingRoute>
              <LandingContent />
            </LandingRoute>
          }
        />
        <Route path="/dashboard" element={<DashboardPage />} />
      </Routes>
    </MemoryRouter>
  );

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LandingRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setUnauthenticated();
    localStorage.clear();
    sessionStorage.clear();
  });

  // -------------------------------------------------------------------------
  // AC-1 / AC-3 gate-removal (RED pre-implementation)
  //
  // The critical RED test: isLoading:true + anonymous visitor.
  // Current code: `if (isLoading) return <PageLoader/>` → landing child absent.
  // New code (post-impl): gate removed → landing child present immediately.
  // -------------------------------------------------------------------------
  describe('anonymous visitor — gate-removal RED tests', () => {
    it('AC-1: anonymous visitor (isLoading:false) renders landing children immediately', async () => {
      // isLoading:false, not authenticated — current code renders children
      // (falls through the isLoading gate and returns children for !isAuthenticated).
      // This test should already pass pre-impl; it locks the happy path.
      setUnauthenticated(); // isLoading:false is default
      renderLandingRoute();

      await waitFor(() => {
        expect(screen.getByTestId('landing-content')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('dashboard-page')).not.toBeInTheDocument();
    });

    it('AC-3 (gate-removal RED): anonymous visitor with isLoading:true still renders landing children', async () => {
      // isLoading:true, not authenticated.
      // CURRENT behavior: returns <PageLoader/> → landing-content ABSENT → RED.
      // POST-IMPL behavior: gate removed → landing-content PRESENT → GREEN.
      useAuthStore.setState({
        user: null,
        isAuthenticated: false,
        isLoading: true,
        error: null,
      });

      renderLandingRoute();

      // This assertion FAILS against current code (PageLoader is shown instead).
      await waitFor(() => {
        expect(screen.getByTestId('landing-content')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('dashboard-page')).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // AC-2 / AC-4 redirect preserved (should be GREEN pre+post — regression guard)
  // -------------------------------------------------------------------------
  describe('authenticated visitor — redirect preserved', () => {
    it('AC-2: authenticated visitor (isLoading:false) is redirected to /dashboard', async () => {
      setAuthenticated();
      renderLandingRoute();

      await waitFor(() => {
        expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('landing-content')).not.toBeInTheDocument();
    });

    it('AC-4: authenticated visitor with isLoading:true is redirected to /dashboard once loading clears', async () => {
      // Start: authenticated but isLoading:true.
      useAuthStore.setState({
        user: {
          id: 'test-user-123',
          email: 'test@example.com',
          name: 'Test User',
          role: 'free',
          preferences: { language: 'en', dailyGoal: 20, notifications: true, theme: 'light' },
          stats: { streak: 0, wordsLearned: 0, totalXP: 0, joinedDate: new Date('2025-01-01') },
          createdAt: new Date('2025-01-01'),
          updatedAt: new Date('2025-01-01'),
        },
        isAuthenticated: true,
        isLoading: true,
        error: null,
      });

      renderLandingRoute();

      // With the gate removed, the component renders children or redirects based
      // on isAuthenticated alone. isAuthenticated is true → useEffect fires → redirect.
      // isLoading is still true but the gate is gone, so the effect guard
      // `!isLoading && isAuthenticated` (L32 current) handles this.
      // After isLoading clears (or if effect fires anyway on isAuthenticated:true), redirect fires.
      // Set isLoading:false to trigger the effect re-run.
      await waitFor(() => {
        // Effect fires on mount: !isLoading (true) && isAuthenticated (true) — redirect fires.
        // But isLoading:true → effect guard !isLoading is false → no redirect yet.
        // Transition isLoading → false to trigger effect.
      });

      // Simulate auth loading completing.
      useAuthStore.setState({ isLoading: false });

      await waitFor(() => {
        expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('landing-content')).not.toBeInTheDocument();
    });

    it('auth flips to authenticated after mount — redirect fires', async () => {
      // Start unauthenticated so landing renders, then flip to authenticated.
      setUnauthenticated();
      renderLandingRoute();

      // Landing is initially visible.
      await waitFor(() => {
        expect(screen.getByTestId('landing-content')).toBeInTheDocument();
      });

      // Auth resolves: user becomes authenticated.
      setAuthenticated();

      // Redirect must fire.
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('landing-content')).not.toBeInTheDocument();
    });
  });
});
