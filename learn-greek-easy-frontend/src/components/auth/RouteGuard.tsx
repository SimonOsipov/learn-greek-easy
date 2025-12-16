import { useEffect, useState } from 'react';

import { Loader2 } from 'lucide-react';

import { useAppStore } from '@/stores/appStore';
import { useAuthStore } from '@/stores/authStore';

interface RouteGuardProps {
  children: React.ReactNode;
}

export const RouteGuard: React.FC<RouteGuardProps> = ({ children }) => {
  const { checkAuth } = useAuthStore();
  const setAuthInitialized = useAppStore((state) => state.setAuthInitialized);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const verifyAuth = async () => {
      // TODO: Remove after debugging
      const startTime = Date.now();
      const timestamp = new Date().toISOString();
      console.log(`[E2E-DEBUG][RouteGuard][${timestamp}] verifyAuth START`);

      try {
        // TODO: Remove after debugging
        console.log(
          `[E2E-DEBUG][RouteGuard][${timestamp}] verifyAuth BEFORE_CHECK_AUTH | elapsed=${Date.now() - startTime}ms`
        );

        await checkAuth();

        // TODO: Remove after debugging
        console.log(
          `[E2E-DEBUG][RouteGuard][${timestamp}] verifyAuth AFTER_CHECK_AUTH | elapsed=${Date.now() - startTime}ms`
        );
      } finally {
        // TODO: Remove after debugging
        console.log(
          `[E2E-DEBUG][RouteGuard][${timestamp}] verifyAuth FINALLY_BLOCK | elapsed=${Date.now() - startTime}ms | settingIsChecking=false`
        );

        setIsChecking(false);
        setAuthInitialized();

        // TODO: Remove after debugging
        console.log(
          `[E2E-DEBUG][RouteGuard][${timestamp}] verifyAuth COMPLETE | elapsed=${Date.now() - startTime}ms`
        );
      }
    };

    verifyAuth();
  }, [checkAuth, setAuthInitialized]);

  if (isChecking) {
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

  return <>{children}</>;
};
