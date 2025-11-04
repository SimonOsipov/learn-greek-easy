import { useEffect } from 'react';

import { useNavigate } from 'react-router-dom';

import { useAuthStore } from '@/stores/authStore';

// Main auth hook
export const useAuth = () => {
  const {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
    register,
    updateProfile,
    clearError,
  } = useAuthStore();

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
    // Computed properties
    isAdmin: user?.role === 'admin',
    isPremium: user?.role === 'premium' || user?.role === 'admin',
    isFree: user?.role === 'free',
  };
};

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
