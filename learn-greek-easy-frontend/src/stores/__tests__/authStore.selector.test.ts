// src/stores/__tests__/authStore.selector.test.ts
//
// Pure-function tests for selectHasPersistedSession.
// These tests construct plain object literals and call the selector directly —
// no store instantiation, no localStorage, no mocks.
// This avoids the persist-middleware / localStorage-timing issue that forced
// the main authStore.test.ts to describe.skip at :116.
//
// Note: AuthState is not exported from authStore.ts, so we use a local type
// that mirrors only the three fields the selector reads.

import { describe, it, expect } from 'vitest';

import { selectHasPersistedSession } from '@/stores/authStore';

// ---------------------------------------------------------------------------
// Local type — mirrors only the fields the selector reads
// ---------------------------------------------------------------------------

type SelectorInput = {
  _hasHydrated: boolean;
  isAuthenticated: boolean;
  user: { id: string } | null;
  // Remaining AuthState fields stubbed as unknown so the cast is safe
  [key: string]: unknown;
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('selectHasPersistedSession', () => {
  it('returns true when hydrated and authed user with id (AC-1)', () => {
    const state: SelectorInput = {
      _hasHydrated: true,
      isAuthenticated: true,
      user: { id: 'u1' },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(selectHasPersistedSession(state as any)).toBe(true);
  });

  it('returns false before hydration even with authed user (AC-2)', () => {
    const state: SelectorInput = {
      _hasHydrated: false,
      isAuthenticated: true,
      user: { id: 'u1' },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(selectHasPersistedSession(state as any)).toBe(false);
  });

  it('returns false when not authenticated (AC-3)', () => {
    const state: SelectorInput = {
      _hasHydrated: true,
      isAuthenticated: false,
      user: { id: 'u1' },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(selectHasPersistedSession(state as any)).toBe(false);
  });

  it('returns false when user is null (AC-3)', () => {
    const state: SelectorInput = {
      _hasHydrated: true,
      isAuthenticated: true,
      user: null,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(selectHasPersistedSession(state as any)).toBe(false);
  });

  it('returns false when user id is empty string (AC-3)', () => {
    const state: SelectorInput = {
      _hasHydrated: true,
      isAuthenticated: true,
      user: { id: '' },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(selectHasPersistedSession(state as any)).toBe(false);
  });

  it('is pure, no side effects — identical result on two calls, frozen state does not throw (AC-4)', () => {
    const raw: SelectorInput = {
      _hasHydrated: true,
      isAuthenticated: true,
      user: { id: 'u1' },
    };
    const state = Object.freeze(raw);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const first = selectHasPersistedSession(state as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const second = selectHasPersistedSession(state as any);

    expect(first).toBe(second);
    // Reaching here without TypeError confirms the selector did not mutate the frozen object.
    expect(typeof first).toBe('boolean');
  });
});
