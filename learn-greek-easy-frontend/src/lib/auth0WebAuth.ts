/**
 * Auth0 WebAuth Client
 *
 * Provides embedded authentication using Auth0's auth0-js library.
 * This allows signup and password reset without redirecting users away from our app.
 *
 * Used for:
 * - Email/password registration (embedded form)
 * - Resend verification email (via password reset flow)
 * - Google OAuth (redirect-based, acceptable)
 */

import auth0 from 'auth0-js';

import log from '@/lib/logger';

/**
 * Auth0 WebAuth instance
 * Configured using environment variables
 */
function createWebAuth(): auth0.WebAuth | null {
  const domain = import.meta.env.VITE_AUTH0_DOMAIN;
  const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
  const audience = import.meta.env.VITE_AUTH0_AUDIENCE;

  if (!domain || !clientId) {
    log.warn('[Auth0WebAuth] Missing Auth0 configuration (domain or clientId)');
    return null;
  }

  return new auth0.WebAuth({
    domain,
    clientID: clientId,
    audience,
    responseType: 'token id_token',
    scope: 'openid profile email',
    redirectUri: `${window.location.origin}/callback`,
  });
}

// Lazy initialization - created on first use
let webAuthInstance: auth0.WebAuth | null = null;

function getWebAuth(): auth0.WebAuth {
  if (!webAuthInstance) {
    webAuthInstance = createWebAuth();
    if (!webAuthInstance) {
      throw new Error('Auth0 is not configured. Please check environment variables.');
    }
  }
  return webAuthInstance;
}

/**
 * Auth0 signup error type
 */
export interface Auth0SignupError {
  code: string;
  description: string;
  name?: string;
  statusCode?: number;
}

/**
 * Auth0 signup result
 */
export interface Auth0SignupResult {
  Id: string;
  email: string;
  emailVerified: boolean;
}

/**
 * Map Auth0 error codes to user-friendly messages
 */
function mapAuth0ErrorToMessage(error: Auth0SignupError): string {
  switch (error.code) {
    case 'invalid_signup':
      // Usually means email already exists
      return 'emailExists';
    case 'user_exists':
      return 'emailExists';
    case 'username_exists':
      return 'emailExists';
    case 'invalid_password':
      return 'invalidPassword';
    case 'password_strength_error':
      return 'invalidPassword';
    case 'password_dictionary_error':
      return 'invalidPassword';
    case 'password_no_user_info_error':
      return 'invalidPassword';
    case 'password_history_error':
      return 'invalidPassword';
    case 'extensibility_error':
      // Custom rule/action error
      log.error('[Auth0WebAuth] Extensibility error:', error.description);
      return 'auth0Error';
    case 'access_denied':
      return 'auth0Error';
    default:
      log.error('[Auth0WebAuth] Unknown error code:', error.code, error.description);
      return 'auth0Error';
  }
}

/**
 * Sign up a new user with Auth0 using embedded form
 *
 * @param email User's email address
 * @param password User's password
 * @param name User's full name (stored in user_metadata)
 * @returns Promise that resolves on successful signup
 * @throws Error with translated error key on failure
 */
export function signupWithAuth0(
  email: string,
  password: string,
  name: string
): Promise<Auth0SignupResult> {
  return new Promise((resolve, reject) => {
    const webAuth = getWebAuth();

    webAuth.signup(
      {
        connection: 'Username-Password-Authentication',
        email,
        password,
        userMetadata: {
          name,
          agreedToTerms: true,
          agreedToTermsAt: new Date().toISOString(),
        },
      },
      (err, result) => {
        if (err) {
          const auth0Error = err as Auth0SignupError;
          log.error('[Auth0WebAuth] Signup error:', auth0Error.code, auth0Error.description);
          const errorKey = mapAuth0ErrorToMessage(auth0Error);
          reject(new Error(errorKey));
          return;
        }

        log.info('[Auth0WebAuth] Signup successful for:', email);
        resolve(result as Auth0SignupResult);
      }
    );
  });
}

/**
 * Trigger password reset email
 * Used for "resend verification email" since Auth0's email verification
 * doesn't have a public API. The password reset email allows users to
 * set their password and verify their email in one step.
 *
 * @param email User's email address
 * @returns Promise that resolves on successful request
 * @throws Error on failure
 */
export function changePassword(email: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const webAuth = getWebAuth();

    webAuth.changePassword(
      {
        connection: 'Username-Password-Authentication',
        email,
      },
      (err, result) => {
        if (err) {
          log.error('[Auth0WebAuth] Change password error:', err);
          reject(new Error('Failed to send reset email. Please try again.'));
          return;
        }

        log.info('[Auth0WebAuth] Password reset email sent to:', email);
        resolve(result as string);
      }
    );
  });
}

/**
 * Auth0 login error type
 */
export interface Auth0LoginError {
  code: string;
  description: string;
  original?: string;
  statusCode?: number;
}

/**
 * Map Auth0 login error codes to user-friendly error keys
 */
function mapAuth0LoginErrorToMessage(error: Auth0LoginError): string {
  switch (error.code) {
    case 'invalid_grant':
      return 'invalidCredentials';
    case 'access_denied':
      return 'invalidCredentials';
    case 'too_many_attempts':
      return 'tooManyAttempts';
    case 'user_is_blocked':
      return 'userBlocked';
    case 'requires_verification':
      return 'requiresVerification';
    case 'invalid_user_password':
      return 'invalidCredentials';
    case 'unauthorized':
      return 'invalidCredentials';
    default:
      log.error('[Auth0WebAuth] Unknown login error code:', error.code, error.description);
      return 'auth0Error';
  }
}

/**
 * Login a user with Auth0 using embedded form (Resource Owner flow)
 *
 * @param email User's email address
 * @param password User's password
 * @returns Promise that resolves with auth result on successful login
 * @throws Error with translated error key on failure
 */
export function loginWithAuth0(email: string, password: string): Promise<auth0.Auth0DecodedHash> {
  return new Promise((resolve, reject) => {
    const webAuth = getWebAuth();

    webAuth.login(
      {
        realm: 'Username-Password-Authentication',
        email,
        password,
        responseType: 'token id_token',
        scope: 'openid profile email',
        redirectUri: `${window.location.origin}/callback`,
      },
      (err, result) => {
        if (err) {
          const auth0Error = err as Auth0LoginError;
          log.error('[Auth0WebAuth] Login error:', auth0Error.code, auth0Error.description);
          const errorKey = mapAuth0LoginErrorToMessage(auth0Error);
          reject(new Error(errorKey));
          return;
        }

        log.info('[Auth0WebAuth] Login successful for:', email);
        resolve(result as auth0.Auth0DecodedHash);
      }
    );
  });
}

/**
 * Initiate Google OAuth login
 * This uses redirect-based flow (acceptable for OAuth providers)
 *
 * @param returnTo Optional path to return to after authentication
 */
export function loginWithGoogle(returnTo?: string): void {
  const webAuth = getWebAuth();

  webAuth.authorize({
    connection: 'google-oauth2',
    redirectUri: `${window.location.origin}/callback`,
    state: returnTo ? JSON.stringify({ returnTo }) : undefined,
  });
}

/**
 * Initiate Google OAuth signup
 * Same as login for OAuth - Auth0 handles account creation
 *
 * @param returnTo Optional path to return to after authentication
 */
export function signupWithGoogle(returnTo?: string): void {
  // For OAuth providers, signup and login are the same flow
  // Auth0 will create the account if it doesn't exist
  loginWithGoogle(returnTo);
}
