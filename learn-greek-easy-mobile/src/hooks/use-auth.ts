import { useAuthStore } from '@/stores/auth-store';

/**
 * Returns the current auth slice: session, user, and initial-load flag.
 * Backed by the Zustand auth store; session/user update reactively via
 * the onAuthStateChange subscription wired in the store.
 */
export function useAuth() {
  return useAuthStore((state) => ({
    session: state.session,
    user: state.user,
    isLoading: state.isLoading,
  }));
}
