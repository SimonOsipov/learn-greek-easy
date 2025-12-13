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
 *
 * Uses Zustand's built-in persist API (hasHydrated/onFinishHydration) to
 * track hydration state without circular reference issues.
 */
export const RouteGuard: React.FC<RouteGuardProps> = ({ children }) => {
  const { checkAuth } = useAuthStore();
  const [isChecking, setIsChecking] = useState(true);
  // In test mode (no persist middleware), useAuthStore.persist is undefined
  // Default to true since there's no hydration needed without persist
  const [hasHydrated, setHasHydrated] = useState(useAuthStore.persist?.hasHydrated?.() ?? true);

  useEffect(() => {
    // Subscribe to hydration completion if persist middleware is available
    // In test mode, this is a no-op since persist is undefined
    const unsubFinishHydration = useAuthStore.persist?.onFinishHydration?.(() => {
      setHasHydrated(true);
    });

    return () => {
      unsubFinishHydration?.();
    };
  }, []);

  useEffect(() => {
    // Wait for Zustand persist middleware to hydrate before checking auth
    // In test mode, hasHydrated is true immediately (no persist middleware)
    // In dev/prod, hasHydrated becomes true after onFinishHydration fires
    if (!hasHydrated) {
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
  }, [checkAuth, hasHydrated]);

  // Show loading spinner while waiting for hydration or auth check
  if (!hasHydrated || isChecking) {
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
