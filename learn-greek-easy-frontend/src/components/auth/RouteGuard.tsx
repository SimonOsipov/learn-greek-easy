import { useEffect, useState, useSyncExternalStore } from 'react';

import { Loader2 } from 'lucide-react';

import { useAuthStore } from '@/stores/authStore';

interface RouteGuardProps {
  children: React.ReactNode;
}

/**
 * Subscribe to Zustand persist hydration state changes.
 * Uses onFinishHydration callback which fires when hydration completes.
 *
 * @param callback - Function to call when hydration state changes
 * @returns Cleanup function to unsubscribe
 */
function subscribeToHydration(callback: () => void): () => void {
  // Subscribe to hydration completion if persist middleware is available
  // In test mode (no persist middleware), this returns undefined
  const unsub = useAuthStore.persist?.onFinishHydration?.(callback);
  return () => unsub?.();
}

/**
 * Get current hydration state snapshot.
 * Returns true if already hydrated or if persist middleware is not present.
 */
function getHydrationSnapshot(): boolean {
  return useAuthStore.persist?.hasHydrated?.() ?? true;
}

/**
 * Server-side rendering fallback - always return true since there's no
 * localStorage to hydrate from on the server.
 */
function getServerHydrationSnapshot(): boolean {
  return true;
}

/**
 * RouteGuard waits for store hydration before checking authentication.
 *
 * This prevents a race condition where checkAuth() runs before Zustand's
 * persist middleware has hydrated state from localStorage, which would
 * cause authenticated users to be incorrectly redirected to login.
 *
 * Uses useSyncExternalStore (React 18+) to properly track hydration state
 * without timing issues that can occur with useState + useEffect patterns.
 */
export const RouteGuard: React.FC<RouteGuardProps> = ({ children }) => {
  const { checkAuth } = useAuthStore();
  const [isChecking, setIsChecking] = useState(true);

  // Use useSyncExternalStore for race-condition-free hydration tracking
  // This is the React 18+ recommended pattern for subscribing to external state
  const hasHydrated = useSyncExternalStore(
    subscribeToHydration,
    getHydrationSnapshot,
    getServerHydrationSnapshot
  );

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
