/**
 * useDeck Hook Tests
 * Verifies that useDeck calls the dedicated getDeck endpoint and handles
 * success, 404 errors, and the disabled-when-no-id case.
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { createTestQueryClient } from '@/lib/test-utils';
import { useDeck } from '@/hooks/useDeck';

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

const mockGetDeck = vi.fn();

vi.mock('@/services/adminAPI', () => ({
  adminAPI: {
    getDeck: (...args: unknown[]) => mockGetDeck(...args),
  },
}));

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

const mockDeck = {
  id: 'deck-abc',
  name: 'Greek Basics',
  type: 'vocabulary' as const,
  level: 'A1' as const,
  category: null,
  item_count: 30,
  is_active: true,
  is_premium: false,
  is_system_deck: true,
  created_at: '2024-01-01T00:00:00Z',
  owner_id: null,
  owner_name: null,
};

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makeWrapper() {
  const queryClient = createTestQueryClient();
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return { queryClient, wrapper };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useDeck Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns deck data on success', async () => {
    mockGetDeck.mockResolvedValue(mockDeck);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useDeck('deck-abc'), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.deck).toEqual(mockDeck);
    expect(result.current.isError).toBe(false);
  });

  it('calls getDeck with the exact deckId', async () => {
    mockGetDeck.mockResolvedValue(mockDeck);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useDeck('deck-abc'), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGetDeck).toHaveBeenCalledTimes(1);
    expect(mockGetDeck).toHaveBeenCalledWith('deck-abc');
  });

  it('sets isError when getDeck throws (e.g. 404)', async () => {
    mockGetDeck.mockRejectedValue(new Error('Not Found'));

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useDeck('deck-missing'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.deck).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
  });

  it('is disabled when deckId is null', () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useDeck(null), { wrapper });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.deck).toBeUndefined();
    expect(mockGetDeck).not.toHaveBeenCalled();
  });

  it('is disabled when deckId is an empty string', () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useDeck(''), { wrapper });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.deck).toBeUndefined();
    expect(mockGetDeck).not.toHaveBeenCalled();
  });
});
