/**
 * App Initialization Store
 *
 * Tracks application readiness state for E2E test synchronization.
 * Provides a deterministic signal that the app is ready for interaction.
 *
 * Two initialization phases:
 * 1. reactHydrated - React has mounted (set in App.tsx useEffect)
 * 2. authInitialized - Auth check complete (set in RouteGuard finally block)
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface AppState {
  reactHydrated: boolean;
  authInitialized: boolean;
  isReady: boolean;

  setReactHydrated: () => void;
  setAuthInitialized: () => void;
  reset: () => void;
}

export const useAppStore = create<AppState>()(
  devtools(
    (set) => ({
      reactHydrated: false,
      authInitialized: false,
      isReady: false,

      setReactHydrated: () => {
        set((state) => ({
          reactHydrated: true,
          isReady: state.authInitialized,
        }));
      },

      setAuthInitialized: () => {
        set((state) => ({
          authInitialized: true,
          isReady: state.reactHydrated,
        }));
      },

      reset: () => {
        set({
          reactHydrated: false,
          authInitialized: false,
          isReady: false,
        });
      },
    }),
    { name: 'appStore' }
  )
);

export const selectIsReady = (state: AppState) => state.isReady;
