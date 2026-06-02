import { supabase } from './supabase';
import { getApiConfig } from './config';

/**
 * API error response structure (mirrors web learn-greek-easy-frontend/src/services/api.ts:33-41).
 */
export interface APIError {
  status: number;
  statusText: string;
  message: string;
  detail?: string | Record<string, unknown>[];
}

/**
 * Custom error class for API errors (mirrors web api.ts:43-55).
 */
export class APIRequestError extends Error {
  status: number;
  statusText: string;
  detail?: string | Record<string, unknown>[];

  constructor(error: APIError) {
    super(error.message);
    this.name = 'APIRequestError';
    this.status = error.status;
    this.statusText = error.statusText;
    this.detail = error.detail;
  }
}

/**
 * Minimal typed fetch wrapper for the mobile app. Copy-first port of the web
 * client (learn-greek-easy-frontend/src/services/api.ts), reduced to the
 * proof-of-wiring surface: a single authed GET. Token injection leans on the
 * Supabase client's autoRefreshToken (src/lib/supabase.ts) — no custom refresh.
 * On 401 we throw and let the MOB-03 onAuthStateChange + MOB-04 Stack.Protected
 * gate drive re-auth (prevents an infinite loop).
 */
async function request<T>(method: string, path: string): Promise<T> {
  const { apiUrl } = getApiConfig();
  const url = `${apiUrl}${path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const accessToken = session?.access_token ?? null;
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch(url, { method, headers });

  if (response.status === 401) {
    throw new APIRequestError({
      status: 401,
      statusText: 'Unauthorized',
      message: 'Session expired. Please log in again.',
    });
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      message?: string;
      detail?: string | Record<string, unknown>[];
    };
    throw new APIRequestError({
      status: response.status,
      statusText: response.statusText,
      message: body.message ?? `Request failed with status ${response.status}`,
      detail: body.detail,
    });
  }

  return (await response.json()) as T;
}

export const api = {
  get: <T>(path: string): Promise<T> => request<T>('GET', path),
};
