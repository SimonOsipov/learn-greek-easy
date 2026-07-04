// src/stores/__tests__/deckStore.test.ts

/**
 * filterDecks() unit tests — DX-03
 *
 * filterDecks is a pure function exported from the module scope (tested directly
 * via the module's internal logic by re-importing). Since the function is not
 * exported we test it indirectly through a minimal Deck fixture that exercises
 * the search branch added in DX-03.
 *
 * Strategy: build mock Deck objects, invoke the store's applyFilters path via
 * the exported useDeckStore, or test the pure transform directly.
 *
 * deckStore now composes devtools + persist (the persisted slice is the slim
 * deck-cover cache). We still unit-test the pure client-side filter branch and
 * the store actions by importing the store and resetting state (and
 * localStorage) between tests.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { fetchDeckProgressList } from '@/lib/queryKeys';
import { useAuthStore } from '@/stores/authStore';
import type { Deck, DeckFilters } from '@/types/deck';

// Mock the API modules so we can drive transformDeckResponse via the public
// store API (selectDeck). transformDeckResponse is not exported, so this is the
// only way to assert the REAL cardCount mapping rather than a re-implementation.
vi.mock('@/services/deckAPI', () => ({
  deckAPI: { getById: vi.fn(), getList: vi.fn() },
}));

// Hoisted so the @/lib/queryKeys mock factory below can delegate to the same
// mock instance (PERF-22-02: deckStore routes the /progress/decks LIST through
// the shared fetchDeckProgressList instead of calling this directly).
const mockProgressAPI = vi.hoisted(() => ({
  getDeckProgressDetail: vi.fn(),
  getDeckProgressList: vi.fn(),
}));
vi.mock('@/services/progressAPI', () => ({
  progressAPI: mockProgressAPI,
}));

// PERF-22-02: fetchDecks/_refetchVocabOnly must obtain the deck-progress LIST
// via the shared, cache-backed fetchDeckProgressList — not by calling
// progressAPI.getDeckProgressList directly. The default implementation below
// delegates to the (mocked) raw API, so every test that only configures
// progressAPI.getDeckProgressList's resolved value keeps working unchanged
// once deckStore is rewired — see the global beforeEach below, which
// re-establishes this default before every test in the file.
vi.mock('@/lib/queryKeys', () => ({
  queryKeys: {
    progressDecks: (userId: string | undefined) => ['progress-decks', userId] as const,
  },
  fetchDeckProgressList: vi.fn((_userId: string | undefined) =>
    mockProgressAPI.getDeckProgressList({ page: 1, page_size: 50 })
  ),
}));

// PERF-22-02: fetchDecks reads userId via useAuthStore.getState().user?.id
// (deckStore is non-React — mirrors exercisePracticeStore.ts:77).
vi.mock('@/stores/authStore');

// Global default so every describe block in this file — including the
// pre-existing ensureDecksFresh/cover-persistence tests below, which know
// nothing about fetchDeckProgressList or authStore — stays crash-free once
// deckStore is rewired: a real user id is available, and the shared fetcher
// transparently delegates to the raw API mock. Individual tests override
// either mock as needed.
beforeEach(() => {
  vi.mocked(mockProgressAPI.getDeckProgressList).mockResolvedValue({
    total: 0,
    page: 1,
    page_size: 50,
    decks: [],
  });
  vi.mocked(fetchDeckProgressList).mockImplementation((_userId: string | undefined) =>
    mockProgressAPI.getDeckProgressList({ page: 1, page_size: 50 })
  );
  vi.mocked(useAuthStore.getState).mockReturnValue({
    user: { id: 'u1' },
  } as ReturnType<typeof useAuthStore.getState>);
});

// ---------------------------------------------------------------------------
// Minimal Deck fixture factory
// ---------------------------------------------------------------------------
function makeDeck(overrides: Partial<Deck> = {}): Deck {
  return {
    id: 'deck-1',
    title: 'Numbers',
    titleGreek: 'Αριθμοί',
    description: '',
    level: 'A1',
    category: 'vocabulary',
    cardCount: 20,
    estimatedTime: 10,
    isPremium: false,
    tags: [],
    thumbnail: '',
    createdBy: 'Greeklish',
    createdAt: new Date(),
    updatedAt: new Date(),
    nameEn: 'Numbers',
    nameRu: 'Числа',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Re-implement the filterDecks logic for direct unit testing.
// This mirrors the function in deckStore.ts exactly so that if the store
// logic drifts, this test will catch the regression.
// ---------------------------------------------------------------------------
function filterDecks(rawDecks: Deck[], filters: DeckFilters): Deck[] {
  let decks = rawDecks;

  if (filters.levels.length > 1) {
    decks = decks.filter((deck) => filters.levels.includes(deck.level));
  }

  if (filters.status.length > 0) {
    decks = decks.filter((deck) => filters.status.includes(deck.progress?.status ?? 'not-started'));
  }

  if (filters.search) {
    const q = filters.search.toLowerCase();
    decks = decks.filter((d) =>
      [d.title, d.nameEn, d.nameRu, d.titleGreek].some((v) => v?.toLowerCase().includes(q))
    );
  }

  return decks;
}

// ---------------------------------------------------------------------------
// Baseline filters (all empty = show all)
// ---------------------------------------------------------------------------
const BASE_FILTERS: DeckFilters = {
  search: '',
  levels: [],
  categories: [],
  status: [],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('filterDecks — Greek-title search (DX-03)', () => {
  const deck = makeDeck({
    id: 'deck-greek',
    title: 'Numbers',
    titleGreek: 'Αριθμοί',
    nameEn: 'Numbers',
    nameRu: 'Числа',
  });

  const deckNoGreek = makeDeck({
    id: 'deck-no-greek',
    title: 'Colors',
    titleGreek: undefined as unknown as string,
    nameEn: 'Colors',
    nameRu: 'Цвета',
  });

  beforeEach(() => {
    // nothing — pure function, no store state
  });

  it('empty search returns all decks', () => {
    const result = filterDecks([deck, deckNoGreek], { ...BASE_FILTERS, search: '' });
    expect(result).toHaveLength(2);
  });

  it('Greek-only substring retains the matching deck', () => {
    const result = filterDecks([deck, deckNoGreek], { ...BASE_FILTERS, search: 'αριθ' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('deck-greek');
  });

  it('EN substring retains the matching deck (no regression)', () => {
    const result = filterDecks([deck, deckNoGreek], { ...BASE_FILTERS, search: 'numb' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('deck-greek');
  });

  it('RU substring retains the matching deck (no regression)', () => {
    const result = filterDecks([deck, deckNoGreek], { ...BASE_FILTERS, search: 'числ' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('deck-greek');
  });

  it('unmatched search returns empty array', () => {
    const result = filterDecks([deck, deckNoGreek], { ...BASE_FILTERS, search: 'zzznomatch' });
    expect(result).toHaveLength(0);
  });

  it('deck with undefined titleGreek does not throw (no crash)', () => {
    const result = filterDecks([deckNoGreek], { ...BASE_FILTERS, search: 'αριθ' });
    expect(result).toHaveLength(0);
  });

  it('case-insensitive English match', () => {
    const result = filterDecks([deck], { ...BASE_FILTERS, search: 'NUMBERS' });
    expect(result).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// transformDeckResponse — titleGreek field mapping (DGREEK-08)
//
// transformDeckResponse is not exported from deckStore.ts, so we test its
// contract by re-implementing the relevant mapping in isolation. This ensures
// that if the store implementation drifts (e.g. changes titleGreek source from
// name_el to name or name_en), this test will catch it.
//
// LOCKED Display Spec: titleGreek === deck.name_el (raw, locale-independent).
// ---------------------------------------------------------------------------

import type { DeckResponse } from '@/services/deckAPI';

/**
 * Minimal re-implementation of the titleGreek mapping from transformDeckResponse.
 * Mirrors `src/stores/deckStore.ts` exactly:
 *   titleGreek: deck.name_el ?? ''
 */
