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
 *
 * Note: With storageState pattern, auth state is loaded BEFORE React renders,
 * so isAuthenticated will be correct on first render.
 */
export const PublicRoute: React.FC<PublicRouteProps> = ({ redirectTo, children }) => {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  // Redirect authenticated users away from public pages
  useEffect(() => {
    if (isAuthenticated) {
      const from = location.state?.from || redirectTo || '/';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, location.state?.from, redirectTo, navigate]);

  // Render children (or Outlet for nested routes)
  return children ? <>{children}</> : <Outlet />;
};
