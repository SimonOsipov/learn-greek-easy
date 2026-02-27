import { describe, expect, it } from 'vitest';

import { mapSupabaseResetError } from '../auth-errors';

describe('mapSupabaseResetError', () => {
  it('returns sessionExpired for "session expired" messages', () => {
    expect(mapSupabaseResetError('Auth session expired')).toBe('sessionExpired');
  });

  it('returns sessionExpired for "session missing" messages', () => {
    expect(mapSupabaseResetError('Auth session missing')).toBe('sessionExpired');
  });

  it('returns sessionExpired for refresh_token errors', () => {
    expect(mapSupabaseResetError('Invalid refresh_token')).toBe('sessionExpired');
  });

  it('returns sessionExpired for "not authenticated" errors', () => {
    expect(mapSupabaseResetError('User is not authenticated')).toBe('sessionExpired');
  });

  it('returns samePassword for "same password" errors', () => {
    expect(mapSupabaseResetError('New password must be different. Cannot use same password')).toBe(
      'samePassword'
    );
  });

  it('returns weakPassword for "weak password" errors', () => {
    expect(mapSupabaseResetError('Password is too weak')).toBe('weakPassword');
  });

  it('returns updateFailed for unknown errors', () => {
    expect(mapSupabaseResetError('Something unexpected happened')).toBe('updateFailed');
  });
});
