// src/hooks/__tests__/useWarmDeckCovers.test.tsx
// PERF-15-06 (F2) — the deck-cover warm must be skipped on /dashboard (the
// dashboard now sources deck + cover data from GET /dashboard/summary via
// useDashboardSummary) but must still fire on every OTHER protected route,
// exactly as before this story.
//
// ProtectedRoute.integration.test.tsx stubs this hook to a no-op entirely
// (it only cares about route-guard behavior); this file is the real,
// route-aware coverage for the hook itself.

import { createElement } from 'react';

import { renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { useWarmDeckCovers } from '../useWarmDeckCovers';

const mockEnsureDecksFresh = vi.fn(() => Promise.resolve());

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: { isAuthenticated: boolean }) => unknown) =>
    selector({ isAuthenticated: true }),
}));

vi.mock('@/stores/deckStore', () => ({
  useDeckStore: (selector: (s: { ensureDecksFresh: typeof mockEnsureDecksFresh }) => unknown) =>
    selector({ ensureDecksFresh: mockEnsureDecksFresh }),
}));

vi.mock('@/lib/errorReporting', () => ({
  reportAPIError: vi.fn(),
}));

function renderAt(pathname: string) {
  return renderHook(() => useWarmDeckCovers(), {
    wrapper: ({ children }) =>
      createElement(MemoryRouter, { initialEntries: [pathname] }, children),
  });
}

describe('useWarmDeckCovers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does NOT warm decks on /dashboard (summary endpoint already carries deck + cover data)', () => {
    renderAt('/dashboard');
    expect(mockEnsureDecksFresh).not.toHaveBeenCalled();
  });

  it('DOES warm decks on another protected route (/decks)', () => {
    renderAt('/decks');
    expect(mockEnsureDecksFresh).toHaveBeenCalledTimes(1);
  });

  it('DOES warm decks on a deck-detail route', () => {
    renderAt('/decks/abc-123');
    expect(mockEnsureDecksFresh).toHaveBeenCalledTimes(1);
  });
});
