import posthog from 'posthog-js';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import { reportAPIError } from '@/lib/errorReporting';
import { queryClient } from '@/lib/queryClient';
import { supabase } from '@/lib/supabaseClient';
import { authAPI, type ProfileUpdateRequest } from '@/services/authAPI';
import type { User, AuthError } from '@/types/auth';

/**
 * In-flight guard: if checkAuth is already in progress, callers share the
 * same Promise instead of issuing a second GET /auth/me.
 */
let _checkAuthInflight: Promise<void> | null = null;

/**
 * Freshness window (ms). If the profile was fetched within this window, skip
 * the refetch. 30 s is short enough that stale data is unlikely (typical
 * navigation takes <1 s), but long enough to absorb all duplicate calls that
 * occur within a single page-load cycle (AuthProvider + LoginForm, etc.).
 */
const PROFILE_FRESHNESS_MS = 30_000;

/**
 * Timestamp (Date.now()) of the most recent successful getProfile() call.
 * Stored at module level so it survives Zustand re-renders but does NOT get
 * persisted to localStorage (no stale-cache risk across sessions).
 */
let _profileFetchedAt = 0;

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
  updatePassword: (newPassword: string) => Promise<void>;
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

        // Clear auth data + dedup state so next login fetches fresh profile
        _checkAuthInflight = null;
        _profileFetchedAt = 0;

        set({
          user: null,
          isAuthenticated: false,
          error: null,
        });

        // Clear analytics query cache
        queryClient.removeQueries({ queryKey: ['analytics'] });

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
          if (updates.tourCompletedAt !== undefined) {
            apiUpdates.tour_completed_at = updates.tourCompletedAt;
          }

          // Call backend API
          const profileResponse = await authAPI.updateProfile(apiUpdates);

          // Transform response to User type
          const updatedUser: User = {
            id: profileResponse.id,
            email: profileResponse.email,
            name: profileResponse.full_name || profileResponse.email.split('@')[0],
            avatar: profileResponse.avatar_url || undefined,
            role:
              profileResponse.effective_role ?? (profileResponse.is_superuser ? 'admin' : 'free'),
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
            tourCompletedAt: profileResponse.settings?.tour_completed_at ?? undefined,
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

      // Update password action (Supabase doesn't require current password)
      updatePassword: async (newPassword: string) => {
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

      // Check auth on app load — deduplicated via in-flight guard + freshness window
      checkAuth: async (options?: { signal?: AbortSignal }) => {
        // --- In-flight guard ---
        // If another checkAuth call is already in flight, share that Promise
        // instead of issuing a second GET /auth/me.
        if (_checkAuthInflight !== null) {
          return _checkAuthInflight;
        }

        // --- Freshness window ---
        // If we successfully fetched the profile very recently (< 30 s ago)
        // AND the store already holds a user, skip the refetch entirely.
        const { user } = get();
        if (user !== null && Date.now() - _profileFetchedAt < PROFILE_FRESHNESS_MS) {
          return;
        }

        const signal = options?.signal;

        // Wrap the actual fetch in a Promise we store so concurrent callers
        // can attach to it rather than spawning their own requests.
        _checkAuthInflight = (async () => {
          try {
            // Check Supabase session
            const {
              data: { session },
            } = await supabase.auth.getSession();

            if (!session) {
              set({ isAuthenticated: false, isLoading: false });
              return;
            }

            const { isAuthenticated } = get();
            if (!isAuthenticated) {
              set({ isLoading: true });
            }

            const profileResponse = await authAPI.getProfile({ signal });

            // Check if aborted after the call
            if (signal?.aborted) {
              return;
            }

            // Transform backend user response to frontend User type
            const fetchedUser: User = {
              id: profileResponse.id,
              email: profileResponse.email,
              name: profileResponse.full_name || profileResponse.email.split('@')[0],
              avatar: profileResponse.avatar_url || undefined,
              role:
                profileResponse.effective_role ?? (profileResponse.is_superuser ? 'admin' : 'free'),
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
              tourCompletedAt: profileResponse.settings?.tour_completed_at ?? undefined,
            };

            // Record successful fetch time for freshness tracking
            _profileFetchedAt = Date.now();

            // Re-identify user to ensure PostHog session continuity
            if (typeof posthog?.identify === 'function') {
              posthog.identify(fetchedUser.id, {
                email: fetchedUser.email,
                created_at: fetchedUser.createdAt.toISOString(),
              });
            }

            set({
              user: fetchedUser,
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
          } finally {
            // Always release the in-flight guard so future calls can proceed
            _checkAuthInflight = null;
          }
        })();

        return _checkAuthInflight;
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
