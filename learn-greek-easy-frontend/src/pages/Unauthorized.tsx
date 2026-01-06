import { Lock, Crown } from 'lucide-react';
import { useLocation, Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';

export const Unauthorized: React.FC = () => {
  const location = useLocation();
  const requiredRole = location.state?.requiredRole;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 px-4">
      <div className="max-w-md text-center">
        <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100">
          {requiredRole === 'premium' ? (
            <Crown className="h-8 w-8 text-yellow-600" />
          ) : (
            <Lock className="h-8 w-8 text-yellow-600" />
          )}
        </div>
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Access Restricted</h1>
        <p className="mb-8 text-gray-600">
          {requiredRole === 'premium'
            ? 'This feature requires a Premium subscription. Upgrade to unlock all learning features!'
            : requiredRole === 'admin'
              ? 'This area is restricted to administrators only.'
              : "You don't have permission to access this page."}
        </p>
        <div className="flex flex-col justify-center gap-4 sm:flex-row">
          {requiredRole === 'premium' && (
            <Link to="/profile">
              <Button className="w-full sm:w-auto">
                <Crown className="mr-2 h-4 w-4" />
                Upgrade to Premium
              </Button>
            </Link>
          )}
          <Link to="/dashboard">
            <Button variant="outline" className="w-full sm:w-auto">
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};
