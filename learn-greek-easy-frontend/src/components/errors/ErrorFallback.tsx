import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

/**
 * Props for the ErrorFallback component
 */
export interface ErrorFallbackProps {
  /** The error that was caught */
  error: Error | null;
  /** Callback to reset the error boundary */
  onReset?: () => void;
}

/**
 * ErrorFallback component displays a user-friendly error message
 * when an error boundary catches an error
 *
 * @example
 * ```tsx
 * <ErrorFallback
 *   error={new Error('Something went wrong')}
 *   onReset={() => window.location.reload()}
 * />
 * ```
 */
export function ErrorFallback({ error, onReset }: ErrorFallbackProps) {
  const navigate = useNavigate();

  const handleGoHome = () => {
    navigate('/');
    onReset?.();
  };

  const handleTryAgain = () => {
    onReset?.();
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-8">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-4 h-16 w-16 text-red-500" aria-hidden="true" />
          <h1 className="mb-2 text-2xl font-bold text-gray-900">Something went wrong</h1>
          <p className="text-muted-foreground">
            We're sorry, but something unexpected happened. Please try again.
          </p>
        </div>

        {/* Show error details in development mode */}
        {error && import.meta.env.DEV && (
          <Alert variant="destructive">
            <AlertDescription className="max-h-48 overflow-auto font-mono text-xs">
              <strong>Error:</strong> {error.message}
              {error.stack && (
                <>
                  <br />
                  <br />
                  <strong>Stack:</strong>
                  <pre className="mt-2 whitespace-pre-wrap text-xs">{error.stack}</pre>
                </>
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex gap-3">
          <Button onClick={handleTryAgain} variant="outline" className="flex-1">
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
          <Button onClick={handleGoHome} className="flex-1">
            <Home className="mr-2 h-4 w-4" />
            Go Home
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          If this problem persists, please contact support.
        </p>
      </div>
    </div>
  );
}
