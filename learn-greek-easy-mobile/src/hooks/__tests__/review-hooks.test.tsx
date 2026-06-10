/// <reference types="jest" />
/**
 * MOB-09 — Unit tests for review data hooks.
 *
 * useStudyQueue: verifies path, queryKey, enabled guard.
 * useSubmitReview: verifies mutationFn calls POST /api/v1/reviews/v2.
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

const mockApiGet  = jest.fn();
const mockApiPost = jest.fn();
jest.mock('@/lib/api-client', () => ({
  api: {
    get:  (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
  },
}));

let mockSession: Session | null = null;
jest.mock('@/stores/auth-store', () => ({
  useAuthStore: jest.fn((sel: (s: { session: Session | null }) => unknown) =>
    sel({ session: mockSession }),
  ),
}));

import { useStudyQueue } from '@/hooks/use-study-queue';
import { useSubmitReview } from '@/hooks/use-submit-review';
import { mapRatingToQuality } from '@/types/review';

function makeClient() {
  // #43: add mutations.gcTime:0 to prevent the mutation's default 5-min gcTime
  // from holding a setTimeout that causes jest to force-exit the worker after
  // mutateAsync() calls (verified root cause: TanStack Query v5 Mutation.removeObserver
  // → scheduleGc() with 5*60*1000ms default when only queries.gcTime is overridden).
  return new QueryClient({
    defaultOptions: {
      queries:   { retry: false, gcTime: 0 },
      mutations: { gcTime: 0 },
    },
  });
}

function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={makeClient()}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSession = { access_token: 'tok' } as Session;
});

// ---------------------------------------------------------------------------
// useStudyQueue
// ---------------------------------------------------------------------------

describe('useStudyQueue', () => {
  it('fetches GET /api/v1/study/queue/v2?deck_id=...', async () => {
    mockApiGet.mockResolvedValue({ total_due: 3, cards: [] });
    const { result } = renderHook(() => useStudyQueue('deck-1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApiGet).toHaveBeenCalledWith(
      '/api/v1/study/queue/v2?deck_id=deck-1&limit=20&include_new=true',
    );
  });

  it('is disabled when signed out', () => {
    mockSession = null;
    renderHook(() => useStudyQueue('deck-1'), { wrapper });
    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it('is disabled when deckId is undefined', () => {
    renderHook(() => useStudyQueue(undefined), { wrapper });
    expect(mockApiGet).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// useSubmitReview
// ---------------------------------------------------------------------------

describe('useSubmitReview', () => {
  it('posts to POST /api/v1/reviews/v2 with provided body', async () => {
    mockApiPost.mockResolvedValue({ card_record_id: 'cr-1', quality: 4 });
    const { result } = renderHook(() => useSubmitReview(), { wrapper });
    await result.current.mutateAsync({
      card_record_id: 'cr-1',
      quality: 4,
      time_taken: 8,
    });
    expect(mockApiPost).toHaveBeenCalledWith('/api/v1/reviews/v2', {
      card_record_id: 'cr-1',
      quality: 4,
      time_taken: 8,
    });
  });
});

// ---------------------------------------------------------------------------
// mapRatingToQuality
// ---------------------------------------------------------------------------

describe('mapRatingToQuality', () => {
  it('maps Again(1) → 0', () => expect(mapRatingToQuality(1)).toBe(0));
  it('maps Hard(2)  → 2', () => expect(mapRatingToQuality(2)).toBe(2));
  it('maps Good(3)  → 4', () => expect(mapRatingToQuality(3)).toBe(4));
  it('maps Easy(4)  → 5', () => expect(mapRatingToQuality(4)).toBe(5));
});
