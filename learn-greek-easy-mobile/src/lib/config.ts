import Constants from 'expo-constants';

// NOTE: getSentryConfig and getPostHogConfig intentionally deviate from the
// throw-on-missing pattern of getSupabaseConfig/getApiConfig below. Observability
// must degrade to a no-op when keys are absent — it must never crash the app.

export function getSentryConfig(): { dsn: string | undefined; environment: string } {
  const extra = Constants.expoConfig?.extra as
    | { sentryDsn?: string; environment?: string }
    | undefined;
  return {
    dsn: extra?.sentryDsn, // undefined when unset — no throw
    environment: extra?.environment ?? 'development',
  };
}

export function getPostHogConfig(): { apiKey: string | undefined; host: string } {
  const extra = Constants.expoConfig?.extra as
    | { posthogApiKey?: string; posthogHost?: string }
    | undefined;
  return {
    apiKey: extra?.posthogApiKey, // undefined when unset — no throw
    host: extra?.posthogHost ?? 'https://us.i.posthog.com', // US region — matches Greekly project id 108020
  };
}

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

export function getApiConfig(): { apiUrl: string } {
  const extra = Constants.expoConfig?.extra as { apiUrl?: string } | undefined;

  const apiUrl = extra?.apiUrl;

  if (!apiUrl) {
    throw new Error('Missing API config in app.config extra (apiUrl)');
  }

  return { apiUrl };
}
