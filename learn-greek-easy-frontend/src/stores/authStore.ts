import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

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

  // Actions
  login: (email: string, password: string, remember?: boolean) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  updatePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  refreshSession: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      rememberMe: false,

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
          await new Promise(resolve => setTimeout(resolve, 1000));

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
    }),
    {
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
    }
  )
);
