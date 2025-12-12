import { useEffect, useState } from 'react';

import { Loader2 } from 'lucide-react';

import { useAuthStore } from '@/stores/authStore';

interface RouteGuardProps {
  children: React.ReactNode;
}

/**
 * RouteGuard waits for store hydration before checking authentication.
 *
 * This prevents a race condition where checkAuth() runs before Zustand's
 * persist middleware has hydrated state from localStorage, which would
 * cause authenticated users to be incorrectly redirected to login.
 */
export const RouteGuard: React.FC<RouteGuardProps> = ({ children }) => {
  const { checkAuth, _hasHydrated } = useAuthStore();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Wait for Zustand persist middleware to hydrate before checking auth
    // In test mode, _hasHydrated is true immediately (no persist middleware)
    // In dev/prod, _hasHydrated becomes true after onRehydrateStorage callback
    if (!_hasHydrated) {
      return;
    }

    const verifyAuth = async () => {
      try {
        await checkAuth();
      } finally {
        setIsChecking(false);
      }
    };

    verifyAuth();
  }, [checkAuth, _hasHydrated]);

  // Show loading spinner while waiting for hydration or auth check
  if (!_hasHydrated || isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
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

  return <>{children}</>;
};
