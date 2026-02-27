export type ResetErrorKey = 'sessionExpired' | 'samePassword' | 'weakPassword' | 'updateFailed';

/**
 * Maps Supabase auth error messages to i18n error keys.
 * Pure function — no dependency on i18n or React.
 */
export function mapSupabaseResetError(message: string): ResetErrorKey {
  const lower = message.toLowerCase();

  if (lower.includes('session') && (lower.includes('missing') || lower.includes('expired'))) {
    return 'sessionExpired';
  }
  if (lower.includes('refresh_token') || lower.includes('not authenticated')) {
    return 'sessionExpired';
  }
  if (lower.includes('same password') || lower.includes('different from the old password')) {
    return 'samePassword';
  }
  if (lower.includes('weak password') || lower.includes('password is too weak')) {
    return 'weakPassword';
  }

  return 'updateFailed';
}
