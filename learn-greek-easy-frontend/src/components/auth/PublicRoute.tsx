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
 */
export const PublicRoute: React.FC<PublicRouteProps> = ({ redirectTo, children }) => {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  // Use useEffect to handle redirect to ensure it happens after render
  // This prevents potential timing issues with state updates
  useEffect(() => {
    if (isAuthenticated) {
      const from = location.state?.from || redirectTo || '/dashboard';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, location.state?.from, redirectTo, navigate]);

  // If authenticated, show nothing while redirect is in progress
  if (isAuthenticated) {
    return null;
  }

  return children ? <>{children}</> : <Outlet />;
};
