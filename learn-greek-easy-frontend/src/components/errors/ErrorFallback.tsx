import { AlertCircle, RefreshCw, Home, MessageSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { getSentry, isSentryLoaded } from '@/lib/sentry-queue';

/**
 * Props for the ErrorFallback component
 */
export interface ErrorFallbackProps {
  /** The error that was caught */
  error: Error | null;
  /** Callback to reset the error boundary */
  onReset?: () => void;
  /** Sentry event ID for user feedback */
  eventId?: string;
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
export function ErrorFallback({ error, onReset, eventId }: ErrorFallbackProps) {
  const { t } = useTranslation('common');

  const handleGoHome = () => {
    window.location.href = '/';
  };

  const handleTryAgain = () => {
    onReset?.();
  };

  const handleReportIssue = () => {
    // Open Sentry's user feedback dialog if we have an eventId and Sentry is loaded
    if (eventId && isSentryLoaded()) {
      const Sentry = getSentry();
      Sentry?.showReportDialog({ eventId });
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-8">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-4 h-16 w-16 text-red-500" aria-hidden="true" />
          <h1 className="mb-2 text-2xl font-bold text-gray-900">{t('error.somethingWrong')}</h1>
          <p className="text-muted-foreground">{t('error.unexpectedError')}</p>
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

        <div className="flex flex-col gap-3">
          <div className="flex gap-3">
            <Button onClick={handleTryAgain} variant="outline" className="flex-1">
              <RefreshCw className="mr-2 h-4 w-4" />
              {t('errorPage.tryAgain')}
            </Button>
            <Button onClick={handleGoHome} className="flex-1">
              <Home className="mr-2 h-4 w-4" />
              {t('errorPage.goHome')}
            </Button>
          </div>
          {/* Show report button only in production when Sentry eventId is available and Sentry is loaded */}
          {eventId && import.meta.env.PROD && isSentryLoaded() && (
            <Button onClick={handleReportIssue} variant="secondary" className="w-full">
              <MessageSquare className="mr-2 h-4 w-4" />
              {t('error.reportIssue', 'Report Issue')}
            </Button>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground">{t('error.persistsContact')}</p>
      </div>
    </div>
  );
}
