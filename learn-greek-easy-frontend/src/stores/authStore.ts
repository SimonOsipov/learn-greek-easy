import posthog from 'posthog-js';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import { reportAPIError } from '@/lib/errorReporting';
import { supabase } from '@/lib/supabaseClient';
import { authAPI, type ProfileUpdateRequest } from '@/services/authAPI';
import type { User, AuthError } from '@/types/auth';

import { useAnalyticsStore } from './analyticsStore';

interface AuthState {
  // State
  user: User | null;
  isAuthenticated: boolean;
  // isLoading: true during auth operations (initial check, login, logout) - triggers full-page loader
  isLoading: boolean;
  // isProfileUpdating: true during profile operations (update profile, change password) - no full-page loader
  isProfileUpdating: boolean;
  error: AuthError | null;
  _hasHydrated: boolean;

  // Actions
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  updatePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  checkAuth: (options?: { signal?: AbortSignal }) => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      isAuthenticated: false,
      isLoading: false,
      isProfileUpdating: false,
      error: null,
      _hasHydrated: false,

      // Logout action
      logout: async () => {
        // Track logout event before reset
        if (typeof posthog?.capture === 'function') {
          posthog.capture('user_logged_out');
        }

        // Sign out via Supabase (clears session)
        const { error } = await supabase.auth.signOut();
        if (error) {
          reportAPIError(error, { operation: 'logout', endpoint: 'supabase.auth.signOut' });
        }

        // Clear all auth data
        set({
          user: null,
          isAuthenticated: false,
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
      updateProfile: async (updates: Partial<User>) => {
        const { user } = get();

        if (!user) {
          throw new Error('No user logged in');
        }

        set({ isProfileUpdating: true, error: null });

        try {
          // Build API request
          const apiUpdates: ProfileUpdateRequest = {};
          if (updates.name !== undefined) {
            apiUpdates.full_name = updates.name;
          }
          if (updates.avatar !== undefined) {
            apiUpdates.avatar_url = updates.avatar;
          }
          // Handle preferences updates
          if (updates.preferences !== undefined) {
            if (updates.preferences.notifications !== undefined) {
              apiUpdates.email_notifications = updates.preferences.notifications;
            }
            if (updates.preferences.dailyGoal !== undefined) {
              apiUpdates.daily_goal = updates.preferences.dailyGoal;
            }
            if (updates.preferences.language !== undefined) {
              apiUpdates.preferred_language = updates.preferences.language;
            }
            if (updates.preferences.theme !== undefined) {
              apiUpdates.theme = updates.preferences.theme;
            }
          }

          // Call backend API
          const profileResponse = await authAPI.updateProfile(apiUpdates);

          // Transform response to User type
          const updatedUser: User = {
            id: profileResponse.id,
            email: profileResponse.email,
            name: profileResponse.full_name || profileResponse.email.split('@')[0],
            avatar: profileResponse.avatar_url || undefined,
            role: profileResponse.is_superuser ? 'admin' : 'free',
            preferences: {
              // Preserve current language (backend doesn't store it yet)
              language: updates.preferences?.language ?? user.preferences.language,
              dailyGoal: profileResponse.settings?.daily_goal || 20,
              notifications: profileResponse.settings?.email_notifications ?? true,
              theme: profileResponse.settings?.theme || 'light',
            },
            stats: user.stats, // Preserve existing stats
            createdAt: new Date(profileResponse.created_at),
            updatedAt: new Date(profileResponse.updated_at),
            authProvider: profileResponse.auth_provider ?? undefined,
          };

          set({
            user: updatedUser,
            isProfileUpdating: false,
            error: null,
          });
        } catch (error) {
          set({
            isProfileUpdating: false,
            error: error as AuthError,
          });
          throw error;
        }
      },

      // Update password action
      updatePassword: async (_currentPassword: string, newPassword: string) => {
        const { user } = get();

        if (!user) {
          throw new Error('No user logged in');
        }

        set({ isProfileUpdating: true, error: null });

        try {
          const { error } = await supabase.auth.updateUser({ password: newPassword });

          if (error) {
            throw error;
          }

          set({
            isProfileUpdating: false,
            error: null,
          });
        } catch (error) {
          set({
            isProfileUpdating: false,
            error: error as AuthError,
          });
          throw error;
        }
      },

      // Check auth on app load
      checkAuth: async (options?: { signal?: AbortSignal }) => {
        const signal = options?.signal;

        // Check Supabase session
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          set({ isAuthenticated: false, isLoading: false });
          return;
        }

        set({ isLoading: true });

        try {
          const profileResponse = await authAPI.getProfile({ signal });

          // Check if aborted after the call
          if (signal?.aborted) {
            return;
          }

          // Transform backend user response to frontend User type
          const user: User = {
            id: profileResponse.id,
            email: profileResponse.email,
            name: profileResponse.full_name || profileResponse.email.split('@')[0],
            avatar: profileResponse.avatar_url || undefined,
            role: profileResponse.is_superuser ? 'admin' : 'free',
            preferences: {
              language: 'en',
              dailyGoal: profileResponse.settings?.daily_goal || 20,
              notifications: profileResponse.settings?.email_notifications ?? true,
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
            authProvider: profileResponse.auth_provider ?? undefined,
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
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          // Check if request was aborted
          if (signal?.aborted || (error instanceof Error && error.name === 'AbortError')) {
            return;
          }

          // Session exists but profile fetch failed - clear auth state
          set({
            user: null,
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
      // Always persist auth state to localStorage regardless of rememberMe.
      // The rememberMe flag affects token expiration on the backend, not frontend storage.
      // Users should stay logged in during their browser session.
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
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