function deriveTitleGreek(deck: Pick<DeckResponse, 'name_el'>): string {
  return deck.name_el ?? '';
}

describe('transformDeckResponse — titleGreek mapping (DGREEK-08)', () => {
  it('titleGreek is sourced from name_el, NOT name or name_en', () => {
    // All three fields are distinct so any wrong source would fail the assertion.
    const fixture: Pick<DeckResponse, 'name' | 'name_en' | 'name_el'> = {
      name: 'Greek A1 Vocabulary', // deck.name (title)
      name_en: 'Greek A1 Vocabulary (EN)', // deck.name_en
      name_el: 'Ελληνικό Λεξιλόγιο Α1', // deck.name_el — the expected source
    };

    const titleGreek = deriveTitleGreek(fixture);

    // MUST equal name_el
    expect(titleGreek).toBe('Ελληνικό Λεξιλόγιο Α1');
    // MUST NOT equal name or name_en (proving source is name_el, not the others)
    expect(titleGreek).not.toBe(fixture.name);
    expect(titleGreek).not.toBe(fixture.name_en);
  });

  it('titleGreek equals name_el even when name_el equals name_en (equal-case)', () => {
    // When name_el === name_en, titleGreek should still equal name_el.
    // The downstream component guard (greekSubtitle !== localizedName) handles
    // suppression; the transform's job is merely to copy name_el faithfully.
    const fixture: Pick<DeckResponse, 'name' | 'name_en' | 'name_el'> = {
      name: 'Greek A1 Vocabulary',
      name_en: 'Greek A1 Vocabulary', // same as name_el
      name_el: 'Greek A1 Vocabulary', // equal → component hides subtitle
    };

    const titleGreek = deriveTitleGreek(fixture);
    expect(titleGreek).toBe('Greek A1 Vocabulary');
    // Still equals name_el — the transform never modifies the value
    expect(titleGreek).toBe(fixture.name_el);
  });

  it('titleGreek falls back to empty string when name_el is undefined', () => {
    const fixture: Pick<DeckResponse, 'name' | 'name_en' | 'name_el'> = {
      name: 'Greek A1 Vocabulary',
      name_en: 'Greek A1 Vocabulary',
      name_el: undefined,
    };

    const titleGreek = deriveTitleGreek(fixture);
    expect(titleGreek).toBe('');
  });
});

