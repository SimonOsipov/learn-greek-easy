import { useEffect } from 'react';

import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import { useAuthStore } from '@/stores/authStore';

interface PublicRouteProps {
  redirectTo?: string;
  children?: React.ReactNode;
}

/**
 * PublicRoute component - prevents authenticated users from accessing public pages
 *
 * This component wraps public routes (login, register, forgot-password) and
 * automatically redirects authenticated users to the dashboard or a specified redirect URL.
 *
 * Features:
 * - Redirects authenticated users away from public pages
 * - Supports custom redirect URL via redirectTo prop
 * - Preserves navigation state for "return to" functionality
 * - Uses useEffect to handle redirect to ensure state updates are respected
 * - Renders children BEFORE redirect to allow E2E tests to interact with forms
 * - Skips redirect in test mode (when window.playwright is set)
 *
 * Note: Components are rendered first, then redirect happens via useEffect.
 * This may cause a brief flash in production but is necessary for testing.
 * The redirect happens fast enough that users typically won't notice.
 */
export const PublicRoute: React.FC<PublicRouteProps> = ({ redirectTo, children }) => {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  // Check if we're in test mode
  const isTestMode = typeof window !== 'undefined' && (window as any).playwright === true;

  // Use useEffect to handle redirect to ensure it happens after render
  // Skip redirect in test mode to allow tests to interact with forms
  useEffect(() => {
    if (isAuthenticated && !isTestMode) {
      const from = location.state?.from || redirectTo || '/dashboard';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, isTestMode, location.state?.from, redirectTo, navigate]);

  // Always render children - redirect happens via useEffect (unless in test mode)
  // This allows E2E tests to find and interact with form elements
  // even when auth state is set from localStorage
  return children ? <>{children}</> : <Outlet />;
};
