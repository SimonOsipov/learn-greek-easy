import { useEffect, type ReactNode } from 'react';

import { useNavigate } from 'react-router-dom';

import { PageLoader } from '@/components/feedback';
import { useAuthStore } from '@/stores/authStore';

interface LandingRouteProps {
  children: ReactNode;
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
 *
 * Usage:
 * <Route path="/" element={<LandingRoute><LandingPage /></LandingRoute>} />
 */
export const LandingRoute = ({ children }: LandingRouteProps) => {
  const { isAuthenticated, isLoading } = useAuthStore();
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