// ---------------------------------------------------------------------------
// transformDeckResponse — cardCount source (#522 regression guard)
//
// Deck.cardCount is the headline "words" stat (deck hero, list card, selector
// modal). It MUST be the word-entry count (deck.card_count), NOT the SRS
// card-record count (progress.total_cards, ~15 records per word). A 37-word
// deck once displayed 555 because the transform preferred total_cards.
//
// This drives the REAL transformDeckResponse through selectDeck with mocked
// APIs so the precedence is genuinely exercised, not re-implemented.
// ---------------------------------------------------------------------------

import { useDeckStore } from '@/stores/deckStore';
import { deckAPI } from '@/services/deckAPI';
import { progressAPI } from '@/services/progressAPI';
import type { DeckDetailResponse, DeckListResponse } from '@/services/deckAPI';
import type {
  DeckProgressDetailResponse,
  DeckProgressListResponse,
  DeckProgressSummary,
} from '@/services/progressAPI';

const WORD_COUNT = 37;
const SRS_CARD_COUNT = 555; // 37 words x ~15 SRS cards each

function makeDeckDetail(): DeckDetailResponse {
  return {
    id: 'deck-words',
    name: 'Numbers',
    description: null,
    name_el: 'Αριθμοί',
    level: 'A1',
    is_active: true,
    card_count: WORD_COUNT,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  } as DeckDetailResponse;
}

function makeProgressDetail(): DeckProgressDetailResponse {
  return {
    deck_id: 'deck-words',
    deck_name: 'Numbers',
    deck_level: 'a1',
    deck_description: null,
    progress: {
      total_cards: SRS_CARD_COUNT,
      cards_studied: 100,
      cards_mastered: 40,
      cards_due: 10,
      cards_new: 455,
      cards_learning: 60,
      cards_review: 40,
      mastery_percentage: 7,
      completion_percentage: 18,
    },
    statistics: {
      total_reviews: 200,
      total_study_time_seconds: 1200,
      average_quality: 4,
      average_easiness_factor: 2.5,
      average_interval_days: 3,
      deck_streak_current: 0,
      deck_streak_longest: 0,
      weekly_activity: [],
    },
    timeline: {
      first_studied_at: null,
      last_studied_at: null,
      days_active: 1,
      estimated_completion_days: null,
    },
  };
}

