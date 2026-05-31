/**
 * PublicRoute Unit Tests
 *
 * Covers:
 * - Authenticated user is redirected to /dashboard (default)
 * - Authenticated user honours location.state.from
 * - Custom redirectTo prop is used when state.from is absent
 * - Unauthenticated user sees the Outlet (no redirect)
 * - Children rendered instead of Outlet when children prop is provided
 */

import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { render as rtlRender, screen, waitFor } from '@testing-library/react';
import { useAuthStore } from '@/stores/authStore';

import { PublicRoute } from '../PublicRoute';

// Prevent real network calls originating from authStore / supabase client
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

// Helper: set the store into an authenticated state
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

// Helper: set the store into an unauthenticated state
const setUnauthenticated = () => {
  useAuthStore.setState({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
  });
};

// Placeholder page components used in test route trees
const DashboardPage = () => <div>Dashboard Page</div>;
const CustomPage = () => <div>Custom Redirect Page</div>;
const OutletContent = () => <div>Outlet Content</div>;
const ChildContent = () => <div>Child Content</div>;

describe('PublicRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setUnauthenticated();
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('unauthenticated user', () => {
    it('renders the Outlet when no children are passed', async () => {
      rtlRender(
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<PublicRoute />}>
              <Route index element={<OutletContent />} />
            </Route>
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Outlet Content')).toBeInTheDocument();
      });
    });

    it('renders children when the children prop is provided', async () => {
      rtlRender(
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <ChildContent />
                </PublicRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Child Content')).toBeInTheDocument();
      });
    });
  });

  describe('authenticated user — default redirect', () => {
    it('redirects to /dashboard when no state.from or redirectTo are set', async () => {
      setAuthenticated();

      rtlRender(
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <ChildContent />
                </PublicRoute>
              }
            />
            <Route path="/dashboard" element={<DashboardPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
        expect(screen.queryByText('Child Content')).not.toBeInTheDocument();
      });
    });
  });

  describe('authenticated user — state.from takes priority', () => {
    it('redirects to location.state.from when it is present', async () => {
      setAuthenticated();

      // A small component that captures where we ended up
      const LandingCapture = () => {
        const loc = useLocation();
        return <div>Landed at {loc.pathname}</div>;
      };

      rtlRender(
        <MemoryRouter
          initialEntries={[
            {
              pathname: '/login',
              state: { from: '/decks' },
            },
          ]}
        >
          <Routes>
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <ChildContent />
                </PublicRoute>
              }
            />
            <Route path="/decks" element={<LandingCapture />} />
            <Route path="/dashboard" element={<DashboardPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Landed at /decks')).toBeInTheDocument();
        expect(screen.queryByText('Dashboard Page')).not.toBeInTheDocument();
      });
    });
  });

  describe('authenticated user — custom redirectTo prop', () => {
    it('redirects to redirectTo when state.from is absent', async () => {
      setAuthenticated();

      rtlRender(
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route
              path="/login"
              element={
                <PublicRoute redirectTo="/custom">
                  <ChildContent />
                </PublicRoute>
              }
            />
            <Route path="/custom" element={<CustomPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Custom Redirect Page')).toBeInTheDocument();
        expect(screen.queryByText('Dashboard Page')).not.toBeInTheDocument();
      });
    });
  });

  describe('children vs Outlet branch', () => {
    it('prefers children over Outlet when both are technically present', async () => {
      // When children is passed, the component returns <>{children}</>
      // and never renders an <Outlet>, even inside a parent route.
      rtlRender(
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <ChildContent />
                </PublicRoute>
              }
            >
              {/* This nested route would render via Outlet if Outlet was used */}
              <Route index element={<OutletContent />} />
            </Route>
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Child Content')).toBeInTheDocument();
        expect(screen.queryByText('Outlet Content')).not.toBeInTheDocument();
      });
    });
  });
});
