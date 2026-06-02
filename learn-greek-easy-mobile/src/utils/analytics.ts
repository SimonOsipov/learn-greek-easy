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