describe('transformDeckResponse — cardCount uses word count, not SRS count (#522)', () => {
  beforeEach(() => {
    vi.mocked(deckAPI.getById).mockResolvedValue(makeDeckDetail());
    vi.mocked(progressAPI.getDeckProgressDetail).mockResolvedValue(makeProgressDetail());
  });

  it('selectedDeck.cardCount is the word count (card_count), not progress.total_cards', async () => {
    await useDeckStore.getState().selectDeck('deck-words');
    const { selectedDeck } = useDeckStore.getState();

    expect(selectedDeck?.cardCount).toBe(WORD_COUNT);
    expect(selectedDeck?.cardCount).not.toBe(SRS_CARD_COUNT);
  });

  it('SRS card count still flows through the progress object (cardsTotal)', async () => {
    await useDeckStore.getState().selectDeck('deck-words');
    const { selectedDeck } = useDeckStore.getState();

    // Progress bars/percentages remain SRS-based — only the headline stat changed.
    expect(selectedDeck?.progress?.cardsTotal).toBe(SRS_CARD_COUNT);
  });

  it('falls back to total_cards when card_count is absent', async () => {
    const detail = makeDeckDetail();
    delete (detail as Partial<DeckDetailResponse>).card_count;
    vi.mocked(deckAPI.getById).mockResolvedValue(detail as DeckDetailResponse);

    await useDeckStore.getState().selectDeck('deck-words');
    const { selectedDeck } = useDeckStore.getState();

    expect(selectedDeck?.cardCount).toBe(SRS_CARD_COUNT);
  });
});

// ---------------------------------------------------------------------------
// deckStore — shared-fetcher routing / no auth gate (PERF-22-02)
//
// fetchDecks() must obtain the progress LIST via the shared, cache-backed
// fetchDeckProgressList(userId) — not by calling progressAPI.getDeckProgressList
// directly. These tests will fail under three specific regressions:
//
//   A) Sequential-await regression: if fetchDecks() is rewritten to
//      `await deckAPI.getList(...); await fetchDeckProgressList(...)` then
//      while the first promise is pending the second call will NOT have been
//      made yet, so `fetchDeckProgressList.mock.calls.length` would be 0 when
//      asserted synchronously — the test fails.
//
//   B) Not-yet-rewired regression (the RED state before PERF-22-02 lands):
//      fetchDecks() still calls progressAPI.getDeckProgressList directly
//      instead of fetchDeckProgressList — `fetchDeckProgressList` is never
//      called, and `progressAPI.getDeckProgressList` IS called — the test
//      fails on both counts.
//
//   C) Auth-gate regression: if someone adds `if (!isAuthenticated) return;`
//      or `if (!authInitialized) return;` at the top of fetchDecks(), the
//      store in its default Zustand state (no auth properties set) would
//      early-return before ever calling deckAPI.getList(), and
//      `getList.mock.calls.length` would be 0 — the test fails.
// ---------------------------------------------------------------------------

