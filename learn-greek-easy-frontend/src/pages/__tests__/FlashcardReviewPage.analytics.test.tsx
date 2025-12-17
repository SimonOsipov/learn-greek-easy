/**
 * FlashcardReviewPage Analytics Integration Tests
 *
 * Tests PostHog analytics tracking for study sessions:
 * - study_session_started fires on session begin
 * - No duplicate events on re-render
 * - Properties match expected values
 */

import userEvent from '@testing-library/user-event';
import posthog from 'posthog-js';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import { render, screen, waitFor } from '@/lib/test-utils';
import { useAuthStore } from '@/stores/authStore';
import { useDeckStore } from '@/stores/deckStore';
import { useReviewStore } from '@/stores/reviewStore';

import { FlashcardReviewPage } from '../FlashcardReviewPage';

// Mock PostHog
vi.mock('posthog-js', () => ({
  default: {
    capture: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
    people: {
      set: vi.fn(),
    },
  },
}));

// Mock react-router-dom for navigation and params
const mockNavigate = vi.fn();
const mockParams = { deckId: 'deck-a1-basics' };

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => mockParams,
    useLocation: () => ({ state: null, pathname: '/review' }),
  };
});

// Mock all API services to prevent real network calls
vi.mock('@/services/authAPI', () => ({
  authAPI: {
    login: vi.fn().mockResolvedValue({
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      token_type: 'bearer',
    }),
    getProfile: vi.fn().mockResolvedValue({
      id: 'test-user-123',
      email: 'demo@learngreekeasy.com',
      full_name: 'Demo User',
      is_superuser: false,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
      settings: { daily_goal: 20, email_notifications: true },
    }),
    logout: vi.fn().mockResolvedValue(undefined),
    register: vi.fn().mockResolvedValue({
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      token_type: 'bearer',
    }),
    refresh: vi.fn().mockResolvedValue({
      access_token: 'mock-new-access-token',
      refresh_token: 'mock-new-refresh-token',
      token_type: 'bearer',
    }),
  },
  clearAuthTokens: vi.fn(),
}));

