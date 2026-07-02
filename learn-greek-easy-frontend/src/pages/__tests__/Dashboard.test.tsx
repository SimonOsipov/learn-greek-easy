/**
 * Dashboard Navigation Tests
 *
 * Verifies that "Start Review Session" and "Continue Learning" buttons
 * navigate to the correct routes for vocabulary vs culture decks.
 *
 * These tests exist because the SM2V2 migration changed the vocab practice
 * route from /decks/:id/review to /decks/:id/practice, and the Dashboard
 * was missed — causing a 404 in production.
 *
 * PERF-15-05: hero/feed deck rendering sources from the dashboard-summary
 * endpoint (dashboardAPI.getSummary). We mock at the API-client level and
 * seed the user-scoped `['dashboard-summary', userId]` query cache.
 *
 * PERF-15-06: Dashboard.tsx no longer reads deckStore at all — the nav
 * handlers (handleStartReview/handleContinueDeck) resolve decks off
 * `summary.decks`, and the feed renders from server-composed `summary.feed`
 * (not client-side composeFeed). `makeSummaryFromDecks` below builds both
 * `decks` and a matching `feed` (resume + deck items only — enough for the
 * CTA-wiring assertions below; full feed-composition ordering/gating is
 * unit-tested server-side in test_compose_feed.py) using the same
 * resume-pick rule as the backend's pick_resume_deck (most-recently-studied,
 * else first-with-due, else first).
 */

import { act } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { screen, fireEvent } from '@testing-library/react';
import { createElement } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { renderWithProviders, createTestQueryClient } from '@/lib/test-utils';

import { Dashboard } from '../Dashboard';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockAuthState = {
  user: { id: 'u1', name: 'Test User', email: 'test@test.com' },
  isAuthenticated: true,
};

vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn((selector?: (s: Record<string, unknown>) => unknown) =>
    selector ? selector(mockAuthState) : mockAuthState
  ),
}));

vi.mock('@/stores/dateRangeStore', () => ({
  useDateRangeStore: (selector: (s: { dateRange: string }) => unknown) =>
    selector({ dateRange: 'last7' }),
}));

// PERF-15-05: dashboard-summary is the source for hero/feed deck rendering.
const mockGetSummary = vi.fn();
vi.mock('@/services/dashboardAPI', () => ({
  dashboardAPI: { getSummary: () => mockGetSummary() },
}));

