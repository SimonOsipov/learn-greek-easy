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

import type { User, UserRole } from '@/types/auth';

/**
 * Check if Auth0 authentication is enabled via feature flag.
 * Returns false if VITE_AUTH0_ENABLED is not set or not "true".
 */
export function isAuth0Enabled(): boolean {
  return import.meta.env.VITE_AUTH0_ENABLED === 'true';
}

/**
 * Transform Auth0 user to application User type.
 * Maps Auth0 user claims to the existing User interface.
 */
function transformAuth0User(auth0User: Auth0User): User {
  // Extract role from Auth0 custom claims (namespace varies by tenant setup)
  // Common patterns: https://your-namespace/roles or app_metadata.role
  const customClaims = auth0User as Record<string, unknown>;
  const roles = (customClaims['https://learn-greek-easy.com/roles'] as string[]) || [];
  const role: UserRole = roles.includes('admin')
    ? 'admin'
    : roles.includes('premium')
      ? 'premium'
      : 'free';

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
  const logout = async () => {
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
