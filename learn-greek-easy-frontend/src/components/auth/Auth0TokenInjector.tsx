/**
 * Auth0 Token Injector Component
 *
 * Registers the Auth0 getAccessTokenSilently function with the API client.
 * This allows the API client to automatically include Auth0 tokens in requests.
 *
 * Must be rendered inside Auth0Provider and only when Auth0 is enabled.
 */

import { useEffect } from 'react';

import { useAuth0 } from '@auth0/auth0-react';

import { registerAuth0TokenGetter, unregisterAuth0TokenGetter } from '@/services/api';

/**
 * Registers Auth0 token getter with the API client on mount.
 * Unregisters on unmount to clean up.
 *
 * This component renders nothing - it's purely for side effects.
 */
export function Auth0TokenInjector(): null {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  useEffect(() => {
    // Only register if authenticated
    if (isAuthenticated) {
      registerAuth0TokenGetter(getAccessTokenSilently);
    }

    // Cleanup on unmount or when authentication changes
    return () => {
      unregisterAuth0TokenGetter();
    };
  }, [getAccessTokenSilently, isAuthenticated]);

  // This component renders nothing
  return null;
}
