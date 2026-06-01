import { createClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from './config';
import { LargeSecureStore } from './large-secure-store';

const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: new LargeSecureStore(),
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
