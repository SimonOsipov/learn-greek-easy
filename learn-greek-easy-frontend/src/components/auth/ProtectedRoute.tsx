import { Loader2 } from 'lucide-react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuthStore } from '@/stores/authStore';

interface ProtectedRouteProps {
  requiredRole?: 'free' | 'premium' | 'admin';
  redirectTo?: string;
  children?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  requiredRole,
  redirectTo = '/login',
  children,
}) => {
  const location = useLocation();
  const { isAuthenticated, user, isLoading } = useAuthStore();

  // TODO: Remove after debugging
  const timestamp = new Date().toISOString();

  // Show loading state while checking auth
  if (isLoading) {
    // TODO: Remove after debugging
    console.log(
      `[E2E-DEBUG][ProtectedRoute][${timestamp}] RENDER_LOADING | path=${location.pathname} | isLoading=true | isAuthenticated=${isAuthenticated}`
    );
    return (
      <div className="bg-background flex min-h-screen items-center justify-center">
        <div className="space-y-4 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // Not authenticated - redirect to login with return URL
  if (!isAuthenticated) {
    // TODO: Remove after debugging
    console.log(
      `[E2E-DEBUG][ProtectedRoute][${timestamp}] RENDER_REDIRECT | path=${location.pathname} | isLoading=${isLoading} | isAuthenticated=false | redirectTo=${redirectTo}`
    );
    return (
      <Navigate to={redirectTo} state={{ from: location.pathname + location.search }} replace />
    );
  }

  // TODO: Remove after debugging
  console.log(
    `[E2E-DEBUG][ProtectedRoute][${timestamp}] RENDER_ALLOW | path=${location.pathname} | isLoading=${isLoading} | isAuthenticated=true | userId=${user?.id}`
  );

  // Check role requirements
  if (requiredRole) {
    const hasRequiredRole =
      user?.role === requiredRole ||
      user?.role === 'admin' ||
      (requiredRole === 'premium' && user?.role === 'premium');

    if (!hasRequiredRole) {
      return (
        <Navigate to="/unauthorized" state={{ requiredRole, from: location.pathname }} replace />
      );
    }
  }

  // Render children or outlet for nested routes
  return children ? <>{children}</> : <Outlet />;
};
