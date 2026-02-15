/**
 * Playwright route mock helpers for Supabase GoTrue API.
 *
 * Use these to mock Supabase auth responses in E2E tests without
 * hitting a real Supabase instance.
 */

import type { Page } from '@playwright/test';

interface MockSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at: number;
  token_type: string;
  user: {
    id: string;
    email: string;
    [key: string]: unknown;
  };
}

/**
 * Mock a successful Supabase auth session.
 *
 * Intercepts GoTrue password sign-in and token refresh endpoints
 * to return the provided session data.
 */
export async function mockSupabaseSession(page: Page, session: MockSession): Promise<void> {
  // Mock password sign-in
  await page.route('**/auth/v1/token?grant_type=password', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(session),
    })
  );

  // Mock token refresh
  await page.route('**/auth/v1/token?grant_type=refresh_token', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(session),
    })
  );

  // Mock GET /auth/v1/user
  await page.route('**/auth/v1/user', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(session.user),
      });
    }
    return route.continue();
  });
}

/**
 * Mock a Supabase auth error response on a specific endpoint.
 *
 * @param page - Playwright page
 * @param endpoint - GoTrue endpoint pattern (e.g., 'token?grant_type=password')
 * @param error - Error object with message and optional error_description
 * @param status - HTTP status code (default: 400)
 */
export async function mockSupabaseAuthError(
  page: Page,
  endpoint: string,
  error: { error: string; error_description?: string },
  status = 400
): Promise<void> {
  await page.route(`**/auth/v1/${endpoint}`, (route) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(error),
    })
  );
}

/**
 * Mock a token refresh failure (expired/invalid refresh token).
 *
 * Useful for testing session expiry flows.
 */
export async function mockTokenRefreshFailure(page: Page): Promise<void> {
  await page.route('**/auth/v1/token?grant_type=refresh_token', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({
        error: 'invalid_grant',
        error_description: 'Token has expired or is invalid',
      }),
    })
  );
}

/**
 * Remove all Supabase GoTrue route mocks.
 */
export async function clearSupabaseMocks(page: Page): Promise<void> {
  await page.unroute('**/auth/v1/**');
}
