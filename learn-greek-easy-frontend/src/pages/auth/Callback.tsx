import React, { useEffect, useState } from 'react';

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
import { determineUserRole } from '@/hooks/useAuth0Integration';
import log from '@/lib/logger';
import { useAuthStore } from '@/stores/authStore';
import type { User } from '@/types/auth';

/**
 * Auth0 OAuth Callback Component
 *
 * Handles the OAuth redirect from Auth0 after Google authentication.
 * Parses the URL hash fragment to extract tokens, exchanges them with
 * the backend, and stores the session.
 */
export const Callback: React.FC = () => {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const processCallback = async () => {
      try {
        // Parse the URL hash fragment
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);

        const accessToken = params.get('access_token');
        const idToken = params.get('id_token');
        const errorParam = params.get('error');
        const errorDescription = params.get('error_description');
        const state = params.get('state');

        // Handle Auth0 error response
        if (errorParam) {
          log.error('[Callback] Auth0 error:', errorParam, errorDescription);
          setError(errorDescription || errorParam);
          setIsProcessing(false);
          return;
        }

        // Validate required tokens
        if (!accessToken) {
          log.error('[Callback] No access token in callback URL');
          setError('No access token received from authentication provider');
          setIsProcessing(false);
          return;
        }

        log.info('[Callback] Processing OAuth callback with access token');

        // Exchange Auth0 tokens for app tokens via backend
        // Send both access_token and id_token - the id_token contains email/profile claims
        const apiUrl = import.meta.env.VITE_API_URL || '';
        const response = await fetch(`${apiUrl}/api/v1/auth/auth0`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            access_token: accessToken,
            id_token: idToken,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMessage =
            errorData.detail ||
            errorData.error?.message ||
            'Authentication failed. Please try again.';
          log.error('[Callback] Backend auth0 endpoint error:', errorMessage);
          throw new Error(errorMessage);
        }

        const data = await response.json();

        // Transform backend response to frontend User type
        // Extract Auth0 roles from backend response if available (may be forwarded from token)
        const auth0Roles = (data.user?.auth0_roles as string[]) || [];

        const user: User = {
          id: data.user?.id || '',
          email: data.user?.email || '',
          name: data.user?.full_name || data.user?.email?.split('@')[0] || 'User',
          avatar: data.user?.avatar_url || undefined,
          role: determineUserRole(data.user?.is_superuser, auth0Roles),
          preferences: {
            language: 'en',
            dailyGoal: data.user?.settings?.daily_goal || 20,
            notifications: data.user?.settings?.email_notifications ?? true,
            theme: 'light',
          },
          stats: {
            streak: 0,
            wordsLearned: 0,
            totalXP: 0,
            joinedDate: new Date(data.user?.created_at || Date.now()),
          },
          createdAt: new Date(data.user?.created_at || Date.now()),
          updatedAt: new Date(data.user?.updated_at || Date.now()),
        };

        // Identify user in PostHog
        if (typeof posthog?.identify === 'function') {
          posthog.identify(user.id, {
            email: user.email,
            created_at: user.createdAt.toISOString(),
            auth_method: 'auth0_google',
          });
        }
        if (typeof posthog?.capture === 'function') {
          posthog.capture('user_logged_in', {
            method: 'auth0_google',
          });
        }

        // Update auth store with tokens and user
        useAuthStore.setState({
          user,
          token: data.access_token,
          refreshToken: data.refresh_token,
          isAuthenticated: true,
          rememberMe: true, // OAuth users get persistent login
          isLoading: false,
          error: null,
        });

        // Store in sessionStorage as backup
        sessionStorage.setItem('auth-token', data.access_token);

        log.info('[Callback] Successfully authenticated via Auth0');

        // Parse state to get returnTo path
        let returnTo = '/dashboard';
        if (state) {
          try {
            const stateData = JSON.parse(state);
            if (stateData.returnTo) {
              returnTo = stateData.returnTo;
            }
          } catch {
            // Invalid state JSON, use default
            log.warn('[Callback] Could not parse state parameter');
          }
        }

        // Navigate to destination
        navigate(returnTo, { replace: true });
      } catch (err) {
        log.error('[Callback] Error processing callback:', err);
        setError(err instanceof Error ? err.message : 'Authentication failed');
        setIsProcessing(false);
      }
    };

    processCallback();
  }, [navigate]);

  // Show loading state while processing
  if (isProcessing && !error) {
    return <PageLoader />;
  }

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

  // Fallback (should not reach here)
  return <PageLoader />;
};
