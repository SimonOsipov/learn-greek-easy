import { Link } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const NotFound: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 px-4">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-4">🏛️</div>
        <h1 className="text-4xl font-bold text-gray-900 mb-2">404</h1>
        <h2 className="text-2xl font-semibold text-gray-700 mb-4">
          Ωχ! Page Not Found
        </h2>
        <p className="text-gray-600 mb-8">
          The page you're looking for seems to have wandered off to Mount Olympus.
          Let's get you back on track!
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/dashboard">
            <Button className="w-full sm:w-auto">
              <Home className="mr-2 h-4 w-4" />
              Go to Dashboard
            </Button>
          </Link>
          <Button
            variant="outline"
            onClick={() => window.history.back()}
            className="w-full sm:w-auto"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
        </div>
      </div>
    </div>
  );
};
