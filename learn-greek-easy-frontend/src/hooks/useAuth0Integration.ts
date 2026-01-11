/**
 * Auth0 Integration Hook
 *
 * Wraps the @auth0/auth0-react SDK and transforms Auth0 user data
 * to match the existing application User type interface.
 *
 * Features:
 * - isAuth0Enabled() helper to check feature flag
 * - Transforms Auth0 user to app User type
 * - Provides login(), logout(), getToken() methods
 * - Handles Auth0 loading states
 */

import { useAuth0, type User as Auth0User } from '@auth0/auth0-react';
import posthog from 'posthog-js';

import { clearAuthTokens } from '@/services/api';
import { useAnalyticsStore } from '@/stores/analyticsStore';
import { useAuthStore } from '@/stores/authStore';
import type { User, UserRole } from '@/types/auth';

/**
 * Check if Auth0 authentication is enabled via feature flag.
 * Returns false if VITE_AUTH0_ENABLED is not set or not "true".
 */
export function isAuth0Enabled(): boolean {
  return import.meta.env.VITE_AUTH0_ENABLED === 'true';
}

/**
 * Extract Auth0 custom roles from user claims.
 * Returns array of role strings from the custom claim namespace.
 */
function extractAuth0Roles(auth0User: Auth0User | null): string[] {
  if (!auth0User) return [];
  const customClaims = auth0User as Record<string, unknown>;
  return (customClaims['https://learn-greek-easy.com/roles'] as string[]) || [];
}

/**
 * Determine user role using unified logic.
 * Priority:
 * 1. Backend is_superuser = true -> 'admin'
 * 2. Auth0 claims include 'premium' -> 'premium'
 * 3. Default -> 'free'
 *
 * @param isSuperuser - Backend is_superuser flag (takes priority for admin)
 * @param auth0Roles - Array of roles from Auth0 custom claims
 */
export function determineUserRole(
  isSuperuser: boolean | undefined,
  auth0Roles: string[]
): UserRole {
  // Backend is_superuser takes priority for admin role
  if (isSuperuser === true) {
    return 'admin';
  }

  // Check Auth0 claims for premium (backend doesn't track premium status)
  if (auth0Roles.includes('premium')) {
    return 'premium';
  }

  // Default to free
  return 'free';
}

/**
 * Transform Auth0 user to application User type.
 * Maps Auth0 user claims to the existing User interface.
 *
 * @param auth0User - Auth0 user object from SDK
 * @param backendUser - Optional backend user data (when available from auth0 endpoint)
 */
function transformAuth0User(auth0User: Auth0User, backendUser?: { is_superuser?: boolean }): User {
  // Extract roles from Auth0 custom claims
  const auth0Roles = extractAuth0Roles(auth0User);

  // Determine role using unified logic
  const role = determineUserRole(backendUser?.is_superuser, auth0Roles);

  // Extract name from various Auth0 fields
  const name = auth0User.name || auth0User.nickname || auth0User.email?.split('@')[0] || 'User';

  // Parse dates from Auth0 metadata (may not always be available)
  const createdAt = auth0User.created_at ? new Date(auth0User.created_at) : new Date();
  const updatedAt = auth0User.updated_at ? new Date(auth0User.updated_at) : new Date();

  return {
    id: auth0User.sub || '',
    email: auth0User.email || '',
    name,
    avatar: auth0User.picture,
    role,
    preferences: {
      language: 'en',
      dailyGoal: 20,
      notifications: true,
      theme: 'light',
    },
    stats: {
      streak: 0,
      wordsLearned: 0,
      totalXP: 0,
      joinedDate: createdAt,
    },
    createdAt,
    updatedAt,
  };
}

/**
 * Auth0 integration hook result type.
 * Provides a unified interface for Auth0 authentication.
 */
export interface UseAuth0IntegrationResult {
  /** Transformed user object (null if not authenticated) */
  user: User | null;
  /** Whether the user is authenticated */
  isAuthenticated: boolean;
  /** Whether Auth0 is still loading (checking session) */
  isLoading: boolean;
  /** Auth0 error (if any) */
  error: Error | undefined;
  /** Trigger login redirect to Auth0 Universal Login */
  login: (returnTo?: string) => Promise<void>;
  /** Trigger logout and redirect to home */
  logout: () => Promise<void>;
  /** Get the current access token for API calls */
  getAccessToken: () => Promise<string>;
  /** Raw Auth0 getAccessTokenSilently for API client registration */
  getAccessTokenSilently: () => Promise<string>;
}

/**
 * Hook that wraps Auth0 SDK and provides app-compatible interface.
 *
 * Usage:
 * ```tsx
 * const { user, isAuthenticated, login, logout } = useAuth0Integration();
 * ```
 *
 * Note: This hook should only be called when Auth0 is enabled and
 * the component is rendered inside Auth0Provider.
 */
export function useAuth0Integration(): UseAuth0IntegrationResult {
  const {
    user: auth0User,
    isAuthenticated,
    isLoading,
    error,
    loginWithRedirect,
    logout: auth0Logout,
    getAccessTokenSilently,
  } = useAuth0();

  // Transform Auth0 user to app User type
  const user = auth0User && isAuthenticated ? transformAuth0User(auth0User) : null;

  // Wrap login to use Universal Login with optional returnTo
  const login = async (returnTo?: string) => {
    await loginWithRedirect({
      appState: { returnTo: returnTo || '/dashboard' },
    });
  };

  // Wrap logout to redirect to home
  // CRITICAL: Clear Zustand store BEFORE Auth0 logout to prevent route guards
  // from seeing isAuthenticated=true and redirecting back to dashboard
  const logout = async () => {
    // Track logout event before state reset
    if (typeof posthog?.capture === 'function') {
      posthog.capture('user_logged_out');
    }

    // Clear the parallel Zustand store state FIRST (before redirect)
    // This prevents route guards from redirecting back to dashboard
    useAuthStore.setState({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      rememberMe: false,
      error: null,
    });

    // Clear any legacy tokens from localStorage/sessionStorage
    clearAuthTokens();

    // Clear analytics state
    useAnalyticsStore.getState().clearAnalytics();

    // Reset PostHog identity
    if (typeof posthog?.reset === 'function') {
      posthog.reset();
    }

    // Then trigger Auth0 logout (which will redirect)
    await auth0Logout({
      logoutParams: {
        returnTo: window.location.origin,
      },
    });
  };

  // Get access token (wrapper for consistency)
  const getAccessToken = async (): Promise<string> => {
    return getAccessTokenSilently();
  };

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
    getAccessToken,
    getAccessTokenSilently,
  };
}
