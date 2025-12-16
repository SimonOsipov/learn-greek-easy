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
        // TODO: Remove after debugging
        const timestamp = new Date().toISOString();
        const prevState = useAppStore.getState();
        console.log(
          `[E2E-DEBUG][AppStore][${timestamp}] setReactHydrated BEFORE | reactHydrated=${prevState.reactHydrated} | authInitialized=${prevState.authInitialized} | isReady=${prevState.isReady}`
        );

        set((state) => ({
          reactHydrated: true,
          isReady: state.authInitialized,
        }));

        // TODO: Remove after debugging
        const newState = useAppStore.getState();
        console.log(
          `[E2E-DEBUG][AppStore][${timestamp}] setReactHydrated AFTER | reactHydrated=${newState.reactHydrated} | authInitialized=${newState.authInitialized} | isReady=${newState.isReady}`
        );
      },

      setAuthInitialized: () => {
        // TODO: Remove after debugging
        const timestamp = new Date().toISOString();
        const prevState = useAppStore.getState();
        console.log(
          `[E2E-DEBUG][AppStore][${timestamp}] setAuthInitialized BEFORE | reactHydrated=${prevState.reactHydrated} | authInitialized=${prevState.authInitialized} | isReady=${prevState.isReady}`
        );

        set((state) => ({
          authInitialized: true,
          isReady: state.reactHydrated,
        }));

        // TODO: Remove after debugging
        const newState = useAppStore.getState();
        console.log(
          `[E2E-DEBUG][AppStore][${timestamp}] setAuthInitialized AFTER | reactHydrated=${newState.reactHydrated} | authInitialized=${newState.authInitialized} | isReady=${newState.isReady}`
        );
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
