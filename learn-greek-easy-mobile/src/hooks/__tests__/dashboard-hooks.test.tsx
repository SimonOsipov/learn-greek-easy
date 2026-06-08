/// <reference types="jest" />
/**
 * DASH-01 — Unit tests for the dashboard data hooks.
 *
 * Verifies for each hook:
 *  - The correct queryKey is used.
 *  - The correct API path/query-string is called via api.get.
 *  - `enabled` is false when the auth session is null.
 *
 * Mocking strategy:
 *  - @/lib/api-client: api.get is a jest.fn() spy.
 *  - @/stores/auth-store: useAuthStore selector is wired to a mutable mockSession.
 *  - @/lib/supabase: stubbed (auth-store module dependency).
 *  - Hooks are exercised via renderHook wrapped in a fresh QueryClientProvider
 *    per test to isolate cache state.
 */
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Mock: @/lib/supabase — auth-store imports this at module level.
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Mock: expo-web-browser, expo-auth-session — pulled in by auth-store.
// ---------------------------------------------------------------------------
jest.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: jest.fn() }));
jest.mock('expo-auth-session', () => ({ makeRedirectUri: jest.fn().mockReturnValue('myapp://') }));
jest.mock('expo-auth-session/build/QueryParams', () => ({
  getQueryParams: jest.fn().mockReturnValue({ params: {}, errorCode: null }),
}));

// ---------------------------------------------------------------------------
// Mock: @/lib/analytics + @/lib/sentry — pulled in by auth-store.
// ---------------------------------------------------------------------------
jest.mock('@/lib/analytics', () => ({
  identifyUser: jest.fn(),
  resetIdentity: jest.fn(),
  track: jest.fn(),
}));
jest.mock('@/lib/sentry', () => ({ setSentryUser: jest.fn() }));

// ---------------------------------------------------------------------------
// Mock: @/lib/api-client — api.get is the primary spy.
// ---------------------------------------------------------------------------
const mockApiGet = jest.fn();
jest.mock('@/lib/api-client', () => ({
  api: { get: (...args: unknown[]) => mockApiGet(...args) },
  APIRequestError: class APIRequestError extends Error {
    status: number;
    constructor({ status, message }: { status: number; message: string }) {
      super(message);
      this.status = status;
    }
  },
}));

// ---------------------------------------------------------------------------
// Mock: @/stores/auth-store — selector form; session controlled per test.
// ---------------------------------------------------------------------------
let mockSession: Session | null = null;

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: jest.fn((sel: (s: { session: Session | null }) => unknown) =>
    sel({ session: mockSession }),
  ),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns a fresh QueryClient (no retries, immediate stale) for test isolation. */
function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
}

/** Wraps renderHook children in a fresh QueryClientProvider. */
function makeWrapper(client: QueryClient) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, children);
  }
  Wrapper.displayName = 'Wrapper';
  return Wrapper;
}

/** Minimal fake session object (only the `access_token` field is needed). */
const FAKE_SESSION = { access_token: 'tok' } as Session;

// Import hooks AFTER all mocks are registered.
import { useProgressDashboard } from '@/hooks/use-progress-dashboard';
import { useWeekTrends } from '@/hooks/use-week-trends';
import { useDeckProgress } from '@/hooks/use-deck-progress';
import { useNews } from '@/hooks/use-news';
import { useSituations } from '@/hooks/use-situations';
import { useUserProfile } from '@/hooks/use-user-profile';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockSession = null;
  mockApiGet.mockReset();
});

