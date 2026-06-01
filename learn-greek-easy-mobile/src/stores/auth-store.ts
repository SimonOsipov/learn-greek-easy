import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface AuthState {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  error: string | null;
  // Auth actions
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
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

    signIn: async (email: string, password: string) => {
      set({ error: null });
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        // error.message is a safe Supabase API message (not a raw credential).
        set({ error: error.message });
      }
      // session/user update is handled by onAuthStateChange — not set here.
    },

    signUp: async (email: string, password: string) => {
      set({ error: null });
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        set({ error: error.message });
      }
      // session/user update is handled by onAuthStateChange — not set here.
    },

    signOut: async () => {
      set({ error: null });
      const { error } = await supabase.auth.signOut();
      if (error) {
        set({ error: error.message });
      }
      // Storage adapter removes the persisted session; onAuthStateChange fires
      // with a null session and clears session/user in state.
    },

    cleanup: () => {
      _unsubscribe?.();
      _unsubscribe = null;
    },
  };
});
