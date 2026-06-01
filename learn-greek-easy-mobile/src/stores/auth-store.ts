import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface AuthState {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  error: string | null;
  cleanup: () => void;
}

// Capture the subscription handle so cleanup() can unsubscribe.
let _unsubscribe: (() => void) | null = null;

export const useAuthStore = create<AuthState>((set) => {
  // Subscribe to auth state changes before initial session fetch so no
  // events are missed between the two async operations.
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    set({
      session,
      user: session?.user ?? null,
      isLoading: false,
    });
  });

  _unsubscribe = () => subscription.unsubscribe();

  // Populate state from persisted session (resolves immediately if cached).
  supabase.auth.getSession().then(({ data: { session } }) => {
    set({
      session,
      user: session?.user ?? null,
      isLoading: false,
    });
  });

  return {
    session: null,
    user: null,
    isLoading: true,
    error: null,
    cleanup: () => {
      _unsubscribe?.();
      _unsubscribe = null;
    },
  };
});
