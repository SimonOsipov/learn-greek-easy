/**
 * Analytics utility functions for PostHog integration.
 * These are pure functions extracted for testability.
 */

/**
 * Determines if PostHog should be initialized based on environment.
 * Returns false if API key is missing or environment is 'test'.
 *
 * @param apiKey - The PostHog API key (VITE_POSTHOG_KEY)
 * @param environment - The current environment (VITE_ENVIRONMENT)
 * @returns true if PostHog should be initialized, false otherwise
 */
export function shouldInitializePostHog(apiKey: string | undefined, environment: string): boolean {
  return Boolean(apiKey) && environment !== 'test';
}

/**
 * Checks if a user ID belongs to a test user.
 * Patterns:
 * - test_* - Prefixed test user IDs
 * - *@test.* - Test email domains
 * - e2e_* - E2E test user IDs (matches seeding infrastructure)
 *
 * @param userId - The user ID to check (can be undefined/null)
 * @returns true if the user is a test user, false otherwise
 */
export function isTestUser(userId: string | undefined | null): boolean {
  if (typeof userId !== 'string') {
    return false;
  }
  return userId.startsWith('test_') || userId.includes('@test.') || userId.startsWith('e2e_');
}

/**
 * Generates a unique session ID using crypto.randomUUID().
 * Falls back to a polyfill for older browsers that don't support it.
 *
 * @returns A UUID v4 string for session identification
 */
export function generateSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for older browsers (produces UUID v4 format)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
