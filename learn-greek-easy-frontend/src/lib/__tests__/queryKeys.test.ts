// src/lib/__tests__/queryKeys.test.ts
//
// PERF-22-01 (RED): the module under test — src/lib/queryKeys.ts — does not
// exist yet. This file authors the acceptance-criteria tests from the
// architect's Test Specs table (task-1264) BEFORE implementation. Until the
// executor lands src/lib/queryKeys.ts, the import below fails module
// resolution (expected RED reason for the whole file). Once the module
// exists with the right shape, each assertion below is what proves the
// behavior — key shape, cache dedup, user-scoping, and single-attempt
// (retry:false) semantics.

import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { DeckProgressListResponse } from '@/services/progressAPI';

// Mock progressAPI before importing the module under test.
vi.mock('@/services/progressAPI', () => ({
  progressAPI: {
    getDeckProgressList: vi.fn(),
  },
}));

// Import after mocks are registered. `queryClient` is the real app-wide
// singleton (NOT mocked) — fetchDeckProgressList is only meaningful when
// wrapping the real cache, and a throwaway `new QueryClient()` would give a
// false-positive dedup result.
import { queryClient } from '@/lib/queryClient';
import { progressAPI } from '@/services/progressAPI';
// src/lib/queryKeys.ts is created by PERF-22-01 — this import fails module
// resolution (RED) until then.
import { queryKeys, fetchDeckProgressList } from '@/lib/queryKeys';

const stubDeckProgress: DeckProgressListResponse = {
  total: 0,
  page: 1,
  page_size: 50,
  decks: [],
};

describe('queryKeys', () => {
  it('progressDecks/exerciseQueue keys are user-scoped', () => {
    expect(queryKeys.progressDecks('u1')).toEqual(['progress-decks', 'u1']);
    expect(queryKeys.exerciseQueue('u1')).toEqual(['exercise-queue', 'u1']);
  });
});

describe('fetchDeckProgressList', () => {
  beforeEach(() => {
    // Clear the SINGLETON cache — not a throwaway client — so no test leaks
    // cached entries into the next one.
    queryClient.clear();
    vi.clearAllMocks();
  });

  it('dedups repeated calls within staleTime', async () => {
    vi.mocked(progressAPI.getDeckProgressList).mockResolvedValue(stubDeckProgress);

    const first = await fetchDeckProgressList('u1');
    const second = await fetchDeckProgressList('u1');

    expect(progressAPI.getDeckProgressList).toHaveBeenCalledTimes(1);
    expect(first).toEqual(stubDeckProgress);
    expect(second).toEqual(stubDeckProgress);
  });

  it('distinct users get distinct cache entries', async () => {
    vi.mocked(progressAPI.getDeckProgressList).mockResolvedValue(stubDeckProgress);

    await fetchDeckProgressList('u1');
    await fetchDeckProgressList('u2');

    expect(progressAPI.getDeckProgressList).toHaveBeenCalledTimes(2);
  });

  it('does not retry on rejection (retry: false)', async () => {
    vi.mocked(progressAPI.getDeckProgressList).mockRejectedValue(new Error('decks API down'));

    await expect(fetchDeckProgressList('u1')).rejects.toThrow('decks API down');
    // Singleton default is retry:1 (queryClient.ts:18) — a second invocation
    // here would mean fetchDeckProgressList forgot to override retry:false.
    expect(progressAPI.getDeckProgressList).toHaveBeenCalledTimes(1);
  });
});
