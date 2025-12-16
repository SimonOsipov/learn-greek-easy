import { useEffect, useState } from 'react';

import { Loader2 } from 'lucide-react';

import { useAuthStore } from '@/stores/authStore';

interface RouteGuardProps {
  children: React.ReactNode;
}

export const RouteGuard: React.FC<RouteGuardProps> = ({ children }) => {
  const { checkAuth } = useAuthStore();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const verifyAuth = async () => {
      try {
        await checkAuth();
      } finally {
        setIsChecking(false);
      }
    };

    verifyAuth();
  }, [checkAuth]);

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
