import { useEffect } from 'react';

import { useNavigate } from 'react-router-dom';

import { useAuthStore } from '@/stores/authStore';
import type { User, AuthError } from '@/types/auth';

import { useAuth0Integration, isAuth0Enabled } from './useAuth0Integration';

/**
 * Auth hook return type - unified interface for authentication.
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
 * Auth hook for Auth0 mode - uses Auth0 SDK.
 */
function useAuth0Mode(): UseAuthResult {
  const {
    user,
    isAuthenticated,
    isLoading,
    error,
    login: auth0Login,
    logout,
  } = useAuth0Integration();

  // Adapt Auth0 login to expected signature
  const login = async (returnTo?: string) => {
    await auth0Login(returnTo);
  };

  // Auth0 doesn't support registration through the SDK - use Universal Login
  const register = async () => {
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
 * Auth hook for non-Auth0 mode - uses Zustand store directly.
 * Used when Auth0 is disabled (e.g., E2E tests with storageState).
 */
function useStorageMode(): UseAuthResult {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);
  const error = useAuthStore((state) => state.error);
  const storeLogout = useAuthStore((state) => state.logout);
  const storeClearError = useAuthStore((state) => state.clearError);

  // Login redirects to login page (no Auth0 available)
  const login = async (returnTo?: string) => {
    window.location.href = returnTo || '/login';
  };

  // Logout clears store and redirects to home
  const logout = async () => {
    await storeLogout();
    window.location.href = '/';
  };

  // Registration not available without Auth0
  const register = async () => {
    throw new Error('Registration requires Auth0. Enable VITE_AUTH0_ENABLED.');
  };

  // Profile updates not available in storage mode
  const updateProfile = async (_updates: Partial<User>) => {
    throw new Error('Profile updates require Auth0.');
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
    clearError: storeClearError,
    isAdmin: user?.role === 'admin',
    isPremium: user?.role === 'premium' || user?.role === 'admin',
    isFree: user?.role === 'free',
  };
}

/**
 * Main auth hook - uses Auth0 when enabled, falls back to storage mode.
 *
 * Usage:
 * ```tsx
 * const { user, isAuthenticated, login, logout } = useAuth();
 * ```
 */
export function useAuth(): UseAuthResult {
  // Use Auth0 when enabled, otherwise use storage mode (for E2E tests)
  if (isAuth0Enabled()) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useAuth0Mode();
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useStorageMode();
}

/**
 * Internal hook to get unified auth state for helper hooks.
 * Uses Auth0 when enabled, falls back to storage mode.
 */
function useUnifiedAuthState() {
  // Storage mode state (always available)
  const storeUser = useAuthStore((state) => state.user);
  const storeIsAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const storeIsLoading = useAuthStore((state) => state.isLoading);

  // When Auth0 is disabled, use storage mode only
  if (!isAuth0Enabled()) {
    return {
      isAuthenticated: storeIsAuthenticated,
      isLoading: storeIsLoading,
      user: storeUser,
    };
  }

  // Auth0 mode - combine Auth0 state with Zustand store
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const auth0State = useAuth0Integration();

  // For Auth0: use Auth0's isAuthenticated AND check Zustand isn't cleared
  // This handles the logout case where Zustand is cleared before Auth0 redirect
  return {
    isAuthenticated: auth0State.isAuthenticated && storeIsAuthenticated !== false,
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
