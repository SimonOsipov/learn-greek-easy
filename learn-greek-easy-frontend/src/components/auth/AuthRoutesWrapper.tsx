import { createContext, useContext, useState, type ReactNode } from 'react';

import { GoogleOAuthProvider } from '@react-oauth/google';

/**
 * Context for sharing Google Sign-In script loading state
 *
 * This addresses Safari's GSI initialization race condition where
 * the Google accounts object may not be fully hydrated when
 * accessing internal properties like `contentType`.
 */
interface GSIScriptState {
  /** True when Google script has successfully loaded */
  isScriptReady: boolean;
  /** True if script failed to load (ad blockers, network issues, etc.) */
  hasScriptError: boolean;
}

const GSIScriptContext = createContext<GSIScriptState>({
  isScriptReady: false,
  hasScriptError: false,
});

/**
 * Hook to access GSI script loading state
 *
 * @example
 * ```tsx
 * const { isScriptReady, hasScriptError } = useGSIScriptState();
 * if (!isScriptReady) return <LoadingSpinner />;
 * if (hasScriptError) return <FallbackButton />;
 * return <GoogleLogin ... />;
 * ```
 */
export function useGSIScriptState(): GSIScriptState {
  return useContext(GSIScriptContext);
}

interface AuthRoutesWrapperProps {
  children: ReactNode;
}

/**
 * AuthRoutesWrapper - Provides GoogleOAuthProvider only for auth routes
 *
 * This prevents the Google SDK from being loaded on protected routes
 * where it's not needed (dashboard, profile, etc.)
 *
 * It also tracks script loading state to handle Safari's race condition
 * where the Google Identity Services SDK may report `onload` before
 * internal initialization is complete.
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
  // Track GSI script loading state
  const [isScriptReady, setIsScriptReady] = useState(false);
  const [hasScriptError, setHasScriptError] = useState(false);

  // Always provide GoogleOAuthProvider - even without a valid client ID.
  // The provider can exist with invalid clientId - it just won't load the Google script.
  // This prevents "must be used within GoogleOAuthProvider" errors.
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'not-configured';

  const handleScriptLoadSuccess = () => {
    setIsScriptReady(true);
    setHasScriptError(false);
  };

  const handleScriptLoadError = () => {
    setIsScriptReady(false);
    setHasScriptError(true);
  };

  return (
    <GSIScriptContext.Provider value={{ isScriptReady, hasScriptError }}>
      <GoogleOAuthProvider
        clientId={googleClientId}
        onScriptLoadSuccess={handleScriptLoadSuccess}
        onScriptLoadError={handleScriptLoadError}
      >
        {children}
      </GoogleOAuthProvider>
    </GSIScriptContext.Provider>
  );
}
