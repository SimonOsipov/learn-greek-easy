/**
 * Protected Route Integration Tests
 * Tests route protection, authentication checks, and redirects
 */

import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, beforeEach } from 'vitest';

import { render as rtlRender, screen, waitFor } from '@testing-library/react';
import { useAuthStore } from '@/stores/authStore';

import { ProtectedRoute } from '../ProtectedRoute';

// Mock components for testing
const DashboardMock = () => <div>Dashboard Content</div>;
const LoginMock = () => <div>Login Page</div>;
const UnauthorizedMock = () => <div>Unauthorized Page</div>;

describe('Protected Route Integration Tests', () => {
  beforeEach(() => {
    // Reset auth store
    useAuthStore.getState().logout();
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
      // Login user first
      const authStore = useAuthStore.getState();
      await authStore.login('demo@learngreekeasy.com', 'Demo123!');

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
      // Login user
      await useAuthStore.getState().login('demo@learngreekeasy.com', 'Demo123!');

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
      await useAuthStore.getState().login('demo@learngreekeasy.com', 'Demo123!');

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
      // Login as user with 'free' role
      await useAuthStore.getState().login('demo@learngreekeasy.com', 'Demo123!');

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
      // Login as free user
      await useAuthStore.getState().login('demo@learngreekeasy.com', 'Demo123!');

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
      // Login first
      await useAuthStore.getState().login('demo@learngreekeasy.com', 'Demo123!');

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

    it('should verify localStorage is cleared on logout', async () => {
      // Login
      await useAuthStore.getState().login('demo@learngreekeasy.com', 'Demo123!');

      // Verify auth data in localStorage
      let authStorage = localStorage.getItem('auth-storage');
      expect(authStorage).toBeTruthy();

      // Logout
      await useAuthStore.getState().logout();

      // Check localStorage is updated
      authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        const parsed = JSON.parse(authStorage);
        expect(parsed.state.isAuthenticated).toBe(false);
        expect(parsed.state.user).toBeNull();
        expect(parsed.state.token).toBeNull();
      }
    });
  });

  describe('Nested Routes', () => {
    it('should render Outlet for nested routes when authenticated', async () => {
      await useAuthStore.getState().login('demo@learngreekeasy.com', 'Demo123!');

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
