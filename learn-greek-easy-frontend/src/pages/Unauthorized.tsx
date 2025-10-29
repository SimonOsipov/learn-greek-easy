import { useLocation, Link } from 'react-router-dom';
import { Lock, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const Unauthorized: React.FC = () => {
  const location = useLocation();
  const requiredRole = location.state?.requiredRole;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 px-4">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-yellow-100 mb-4">
          {requiredRole === 'premium' ? (
            <Crown className="h-8 w-8 text-yellow-600" />
          ) : (
            <Lock className="h-8 w-8 text-yellow-600" />
          )}
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Access Restricted
        </h1>
        <p className="text-gray-600 mb-8">
          {requiredRole === 'premium' ? (
            "This feature requires a Premium subscription. Upgrade to unlock all learning features!"
          ) : requiredRole === 'admin' ? (
            "This area is restricted to administrators only."
          ) : (
            "You don't have permission to access this page."
          )}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {requiredRole === 'premium' && (
            <Link to="/settings?tab=subscription">
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
