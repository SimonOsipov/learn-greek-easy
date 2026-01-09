import { useEffect } from 'react';

import { useNavigate } from 'react-router-dom';

import { useAuthStore } from '@/stores/authStore';
import type { User, AuthError } from '@/types/auth';

import { useAuth0Integration } from './useAuth0Integration';

/**
 * Auth hook return type - unified interface for Auth0 authentication.
 */
interface UseAuthResult {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: AuthError | Error | null | undefined;
  login: (returnTo?: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (data: {
    name: string;
    email: string;
    password: string;
    agreeToTerms: boolean;
    ageConfirmation: boolean;
  }) => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  clearError: () => void;
  isAdmin: boolean;
  isPremium: boolean;
  isFree: boolean;
}

/**
 * Main auth hook - uses Auth0 authentication.
 *
 * Usage:
 * ```tsx
 * const { user, isAuthenticated, login, logout } = useAuth();
 * ```
 */
export function useAuth(): UseAuthResult {
  const {
    user,
    isAuthenticated,
    isLoading,
    error,
    login: auth0Login,
    logout,
  } = useAuth0Integration();

  // Adapt Auth0 login to expected signature
  // For Auth0, the first parameter is returnTo (optional)
  const login = async (returnTo?: string) => {
    await auth0Login(returnTo);
  };

  // Auth0 doesn't support registration through the SDK - use Universal Login
  const register = async () => {
    // Redirect to Auth0 Universal Login with signup mode
    await auth0Login('/dashboard');
  };

  // Auth0 doesn't support profile updates through the SDK
  const updateProfile = async (_updates: Partial<User>) => {
    throw new Error(
      'Profile updates are not supported with Auth0. Use the Auth0 dashboard or Management API.'
    );
  };

  // No-op for Auth0 (errors are handled differently)
  const clearError = () => {
    // Auth0 errors are managed by the SDK
  };

  return {
    user,
    isAuthenticated,
    isLoading,
    error: error || null,
    login,
    logout,
    register,
    updateProfile,
    clearError,
    isAdmin: user?.role === 'admin',
    isPremium: user?.role === 'premium' || user?.role === 'admin',
    isFree: user?.role === 'free',
  };
}

/**
 * Internal hook to get unified auth state for helper hooks.
 * Combines Auth0 state with Zustand store state to handle logout correctly.
 */
function useUnifiedAuthState() {
  const auth0State = useAuth0Integration();
  const legacyState = useAuthStore();

  // For Auth0: use Auth0's isAuthenticated AND check Zustand isn't cleared
  // This handles the logout case where Zustand is cleared before Auth0 redirect
  return {
    isAuthenticated: auth0State.isAuthenticated && legacyState.isAuthenticated !== false,
    isLoading: auth0State.isLoading,
    user: auth0State.user,
  };
}

// Hook to require authentication
export const useRequireAuth = (redirectTo = '/login') => {
  const { isAuthenticated, isLoading } = useUnifiedAuthState();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate(redirectTo, { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate, redirectTo]);

  return { isAuthenticated, isLoading };
};

// Hook to redirect if already authenticated
export const useRedirectIfAuth = (redirectTo = '/dashboard') => {
  const { isAuthenticated } = useUnifiedAuthState();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate(redirectTo, { replace: true });
    }
  }, [isAuthenticated, navigate, redirectTo]);
};

// Hook for role-based access
export const useRequireRole = (requiredRole: 'admin' | 'premium', redirectTo = '/dashboard') => {
  const { user, isAuthenticated } = useUnifiedAuthState();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
      return;
    }

    const hasAccess = user?.role === requiredRole || user?.role === 'admin';

    if (!hasAccess) {
      navigate(redirectTo, { replace: true });
    }
  }, [user, isAuthenticated, requiredRole, navigate, redirectTo]);

  return {
    hasAccess: user?.role === requiredRole || user?.role === 'admin',
  };
};
