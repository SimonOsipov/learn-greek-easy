/**
 * Auth0 Provider with React Router Navigation
 *
 * Wraps the Auth0Provider and handles the redirect callback using React Router.
 * Must be used inside BrowserRouter for useNavigate to work.
 *
 * Features:
 * - Configures Auth0 with refresh token support
 * - Uses localStorage for token caching (persistent sessions)
 * - Handles OAuth redirect callback with React Router navigation
 * - Reads configuration from environment variables
 */

import { type ReactNode } from 'react';

import { Auth0Provider, type AppState } from '@auth0/auth0-react';
import { useNavigate } from 'react-router-dom';

interface Auth0ProviderWithNavigateProps {
  children: ReactNode;
}

/**
 * Auth0Provider wrapper that integrates with React Router.
 *
 * This component must be rendered inside a BrowserRouter because it uses
 * useNavigate for handling the OAuth callback redirect.
 */
export function Auth0ProviderWithNavigate({ children }: Auth0ProviderWithNavigateProps) {
  const navigate = useNavigate();

  // Read Auth0 configuration from environment
  const domain = import.meta.env.VITE_AUTH0_DOMAIN || '';
  const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID || '';
  const audience = import.meta.env.VITE_AUTH0_AUDIENCE || '';

  // Handle the redirect callback after Auth0 authentication
  const onRedirectCallback = (appState?: AppState) => {
    // Navigate to the intended destination or dashboard
    navigate(appState?.returnTo || '/dashboard', { replace: true });
  };

  // Don't render provider if not configured
  if (!domain || !clientId) {
    // Auth0 not configured - render children without Auth0 provider
    return <>{children}</>;
  }

  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: audience || undefined,
      }}
      onRedirectCallback={onRedirectCallback}
      useRefreshTokens={true}
      cacheLocation="localstorage"
    >
      {children}
    </Auth0Provider>
  );
}