vi.mock('@/hooks/useTourAutoTrigger', () => ({
  useTourAutoTrigger: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Deck fixtures
// ---------------------------------------------------------------------------

const VOCAB_DECK_ID = 'vocab-deck-001';
const CULTURE_DECK_ID = 'culture-deck-001';

function makeDeck(
  overrides: Partial<{
    id: string;
    title: string;
    category: string;
    progress: Record<string, unknown>;
  }>
) {
  return {
    id: overrides.id ?? 'deck-default',
    title: overrides.title ?? 'Test Deck',
    titleGreek: 'Τεστ',
    description: 'A test deck',
    level: 'A2',
    category: overrides.category ?? 'vocabulary',
    tags: [],
    cardCount: 20,
    estimatedTime: 15,
    isPremium: false,
    createdBy: 'admin',
    createdAt: new Date(),
    updatedAt: new Date(),
    progress: {
      deckId: overrides.id ?? 'deck-default',
      status: 'in-progress',
      cardsTotal: 20,
      cardsNew: 5,
      cardsLearning: 5,
      cardsReview: 5,
      cardsMastered: 5,
      dueToday: 5,
      streak: 0,
      totalTimeSpent: 0,
      accuracy: 75,
      ...(overrides.progress ?? {}),
    },
  };
}

const vocabDeck = makeDeck({ id: VOCAB_DECK_ID, title: 'Greek Family', category: 'vocabulary' });
const cultureDeck = makeDeck({
  id: CULTURE_DECK_ID,
  title: 'Cultural Exam',
  category: 'culture',
});

// ---------------------------------------------------------------------------
// Dashboard-summary fixture (PERF-15-05/06) — deck slices + a matching feed
// are built from `mockDecks`, so a hero/feed CTA click resolves against the
// SAME deck id/category the navigation handlers read off `summary.decks`.
// `today.cards_due` stays fixed at 5, independent of decks.
// ---------------------------------------------------------------------------

function makeDeckSlice(deck: ReturnType<typeof makeDeck>) {
  return {
    deck_id: deck.id,
    name_el: deck.titleGreek,
    name_en: deck.title,
    name_ru: null,
    level: deck.level,
    is_premium: deck.isPremium,
    category: deck.category,
    card_count: deck.cardCount,
    cover_image_url: null,
    cover_image_variants: null,
    status: deck.progress.status,
    cards_total: deck.progress.cardsTotal,
    cards_new: deck.progress.cardsNew,
    cards_learning: deck.progress.cardsLearning,
    cards_review: deck.progress.cardsReview,
    cards_mastered: deck.progress.cardsMastered,
    due_today: deck.progress.dueToday,
    completion_pct: 50,
    mastery_pct: 25,
    last_studied_at: null as string | null,
  };
}

/**
 * Build a minimal server-shaped feed (resume + deck items only — this file's
 * tests exercise resume/deck CTA wiring, not full feed composition, which is
 * unit-tested server-side in test_compose_feed.py) mirroring the backend's
 * pick_resume_deck (src/services/dashboard_compose.py): the deck with the
 * max last_studied_at, else the first deck with due_today > 0, else the
 * first deck.
 */
function buildFeedFromDeckSlices(slices: ReturnType<typeof makeDeckSlice>[]) {
  if (slices.length === 0) return [];

  const withLastStudied = slices.filter((s) => s.last_studied_at != null);
  const resume =
    withLastStudied.length > 0
      ? withLastStudied.reduce((best, s) =>
          (s.last_studied_at as string) > (best.last_studied_at as string) ? s : best
        )
      : (slices.find((s) => s.due_today > 0) ?? slices[0]);

  const feed: unknown[] = [
    {
      type: 'resume',
      id: `resume-${resume.deck_id}`,
      deck_id: resume.deck_id,
      sibling_deck_ids: slices
        .filter((s) => s.deck_id !== resume.deck_id)
        .slice(0, 2)
        .map((s) => s.deck_id),
    },
  ];

  for (const s of slices) {
    const isActive = s.status === 'in-progress' || s.due_today > 0;
    if (!isActive || s.deck_id === resume.deck_id) continue;
    feed.push({ type: 'deck', id: `deck-${s.deck_id}`, deck_id: s.deck_id });
  }

  return feed;
}

function makeSummaryFromDecks(decks: ReturnType<typeof makeDeck>[]) {
  const deckSlices = decks.map(makeDeckSlice);
  return {
    is_new_user: false,
    mastered: 2,
    today: {
      reviews_completed: 3,
      cards_due: 5,
      daily_goal: 20,
      goal_progress_percentage: 50,
      study_time_seconds: 720,
    },
    streak: { current_streak: 3, longest_streak: 7 },
    week_heat: { heat: [0, 0, 0, 0, 0, 0, 0], today_idx: 6 },
    decks: deckSlices,
    feed: buildFeedFromDeckSlices(deckSlices),
    whats_new_count: 0,
    queue_count: 0,
    all_time_study_time_seconds: 60,
    word_of_day: null,
    recently_added: null,
    review_time_estimate_minutes: null,
    resume_position: null,
    minutes_goal: null,
  };
}

// ---------------------------------------------------------------------------
// Deck fixtures list — mutable, swapped per-test; feeds makeSummaryFromDecks.
// ---------------------------------------------------------------------------

let mockDecks: ReturnType<typeof makeDeck>[] = [];

// ---------------------------------------------------------------------------
// Helper: render Dashboard with a QueryClientProvider seeded with
// dashboard-summary (built from the CURRENT mockDecks, so it must be seeded
// at render time — after a test has reassigned mockDecks).
//
// renderWithProviders already wraps with BrowserRouter + i18n etc.
// We compose QueryClientProvider around Dashboard before passing to it,
// so React Router context is still present.
// ---------------------------------------------------------------------------

function renderDashboard(queryClient: QueryClient) {
  const summaryFixture = makeSummaryFromDecks(mockDecks);
  mockGetSummary.mockResolvedValue(summaryFixture);
  // User-scoped key (matches the mocked authStore's user.id = 'u1' above).
  queryClient.setQueryData(['dashboard-summary', 'u1'], summaryFixture);

  const DashboardWithQuery = () =>
    createElement(QueryClientProvider, { client: queryClient }, createElement(Dashboard));
  return renderWithProviders(createElement(DashboardWithQuery));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Dashboard navigation', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDecks = [vocabDeck, cultureDeck];
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    queryClient.clear();
  });

  // -----------------------------------------------------------------------
  // Feed deck/resume card CTAs (DASH2-01-06: rewired from removed DeckCard buttons)
  // Fixture: mockDecks = [vocabDeck, cultureDeck]. vocabDeck has dueToday=5 → resume card.
  // cultureDeck is the remaining active deck → deck card "Open deck".
  // -----------------------------------------------------------------------

  it('navigates to /decks/:id/practice when clicking Resume deck (vocab deck is resume)', async () => {
    await act(async () => {
      renderDashboard(queryClient);
    });

    // vocabDeck becomes the resume card (has dueToday=5, comes first with due cards)
    const resumeBtn = screen.getByRole('button', { name: /resume deck/i });
    fireEvent.click(resumeBtn);

    expect(mockNavigate).toHaveBeenCalledWith(`/decks/${VOCAB_DECK_ID}/practice`);
  });

  it('navigates to /culture/:id/practice when clicking Open deck on a culture deck card', async () => {
    await act(async () => {
      renderDashboard(queryClient);
    });

    // cultureDeck is NOT the resume deck → rendered as a deck card with "Open deck" CTA
    const openDeckBtns = screen.getAllByRole('button', { name: /open deck/i });
    fireEvent.click(openDeckBtns[0]);

    expect(mockNavigate).toHaveBeenCalledWith(`/culture/${CULTURE_DECK_ID}/practice`);
  });

  // -----------------------------------------------------------------------
  // "Start Review Session" button (picks first deck with due cards)
  // -----------------------------------------------------------------------

  it('navigates to /decks/:id/practice when Start Review picks a vocab deck', async () => {
    mockDecks = [vocabDeck];

    await act(async () => {
      renderDashboard(queryClient);
    });

    const startButton = screen.getByRole('button', { name: /start review/i });
    fireEvent.click(startButton);

    expect(mockNavigate).toHaveBeenCalledWith(`/decks/${VOCAB_DECK_ID}/practice`);
  });

  it('navigates to /culture/:id/practice when Start Review picks a culture deck', async () => {
    mockDecks = [cultureDeck];

    await act(async () => {
      renderDashboard(queryClient);
    });

    const startButton = screen.getByRole('button', { name: /start review/i });
    fireEvent.click(startButton);

    expect(mockNavigate).toHaveBeenCalledWith(`/culture/${CULTURE_DECK_ID}/practice`);
  });

  it('navigates to /decks when Start Review has no decks', async () => {
    mockDecks = [];

    await act(async () => {
      renderDashboard(queryClient);
    });

    const startButton = screen.getByRole('button', { name: /start review/i });
    fireEvent.click(startButton);

    expect(mockNavigate).toHaveBeenCalledWith('/decks');
  });

  // -----------------------------------------------------------------------
  // Route format regression guard
  // -----------------------------------------------------------------------

  it('never navigates to the old /review route', async () => {
    mockDecks = [vocabDeck, cultureDeck];

    await act(async () => {
      renderDashboard(queryClient);
    });

    // Click Start Review (from HeroEntries — still present)
    fireEvent.click(screen.getByRole('button', { name: /start review/i }));

    // Click Resume deck CTA (feed resume card)
    const resumeBtn = screen.queryByRole('button', { name: /resume deck/i });
    if (resumeBtn) fireEvent.click(resumeBtn);

    // Click all Open deck CTAs (feed deck cards)
    const openDeckBtns = screen.queryAllByRole('button', { name: /open deck/i });
    openDeckBtns.forEach((btn) => fireEvent.click(btn));

    // Assert none of the navigate calls used the old /review route
    const allCalls = (mockNavigate.mock.calls as [string][]).map(([url]) => url);
    const reviewCalls = allCalls.filter((url: string) => url.includes('/review'));
    expect(reviewCalls).toEqual([]);
  });
});
