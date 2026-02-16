import React, { useEffect, useRef, useState } from 'react';

import posthog from 'posthog-js';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';

import { AuthLayout } from '@/components/auth/AuthLayout';
import { PageLoader } from '@/components/feedback';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import log from '@/lib/logger';
import { useAuthStore } from '@/stores/authStore';

/** Timeout for waiting for Supabase to process OAuth tokens (ms) */
const AUTH_TIMEOUT_MS = 10000;

/**
 * Supabase OAuth Callback Component
 *
 * Handles the OAuth redirect from Supabase after Google authentication.
 * Supabase client automatically detects tokens in the URL hash fragment
 * and establishes a session. RouteGuard's onAuthStateChange listener
 * then calls checkAuth() to sync the auth store.
 *
 * This component:
 * 1. Checks for error params in the URL hash
 * 2. Waits for auth store to become authenticated
 * 3. Navigates to dashboard on success
 * 4. Shows error UI on failure or timeout
 */
export const Callback: React.FC = () => {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [error, setError] = useState<string | null>(null);
  const hasNavigated = useRef(false);

  // Check for OAuth error params in URL hash on mount
  useEffect(() => {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const errorParam = params.get('error');
    const errorDescription = params.get('error_description');

    if (errorParam) {
      log.error('[Callback] OAuth error:', errorParam, errorDescription);
      setError(errorDescription || errorParam);
    }
  }, []);

  // Navigate to dashboard when authenticated
  useEffect(() => {
    if (isAuthenticated && !error && !hasNavigated.current) {
      hasNavigated.current = true;

      // Track OAuth login in PostHog
      const user = useAuthStore.getState().user;
      if (user && typeof posthog?.identify === 'function') {
        posthog.identify(user.id, {
          email: user.email,
          created_at: user.createdAt.toISOString(),
        });
      }
      if (typeof posthog?.capture === 'function') {
        posthog.capture('user_logged_in', { method: 'oauth_google' });
      }

      log.info('[Callback] Successfully authenticated via OAuth');
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, error, navigate]);

  // Timeout - show error if auth doesn't complete within threshold
  useEffect(() => {
    if (error) return;

    const timer = setTimeout(() => {
      if (!useAuthStore.getState().isAuthenticated && !hasNavigated.current) {
        log.error('[Callback] Authentication timed out');
        setError(t('callback.error.timeout', 'Authentication timed out. Please try again.'));
      }
    }, AUTH_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [error, t]);

  // Show error state
  if (error) {
    return (
      <AuthLayout>
        <Card className="shadow-xl" data-testid="callback-error-card">
          <CardHeader className="space-y-1 text-center">
            <div className="mb-4">
              <span className="text-4xl">⚠️</span>
            </div>
            <CardTitle className="text-2xl font-bold text-red-600">
              {t('callback.error.title', 'Authentication Failed')}
            </CardTitle>
            <CardDescription>
              {t('callback.error.description', 'We could not complete your sign-in.')}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div
              className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600"
              role="alert"
            >
              {error}
            </div>
          </CardContent>

          <CardFooter className="flex flex-col space-y-4">
            <Button asChild className="w-full" variant="default">
              <Link to="/login">{t('callback.error.backToLogin', 'Back to Login')}</Link>
            </Button>
          </CardFooter>
        </Card>
      </AuthLayout>
    );
  }

  // Show loading while waiting for auth
  return <PageLoader />;
};
