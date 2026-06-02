/**
 * DEV-ONLY: MOB-03 stand-in / override for exercising the MOB-04 app shell.
 *
 * PURPOSE
 * -------
 * Allows shell screens (MOB-04) to exercise signed-in / signed-out / loading
 * states without a real Supabase session during development. This is a
 * temporary development harness — it MUST NEVER reach production behaviour.
 *
 * LIFECYCLE
 * ---------
 * SHELL-09 removes this file entirely. Do not keep it beyond that subtask.
 *
 * HARD CONSTRAINTS
 * ----------------
 * - Does NOT import the Supabase client, the auth store, or SecureStore at
 *   runtime. The `import type` from @supabase/supabase-js is type-erased at
 *   compile time and carries zero runtime cost.
 * - Has no side effects outside of standard React state.
 */

import { useState, useEffect } from 'react';
import type { Session, User } from '@supabase/supabase-js';

// ─── Toggle constants ────────────────────────────────────────────────────────
// Flip DEV_AUTH_STATE to 'signed-in' to exercise authenticated shell screens.
const DEV_AUTH_STATE: 'signed-in' | 'signed-out' = 'signed-out';

// Set SIMULATE_RESTORE_MS > 0 (e.g. 800) to exercise the isLoading window
// before the session "restores". 0 resolves on the first microtask tick.
const SIMULATE_RESTORE_MS = 0;
// ─────────────────────────────────────────────────────────────────────────────

/** Hardcoded minimal user returned when DEV_AUTH_STATE === 'signed-in'. */
const DEV_USER = {
  id: 'dev-user-00000000-0000-0000-0000-000000000001',
  email: 'dev@example.com',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: '2024-01-01T00:00:00.000Z',
} as unknown as User;

/** Hardcoded minimal session returned when DEV_AUTH_STATE === 'signed-in'. */
const DEV_SESSION = {
  access_token: 'dev-access-token',
  refresh_token: 'dev-refresh-token',
  expires_in: 3600,
  token_type: 'bearer',
  user: DEV_USER,
} as unknown as Session;

/**
 * Dev-only hook that mirrors the production `useAuth()` return shape exactly:
 * `{ session: Session | null; user: User | null; isLoading: boolean }`
 *
 * Swap this out for the real `useAuth` (src/hooks/use-auth.ts) when wiring
 * screens to production auth. SHELL-09 deletes this hook entirely.
 */
export function useAuthDevOverride(): {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
} {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    if (SIMULATE_RESTORE_MS > 0) {
      timer = setTimeout(() => setIsLoading(false), SIMULATE_RESTORE_MS);
    } else {
      // Resolve on the next microtask so the component sees isLoading=true
      // for exactly one render before flipping — avoids a synchronous flash.
      timer = setTimeout(() => setIsLoading(false), 0);
    }

    return () => {
      if (timer !== undefined) clearTimeout(timer);
    };
  }, []);

  if (isLoading) {
    return { session: null, user: null, isLoading: true };
  }

  if (DEV_AUTH_STATE === 'signed-in') {
    return { session: DEV_SESSION, user: DEV_USER, isLoading: false };
  }

  return { session: null, user: null, isLoading: false };
}
