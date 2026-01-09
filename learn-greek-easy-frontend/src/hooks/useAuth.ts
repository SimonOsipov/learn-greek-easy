import { useEffect } from 'react';

import { useNavigate } from 'react-router-dom';

import { useAuthStore } from '@/stores/authStore';
import type { User, AuthError } from '@/types/auth';

import { isAuth0Enabled, useAuth0Integration } from './useAuth0Integration';

/**
 * Auth hook return type - unified interface for both Auth0 and legacy auth.
 */
interface UseAuthResult {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: AuthError | Error | null | undefined;
  login: (emailOrReturnTo?: string, password?: string, remember?: boolean) => Promise<void>;
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
 * Hook for legacy (non-Auth0) authentication.
 */
function useLegacyAuth(): UseAuthResult {
  const {
    user,
    isAuthenticated,
    isLoading,
    error,
    login: legacyLogin,
    logout,
    register,
    updateProfile,
    clearError,
  } = useAuthStore();

  // Wrap login to match expected signature
  const login = async (email?: string, password?: string, remember?: boolean) => {
    if (!email || !password) {
      throw new Error('Email and password are required for login');
    }
    await legacyLogin(email, password, remember);
  };

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
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
 * Hook for Auth0 authentication.
 * Adapts Auth0 interface to match the legacy auth interface.
 */
function useAuth0Auth(): UseAuthResult {
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
 * Main auth hook - facade that returns Auth0 or legacy auth based on feature flag.
 *
 * Usage:
 * ```tsx
 * const { user, isAuthenticated, login, logout } = useAuth();
 * ```
 *
 * When VITE_AUTH0_ENABLED=true, uses Auth0 authentication.
 * Otherwise, uses the legacy email/password authentication.
 *
 * IMPORTANT: Since the auth system is determined by environment variable
 * at build time, we export two separate hook implementations and the
 * correct one is selected based on the feature flag.
 */
export const useAuth: () => UseAuthResult = isAuth0Enabled() ? useAuth0Auth : useLegacyAuth;

// Hook to require authentication
export const useRequireAuth = (redirectTo = '/login') => {
  const { isAuthenticated, isLoading } = useAuthStore();
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
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate(redirectTo, { replace: true });
    }
  }, [isAuthenticated, navigate, redirectTo]);
};

// Hook for role-based access
export const useRequireRole = (requiredRole: 'admin' | 'premium', redirectTo = '/dashboard') => {
  const { user, isAuthenticated } = useAuthStore();
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
