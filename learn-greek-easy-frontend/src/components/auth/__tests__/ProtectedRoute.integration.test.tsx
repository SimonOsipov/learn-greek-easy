/**
 * Protected Route Integration Tests
 * Tests route protection, authentication checks, and redirects
 */

import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { render as rtlRender, screen, waitFor } from '@testing-library/react';
import { useAuthStore } from '@/stores/authStore';

import { ProtectedRoute } from '../ProtectedRoute';

// Mock all API services to prevent real network calls
vi.mock('@/services/authAPI', () => ({
  authAPI: {
    getProfile: vi.fn().mockResolvedValue({
      id: 'test-user-123',
      email: 'demo@learngreekeasy.com',
      full_name: 'Demo User',
      is_superuser: false,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
      settings: { daily_goal: 20, email_notifications: true },
    }),
    logout: vi.fn().mockResolvedValue(undefined),
    refresh: vi.fn().mockResolvedValue({
      access_token: 'mock-new-access-token',
      refresh_token: 'mock-new-refresh-token',
      token_type: 'bearer',
    }),
  },
  clearAuthTokens: vi.fn(),
}));

// Helper to set authenticated state directly (since login is handled by Auth0)
const setAuthenticatedUser = (email: string, role: 'free' | 'admin' = 'free') => {
  useAuthStore.setState({
    user: {
      id: 'test-user-123',
      email,
      name: 'Test User',
      role,
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
    token: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    isAuthenticated: true,
    isLoading: false,
    error: null,
    rememberMe: false,
  });
};

vi.mock('@/services/progressAPI', () => ({
  progressAPI: {
    getDashboard: vi.fn().mockResolvedValue({
      overview: { total_cards_studied: 100, total_cards_mastered: 10 },
    }),
    getTrends: vi.fn().mockResolvedValue({
      period: 'week',
      daily_stats: [],
      summary: {},
    }),
    getDeckProgressList: vi.fn().mockResolvedValue({ total: 0, page: 1, page_size: 50, decks: [] }),
  },
}));

// Mock components for testing
const DashboardMock = () => <div>Dashboard Content</div>;
const LoginMock = () => <div>Login Page</div>;
const UnauthorizedMock = () => <div>Unauthorized Page</div>;

describe('Protected Route Integration Tests', () => {
  beforeEach(() => {
    // Clear mocks
    vi.clearAllMocks();

    // Reset auth store directly (don't call logout which uses API)
    useAuthStore.setState({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      rememberMe: false,
    });

    localStorage.clear();
    sessionStorage.clear();
  });

  describe('Unauthenticated Access', () => {
    it('should redirect unauthenticated users to login page', async () => {
      rtlRender(
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route path="/login" element={<LoginMock />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardMock />
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      // Should redirect to login
      await waitFor(() => {
        expect(screen.getByText('Login Page')).toBeInTheDocument();
        expect(screen.queryByText('Dashboard Content')).not.toBeInTheDocument();
      });
    });

    it('should pass return URL when redirecting to login', async () => {
      let locationState: any = null;

      const LoginWithState = () => {
        const location = useLocation();
        locationState = location.state;
        return <div>Login Page</div>;
      };

      rtlRender(
        <MemoryRouter initialEntries={['/dashboard?tab=analytics']}>
          <Routes>
            <Route path="/login" element={<LoginWithState />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardMock />
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Login Page')).toBeInTheDocument();
      });

      // Verify return URL is passed in location state
      expect(locationState).toBeTruthy();
      expect(locationState.from).toBe('/dashboard?tab=analytics');
    });

    it('should redirect to custom redirect path when specified', async () => {
      const CustomLoginMock = () => <div>Custom Login Page</div>;

      rtlRender(
        <MemoryRouter initialEntries={['/protected']}>
          <Routes>
            <Route path="/custom-login" element={<CustomLoginMock />} />
            <Route
              path="/protected"
              element={
                <ProtectedRoute redirectTo="/custom-login">
                  <div>Protected Content</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Custom Login Page')).toBeInTheDocument();
      });
    });
  });

  describe('Authenticated Access', () => {
    it('should allow authenticated users to access protected routes', async () => {
      // Set authenticated user state directly
      setAuthenticatedUser('demo@learngreekeasy.com');

      rtlRender(
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route path="/login" element={<LoginMock />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardMock />
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      // Should render protected content
      await waitFor(() => {
        expect(screen.getByText('Dashboard Content')).toBeInTheDocument();
        expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
      });
    });

    it('should persist authentication across page refresh', async () => {
      // Set authenticated user state directly
      setAuthenticatedUser('demo@learngreekeasy.com');

      // First render
      const { unmount } = rtlRender(
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route path="/login" element={<LoginMock />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardMock />
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Dashboard Content')).toBeInTheDocument();
      });

      // Unmount to simulate page close
      unmount();

      // Re-render (simulates page reload - Zustand persist should restore state)
      rtlRender(
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route path="/login" element={<LoginMock />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardMock />
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      // Should still be authenticated
      await waitFor(() => {
        expect(screen.getByText('Dashboard Content')).toBeInTheDocument();
      });
    });

    it('should render children when authenticated', async () => {
      setAuthenticatedUser('demo@learngreekeasy.com');

      rtlRender(
        <MemoryRouter initialEntries={['/protected']}>
          <Routes>
            <Route
              path="/protected"
              element={
                <ProtectedRoute>
                  <div data-testid="protected-child">Protected Child Component</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('protected-child')).toBeInTheDocument();
        expect(screen.getByText('Protected Child Component')).toBeInTheDocument();
      });
    });
  });

  describe('Role-Based Access Control', () => {
    it('should allow users with required role to access route', async () => {
      // Set user with 'free' role
      setAuthenticatedUser('free@learngreekeasy.com', 'free');

      rtlRender(
        <MemoryRouter initialEntries={['/free-content']}>
          <Routes>
            <Route path="/unauthorized" element={<UnauthorizedMock />} />
            <Route
              path="/free-content"
              element={
                <ProtectedRoute requiredRole="free">
                  <div>Free Content</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      // Should allow access
      await waitFor(() => {
        expect(screen.getByText('Free Content')).toBeInTheDocument();
      });
    });

    it('should redirect users without required role to unauthorized page', async () => {
      // Set user with 'free' role (not 'premium')
      setAuthenticatedUser('free@learngreekeasy.com', 'free');

      rtlRender(
        <MemoryRouter initialEntries={['/premium-content']}>
          <Routes>
            <Route path="/unauthorized" element={<UnauthorizedMock />} />
            <Route
              path="/premium-content"
              element={
                <ProtectedRoute requiredRole="premium">
                  <div>Premium Content</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      // Should redirect to unauthorized
      await waitFor(() => {
        expect(screen.getByText('Unauthorized Page')).toBeInTheDocument();
        expect(screen.queryByText('Premium Content')).not.toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    it('should show loading indicator while checking authentication', async () => {
      // Set isLoading to true manually
      useAuthStore.setState({ isLoading: true });

      rtlRender(
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardMock />
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      // Should show loading state
      expect(screen.getByText(/checking authentication/i)).toBeInTheDocument();
      expect(screen.queryByText('Dashboard Content')).not.toBeInTheDocument();

      // Set loading to false
      useAuthStore.setState({ isLoading: false });

      // Should now show redirect (since not authenticated)
      await waitFor(() => {
        expect(screen.queryByText(/checking authentication/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Session Management', () => {
    it('should clear authentication and redirect when user logs out', async () => {
      // Set authenticated user state directly
      setAuthenticatedUser('demo@learngreekeasy.com');

      const { rerender } = rtlRender(
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route path="/login" element={<LoginMock />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardMock />
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      // Should show protected content
      await waitFor(() => {
        expect(screen.getByText('Dashboard Content')).toBeInTheDocument();
      });

      // Logout
      await useAuthStore.getState().logout();

      // Re-render to trigger protection check
      rerender(
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route path="/login" element={<LoginMock />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardMock />
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      // Should redirect to login
      await waitFor(() => {
        expect(screen.getByText('Login Page')).toBeInTheDocument();
        expect(screen.queryByText('Dashboard Content')).not.toBeInTheDocument();
      });
    });

    it('should verify auth state is cleared on logout', async () => {
      // Set authenticated user state directly with rememberMe enabled
      setAuthenticatedUser('demo@learngreekeasy.com');
      useAuthStore.setState({ rememberMe: true });

      // Verify user is authenticated
      await waitFor(() => {
        const authState = useAuthStore.getState();
        expect(authState.isAuthenticated).toBe(true);
        expect(authState.user).toBeTruthy();
        expect(authState.token).toBeTruthy();
      });

      // Logout
      await useAuthStore.getState().logout();

      // Check auth store state is cleared
      const authState = useAuthStore.getState();
      expect(authState.isAuthenticated).toBe(false);
      expect(authState.user).toBeNull();
      expect(authState.token).toBeNull();
    });
  });

  describe('Nested Routes', () => {
    it('should render Outlet for nested routes when authenticated', async () => {
      setAuthenticatedUser('demo@learngreekeasy.com');

      rtlRender(
        <MemoryRouter initialEntries={['/app/profile']}>
          <Routes>
            <Route path="/app" element={<ProtectedRoute />}>
              <Route path="profile" element={<div>Profile Page</div>} />
              <Route path="settings" element={<div>Settings Page</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      );

      // Should render nested route
      await waitFor(() => {
        expect(screen.getByText('Profile Page')).toBeInTheDocument();
      });
    });

    it('should protect all nested routes when parent has ProtectedRoute', async () => {
      // Not authenticated

      rtlRender(
        <MemoryRouter initialEntries={['/app/settings']}>
          <Routes>
            <Route path="/login" element={<LoginMock />} />
            <Route path="/app" element={<ProtectedRoute />}>
              <Route path="profile" element={<div>Profile Page</div>} />
              <Route path="settings" element={<div>Settings Page</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      );

      // Should redirect to login
      await waitFor(() => {
        expect(screen.getByText('Login Page')).toBeInTheDocument();
        expect(screen.queryByText('Settings Page')).not.toBeInTheDocument();
      });
    });
  });
});

// Import useLocation for testing
import { useLocation } from 'react-router-dom';
