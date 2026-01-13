import posthog from 'posthog-js';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import { reportAPIError } from '@/lib/errorReporting';
import log from '@/lib/logger';
import { shouldRefreshToken } from '@/lib/tokenUtils';
import { APIRequestError } from '@/services/api';
import { authAPI, clearAuthTokens } from '@/services/authAPI';
import type { User, AuthError } from '@/types/auth';

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
  _hasHydrated: boolean;

  // Actions
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  updatePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  refreshSession: () => Promise<void>;
  checkAuth: (options?: { signal?: AbortSignal }) => Promise<void>;
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
      _hasHydrated: false,

      // Logout action
      logout: async () => {
        const { refreshToken: storedRefreshToken } = get();

        // Track logout event before reset
        if (typeof posthog?.capture === 'function') {
          posthog.capture('user_logged_out');
        }

        if (storedRefreshToken) {
          try {
            await authAPI.logout(storedRefreshToken);
          } catch (error) {
            reportAPIError(error, { operation: 'logout', endpoint: '/auth/logout' });
          }
        }

        // Clear all auth data using the centralized function
        clearAuthTokens();

        // Clear all auth data
        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
          rememberMe: false,
          error: null,
        });

        // Clear analytics state
        useAnalyticsStore.getState().clearAnalytics();

        // Reset PostHog identity so next session is anonymous
        if (typeof posthog?.reset === 'function') {
          posthog.reset();
        }
      },

      // Update profile action
      // Note: Backend doesn't currently support profile updates via API
      // This is a local-only update for MVP
      updateProfile: async (updates: Partial<User>) => {
        const { user } = get();

        if (!user) {
          throw new Error('No user logged in');
        }

        set({ isLoading: true, error: null });

        try {
          // TODO: When backend supports profile updates, call the API here
          // For now, just update the local state
          const updatedUser = {
            ...user,
            ...updates,
            updatedAt: new Date(),
          };

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
          // Call real backend API to refresh tokens
          const tokenResponse = await authAPI.refresh(storedRefreshToken);

          // Fetch updated user profile
          sessionStorage.setItem('auth-token', tokenResponse.access_token);
          const profileResponse = await authAPI.getProfile();

          // Transform backend user response to frontend User type
          const user: User = {
            id: profileResponse.id,
            email: profileResponse.email,
            name: profileResponse.full_name || profileResponse.email.split('@')[0],
            role: profileResponse.is_superuser ? 'admin' : 'free',
            preferences: {
              language: 'en',
              dailyGoal: profileResponse.settings?.daily_goal || 20,
              notifications: profileResponse.settings?.email_notifications || true,
              theme: profileResponse.settings?.theme || 'light',
            },
            stats: {
              streak: 0,
              wordsLearned: 0,
              totalXP: 0,
              joinedDate: new Date(profileResponse.created_at),
            },
            createdAt: new Date(profileResponse.created_at),
            updatedAt: new Date(profileResponse.updated_at),
          };

          set({
            user,
            token: tokenResponse.access_token,
            refreshToken: tokenResponse.refresh_token,
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
      checkAuth: async (options?: { signal?: AbortSignal }) => {
        const { token, refreshToken: storedRefreshToken } = get();
        const signal = options?.signal;

        // Check session storage if not remember me
        const sessionToken = sessionStorage.getItem('auth-token');
        const activeToken = token || sessionToken;

        if (!activeToken) {
          set({ isAuthenticated: false });
          return;
        }

        // PROACTIVE REFRESH: If token is expired/expiring, refresh before verifying
        // This prevents 401s when the app loads after being idle
        if (shouldRefreshToken(activeToken) && storedRefreshToken) {
          log.debug('Token expiring on app load, proactively refreshing');
          try {
            await get().refreshSession();
            log.debug('Proactive refresh on app load successful');
            // After refresh, continue with the new token from store
          } catch (error) {
            // Refresh failed - clear auth and return
            log.warn('Proactive refresh on app load failed', { error });
            clearAuthTokens();
            set({
              user: null,
              token: null,
              refreshToken: null,
              isAuthenticated: false,
              isLoading: false,
            });
            return;
          }
        }

        set({ isLoading: true });

        try {
          // Verify token by fetching user profile
          // Ensure the token is available for the request
          if (!sessionToken && activeToken) {
            sessionStorage.setItem('auth-token', activeToken);
          }

          const profileResponse = await authAPI.getProfile({ signal });

          // Check if aborted after the call (signal might have been aborted during fetch)
          if (signal?.aborted) {
            return;
          }

          // Transform backend user response to frontend User type
          const user: User = {
            id: profileResponse.id,
            email: profileResponse.email,
            name: profileResponse.full_name || profileResponse.email.split('@')[0],
            role: profileResponse.is_superuser ? 'admin' : 'free',
            preferences: {
              language: 'en',
              dailyGoal: profileResponse.settings?.daily_goal || 20,
              notifications: profileResponse.settings?.email_notifications || true,
              theme: profileResponse.settings?.theme || 'light',
            },
            stats: {
              streak: 0,
              wordsLearned: 0,
              totalXP: 0,
              joinedDate: new Date(profileResponse.created_at),
            },
            createdAt: new Date(profileResponse.created_at),
            updatedAt: new Date(profileResponse.updated_at),
          };

          // Re-identify user to ensure PostHog session continuity
          if (typeof posthog?.identify === 'function') {
            posthog.identify(user.id, {
              email: user.email,
              created_at: user.createdAt.toISOString(),
            });
          }

          set({
            user,
            token: activeToken,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          // Check if request was aborted - don't update state for aborted requests
          if (signal?.aborted || (error instanceof Error && error.name === 'AbortError')) {
            return;
          }

          // Only clear tokens on explicit auth failures (401/403)
          // Network errors (status 0), timeouts (408), or other errors should NOT clear auth
          if (error instanceof APIRequestError && (error.status === 401 || error.status === 403)) {
            // Token expired or invalid - clear auth state
            clearAuthTokens();
            set({
              user: null,
              token: null,
              refreshToken: null,
              isAuthenticated: false,
              isLoading: false,
            });
          } else {
            // Network error or other non-auth error - keep existing auth state, just stop loading
            set({ isLoading: false });
          }
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
      onRehydrateStorage: () => (state) => {
        if (state) {
          state._hasHydrated = true;
        }
      },
    }
  )
);

/**
 * Hook to check if the auth store has finished hydrating from localStorage.
 * Use this to prevent API calls before hydration is complete.
 */
export const useHasHydrated = () => useAuthStore((state) => state._hasHydrated);
