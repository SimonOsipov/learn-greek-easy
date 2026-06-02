import { useShallow } from 'zustand/react/shallow';

import { useAuthStore } from '@/stores/auth-store';

/**
 * Returns the current auth slice: session, user, and initial-load flag.
 * Backed by the Zustand auth store; session/user update reactively via
 * the onAuthStateChange subscription wired in the store.
 *
 * `useShallow` is required because the selector returns a new object each
 * call: under Zustand v5's Object.is snapshot equality, an unwrapped object
 * selector re-fires every render, tripping React's "getSnapshot should be
 * cached" warning and a "Maximum update depth exceeded" loop.
 */
export function useAuth() {
  return useAuthStore(
    useShallow((state) => ({
      session: state.session,
      user: state.user,
      isLoading: state.isLoading,
    })),
  );
}