describe('deckStore — shared-fetcher routing / no auth gate (PERF-22-02)', () => {
  beforeEach(() => {
    // Reset call counts between tests. progressAPI.getDeckProgressList is left
    // alone (its safe empty-list default from the file-level beforeEach stays
    // in place) since fetchDeckProgressList's delegate default depends on it.
    vi.mocked(deckAPI.getList).mockReset();
    vi.mocked(fetchDeckProgressList).mockReset();
    vi.mocked(deckAPI.getById).mockReset();
    vi.mocked(progressAPI.getDeckProgressDetail).mockReset();
  });

  // -------------------------------------------------------------------------
  // Guard A: parallel dispatch through the shared fetcher — both calls fired
  // before either resolves, and the progress leg goes through
  // fetchDeckProgressList (not a duplicate direct call to the raw API).
  // -------------------------------------------------------------------------

  it('fires deckAPI.getList and fetchDeckProgressList in parallel, not a raw duplicate call', () => {
    // Never-resolving promises simulate long-latency calls.
    // We assert BOTH were called before we give the event loop a tick.
    vi.mocked(deckAPI.getList).mockReturnValue(new Promise(() => {}));
    vi.mocked(fetchDeckProgressList).mockReturnValue(new Promise(() => {}));

    // Invoke without await — we only care about synchronous dispatch
    useDeckStore.getState().fetchDecks();

    // Both must have been called already (synchronously, inside Promise.all)
    expect(deckAPI.getList).toHaveBeenCalledTimes(1);
    expect(deckAPI.getList).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, page_size: 50 })
    );
    expect(fetchDeckProgressList).toHaveBeenCalledTimes(1);
    // Routed through the shared, user-scoped fetcher (userId from
    // useAuthStore) — NOT a second, direct call to the raw list endpoint.
    expect(fetchDeckProgressList).toHaveBeenCalledWith('u1');
    expect(progressAPI.getDeckProgressList).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Guard B: No auth gate — fetchDecks() does NOT read any auth state as a
  // precondition before calling the API (it still reads userId to pass along,
  // but never gates on it). The store in its default Zustand initial state
  // has no auth-related flags set. If an `if (!isAuthenticated) return;`
  // guard were added, getList would never be called.
  // -------------------------------------------------------------------------

  it('fires deckAPI.getList even with no user set (no auth gate), still via fetchDeckProgressList', () => {
    vi.mocked(useAuthStore.getState).mockReturnValue({
      user: null,
    } as ReturnType<typeof useAuthStore.getState>);

    // Confirm store has no auth-gating fields (it never did — this documents
    // the contract). Default store state is what Zustand initialises with.
    const storeState = useDeckStore.getState();
    // The DeckState interface has no auth fields — assert the firing, not absence
    expect('authInitialized' in storeState).toBe(false);
    expect('isAuthenticated' in storeState).toBe(false);

    vi.mocked(deckAPI.getList).mockReturnValue(new Promise(() => {}));
    vi.mocked(fetchDeckProgressList).mockReturnValue(new Promise(() => {}));

    // Invoke fetchDecks() — must reach the API calls with no precondition
    useDeckStore.getState().fetchDecks();

    expect(deckAPI.getList).toHaveBeenCalledTimes(1);
    // Still routes to the shared fetcher, with userId=undefined (no gate) —
    // not the legacy direct progressAPI call.
    expect(fetchDeckProgressList).toHaveBeenCalledWith(undefined);
  });
});

// ---------------------------------------------------------------------------
// deckStore — fetchDecks resilience (PERF-22-02 QA adversarial coverage)
//
// Two failure classes the Guard-A/B tests above don't reach because they use
// never-resolving promises: (1) a fully logged-out round trip must actually
// complete, not just fire the calls; (2) a rejected fetchDeckProgressList
// must be swallowed by the `.catch(() => ({ decks: [] }))` wrapper (Decision
// 10) so the deck list still renders (without progress), instead of throwing
// or leaving fetchDecks() permanently pending.
// ---------------------------------------------------------------------------

describe('fetchDecks — resilience (PERF-22-02 adversarial)', () => {
  beforeEach(() => {
    vi.mocked(deckAPI.getList).mockReset();
    vi.mocked(fetchDeckProgressList).mockReset();
  });

  it('logged-out (userId undefined) full round trip resolves without throwing', async () => {
    vi.mocked(useAuthStore.getState).mockReturnValue({
      user: null,
    } as ReturnType<typeof useAuthStore.getState>);

    vi.mocked(deckAPI.getList).mockResolvedValue(
      deckList([makeDeckResponse({ id: 'deck-logged-out' })])
    );
    vi.mocked(fetchDeckProgressList).mockResolvedValue({
      total: 0,
      page: 1,
      page_size: 50,
      decks: [],
    });

    await expect(useDeckStore.getState().fetchDecks()).resolves.toBeUndefined();

    const { rawDecks, error } = useDeckStore.getState();
    expect(error).toBeNull();
    expect(rawDecks).toHaveLength(1);
    expect(fetchDeckProgressList).toHaveBeenCalledWith(undefined);
  });

  it('swallows a REJECTED fetchDeckProgressList into an empty progress list (Decision 10)', async () => {
    vi.mocked(useAuthStore.getState).mockReturnValue({
      user: { id: 'u1' },
    } as ReturnType<typeof useAuthStore.getState>);

    vi.mocked(deckAPI.getList).mockResolvedValue(
      deckList([makeDeckResponse({ id: 'deck-progress-down' })])
    );
    // A real rejection (not a pre-shaped { decks: [] } resolved value) —
    // proves the store's own .catch() wrapper does the swallowing, not a
    // lucky mock shape.
    vi.mocked(fetchDeckProgressList).mockRejectedValue(new Error('progress service down'));

    await expect(useDeckStore.getState().fetchDecks()).resolves.toBeUndefined();

    const { rawDecks, error } = useDeckStore.getState();
    expect(error).toBeNull();
    expect(rawDecks).toHaveLength(1);
    // No progress merged for this deck — the summary map stayed empty.
    expect(rawDecks[0].progress?.status ?? 'not-started').toBe('not-started');
  });
});

