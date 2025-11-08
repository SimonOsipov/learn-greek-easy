import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

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
    <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-gray-50">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <AlertCircle
            className="h-16 w-16 text-red-500 mx-auto mb-4"
            aria-hidden="true"
          />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Something went wrong
          </h1>
          <p className="text-muted-foreground">
            We're sorry, but something unexpected happened. Please try again.
          </p>
        </div>

        {/* Show error details in development mode */}
        {error && import.meta.env.DEV && (
          <Alert variant="destructive">
            <AlertDescription className="text-xs font-mono overflow-auto max-h-48">
              <strong>Error:</strong> {error.message}
              {error.stack && (
                <>
                  <br />
                  <br />
                  <strong>Stack:</strong>
                  <pre className="text-xs whitespace-pre-wrap mt-2">{error.stack}</pre>
                </>
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex gap-3">
          <Button
            onClick={handleTryAgain}
            variant="outline"
            className="flex-1"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
          <Button
            onClick={handleGoHome}
            className="flex-1"
          >
            <Home className="mr-2 h-4 w-4" />
            Go Home
          </Button>
        </div>

        <p className="text-xs text-center text-muted-foreground">
          If this problem persists, please contact support.
        </p>
      </div>
    </div>
  );
}
