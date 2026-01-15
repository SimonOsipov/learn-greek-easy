import { useEffect, type ReactNode } from 'react';

import { useAuth0 } from '@auth0/auth0-react';
import { useNavigate } from 'react-router-dom';

import { PageLoader } from '@/components/feedback';
import { isAuth0Enabled } from '@/hooks/useAuth0Integration';
import { useAuthStore } from '@/stores/authStore';

interface LandingRouteProps {
  children: ReactNode;
}

/**
 * Hook to get unified auth state for LandingRoute.
 * Uses Auth0 when enabled, falls back to storage mode.
 *
 * When Auth0 is enabled, uses Auth0's isLoading state (matches RouteGuard behavior)
 * and checks both Auth0 and Zustand's isAuthenticated states.
 * This prevents the flash to login page during logout.
 */
function useLandingAuthState() {
  // Storage mode state (always available)
  const storeIsAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const storeIsLoading = useAuthStore((state) => state.isLoading);

  // When Auth0 is disabled, use storage mode only
  if (!isAuth0Enabled()) {
    return {
      isAuthenticated: storeIsAuthenticated,
      isLoading: storeIsLoading,
    };
  }

  // Auth0 mode - combine Auth0 state with Zustand store
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { isAuthenticated: auth0IsAuthenticated, isLoading: auth0IsLoading } = useAuth0();

  // For Auth0: use Auth0's isAuthenticated AND check Zustand isn't cleared
  // This handles the logout case where Zustand is cleared before Auth0 redirect
  return {
    isAuthenticated: auth0IsAuthenticated && storeIsAuthenticated !== false,
    isLoading: auth0IsLoading,
  };
}

/**
 * LandingRoute Component
 *
 * Wrapper for the landing page that handles authentication-aware redirects.
 * Authenticated users visiting the landing page are automatically redirected
 * to the dashboard.
 *
 * Features:
 * - Shows loading state while auth is being checked (prevents flash)
 * - Redirects authenticated users to /dashboard
 * - Renders landing page for unauthenticated users
 * - Uses unified auth state to prevent flash during logout
 *
 * Usage:
 * <Route path="/" element={<LandingRoute><LandingPage /></LandingRoute>} />
 */
export const LandingRoute = ({ children }: LandingRouteProps) => {
  const { isAuthenticated, isLoading } = useLandingAuthState();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  // Show loading while checking auth (prevents flash of landing page)
  if (isLoading) {
    return <PageLoader />;
  }

  // Only render children if not authenticated
  return isAuthenticated ? null : <>{children}</>;
};
