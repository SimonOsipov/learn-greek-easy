import Constants from 'expo-constants';

export function getSupabaseConfig(): { supabaseUrl: string; supabaseAnonKey: string } {
  const extra = Constants.expoConfig?.extra as
    | { supabaseUrl?: string; supabaseAnonKey?: string }
    | undefined;

  const supabaseUrl = extra?.supabaseUrl;
  const supabaseAnonKey = extra?.supabaseAnonKey;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase config in app.config extra (supabaseUrl/supabaseAnonKey)',
    );
  }

  return { supabaseUrl, supabaseAnonKey };
}
