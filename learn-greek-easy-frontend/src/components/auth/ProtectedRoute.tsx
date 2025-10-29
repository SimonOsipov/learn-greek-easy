import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Loader2 } from 'lucide-react';

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

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // Not authenticated - redirect to login with return URL
  if (!isAuthenticated) {
    return (
      <Navigate
        to={redirectTo}
        state={{ from: location.pathname + location.search }}
        replace
      />
    );
  }

  // Check role requirements
  if (requiredRole) {
    const hasRequiredRole =
      user?.role === requiredRole ||
      user?.role === 'admin' ||
      (requiredRole === 'premium' && user?.role === 'premium');

    if (!hasRequiredRole) {
      return (
        <Navigate
          to="/unauthorized"
          state={{ requiredRole, from: location.pathname }}
          replace
        />
      );
    }
  }

  // Render children or outlet for nested routes
  return children ? <>{children}</> : <Outlet />;
};
