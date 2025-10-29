import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { Loader2 } from 'lucide-react';

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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Learn Greek Easy</h2>
            <p className="text-sm text-muted-foreground mt-1">Loading your experience...</p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
