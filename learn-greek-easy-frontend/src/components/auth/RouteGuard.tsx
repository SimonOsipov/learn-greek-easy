import { useEffect, useRef, useState } from 'react';

import { Loader2 } from 'lucide-react';

import { APP_NAME } from '@/lib/constants';
import { getSupabase } from '@/lib/supabaseClient';
import { useAppStore } from '@/stores/appStore';
import { useAuthStore, selectHasPersistedSession } from '@/stores/authStore';

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
          <h2 className="text-lg font-semibold">{APP_NAME}</h2>
          <p className="mt-1 text-sm text-muted-foreground">Loading your experience...</p>
        </div>
      </div>
    </div>
  );
}

/**
 * RouteGuard component that verifies authentication on app load
 * using Supabase's onAuthStateChange listener.
 *
 * Subscribes to auth state changes and calls checkAuth() to sync
 * the Zustand auth store with the current Supabase session.
 * Shows a loading screen until the initial auth check completes.
 */
export const RouteGuard: React.FC<RouteGuardProps> = ({ children }) => {
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const setAuthInitialized = useAppStore((state) => state.setAuthInitialized);
  const [isInitializing, setIsInitializing] = useState(
    () => !selectHasPersistedSession(useAuthStore.getState())
  );
  const hasInitializedRef = useRef(false);
  const initialSessionHandledRef = useRef(false);

  useEffect(() => {
    const abortController = new AbortController();

    const handleAuthEvent = async () => {
      try {
        await checkAuth({ signal: abortController.signal });
      } catch {
        // Auth check failed - non-critical, user proceeds as unauthenticated
      } finally {
        if (!abortController.signal.aborted && !hasInitializedRef.current) {
          hasInitializedRef.current = true;
          setIsInitializing(false);
          setAuthInitialized();
        }
      }
    };

    // Subscribe to Supabase auth state changes.
    // The callback fires immediately with INITIAL_SESSION, then on
    // SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, USER_UPDATED events.
    let cancelled = false;
    let subscription: { unsubscribe: () => void } | undefined;
    getSupabase().then((supabase) => {
      if (cancelled) return;
      const { data } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'INITIAL_SESSION') {
          // Initial session check on mount
          initialSessionHandledRef.current = true;
          handleAuthEvent();
        } else if (event === 'SIGNED_IN') {
          // Skip the redundant SIGNED_IN that Supabase fires right after
          // INITIAL_SESSION for already-authenticated users. Only react to
          // SIGNED_IN when the user was not yet authenticated (actual login).
          const { isAuthenticated } = useAuthStore.getState();
          if (!initialSessionHandledRef.current || !isAuthenticated) {
            handleAuthEvent();
          }
        } else if (event === 'USER_UPDATED') {
          handleAuthEvent();
        } else if (event === 'SIGNED_OUT') {
          // User signed out - clear auth state
          useAuthStore.setState({
            user: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      });
      subscription = data.subscription;
    });

    return () => {
      cancelled = true;
      abortController.abort();
      subscription?.unsubscribe();
    };
  }, [checkAuth, setAuthInitialized]);

  if (isInitializing) {
    return <AuthLoadingScreen />;
  }

  return <>{children}</>;
};