vi.mock('@/services/deckAPI', () => ({
  deckAPI: {
    getList: vi.fn().mockResolvedValue({
      total: 1,
      page: 1,
      page_size: 50,
      decks: [
        {
          id: 'deck-a1-basics',
          name: 'A1 Basics',
          description: 'Basic Greek vocabulary',
          level: 'a1',
          card_count: 10,
          estimated_time_minutes: 15,
          tags: ['basics'],
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
      ],
    }),
    getById: vi.fn().mockResolvedValue({
      id: 'deck-a1-basics',
      name: 'A1 Basics',
      description: 'Basic Greek vocabulary',
      level: 'a1',
      card_count: 10,
      estimated_time_minutes: 15,
      tags: ['basics'],
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
      cards: [],
    }),
  },
}));

vi.mock('@/services/progressAPI', () => ({
  progressAPI: {
    getDeckProgressList: vi.fn().mockResolvedValue({
      total: 1,
      page: 1,
      page_size: 50,
      decks: [
        {
          deck_id: 'deck-a1-basics',
          deck_name: 'A1 Basics',
          deck_level: 'a1',
          total_cards: 10,
          cards_studied: 5,
          cards_mastered: 2,
          cards_due: 3,
          mastery_percentage: 20,
          completion_percentage: 50,
          last_studied_at: '2025-01-08T10:00:00Z',
          average_easiness_factor: 2.5,
          estimated_review_time_minutes: 5,
        },
      ],
    }),
    getDeckProgressDetail: vi.fn().mockResolvedValue({
      deck_id: 'deck-a1-basics',
      deck_name: 'A1 Basics',
      deck_level: 'a1',
      progress: {
        total_cards: 10,
        cards_studied: 5,
        cards_mastered: 2,
        cards_due: 3,
        mastery_percentage: 20,
        completion_percentage: 50,
      },
      timeline: { last_studied_at: '2025-01-08T10:00:00Z' },
      statistics: { average_easiness_factor: 2.5, total_study_time_seconds: 300 },
    }),
    getDashboard: vi.fn().mockResolvedValue({
      overview: { total_cards_studied: 100, total_cards_mastered: 10 },
    }),
    getTrends: vi.fn().mockResolvedValue({
      period: 'week',
      daily_stats: [],
      summary: {},
    }),
  },
}));

vi.mock('@/services/studyAPI', () => {
  const studyQueueCards = [
    {
      card_id: 'card-1',
      greek_word: 'Kalimera',
      english_translation: 'Good morning',
      pronunciation: 'kah-lee-MEH-rah',
      example_sentence: 'Kalimera, ti kanis;',
      example_translation: 'Good morning, how are you doing?',
      status: 'new',
      difficulty: 'easy',
      easiness_factor: 2.5,
      interval: 0,
      repetitions: 0,
      next_review_date: null,
    },
    {
      card_id: 'card-2',
      greek_word: 'Efharisto',
      english_translation: 'Thank you',
      pronunciation: 'ef-ha-ree-STO',
      example_sentence: 'Efharisto poli!',
      example_translation: 'Thank you very much!',
      status: 'learning',
      difficulty: 'medium',
      easiness_factor: 2.3,
      interval: 1,
      repetitions: 1,
      next_review_date: '2025-01-08',
    },
  ];

  return {
    studyAPI: {
      getQueue: vi.fn().mockImplementation(({ deck_id }: { deck_id: string }) => {
        if (!deck_id) {
          return Promise.reject(new Error('Deck ID is required'));
        }
        return Promise.resolve({
          deck_id,
          total_due: studyQueueCards.length,
          new_count: 1,
          learning_count: 1,
          review_count: 0,
          cards: studyQueueCards,
        });
      }),
      initializeCards: vi.fn().mockResolvedValue({ initialized_count: 10 }),
    },
  };
});

vi.mock('@/services/reviewAPI', () => ({
  reviewAPI: {
    submit: vi.fn().mockResolvedValue({
      success: true,
      next_review_date: '2025-01-10',
      new_interval: 2,
      new_easiness_factor: 2.5,
    }),
  },
}));

// Helper to set up authenticated state directly without calling API
const setupAuthenticatedUser = () => {
  useAuthStore.setState({
    user: {
      id: 'test-user-123',
      email: 'demo@learngreekeasy.com',
      name: 'Demo User',
      role: 'free',
      preferences: {
        language: 'en',
        dailyGoal: 20,
        notifications: true,
        theme: 'light',
      },
      stats: {
        streak: 0,
        wordsLearned: 0,
        totalXP: 0,
        joinedDate: new Date('2025-01-01'),
      },
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-01'),
    },
    token: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    isAuthenticated: true,
    isLoading: false,
    error: null,
    rememberMe: false,
  });
};

// Helper to set up decks in store directly
const setupDecks = () => {
  useDeckStore.setState({
    decks: [
      {
        id: 'deck-a1-basics',
        title: 'A1 Basics',
        titleGreek: 'A1 Basics',
        description: 'Basic Greek vocabulary',
        level: 'A1',
        category: 'vocabulary',
        cardCount: 10,
        estimatedTime: 15,
        isPremium: false,
        tags: ['basics'],
        thumbnail: '/images/decks/a1.jpg',
        createdBy: 'Learn Greek Easy',
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        progress: {
          deckId: 'deck-a1-basics',
          status: 'in-progress',
          cardsTotal: 10,
          cardsNew: 5,
          cardsLearning: 3,
          cardsReview: 2,
          cardsMastered: 2,
          dueToday: 3,
          streak: 0,
          lastStudied: new Date('2025-01-08'),
          totalTimeSpent: 5,
          accuracy: 20,
        },
      },
    ],
    selectedDeck: null,
    filters: { search: '', levels: [], categories: [], status: [], showPremiumOnly: false },
    isLoading: false,
    error: null,
  });
};

describe('FlashcardReviewPage - Analytics Tracking', () => {
  beforeEach(() => {
    // Clear all stores and mocks
    localStorage.clear();
    sessionStorage.clear();
    mockNavigate.mockClear();
    vi.clearAllMocks();

    // Reset to valid deck ID
    mockParams.deckId = 'deck-a1-basics';

    // Set up authenticated user and decks
    setupAuthenticatedUser();
    setupDecks();

    // Reset review store
    useReviewStore.getState().resetSession();
  });

  afterEach(() => {
    sessionStorage.removeItem('learn-greek-easy:active-session');
  });

  it('should track study_session_started when session begins', async () => {
    render(<FlashcardReviewPage />);

    // Wait for session to start
    await waitFor(
      () => {
        const { activeSession } = useReviewStore.getState();
        expect(activeSession).toBeTruthy();
      },
      { timeout: 5000 }
    );

    // Verify PostHog capture was called with study_session_started
    await waitFor(() => {
      expect(posthog.capture).toHaveBeenCalledWith(
        'study_session_started',
        expect.objectContaining({
          deck_id: 'deck-a1-basics',
          deck_level: 'A1',
          cards_due: expect.any(Number),
          is_first_session: expect.any(Boolean),
          session_id: expect.any(String),
          timestamp: expect.any(String),
        })
      );
    });
  });

  it('should NOT fire duplicate study_session_started events on re-render', async () => {
    const { rerender } = render(<FlashcardReviewPage />);

    // Wait for session to start
    await waitFor(
      () => {
        const { activeSession } = useReviewStore.getState();
        expect(activeSession).toBeTruthy();
      },
      { timeout: 5000 }
    );

    // Get initial call count
    const initialCallCount = (posthog.capture as ReturnType<typeof vi.fn>).mock.calls.filter(
      (call) => call[0] === 'study_session_started'
    ).length;

    expect(initialCallCount).toBe(1);

    // Re-render component
    rerender(<FlashcardReviewPage />);

    // Wait a bit for potential duplicate
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Should still be only 1 call
    const finalCallCount = (posthog.capture as ReturnType<typeof vi.fn>).mock.calls.filter(
      (call) => call[0] === 'study_session_started'
    ).length;

    expect(finalCallCount).toBe(1);
  });

  it('should include correct session_id in UUID v4 format', async () => {
    render(<FlashcardReviewPage />);

    await waitFor(
      () => {
        const { activeSession } = useReviewStore.getState();
        expect(activeSession).toBeTruthy();
      },
      { timeout: 5000 }
    );

    // Wait for tracking call
    await waitFor(() => {
      expect(posthog.capture).toHaveBeenCalledWith('study_session_started', expect.any(Object));
    });

    // Get the session_id from the capture call
    const captureCall = (posthog.capture as ReturnType<typeof vi.fn>).mock.calls.find(
      (call) => call[0] === 'study_session_started'
    );

    expect(captureCall).toBeTruthy();
    const properties = captureCall[1];
    const sessionId = properties.session_id;

    // Verify UUID v4 format
    const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(sessionId).toMatch(uuidV4Regex);
  });

  it('should correctly identify first session for a deck', async () => {
    // Set up deck with NO lastStudied date (first session)
    useDeckStore.setState({
      decks: [
        {
          id: 'deck-a1-basics',
          title: 'A1 Basics',
          titleGreek: 'A1 Basics',
          description: 'Basic Greek vocabulary',
          level: 'A1',
          category: 'vocabulary',
          cardCount: 10,
          estimatedTime: 15,
          isPremium: false,
          tags: ['basics'],
          thumbnail: '/images/decks/a1.jpg',
          createdBy: 'Learn Greek Easy',
          createdAt: new Date('2025-01-01'),
          updatedAt: new Date('2025-01-01'),
          progress: {
            deckId: 'deck-a1-basics',
            status: 'not-started',
            cardsTotal: 10,
            cardsNew: 10,
            cardsLearning: 0,
            cardsReview: 0,
            cardsMastered: 0,
            dueToday: 0,
            streak: 0,
            lastStudied: undefined, // First session - no previous study
            totalTimeSpent: 0,
            accuracy: 0,
          },
        },
      ],
    });

    render(<FlashcardReviewPage />);

    await waitFor(
      () => {
        const { activeSession } = useReviewStore.getState();
        expect(activeSession).toBeTruthy();
      },
      { timeout: 5000 }
    );

    // Wait for tracking call
    await waitFor(() => {
      expect(posthog.capture).toHaveBeenCalledWith(
        'study_session_started',
        expect.objectContaining({
          is_first_session: true,
        })
      );
    });
  });

  it('should correctly identify subsequent sessions', async () => {
    // Deck already has lastStudied date set (subsequent session)
    render(<FlashcardReviewPage />);

    await waitFor(
      () => {
        const { activeSession } = useReviewStore.getState();
        expect(activeSession).toBeTruthy();
      },
      { timeout: 5000 }
    );

    // Wait for tracking call
    await waitFor(() => {
      expect(posthog.capture).toHaveBeenCalledWith(
        'study_session_started',
        expect.objectContaining({
          is_first_session: false,
        })
      );
    });
  });

  it('should include cards_due count from active session', async () => {
    render(<FlashcardReviewPage />);

    await waitFor(
      () => {
        const { activeSession } = useReviewStore.getState();
        expect(activeSession).toBeTruthy();
      },
      { timeout: 5000 }
    );

    // Wait for tracking call
    await waitFor(() => {
      expect(posthog.capture).toHaveBeenCalledWith(
        'study_session_started',
        expect.objectContaining({
          cards_due: 2, // studyQueueCards has 2 cards
        })
      );
    });
  });

  it('should NOT track events when session fails to start', async () => {
    // Clear mocks to ensure clean state
    vi.mocked(posthog.capture).mockClear();

    // Import studyAPI to mock it for this specific test
    const { studyAPI } = await import('@/services/studyAPI');

    // Make the API return an empty queue (no cards due)
    vi.mocked(studyAPI.getQueue).mockResolvedValueOnce({
      deck_id: 'deck-a1-basics',
      total_due: 0,
      new_count: 0,
      learning_count: 0,
      review_count: 0,
      cards: [], // Empty cards array
    });

    // Reset session before render
    useReviewStore.getState().resetSession();

    render(<FlashcardReviewPage />);

    // Wait for the session to process (it will fail due to no cards)
    await waitFor(
      () => {
        const { isLoading } = useReviewStore.getState();
        expect(isLoading).toBe(false);
      },
      { timeout: 3000 }
    );

    // Wait a bit more for any potential tracking
    await new Promise((resolve) => setTimeout(resolve, 200));

    // study_session_started should NOT have been called
    // because there are no cards due
    const startedCalls = (posthog.capture as ReturnType<typeof vi.fn>).mock.calls.filter(
      (call) => call[0] === 'study_session_started'
    );

    expect(startedCalls.length).toBe(0);
  });
});

describe('FlashcardReviewPage - Session Abandonment Tracking', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    mockNavigate.mockClear();
    vi.clearAllMocks();
    mockParams.deckId = 'deck-a1-basics';
    setupAuthenticatedUser();
    setupDecks();
    useReviewStore.getState().resetSession();
  });

  afterEach(() => {
    sessionStorage.removeItem('learn-greek-easy:active-session');
  });

  it('should set up beforeunload handler for abandonment tracking', async () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

    render(<FlashcardReviewPage />);

    await waitFor(
      () => {
        const { activeSession } = useReviewStore.getState();
        expect(activeSession).toBeTruthy();
      },
      { timeout: 5000 }
    );

    // Check that beforeunload listener was added
    expect(addEventListenerSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));

    addEventListenerSpy.mockRestore();
  });

  it('should clean up beforeunload handler on unmount', async () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = render(<FlashcardReviewPage />);

    await waitFor(
      () => {
        const { activeSession } = useReviewStore.getState();
        expect(activeSession).toBeTruthy();
      },
      { timeout: 5000 }
    );

    unmount();

    // Check that beforeunload listener was removed
    expect(removeEventListenerSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));

    removeEventListenerSpy.mockRestore();
  });

  it('should track study_session_abandoned when user reviews cards and leaves', async () => {
    const user = userEvent.setup();
    render(<FlashcardReviewPage />);

    // Wait for session to start
    await waitFor(
      () => {
        const { activeSession, currentCard } = useReviewStore.getState();
        expect(activeSession).toBeTruthy();
        expect(currentCard).toBeTruthy();
      },
      { timeout: 5000 }
    );

    // Flip and rate one card
    const cardArea = screen.getByRole('button', { name: /flip card/i });
    await user.click(cardArea);

    await waitFor(() => {
      expect(useReviewStore.getState().isCardFlipped).toBe(true);
    });

    const goodButton = screen.getByRole('button', { name: /rate card as good/i });
    await user.click(goodButton);

    // Wait for rating to process
    await waitFor(() => {
      expect(useReviewStore.getState().sessionStats.cardsReviewed).toBe(1);
    });

    // Manually trigger beforeunload event to simulate abandonment
    const beforeUnloadEvent = new Event('beforeunload');
    window.dispatchEvent(beforeUnloadEvent);

    // The abandonment tracking should have been called
    // Note: This is tricky to test because beforeunload handlers can't be easily verified
    // In a real scenario, the PostHog capture would be called
    // For this test, we verify the handler was set up correctly

    // Verify posthog.capture was called for abandonment
    // (the actual call happens inside the beforeunload handler)
    await waitFor(() => {
      const abandonedCalls = (posthog.capture as ReturnType<typeof vi.fn>).mock.calls.filter(
        (call) => call[0] === 'study_session_abandoned'
      );
      expect(abandonedCalls.length).toBe(1);
      expect(abandonedCalls[0][1]).toMatchObject({
        deck_id: 'deck-a1-basics',
        session_id: expect.any(String),
        cards_reviewed: 1,
        duration_sec: expect.any(Number),
      });
    });
  });

  it('should NOT track abandonment if no cards were reviewed', async () => {
    render(<FlashcardReviewPage />);

    // Wait for session to start
    await waitFor(
      () => {
        const { activeSession, currentCard } = useReviewStore.getState();
        expect(activeSession).toBeTruthy();
        expect(currentCard).toBeTruthy();
      },
      { timeout: 5000 }
    );

    // DO NOT review any cards - just trigger beforeunload
    const beforeUnloadEvent = new Event('beforeunload');
    window.dispatchEvent(beforeUnloadEvent);

    // Wait a bit
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify NO abandonment was tracked (cardsReviewed === 0)
    const abandonedCalls = (posthog.capture as ReturnType<typeof vi.fn>).mock.calls.filter(
      (call) => call[0] === 'study_session_abandoned'
    );

    expect(abandonedCalls.length).toBe(0);
  });
});
