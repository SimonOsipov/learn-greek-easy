import { Component, type ReactNode, type ErrorInfo } from 'react';

import { RefreshCw, WifiOff } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import log from '@/lib/logger';
import { getFrontendVersion } from '@/lib/versionCheck';

interface ChunkErrorBoundaryProps {
  children: ReactNode;
  /** Name of the chunk/route for error messages */
  chunkName?: string;
  /** Maximum number of retry attempts */
  maxRetries?: number;
  /** Callback when all retries exhausted */
  onMaxRetriesExceeded?: () => void;
}

interface ChunkErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
  isRetrying: boolean;
  isChunkError: boolean;
}

/**
 * ChunkErrorBoundary - Specialized error boundary for lazy-loaded chunks
 *
 * Handles ChunkLoadError and similar dynamic import failures with:
 * - Automatic retry with exponential backoff
 * - User-friendly error message
 * - Manual retry button
 * - Version mismatch detection (stale deployment)
 *
 * @example
 * ```tsx
 * <ChunkErrorBoundary>
 *   <Suspense fallback={<PageLoader />}>
 *     <Routes>...</Routes>
 *   </Suspense>
 * </ChunkErrorBoundary>
 * ```
 */
export class ChunkErrorBoundary extends Component<
  ChunkErrorBoundaryProps,
  ChunkErrorBoundaryState
> {
  static defaultProps = {
    maxRetries: 3,
  };

  constructor(props: ChunkErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      retryCount: 0,
      isRetrying: false,
      isChunkError: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ChunkErrorBoundaryState> {
    // Determine if this is a chunk loading error
    const message = error.message.toLowerCase();
    const isChunkError =
      message.includes('loading chunk') ||
      message.includes('dynamically imported module') ||
      message.includes('failed to fetch') ||
      error.name === 'ChunkLoadError';

    return { hasError: true, error, isChunkError };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const isChunkError = this.isChunkLoadError(error);
    const isVersionMismatch = this.isVersionMismatch(error);

    log.error('ChunkErrorBoundary caught error:', {
      error: error.message,
      isChunkError,
      isVersionMismatch,
      frontendVersion: getFrontendVersion(),
      componentStack: errorInfo.componentStack,
      chunkName: this.props.chunkName,
    });

    // Auto-retry for chunk errors if under max retries
    if (isChunkError && this.state.retryCount < (this.props.maxRetries ?? 3)) {
      this.scheduleRetry();
    }
  }

  /**
   * Check if error is a chunk loading error
   */
  isChunkLoadError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return (
      message.includes('loading chunk') ||
      message.includes('dynamically imported module') ||
      message.includes('failed to fetch') ||
      error.name === 'ChunkLoadError'
    );
  }

  /**
   * Check if error is due to version mismatch (stale deployment)
   */
  isVersionMismatch(error: Error): boolean {
    const message = error.message.toLowerCase();
    return (
      message.includes('unexpected token') ||
      message.includes('is not valid json') ||
      message.includes('mime type')
    );
  }

  /**
   * Schedule auto-retry with exponential backoff
   */
  scheduleRetry = () => {
    const backoffMs = Math.min(1000 * Math.pow(2, this.state.retryCount), 10000);

    this.setState({ isRetrying: true });

    setTimeout(() => {
      this.handleRetry();
    }, backoffMs);
  };

  /**
   * Handle retry attempt
   */
  handleRetry = () => {
    this.setState((prevState) => ({
      hasError: false,
      error: null,
      retryCount: prevState.retryCount + 1,
      isRetrying: false,
    }));
  };

  /**
   * Force reload the page (for version mismatch scenarios)
   */
  handleHardRefresh = () => {
    // Clear cache and reload
    if ('caches' in window) {
      caches.keys().then((names) => {
        names.forEach((name) => caches.delete(name));
      });
    }
    window.location.reload();
  };

  render() {
    const { hasError, error, retryCount, isRetrying, isChunkError } = this.state;
    const { children, maxRetries = 3 } = this.props;

    if (!hasError) {
      return children;
    }

    // If this is NOT a chunk error and NOT a version mismatch, re-throw
    // to let the parent ErrorBoundary handle it appropriately
    if (!isChunkError && !this.isVersionMismatch(error!)) {
      throw error;
    }

    const isVersionMismatch = error && this.isVersionMismatch(error);
    const retriesExhausted = retryCount >= maxRetries;

    if (isRetrying) {
      return (
        <div className="flex min-h-[200px] items-center justify-center">
          <div className="text-center">
            <RefreshCw className="mx-auto h-6 w-6 animate-spin text-primary" />
            <p className="mt-2 text-sm text-muted-foreground">
              Retrying... (attempt {retryCount + 1} of {maxRetries})
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex min-h-[300px] items-center justify-center p-8">
        <Alert variant="destructive" className="max-w-md">
          <WifiOff className="h-4 w-4" />
          <AlertTitle>{isVersionMismatch ? 'App Updated' : 'Failed to Load'}</AlertTitle>
          <AlertDescription className="mt-2 space-y-4">
            {isVersionMismatch ? (
              <p>A new version of the app is available. Please refresh to continue.</p>
            ) : (
              <p>
                {retriesExhausted
                  ? 'Unable to load this page after multiple attempts. Please check your connection and try again.'
                  : 'There was a problem loading this page. This might be a temporary network issue.'}
              </p>
            )}

            <div className="flex gap-2">
              {isVersionMismatch ? (
                <Button onClick={this.handleHardRefresh} size="sm">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh App
                </Button>
              ) : (
                <>
                  <Button onClick={this.handleRetry} size="sm" disabled={retriesExhausted}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Try Again
                  </Button>
                  {retriesExhausted && (
                    <Button onClick={this.handleHardRefresh} variant="outline" size="sm">
                      Refresh Page
                    </Button>
                  )}
                </>
              )}
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }
}