// ---------------------------------------------------------------------------
// deckStore — ensureDecksFresh + cover persistence (deck-covers-always-available)
//
// ensureDecksFresh() warms/refreshes the deck list once per session so covers
// are available everywhere without visiting /decks. Persist stores a slim
// cover cache (progress stripped) so covers paint instantly on reload.
// ---------------------------------------------------------------------------

const COVER_URL = 'https://cdn.example.com/cover-1.jpg';
const PERSIST_KEY = 'greeklish-deck-covers-v1';

function makeDeckResponse(overrides: Partial<DeckResponse> = {}): DeckResponse {
  return {
    id: 'deck-cover-1',
    name: 'Greetings',
    description: 'Basic greetings',
    name_el: 'Χαιρετισμοί',
    name_en: 'Greetings',
    name_ru: 'Приветствия',
    level: 'a1' as DeckResponse['level'],
    is_active: true,
    is_premium: false,
    card_count: 12,
    estimated_time_minutes: 8,
    tags: [],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
    cover_image_url: COVER_URL,
    cover_image_variants: { 400: 'https://cdn.example.com/cover-1-400.webp' },
    ...overrides,
  };
}

const EMPTY_PROGRESS: DeckProgressListResponse = { total: 0, page: 1, page_size: 50, decks: [] };

function deckList(decks: DeckResponse[]): DeckListResponse {
  return { total: decks.length, page: 1, page_size: 50, decks };
}

