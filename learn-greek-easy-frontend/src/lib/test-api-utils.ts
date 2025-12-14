/**
 * Test API Utilities
 * Helper functions for integration tests with real backend API
 */

/**
 * Test user credentials from E2E seeding
 * These users are created by the backend seed endpoint
 */
export const TEST_USERS = {
  learner: {
    email: 'e2e_learner@test.com',
    password: 'TestPassword123!',
    description: 'Regular user with progress and review history',
  },
  beginner: {
    email: 'e2e_beginner@test.com',
    password: 'TestPassword123!',
    description: 'New user with no progress',
  },
  advanced: {
    email: 'e2e_advanced@test.com',
    password: 'TestPassword123!',
    description: 'Advanced user with extensive progress',
  },
  admin: {
    email: 'e2e_admin@test.com',
    password: 'TestPassword123!',
    description: 'Admin user with full permissions',
  },
} as const;

/**
 * Check if tests are running with a real API backend
 * Returns true when VITE_API_URL is set (typically in CI)
 */
export function isRealApiMode(): boolean {
  try {
    const apiUrl = import.meta.env.VITE_API_URL;
    return Boolean(apiUrl && apiUrl !== 'undefined');
  } catch {
    return false;
  }
}

/**
 * Get the API URL for test requests
 * Returns the configured API URL or default localhost
 */
export function getApiUrl(): string {
  try {
    return import.meta.env.VITE_API_URL || 'http://localhost:8000';
  } catch {
    return 'http://localhost:8000';
  }
}

/**
 * Wait for a condition to be true
 * Useful for async operations in tests
 *
 * @param condition - Function that returns true when condition is met
 * @param options - Configuration options
 * @returns Promise that resolves when condition is met or rejects on timeout
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: {
    timeout?: number;
    interval?: number;
    message?: string;
  } = {}
): Promise<void> {
  const { timeout = 5000, interval = 100, message = 'Condition not met' } = options;

  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const result = await condition();
    if (result) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`waitFor timeout: ${message}`);
}

/**
 * Make an authenticated API request using test user credentials
 *
 * @param user - Test user key from TEST_USERS
 * @param endpoint - API endpoint (without base URL)
 * @param options - Fetch options
 * @returns Fetch response
 */
export async function authenticatedFetch(
  user: keyof typeof TEST_USERS,
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const apiUrl = getApiUrl();
  const userCredentials = TEST_USERS[user];

  // Login to get token
  const loginResponse = await fetch(`${apiUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      username: userCredentials.email,
      password: userCredentials.password,
    }),
  });

  if (!loginResponse.ok) {
    throw new Error(`Login failed for user ${user}: ${loginResponse.statusText}`);
  }

  const { access_token } = await loginResponse.json();

  // Make authenticated request
  return fetch(`${apiUrl}${endpoint}`, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${access_token}`,
    },
  });
}
