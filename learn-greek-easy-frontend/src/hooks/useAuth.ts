import { useEffect } from 'react';

import { useNavigate } from 'react-router-dom';

import { useAuthStore } from '@/stores/authStore';
import type { User, AuthError } from '@/types/auth';

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
 * Main auth hook - reads from Zustand store, delegates auth to Supabase.
 *
 * Usage:
 * ```tsx
 * const { user, isAuthenticated, login, logout } = useAuth();
 * ```
 */
export function useAuth(): UseAuthResult {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);
  const error = useAuthStore((state) => state.error);
  const storeLogout = useAuthStore((state) => state.logout);
  const storeUpdateProfile = useAuthStore((state) => state.updateProfile);
  const storeClearError = useAuthStore((state) => state.clearError);

  // Login redirects to login page (actual Supabase login is in LoginPage - FAUTH-04)
  const login = async (returnTo?: string) => {
    window.location.href = returnTo || '/login';
  };

  // Register redirects to register page (actual Supabase signup is in RegisterPage - FAUTH-04)
  const register = async () => {
    window.location.href = '/register';
  };

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    logout: storeLogout,
    register,
    updateProfile: storeUpdateProfile,
    clearError: storeClearError,
    isAdmin: user?.role === 'admin',
    isPremium: user?.role === 'premium' || user?.role === 'admin',
    isFree: user?.role === 'free',
  };
}

// Hook to require authentication
export const useRequireAuth = (redirectTo = '/login') => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);
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
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate(redirectTo, { replace: true });
    }
  }, [isAuthenticated, navigate, redirectTo]);
};

// Hook for role-based access
export const useRequireRole = (requiredRole: 'admin' | 'premium', redirectTo = '/dashboard') => {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
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
