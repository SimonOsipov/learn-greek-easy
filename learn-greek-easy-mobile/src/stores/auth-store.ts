import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { getQueryParams } from 'expo-auth-session/build/QueryParams';
import { supabase } from '@/lib/supabase';

// Complete any pending browser auth sessions on module load.
WebBrowser.maybeCompleteAuthSession();

interface AuthState {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  error: string | null;
  // Auth actions
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
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

    signInWithGoogle: async () => {
      set({ error: null });
      try {
        const redirectTo = makeRedirectUri();

        // Step 1: get the OAuth URL from Supabase (skipBrowserRedirect so we
        // can open it ourselves with expo-web-browser).
        const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo, skipBrowserRedirect: true },
        });
        if (oauthError) throw oauthError;

        // Step 2: open the browser and wait for the redirect back to our app.
        const res = await WebBrowser.openAuthSessionAsync(data.url ?? '', redirectTo);
        if (res.type !== 'success') return;

        // Step 3: extract tokens from the redirect URL and hand them to
        // Supabase. detectSessionInUrl is false so we must do this explicitly.
        const { params, errorCode } = getQueryParams(res.url);
        if (errorCode) throw new Error(errorCode);

        const { access_token, refresh_token } = params;
        if (!access_token) return;

        // setSession triggers onAuthStateChange which updates session/user.
        await supabase.auth.setSession({
          access_token,
          refresh_token: refresh_token ?? '',
        });
      } catch (err: unknown) {
        // Sanitize: surface only the message string, never token values.
        const message = err instanceof Error ? err.message : 'Google sign-in failed';
        set({ error: message });
      }
    },

    cleanup: () => {
      _unsubscribe?.();
      _unsubscribe = null;
    },
  };
});
