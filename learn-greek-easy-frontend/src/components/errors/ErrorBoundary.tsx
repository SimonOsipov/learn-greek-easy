import { Component, type ErrorInfo, type ReactNode } from 'react';

import * as Sentry from '@sentry/react';

import log from '@/lib/logger';

import { ErrorFallback } from './ErrorFallback';

/**
 * Props for the ErrorBoundary component
 */
export interface ErrorBoundaryProps {
  /** Child components to render */
  children: ReactNode;
  /** Optional custom fallback UI to display on error */
  fallback?: ReactNode;
  /** Optional callback fired when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

/**
 * State for the ErrorBoundary component
 */
interface ErrorBoundaryState {
  /** Whether an error has been caught */
  hasError: boolean;
  /** The caught error, if any */
  error: Error | null;
  /** Sentry event ID for user feedback */
  eventId: string | null;
}

/**
 * ErrorBoundary component to catch and handle React component errors
 *
 * React Error Boundaries catch errors during rendering, in lifecycle methods,
 * and in constructors of the whole tree below them.
 *
 * @example
 * ```tsx
 * // Wrap entire app
 * <ErrorBoundary>
 *   <App />
 * </ErrorBoundary>
 *
 * // With custom fallback
 * <ErrorBoundary fallback={<div>Something went wrong</div>}>
 *   <MyComponent />
 * </ErrorBoundary>
 *
 * // With error handler
 * <ErrorBoundary onError={(error, errorInfo) => logToService(error, errorInfo)}>
 *   <MyComponent />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, eventId: null };
  }

  /**
   * Update state so the next render will show the fallback UI
   */
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, eventId: null };
  }

  /**
   * Log the error to Sentry and optionally call custom error handler
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to console in development
    if (import.meta.env.DEV) {
      log.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    // Report to Sentry with React component stack context
    Sentry.withScope((scope) => {
      // Add React-specific context
      scope.setContext('react', {
        componentStack: errorInfo.componentStack,
      });

      // Tag the error as coming from error boundary
      scope.setTag('error.boundary', 'true');
      scope.setTag('error.handled', 'true');

      // Set error level
      scope.setLevel('error');

      // Capture the exception and store eventId for user feedback
      const eventId = Sentry.captureException(error);
      this.setState({ eventId });
    });

    // Call optional error handler
    this.props.onError?.(error, errorInfo);
  }

  /**
   * Reset error state to allow retry
   */
  handleReset = () => {
    this.setState({ hasError: false, error: null, eventId: null });
  };

  render() {
    if (this.state.hasError) {
      // If custom fallback provided, use it
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Otherwise, use default ErrorFallback component with Sentry eventId
      return (
        <ErrorFallback
          error={this.state.error}
          onReset={this.handleReset}
          eventId={this.state.eventId ?? undefined}
        />
      );
    }

    // No error, render children normally
    return this.props.children;
  }
}
