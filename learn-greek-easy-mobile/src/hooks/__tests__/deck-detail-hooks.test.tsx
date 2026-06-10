/// <reference types="jest" />
/**
 * MOB-07 — Unit tests for the deck-detail data hooks (use-deck-detail.ts).
 *
 * Verifies:
 *  - Paths and queryKeys for useDeck / useDeckWords / useDeckWordMastery.
 *  - useDeckWords loops word-entry pages until `total` is covered.
 *  - `enabled` is false (no fetch) when the auth session is null.
 *
 * Mocking strategy mirrors dashboard-hooks.test.tsx.
 */
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: jest.fn().mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      }),
    },
  },
}));
jest.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: jest.fn() }));
jest.mock('expo-auth-session', () => ({ makeRedirectUri: jest.fn().mockReturnValue('myapp://') }));
jest.mock('expo-auth-session/build/QueryParams', () => ({
  getQueryParams: jest.fn().mockReturnValue({ params: {}, errorCode: null }),
}));
jest.mock('@/lib/analytics', () => ({
  identifyUser: jest.fn(),
  resetIdentity: jest.fn(),
  track: jest.fn(),
}));
jest.mock('@/lib/sentry', () => ({ setSentryUser: jest.fn() }));

const mockApiGet = jest.fn();
jest.mock('@/lib/api-client', () => ({
  api: { get: (...args: unknown[]) => mockApiGet(...args) },
}));

let mockSession: Session | null = null;
jest.mock('@/stores/auth-store', () => ({
  useAuthStore: jest.fn((sel: (s: { session: Session | null }) => unknown) =>
    sel({ session: mockSession }),
  ),
}));

import { useDeck, useDeckWords, useDeckWordMastery } from '@/hooks/use-deck-detail';

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
}

function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={makeClient()}>{children}</QueryClientProvider>;
}

function makeWordPage(page: number, total: number, count: number) {
  return {
    deck_id: 'd1',
    total,
    page,
    page_size: 100,
    word_entries: Array.from({ length: count }, (_, i) => ({
      id: `w-${page}-${i}`,
      deck_id: 'd1',
      lemma: 'σπίτι',
      part_of_speech: 'noun',
      translation_en: 'house',
      translation_ru: null,
      pronunciation: null,
      grammar_data: null,
      is_active: true,
    })),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSession = { access_token: 'tok' } as Session;
});

describe('useDeck', () => {
  it('fetches GET /api/v1/decks/{id}', async () => {
    mockApiGet.mockResolvedValue({ id: 'd1' });
    const { result } = renderHook(() => useDeck('d1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApiGet).toHaveBeenCalledWith('/api/v1/decks/d1');
  });

  it('does not fetch when signed out', () => {
    mockSession = null;
    renderHook(() => useDeck('d1'), { wrapper });
    expect(mockApiGet).not.toHaveBeenCalled();
  });
});

describe('useDeckWords', () => {
  it('fetches a single page when total fits', async () => {
    mockApiGet.mockResolvedValueOnce(makeWordPage(1, 7, 7));
    const { result } = renderHook(() => useDeckWords('d1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApiGet).toHaveBeenCalledTimes(1);
    expect(mockApiGet).toHaveBeenCalledWith('/api/v1/decks/d1/word-entries?page=1&page_size=100');
    expect(result.current.data).toHaveLength(7);
  });

  it('loops pages until total is covered', async () => {
    mockApiGet
      .mockResolvedValueOnce(makeWordPage(1, 250, 100))
      .mockResolvedValueOnce(makeWordPage(2, 250, 100))
      .mockResolvedValueOnce(makeWordPage(3, 250, 50));
    const { result } = renderHook(() => useDeckWords('d1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApiGet).toHaveBeenCalledTimes(3);
    expect(mockApiGet).toHaveBeenLastCalledWith(
      '/api/v1/decks/d1/word-entries?page=3&page_size=100',
    );
    expect(result.current.data).toHaveLength(250);
  });

  it('does not fetch without a deckId', () => {
    renderHook(() => useDeckWords(undefined), { wrapper });
    expect(mockApiGet).not.toHaveBeenCalled();
  });
});

describe('useDeckWordMastery', () => {
  it('fetches GET /api/v1/decks/{id}/word-mastery', async () => {
    mockApiGet.mockResolvedValue({ deck_id: 'd1', items: [] });
    const { result } = renderHook(() => useDeckWordMastery('d1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApiGet).toHaveBeenCalledWith('/api/v1/decks/d1/word-mastery');
  });
});
