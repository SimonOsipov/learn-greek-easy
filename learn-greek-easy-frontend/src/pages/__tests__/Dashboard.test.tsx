/**
 * Dashboard Navigation Tests
 *
 * Verifies that "Start Review Session" and "Continue Learning" buttons
 * navigate to the correct routes for vocabulary vs culture decks.
 *
 * These tests exist because the SM2V2 migration changed the vocab practice
 * route from /decks/:id/review to /decks/:id/practice, and the Dashboard
 * was missed — causing a 404 in production.
 */

import { act } from 'react';

import { screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { render } from '@/lib/test-utils';

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

// Mock analytics to avoid API calls and show loaded state
vi.mock('@/hooks/useAnalytics', () => ({
  useAnalytics: () => ({
    data: {
      summary: { totalTimeStudied: 60, totalCardsReviewed: 10 },
      streak: { currentStreak: 3 },
      wordStatus: { learning: 5, review: 10, mastered: 2, newCards: 0 },
    },
    loading: false,
    error: null,
  }),
}));

vi.mock('@/hooks/useAnalyticsSSE', () => ({
  useAnalyticsSSE: vi.fn(),
}));

vi.mock('@/hooks/useTourAutoTrigger', () => ({
  useTourAutoTrigger: vi.fn(),
}));

vi.mock('@/lib/errorReporting', () => ({
  reportAPIError: vi.fn(),
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
// deckStore mock — mutable decks list swapped per-test
// ---------------------------------------------------------------------------

let mockDecks: ReturnType<typeof makeDeck>[] = [];
const mockFetchDecks = vi.fn(() => Promise.resolve());

vi.mock('@/stores/deckStore', () => ({
  useDeckStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      decks: mockDecks,
      isLoading: false,
      fetchDecks: mockFetchDecks,
    }),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Dashboard navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDecks = [vocabDeck, cultureDeck];
  });

  // -----------------------------------------------------------------------
  // "Continue Learning" button (per-deck)
  // -----------------------------------------------------------------------

  it('navigates to /decks/:id/practice when clicking Continue Learning on a vocab deck', async () => {
    await act(async () => {
      render(<Dashboard />);
    });

    const buttons = screen.getAllByRole('button', { name: /continue learning/i });
    // First deck in our fixture list is the vocab deck
    fireEvent.click(buttons[0]);

    expect(mockNavigate).toHaveBeenCalledWith(`/decks/${VOCAB_DECK_ID}/practice`);
  });

  it('navigates to /culture/:id/practice when clicking Continue Learning on a culture deck', async () => {
    await act(async () => {
      render(<Dashboard />);
    });

    const buttons = screen.getAllByRole('button', { name: /continue learning/i });
    // Second deck in our fixture list is the culture deck
    fireEvent.click(buttons[1]);

    expect(mockNavigate).toHaveBeenCalledWith(`/culture/${CULTURE_DECK_ID}/practice`);
  });

  // -----------------------------------------------------------------------
  // "Start Review Session" button (picks first deck with due cards)
  // -----------------------------------------------------------------------

  it('navigates to /decks/:id/practice when Start Review picks a vocab deck', async () => {
    mockDecks = [vocabDeck];

    await act(async () => {
      render(<Dashboard />);
    });

    const startButton = screen.getByRole('button', { name: /start review/i });
    fireEvent.click(startButton);

    expect(mockNavigate).toHaveBeenCalledWith(`/decks/${VOCAB_DECK_ID}/practice`);
  });

  it('navigates to /culture/:id/practice when Start Review picks a culture deck', async () => {
    mockDecks = [cultureDeck];

    await act(async () => {
      render(<Dashboard />);
    });

    const startButton = screen.getByRole('button', { name: /start review/i });
    fireEvent.click(startButton);

    expect(mockNavigate).toHaveBeenCalledWith(`/culture/${CULTURE_DECK_ID}/practice`);
  });

  it('navigates to /decks when Start Review has no decks', async () => {
    mockDecks = [];

    await act(async () => {
      render(<Dashboard />);
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
      render(<Dashboard />);
    });

    // Click Start Review
    fireEvent.click(screen.getByRole('button', { name: /start review/i }));

    // Click all Continue Learning buttons
    const continueButtons = screen.getAllByRole('button', { name: /continue learning/i });
    continueButtons.forEach((btn) => fireEvent.click(btn));

    // Assert none of the navigate calls used the old /review route
    const allCalls = mockNavigate.mock.calls.map(([url]: [string]) => url);
    const reviewCalls = allCalls.filter((url: string) => url.includes('/review'));
    expect(reviewCalls).toEqual([]);
  });
});
