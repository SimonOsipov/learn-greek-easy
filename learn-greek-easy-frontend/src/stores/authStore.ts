import { create, StateCreator } from 'zustand';
import { persist, createJSONStorage, PersistOptions } from 'zustand/middleware';

import { mockAuthAPI } from '@/services/mockAuthAPI';
import type { User, RegisterData, AuthError } from '@/types/auth';

import { useAnalyticsStore } from './analyticsStore';

interface AuthState {
  // State
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: AuthError | null;
  rememberMe: boolean;
  _hasHydrated: boolean; // Tracks if persist middleware has hydrated from localStorage

  // Actions
  login: (email: string, password: string, remember?: boolean) => Promise<void>;
  loginWithGoogle: (googleToken: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  updatePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  refreshSession: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}

/**
 * Store configuration - extracted for conditional persistence
 * In test environment, persist middleware is disabled to allow proper unit testing
 */
const storeConfig: StateCreator<AuthState, [], []> = (set, get) => ({
  // Initial state
  user: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  rememberMe: false,
  _hasHydrated: false, // Set to true after persist hydration completes

  // Login action
  login: async (email: string, password: string, remember = false) => {
    set({ isLoading: true, error: null });

    try {
      const response = await mockAuthAPI.login(email, password);

      set({
        user: response.user,
        token: response.token,
        refreshToken: response.refreshToken,
        isAuthenticated: true,
        rememberMe: remember,
        isLoading: false,
        error: null,
      });

      // If not remember me, store in sessionStorage instead
      if (!remember) {
        sessionStorage.setItem('auth-token', response.token);
      }
    } catch (error) {
      set({
        isLoading: false,
        error: error as AuthError,
        isAuthenticated: false,
      });
      throw error;
    }
  },

  // Login with Google OAuth
  loginWithGoogle: async (googleToken: string) => {
    set({ isLoading: true, error: null });

    try {
      // Call backend API to exchange Google token for our tokens
      // Use relative URL for nginx proxy in production, or VITE_API_URL for dev
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${apiUrl}/api/v1/auth/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id_token: googleToken }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData.detail ||
          errorData.error?.message ||
          'Google sign-in failed. Please try again.';
        throw new Error(errorMessage);
      }

      const data = await response.json();

      // Transform backend response to match our User type
      const user: User = {
        id: data.user?.id || '',
        email: data.user?.email || '',
        name: data.user?.full_name || data.user?.email?.split('@')[0] || 'User',
        role: data.user?.is_superuser ? 'admin' : 'free',
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
          joinedDate: new Date(data.user?.created_at || Date.now()),
        },
        createdAt: new Date(data.user?.created_at || Date.now()),
        updatedAt: new Date(data.user?.updated_at || Date.now()),
      };

      set({
        user,
        token: data.access_token,
        refreshToken: data.refresh_token,
        isAuthenticated: true,
        rememberMe: true, // Google users get persistent login
        isLoading: false,
        error: null,
      });

      // Store in sessionStorage as backup
      sessionStorage.setItem('auth-token', data.access_token);
    } catch (error) {
      set({
        isLoading: false,
        error: {
          code: 'GOOGLE_AUTH_FAILED',
          message: error instanceof Error ? error.message : 'Google sign-in failed',
        },
        isAuthenticated: false,
      });
      throw error;
    }
  },

  // Register action
  register: async (data: RegisterData) => {
    set({ isLoading: true, error: null });

    try {
      const response = await mockAuthAPI.register(data);

      set({
        user: response.user,
        token: response.token,
        refreshToken: response.refreshToken,
        isAuthenticated: true,
        rememberMe: false,
        isLoading: false,
        error: null,
      });

      // New users start with session storage
      sessionStorage.setItem('auth-token', response.token);
    } catch (error) {
      set({
        isLoading: false,
        error: error as AuthError,
        isAuthenticated: false,
      });
      throw error;
    }
  },

  // Logout action
  logout: async () => {
    const { token } = get();

    if (token) {
      try {
        await mockAuthAPI.logout(token);
      } catch (error) {
        console.error('Logout error:', error);
      }
    }

    // Clear all auth data
    set({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      rememberMe: false,
      error: null,
    });

    // Clear session storage
    sessionStorage.removeItem('auth-token');

    // Clear analytics state
    useAnalyticsStore.getState().clearAnalytics();

    // Clear localStorage (handled by persist middleware)
  },

  // Update profile action
  updateProfile: async (updates: Partial<User>) => {
    const { user } = get();

    if (!user) {
      throw new Error('No user logged in');
    }

    set({ isLoading: true, error: null });

    try {
      const updatedUser = await mockAuthAPI.updateProfile(user.id, updates);

      set({
        user: updatedUser,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error as AuthError,
      });
      throw error;
    }
  },

  // Update password action
  updatePassword: async (_currentPassword: string, _newPassword: string) => {
    const { user } = get();

    if (!user) {
      throw new Error('No user logged in');
    }

    set({ isLoading: true, error: null });

    try {
      // TODO: In production, verify currentPassword and update via backend API
      // For MVP with mockAuthAPI, simulate password update
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // In real implementation:
      // await mockAuthAPI.updatePassword(user.id, currentPassword, newPassword);

      set({
        isLoading: false,
        error: null,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error as AuthError,
      });
      throw error;
    }
  },

  // Refresh session action
  refreshSession: async () => {
    const { refreshToken: storedRefreshToken } = get();

    if (!storedRefreshToken) {
      throw new Error('No refresh token available');
    }

    set({ isLoading: true, error: null });

    try {
      const response = await mockAuthAPI.refreshToken(storedRefreshToken);

      set({
        user: response.user,
        token: response.token,
        refreshToken: response.refreshToken,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error as AuthError,
        isAuthenticated: false,
      });
      throw error;
    }
  },

  // Check auth on app load
  checkAuth: async () => {
    const { token, rememberMe: _rememberMe } = get();

    // Check session storage if not remember me
    const sessionToken = sessionStorage.getItem('auth-token');
    const activeToken = token || sessionToken;

    if (!activeToken) {
      set({ isAuthenticated: false });
      return;
    }

    set({ isLoading: true });

    try {
      const user = await mockAuthAPI.verifyToken(activeToken);

      if (user) {
        set({
          user,
          token: activeToken,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        // Token expired or invalid
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    } catch (error) {
      set({
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  // Clear error
  clearError: () => {
    set({ error: null });
  },
});

/**
 * Persist configuration - only applied in non-test environments
 */
const persistConfig: PersistOptions<AuthState, Partial<AuthState>> = {
  name: 'auth-storage',
  storage: createJSONStorage(() => localStorage),
  partialize: (state) =>
    state.rememberMe
      ? ({
          user: state.user,
          token: state.token,
          refreshToken: state.refreshToken,
          rememberMe: true,
          isAuthenticated: state.isAuthenticated,
        } as Partial<AuthState>)
      : ({} as Partial<AuthState>),
  onRehydrateStorage: () => {
    // Called when hydration starts; returns callback for when hydration finishes
    return () => {
      // Hydration complete - mark store as hydrated
      // This allows RouteGuard to know when it's safe to check auth
      useAuthStore.setState({ _hasHydrated: true });
    };
  },
};

/**
 * Test mode store configuration - wraps storeConfig with _hasHydrated = true
 * since there's no persist middleware to trigger hydration
 */
const testStoreConfig: StateCreator<AuthState, [], []> = (set, get, api) => ({
  ...storeConfig(set, get, api),
  _hasHydrated: true, // No hydration needed in test mode - mark as ready immediately
});

/**
 * Auth store with conditional persistence
 * - In test mode (vitest): persist middleware is disabled for proper unit testing
 * - In dev/prod: full persistence functionality is enabled
 */
export const useAuthStore = create<AuthState>()(
  import.meta.env.MODE === 'test' ? testStoreConfig : persist(storeConfig, persistConfig)
);
