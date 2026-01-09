import { useEffect, useState } from 'react';

import { useAuth0 } from '@auth0/auth0-react';
import { Loader2 } from 'lucide-react';

import { isAuth0Enabled } from '@/hooks/useAuth0Integration';
import { useAppStore } from '@/stores/appStore';
import { useAuthStore } from '@/stores/authStore';

interface RouteGuardProps {
  children: React.ReactNode;
}

/**
 * Loading component shown while authentication is being verified.
 */
function AuthLoadingScreen() {
  return (
    <div
      data-testid="auth-loading"
      className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50"
    >
      <div className="space-y-4 text-center">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Learn Greek Easy</h2>
          <p className="mt-1 text-sm text-muted-foreground">Loading your experience...</p>
        </div>
      </div>
    </div>
  );
}

/**
 * RouteGuard for Auth0 authentication.
 * Uses Auth0's isLoading state to determine when auth is ready.
 */
function Auth0RouteGuard({ children }: RouteGuardProps) {
  const { isLoading } = useAuth0();
  const setAuthInitialized = useAppStore((state) => state.setAuthInitialized);

  useEffect(() => {
    // Mark auth as initialized when Auth0 finishes loading
    if (!isLoading) {
      setAuthInitialized();
    }
  }, [isLoading, setAuthInitialized]);

  if (isLoading) {
    return <AuthLoadingScreen />;
  }

  return <>{children}</>;
}

/**
 * RouteGuard for legacy (non-Auth0) authentication.
 * Checks auth state by calling the backend.
 */
function LegacyRouteGuard({ children }: RouteGuardProps) {
  const { checkAuth } = useAuthStore();
  const setAuthInitialized = useAppStore((state) => state.setAuthInitialized);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Create AbortController for this effect - allows cancelling pending requests on cleanup
    const abortController = new AbortController();

    const verifyAuth = async () => {
      try {
        await checkAuth({ signal: abortController.signal });
      } finally {
        // Only update state if the request wasn't aborted
        // This prevents race conditions from React StrictMode double-invocation
        if (!abortController.signal.aborted) {
          setIsChecking(false);
          setAuthInitialized();
        }
      }
    };

    verifyAuth();

    // Cleanup: abort any pending request when effect re-runs or component unmounts
    return () => {
      abortController.abort();
    };
  }, [checkAuth, setAuthInitialized]);

  if (isChecking) {
    return <AuthLoadingScreen />;
  }

  return <>{children}</>;
}

/**
 * RouteGuard component that verifies authentication on app load.
 *
 * Uses Auth0 loading state when Auth0 is enabled, otherwise
 * uses the legacy auth check which calls the backend.
 */
export const RouteGuard: React.FC<RouteGuardProps> = ({ children }) => {
  // Select the appropriate RouteGuard based on auth system
  if (isAuth0Enabled()) {
    return <Auth0RouteGuard>{children}</Auth0RouteGuard>;
  }

  return <LegacyRouteGuard>{children}</LegacyRouteGuard>;
};