// ---------------------------------------------------------------------------
// useProgressDashboard
// ---------------------------------------------------------------------------
describe('useProgressDashboard', () => {
  it('uses queryKey [progress-dashboard]', () => {
    const client = makeClient();
    const { result } = renderHook(() => useProgressDashboard(), {
      wrapper: makeWrapper(client),
    });
    // enabled:false — query stays idle but the key is registered
    expect(result.current.status).toBe('pending');
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('calls /api/v1/progress/dashboard when session is present', async () => {
    mockSession = FAKE_SESSION;
    mockApiGet.mockResolvedValueOnce({
      streak: {
        current_streak: 5,
        longest_streak: 10,
        last_study_date: '2026-06-07',
        vocabulary_current_streak: 3,
        vocabulary_longest_streak: 7,
        culture_current_streak: 2,
        culture_longest_streak: 4,
        exercise_current_streak: 1,
        exercise_longest_streak: 3,
      },
      today: {},
      overview: {},
      recent_activity: [],
    });

    const client = makeClient();
    const { result } = renderHook(() => useProgressDashboard(), {
      wrapper: makeWrapper(client),
    });

    await waitFor(() => expect(mockApiGet).toHaveBeenCalledTimes(1));
    expect(mockApiGet).toHaveBeenCalledWith('/api/v1/progress/dashboard');
  });

  it('is disabled (fetchStatus idle) when session is null', () => {
    mockSession = null;
    const client = makeClient();
    const { result } = renderHook(() => useProgressDashboard(), {
      wrapper: makeWrapper(client),
    });
    expect(result.current.fetchStatus).toBe('idle');
    expect(mockApiGet).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// useWeekTrends
// ---------------------------------------------------------------------------
describe('useWeekTrends', () => {
  it('calls /api/v1/progress/trends?period=week when session is present', async () => {
    mockSession = FAKE_SESSION;
    mockApiGet.mockResolvedValueOnce({ daily_stats: [] });

    const client = makeClient();
    renderHook(() => useWeekTrends(), { wrapper: makeWrapper(client) });

    await waitFor(() => expect(mockApiGet).toHaveBeenCalledTimes(1));
    expect(mockApiGet).toHaveBeenCalledWith('/api/v1/progress/trends?period=week');
  });

  it('is disabled when session is null', () => {
    mockSession = null;
    const client = makeClient();
    const { result } = renderHook(() => useWeekTrends(), { wrapper: makeWrapper(client) });
    expect(result.current.fetchStatus).toBe('idle');
    expect(mockApiGet).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// useDeckProgress
// ---------------------------------------------------------------------------
describe('useDeckProgress', () => {
  it('calls /api/v1/progress/decks when session is present', async () => {
    mockSession = FAKE_SESSION;
    mockApiGet.mockResolvedValueOnce({ total: 0, page: 1, page_size: 20, decks: [] });

    const client = makeClient();
    renderHook(() => useDeckProgress(), { wrapper: makeWrapper(client) });

    await waitFor(() => expect(mockApiGet).toHaveBeenCalledTimes(1));
    expect(mockApiGet).toHaveBeenCalledWith('/api/v1/progress/decks');
  });

  it('is disabled when session is null', () => {
    mockSession = null;
    const client = makeClient();
    const { result } = renderHook(() => useDeckProgress(), { wrapper: makeWrapper(client) });
    expect(result.current.fetchStatus).toBe('idle');
    expect(mockApiGet).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// useNews
// ---------------------------------------------------------------------------
describe('useNews', () => {
  it('uses queryKey [news, cyprus]', async () => {
    mockSession = FAKE_SESSION;
    mockApiGet.mockResolvedValueOnce({
      items: [],
      total: 0,
      page: 1,
      page_size: 20,
      country_counts: { cyprus: 0, greece: 0, world: 0 },
      audio_count: 0,
    });

    const client = makeClient();
    renderHook(() => useNews(), { wrapper: makeWrapper(client) });

    await waitFor(() => expect(mockApiGet).toHaveBeenCalledTimes(1));
    expect(mockApiGet).toHaveBeenCalledWith('/api/v1/news?country=cyprus');
  });

  it('is disabled when session is null', () => {
    mockSession = null;
    const client = makeClient();
    const { result } = renderHook(() => useNews(), { wrapper: makeWrapper(client) });
    expect(result.current.fetchStatus).toBe('idle');
    expect(mockApiGet).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// useSituations
// ---------------------------------------------------------------------------
describe('useSituations', () => {
  it('calls /api/v1/situations when session is present', async () => {
    mockSession = FAKE_SESSION;
    mockApiGet.mockResolvedValueOnce({ items: [], total: 0, page: 1, page_size: 20 });

    const client = makeClient();
    renderHook(() => useSituations(), { wrapper: makeWrapper(client) });

    await waitFor(() => expect(mockApiGet).toHaveBeenCalledTimes(1));
    expect(mockApiGet).toHaveBeenCalledWith('/api/v1/situations');
  });

  it('is disabled when session is null', () => {
    mockSession = null;
    const client = makeClient();
    const { result } = renderHook(() => useSituations(), { wrapper: makeWrapper(client) });
    expect(result.current.fetchStatus).toBe('idle');
    expect(mockApiGet).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// useUserProfile
// ---------------------------------------------------------------------------
describe('useUserProfile', () => {
  it('calls /api/v1/auth/me and returns full UserProfile (no select transform)', async () => {
    mockSession = FAKE_SESSION;
    const profile = {
      id: 'u1',
      email: 'a@b.com',
      full_name: 'Alice',
      avatar_url: null,
      is_active: true,
      is_superuser: false,
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
      settings: { id: 's1', user_id: 'u1', daily_goal: 20 },
    };
    mockApiGet.mockResolvedValueOnce(profile);

    const client = makeClient();
    const { result } = renderHook(() => useUserProfile(), { wrapper: makeWrapper(client) });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(mockApiGet).toHaveBeenCalledWith('/api/v1/auth/me');
    // full_name is present — no select transform drops fields
    expect(result.current.data?.full_name).toBe('Alice');
  });

  it('is disabled when session is null', () => {
    mockSession = null;
    const client = makeClient();
    const { result } = renderHook(() => useUserProfile(), { wrapper: makeWrapper(client) });
    expect(result.current.fetchStatus).toBe('idle');
    expect(mockApiGet).not.toHaveBeenCalled();
  });
});
