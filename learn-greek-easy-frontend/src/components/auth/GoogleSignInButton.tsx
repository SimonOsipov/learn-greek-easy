import React, { Component, useEffect, useState, type ErrorInfo, type ReactNode } from 'react';

import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import { useTranslation } from 'react-i18next';

import { useGSIScriptState } from '@/components/auth/AuthRoutesWrapper';
import log from '@/lib/logger';
import { useAuthStore } from '@/stores/authStore';

// Timeout for script loading (handles ad blockers, slow networks)
const GSI_SCRIPT_TIMEOUT_MS = 10000;

interface GoogleSignInButtonProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Error Boundary for catching GSI-specific errors
 *
 * Safari can throw errors like "undefined is not an object (evaluating 'X.contentType')"
 * when the Google Identity Services SDK is not fully initialized.
 * This boundary catches those errors and shows a graceful fallback.
 */
interface GSIErrorBoundaryState {
  hasError: boolean;
}

class GSIErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  GSIErrorBoundaryState
> {
  constructor(props: { children: ReactNode; fallback: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): GSIErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log the error but don't report to Sentry (filtered in instrument.ts)
    log.warn('[GSI] Error boundary caught GSI error:', {
      message: error.message,
      componentStack: errorInfo.componentStack,
    });
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

/**
 * Google Sign-In Button Component
 *
 * Uses the @react-oauth/google library to handle Google OAuth flow.
 * The GoogleLogin component provides the ID token (credential) directly,
 * which is then verified by the backend against Google's public keys.
 *
 * This component handles Safari's GSI initialization race condition by:
 * 1. Waiting for script ready state from AuthRoutesWrapper context
 * 2. Wrapping GoogleLogin in an error boundary for graceful degradation
 * 3. Showing loading state while script initializes
 * 4. Showing fallback UI if script fails to load (ad blockers, network issues)
 */
export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  onSuccess,
  onError,
  disabled = false,
  className = '',
}) => {
  // Hooks must be called unconditionally (React Rules of Hooks)
  const { t } = useTranslation('auth');
  const { loginWithGoogle, isLoading } = useAuthStore();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Get script loading state from context
  const { isScriptReady, hasScriptError } = useGSIScriptState();

  // Track timeout for script loading
  const [hasTimedOut, setHasTimedOut] = useState(false);

  // Set timeout for script loading (handles ad blockers, slow networks)
  useEffect(() => {
    // Only start timeout if script is not ready and hasn't errored
    if (isScriptReady || hasScriptError) {
      return;
    }

    const timeoutId = setTimeout(() => {
      if (!isScriptReady && !hasScriptError) {
        log.warn('[GSI] Script loading timed out after', GSI_SCRIPT_TIMEOUT_MS, 'ms');
        setHasTimedOut(true);
      }
    }, GSI_SCRIPT_TIMEOUT_MS);

    return () => clearTimeout(timeoutId);
  }, [isScriptReady, hasScriptError]);

  // Check if Google OAuth is configured via environment variable
  // If not configured, don't render - the button would be non-functional anyway
  const isGoogleOAuthConfigured = !!import.meta.env.VITE_GOOGLE_CLIENT_ID;

  // Early return after hooks - safe because hooks are already called unconditionally above
  if (!isGoogleOAuthConfigured) {
    return null;
  }

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) {
      onError?.('No credential received from Google. Please try again.');
      return;
    }

    setIsGoogleLoading(true);
    try {
      // The credential is the Google ID token (JWT)
      // This is what our backend expects to verify
      await loginWithGoogle(credentialResponse.credential);
      onSuccess?.();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Google sign-in failed. Please try again.';
      onError?.(errorMessage);
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleGoogleError = () => {
    log.warn('[GSI] Google OAuth error occurred');
    onError?.('Google sign-in was cancelled or failed. Please try again.');
  };

  const isButtonDisabled = disabled || isLoading || isGoogleLoading;

  // Determine if we should show the fallback (script failed or timed out)
  const showFallback = hasScriptError || hasTimedOut;

  // When disabled or loading, show custom disabled button
  if (isButtonDisabled) {
    return (
      <div className={`w-full ${className}`}>
        <button
          type="button"
          disabled
          className="flex w-full items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-muted-foreground opacity-50"
          data-testid="google-signin-button"
        >
          {isGoogleLoading ? (
            <>
              <LoadingSpinner />
              {t('oauth.signingIn')}
            </>
          ) : (
            <>
              <GoogleIcon />
              {t('oauth.google')}
            </>
          )}
        </button>
      </div>
    );
  }

  // Show loading state while script is loading (before ready or error)
  if (!isScriptReady && !showFallback) {
    return (
      <div className={`w-full ${className}`} data-testid="google-signin-button">
        <button
          type="button"
          disabled
          className="flex w-full items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-muted-foreground opacity-50"
          aria-label={t('oauth.loading')}
        >
          <LoadingSpinner />
          {t('oauth.loading')}
        </button>
      </div>
    );
  }

  // Show fallback if script failed to load or timed out
  if (showFallback) {
    return (
      <div className={`w-full ${className}`} data-testid="google-signin-button">
        <button
          type="button"
          disabled
          className="flex w-full items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-muted-foreground opacity-50"
          title={t('oauth.unavailable')}
        >
          <GoogleIcon />
          {t('oauth.unavailable')}
        </button>
      </div>
    );
  }

  // Render the actual Google Login button wrapped in error boundary
  return (
    <div className={`w-full ${className}`} data-testid="google-signin-button">
      <GSIErrorBoundary
        fallback={
          <button
            type="button"
            disabled
            className="flex w-full items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-muted-foreground opacity-50"
            title={t('oauth.unavailable')}
          >
            <GoogleIcon />
            {t('oauth.unavailable')}
          </button>
        }
      >
        <GoogleLogin
          onSuccess={handleGoogleSuccess}
          onError={handleGoogleError}
          theme="outline"
          size="large"
          width="100%"
          text="continue_with"
          shape="rectangular"
        />
      </GSIErrorBoundary>
    </div>
  );
};

// Loading spinner component
const LoadingSpinner = () => (
  <svg
    className="mr-2 h-4 w-4 animate-spin"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    ></circle>
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    ></path>
  </svg>
);

// Google icon component for disabled state and fallback
const GoogleIcon = () => (
  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);

export default GoogleSignInButton;
