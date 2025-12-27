import posthog from 'posthog-js';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import log from '@/lib/logger';
import { shouldRefreshToken } from '@/lib/tokenUtils';
import { APIRequestError } from '@/services/api';
import { authAPI, clearAuthTokens } from '@/services/authAPI';
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
  loginWithGoogle: (googleToken: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
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

      // Login action
      login: async (email: string, password: string, remember = false) => {
        set({ isLoading: true, error: null });

        try {
          // Call real backend API
          const tokenResponse = await authAPI.login({ email, password });

          // Fetch user profile after login
          // First store token temporarily for the profile request
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
              theme: 'light',
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

          // Identify user in PostHog
          if (typeof posthog?.identify === 'function') {
            posthog.identify(user.id, {
              email: user.email,
              created_at: user.createdAt.toISOString(),
              auth_method: 'email',
            });
          }
          if (typeof posthog?.capture === 'function') {
            posthog.capture('user_logged_in', {
              method: 'email',
            });
          }

          set({
            user,
            token: tokenResponse.access_token,
            refreshToken: tokenResponse.refresh_token,
            isAuthenticated: true,
            rememberMe: remember,
            isLoading: false,
            error: null,
          });

          // If not remember me, store in sessionStorage instead
          if (!remember) {
            sessionStorage.setItem('auth-token', tokenResponse.access_token);
          }
        } catch (error) {
          set({
            isLoading: false,
            error: {
              code: 'LOGIN_FAILED',
              message: error instanceof Error ? error.message : 'Login failed',
            },
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

          // Identify user in PostHog (Google auth)
          if (typeof posthog?.identify === 'function') {
            posthog.identify(user.id, {
              email: user.email,
              created_at: user.createdAt.toISOString(),
              auth_method: 'google',
            });
          }
          if (typeof posthog?.capture === 'function') {
            posthog.capture('user_logged_in', {
              method: 'google',
            });
          }

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
          // Call real backend API
          const tokenResponse = await authAPI.register({
            email: data.email,
            password: data.password,
            full_name: data.name,
          });

          // Store token temporarily for the profile request
          sessionStorage.setItem('auth-token', tokenResponse.access_token);

          // Fetch user profile after registration
          const profileResponse = await authAPI.getProfile();

          // Transform backend user response to frontend User type
          const user: User = {
            id: profileResponse.id,
            email: profileResponse.email,
            name: profileResponse.full_name || profileResponse.email.split('@')[0],
            role: 'free', // New users are always free tier
            preferences: {
              language: 'en',
              dailyGoal: profileResponse.settings?.daily_goal || 20,
              notifications: profileResponse.settings?.email_notifications || true,
              theme: 'light',
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

          // Identify new user in PostHog
          if (typeof posthog?.identify === 'function') {
            posthog.identify(user.id, {
              email: user.email,
              created_at: user.createdAt.toISOString(),
              auth_method: 'email',
            });
          }
          if (typeof posthog?.capture === 'function') {
            posthog.capture('user_signed_up', {
              method: 'email',
              referrer:
                typeof document !== 'undefined' ? document.referrer || undefined : undefined,
            });
          }

          set({
            user,
            token: tokenResponse.access_token,
            refreshToken: tokenResponse.refresh_token,
            isAuthenticated: true,
            rememberMe: false,
            isLoading: false,
            error: null,
          });

          // New users start with session storage
          sessionStorage.setItem('auth-token', tokenResponse.access_token);
        } catch (error) {
          set({
            isLoading: false,
            error: {
              code: 'REGISTRATION_FAILED',
              message: error instanceof Error ? error.message : 'Registration failed',
            },
            isAuthenticated: false,
          });
          throw error;
        }
      },

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
            log.error('Logout error:', error);
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
              theme: 'light',
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
              theme: 'light',
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
    }
  )
);
