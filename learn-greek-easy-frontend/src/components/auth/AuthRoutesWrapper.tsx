import { type ReactNode } from 'react';

import { GoogleOAuthProvider } from '@react-oauth/google';

interface AuthRoutesWrapperProps {
  children: ReactNode;
}

/**
 * AuthRoutesWrapper - Provides GoogleOAuthProvider only for auth routes
 *
 * This prevents the Google SDK from being loaded on protected routes
 * where it's not needed (dashboard, profile, etc.)
 *
 * @example
 * ```tsx
 * <Route element={<AuthRoutesWrapper><PublicRoute /></AuthRoutesWrapper>}>
 *   <Route path="/login" element={<Login />} />
 *   <Route path="/register" element={<Register />} />
 * </Route>
 * ```
 */
export function AuthRoutesWrapper({ children }: AuthRoutesWrapperProps) {
  // Always provide GoogleOAuthProvider - even without a valid client ID.
  // The provider can exist with invalid clientId - it just won't load the Google script.
  // This prevents "must be used within GoogleOAuthProvider" errors.
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'not-configured';

  return <GoogleOAuthProvider clientId={googleClientId}>{children}</GoogleOAuthProvider>;
}