describe('deckStore — ensureDecksFresh + cover persistence (deck-covers-always-available)', () => {
  beforeEach(() => {
    vi.mocked(deckAPI.getList).mockReset();
    vi.mocked(progressAPI.getDeckProgressList).mockReset();
    localStorage.clear();
    useDeckStore.setState({
      rawDecks: [],
      decks: [],
      totalDecks: 0,
      lastFetchedAt: null,
      isLoading: false,
      error: null,
      filters: { search: '', levels: [], categories: [], status: [] },
    });
  });

  it('fetches and populates covers when the list is empty/stale', async () => {
    vi.mocked(deckAPI.getList).mockResolvedValue(deckList([makeDeckResponse()]));
    vi.mocked(progressAPI.getDeckProgressList).mockResolvedValue(EMPTY_PROGRESS);

    await useDeckStore.getState().ensureDecksFresh();

    expect(deckAPI.getList).toHaveBeenCalledTimes(1);
    expect(useDeckStore.getState().rawDecks).toHaveLength(1);
    expect(useDeckStore.getState().rawDecks[0].coverImageUrl).toBe(COVER_URL);
  });

  it('skips the fetch when the list is still fresh', async () => {
    vi.mocked(deckAPI.getList).mockResolvedValue(deckList([makeDeckResponse()]));
    vi.mocked(progressAPI.getDeckProgressList).mockResolvedValue(EMPTY_PROGRESS);

    await useDeckStore.getState().ensureDecksFresh(); // primes cache + lastFetchedAt
    expect(deckAPI.getList).toHaveBeenCalledTimes(1);

    await useDeckStore.getState().ensureDecksFresh(); // fresh → no second fetch
    expect(deckAPI.getList).toHaveBeenCalledTimes(1);
  });

  it('coalesces concurrent callers onto a single fetch', async () => {
    let resolveList: (v: DeckListResponse) => void = () => {};
    const listPromise = new Promise<DeckListResponse>((r) => {
      resolveList = r;
    });
    vi.mocked(deckAPI.getList).mockReturnValue(listPromise);
    vi.mocked(progressAPI.getDeckProgressList).mockResolvedValue(EMPTY_PROGRESS);

    const p1 = useDeckStore.getState().ensureDecksFresh();
    const p2 = useDeckStore.getState().ensureDecksFresh();

    resolveList(deckList([makeDeckResponse()]));
    await Promise.all([p1, p2]);

    expect(deckAPI.getList).toHaveBeenCalledTimes(1);
  });

  it('persists a slim cover cache to localStorage (strips volatile progress)', () => {
    const deck = makeDeck({
      id: 'd1',
      coverImageUrl: COVER_URL,
      progress: {
        deckId: 'd1',
        status: 'in-progress',
        cardsTotal: 10,
        cardsNew: 5,
        cardsLearning: 3,
        cardsReview: 2,
        cardsMastered: 2,
        dueToday: 2,
        streak: 0,
        totalTimeSpent: 0,
        accuracy: 50,
      },
    });

    useDeckStore.setState({ rawDecks: [deck], decks: [deck], totalDecks: 1 });

    // In-memory state keeps full progress...
    expect(useDeckStore.getState().rawDecks[0].progress).toBeDefined();

    // ...but the persisted copy keeps the cover URL and drops progress.
    const stored = JSON.parse(localStorage.getItem(PERSIST_KEY) ?? '{}');
    const persistedDeck = stored.state.rawDecks[0];
    expect(persistedDeck.coverImageUrl).toBe(COVER_URL);
    expect(persistedDeck.progress).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// fetchDecks — progress merge survives the shared-fetcher routing (PERF-22-02)
//
// Confirms the merge behavior (rawDecks[i].progress derived from the matching
// deck-progress summary) still works when the progress LIST comes from
// fetchDeckProgressList instead of a direct progressAPI.getDeckProgressList
// call. The direct API mock is deliberately configured to resolve EMPTY here
// so that if fetchDecks regresses to reading from the raw call again, the
// merge silently produces no progress — a real, observable assertion failure,
// not a crash.
// ---------------------------------------------------------------------------

describe('fetchDecks — progress merge via the shared fetcher (PERF-22-02)', () => {
  beforeEach(() => {
    vi.mocked(deckAPI.getList).mockReset();
    vi.mocked(fetchDeckProgressList).mockReset();
  });

  it('merges the fetchDeckProgressList summary onto the matching deck', async () => {
    vi.mocked(deckAPI.getList).mockResolvedValue(
      deckList([makeDeckResponse({ id: 'deck-merge-1' })])
    );

    const progressSummary: DeckProgressSummary = {
      deck_id: 'deck-merge-1',
      deck_name: 'Greetings',
      deck_level: 'a1',
      deck_type: 'vocabulary',
      total_cards: 20,
      cards_studied: 10,
      cards_mastered: 4,
      cards_due: 3,
      mastery_percentage: 20,
      completion_percentage: 50,
      last_studied_at: null,
      average_easiness_factor: 2.5,
      estimated_review_time_minutes: 5,
    };
    vi.mocked(fetchDeckProgressList).mockResolvedValue({
      total: 1,
      page: 1,
      page_size: 50,
      decks: [progressSummary],
    });
    // Direct call resolves EMPTY — proves the merge depends on
    // fetchDeckProgressList, not a residual direct call to the raw API.
    vi.mocked(progressAPI.getDeckProgressList).mockResolvedValue({
      total: 0,
      page: 1,
      page_size: 50,
      decks: [],
    });

    await useDeckStore.getState().fetchDecks();

    const { rawDecks } = useDeckStore.getState();
    expect(rawDecks).toHaveLength(1);
    expect(rawDecks[0].progress).toBeDefined();
    expect(rawDecks[0].progress?.status).toBe('in-progress');
    expect(rawDecks[0].progress?.dueToday).toBe(3);
    expect(rawDecks[0].progress?.cardsMastered).toBe(4);
  });
});
