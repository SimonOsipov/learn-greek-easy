/**
 * Token Utility Functions
 *
 * Provides JWT token inspection for proactive refresh.
 * IMPORTANT: These utilities only read token claims for timing purposes.
 * Never trust decoded claims for authorization - always verify on backend.
 */

import log from '@/lib/logger';

/**
 * Default buffer time before expiry to trigger refresh (5 minutes)
 */
export const DEFAULT_REFRESH_BUFFER_SECONDS = 300;

/**
 * Decoded JWT payload (only the fields we care about)
 */
export interface JWTPayload {
  sub: string; // User ID
  type: string; // Token type (access/refresh)
  exp: number; // Expiration timestamp (Unix seconds)
  iat: number; // Issued at timestamp (Unix seconds)
}

/**
 * Decode a JWT token without verification.
 *
 * SECURITY NOTE: This only decodes the payload for reading expiry.
 * It does NOT verify the signature - that's the backend's job.
 *
 * @param token - The JWT access token
 * @returns The decoded payload or null if invalid
 */
export function decodeJWT(token: string): JWTPayload | null {
  try {
    // JWT format: header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    // Decode the payload (middle part)
    const payload = parts[1];
    // Handle base64url encoding (replace - with +, _ with /)
    let base64 = payload.replace(/-/g, '+').replace(/_/g, '/');

    // Add padding for robustness (QA recommendation)
    // Base64 strings should be divisible by 4
    const paddingNeeded = (4 - (base64.length % 4)) % 4;
    base64 = base64.padEnd(base64.length + paddingNeeded, '=');

    const jsonPayload = atob(base64);

    return JSON.parse(jsonPayload) as JWTPayload;
  } catch (error) {
    log.debug('Failed to decode JWT', { error });
    return null;
  }
}

/**
 * Check if a token is expired or will expire soon.
 *
 * @param token - The JWT access token
 * @param bufferSeconds - Seconds before actual expiry to consider "expired" (default: 300 = 5 min)
 * @returns true if token is expired or will expire within buffer
 */
export function isTokenExpired(
  token: string | null,
  bufferSeconds: number = DEFAULT_REFRESH_BUFFER_SECONDS
): boolean {
  if (!token) {
    return true;
  }

  const payload = decodeJWT(token);
  if (!payload || !payload.exp) {
    // Can't determine expiry - assume expired to be safe
    return true;
  }

  // exp is in seconds, Date.now() is in milliseconds
  const expiresAt = payload.exp * 1000;
  const bufferMs = bufferSeconds * 1000;
  const now = Date.now();

  return now >= expiresAt - bufferMs;
}

/**
 * Get the time remaining until token expires.
 *
 * @param token - The JWT access token
 * @returns Milliseconds until expiry, or 0 if already expired, or null if can't determine
 */
export function getTokenTimeRemaining(token: string | null): number | null {
  if (!token) {
    return null;
  }

  const payload = decodeJWT(token);
  if (!payload || !payload.exp) {
    return null;
  }

  const expiresAt = payload.exp * 1000;
  const remaining = expiresAt - Date.now();

  return remaining > 0 ? remaining : 0;
}

/**
 * Check if token should be proactively refreshed.
 *
 * Returns true if:
 * - Token is expired
 * - Token will expire within 5 minutes
 * - Token cannot be decoded (safer to refresh)
 *
 * @param token - The JWT access token
 * @returns true if token should be refreshed
 */
export function shouldRefreshToken(token: string | null): boolean {
  if (!token) {
    return false; // No token = not logged in, don't try to refresh
  }

  return isTokenExpired(token, DEFAULT_REFRESH_BUFFER_SECONDS);
}
