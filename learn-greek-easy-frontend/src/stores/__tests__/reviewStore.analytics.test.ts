// src/stores/__tests__/reviewStore.analytics.test.ts

import { act, renderHook, waitFor } from '@testing-library/react';
import posthog from 'posthog-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { reviewAPI } from '@/services/reviewAPI';
import { studyAPI, type StudyQueueCard } from '@/services/studyAPI';

import { useAnalyticsStore } from '../analyticsStore';
import { useAuthStore } from '../authStore';
import { useReviewStore } from '../reviewStore';

// Mock PostHog
vi.mock('posthog-js', () => ({
  default: {
    capture: vi.fn(),
  },
}));

// Mock API services
vi.mock('@/services/reviewAPI', () => ({
  reviewAPI: {
    submit: vi.fn(),
  },
}));

vi.mock('@/services/studyAPI', () => ({
  studyAPI: {
    getQueue: vi.fn(),
    getDeckQueue: vi.fn(),
  },
}));

vi.mock('../authStore');
vi.mock('../analyticsStore');

describe('reviewStore analytics', () => {
  const mockUserId = 'test-user-123';
  const mockDeckId = 'deck-a1-basics';
  const mockSessionId = expect.stringMatching(/^[a-f0-9-]{36}$/);

  const mockStudyQueueCards: StudyQueueCard[] = [
    {
      card_id: 'card-1',
      front_text: 'Hello',
      back_text: 'Γειά σου',
      pronunciation: 'yia sou',
      example_sentence: 'Hello, how are you?',
      status: 'new',
      difficulty: 'easy',
      easiness_factor: 2.5,
      interval: 0,
      is_new: true,
      is_early_practice: false,
      due_date: null,
    },
    {
      card_id: 'card-2',
      front_text: 'Goodbye',
      back_text: 'Αντίο',
      pronunciation: 'adio',
      example_sentence: 'Goodbye, see you later',
      status: 'learning',
      difficulty: 'medium',
      easiness_factor: 2.3,
      interval: 1,
      is_new: false,
      is_early_practice: false,
      due_date: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    useReviewStore.setState({
      activeSession: null,
      currentCardIndex: 0,
      isCardFlipped: false,
      sessionStats: {
        cardsReviewed: 0,
        cardsRemaining: 0,
        accuracy: 0,
        cardsCorrect: 0,
        cardsIncorrect: 0,
        totalTime: 0,
        averageTime: 0,
        againCount: 0,
        hardCount: 0,
        goodCount: 0,
        easyCount: 0,
      },
      isLoading: false,
      error: null,
      sessionSummary: null,
      cardStartTime: null,
      currentCard: null,
      progress: { current: 0, total: 0 },
      hasNextCard: false,
      canRate: false,
    });

    // Mock auth store
    vi.mocked(useAuthStore.getState).mockReturnValue({
      user: { id: mockUserId, email: 'test@test.com', created_at: new Date().toISOString() },
      isAuthenticated: true,
      isLoading: false,
      error: null,
      login: vi.fn(),
      logout: vi.fn(),
      signup: vi.fn(),
      checkAuth: vi.fn(),
      clearError: vi.fn(),
      setUser: vi.fn(),
    });

    // Mock analytics store
    vi.mocked(useAnalyticsStore.getState).mockReturnValue({
      snapshot: null,
      isLoading: false,
      error: null,
      loadSnapshot: vi.fn(),
      updateSnapshot: vi.fn(),
      clearSnapshot: vi.fn(),
      refreshAllAnalytics: vi.fn(),
    });

    // Mock study API to return test cards
    vi.mocked(studyAPI.getDeckQueue).mockResolvedValue({
      deck_id: mockDeckId,
      deck_name: 'Test Deck',
      cards: mockStudyQueueCards,
      total_due: 2,
      total_new: 1,
      total_early_practice: 0,
      total_in_queue: 2,
    });

    // Mock review API submit
    vi.mocked(reviewAPI.submit).mockResolvedValue({
      success: true,
      next_review_date: new Date().toISOString(),
      new_interval: 1,
      new_easiness_factor: 2.5,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('mapRatingToAnalytics', () => {
    it('should track card_reviewed event with rating=1 for "again"', async () => {
      const { result } = renderHook(() => useReviewStore());

      // Start session
      await act(async () => {
        await result.current.startSession(mockDeckId);
      });

      // Flip card and rate
      act(() => {
        result.current.flipCard();
      });

      await act(async () => {
        await result.current.rateCard('again');
      });

      expect(posthog.capture).toHaveBeenCalledWith(
        'card_reviewed',
        expect.objectContaining({
          rating: 1,
        })
      );
    });

    it('should track card_reviewed event with rating=2 for "hard"', async () => {
      const { result } = renderHook(() => useReviewStore());

      await act(async () => {
        await result.current.startSession(mockDeckId);
      });

      act(() => {
        result.current.flipCard();
      });

      await act(async () => {
        await result.current.rateCard('hard');
      });

      expect(posthog.capture).toHaveBeenCalledWith(
        'card_reviewed',
        expect.objectContaining({
          rating: 2,
        })
      );
    });

    it('should track card_reviewed event with rating=3 for "good"', async () => {
      const { result } = renderHook(() => useReviewStore());

      await act(async () => {
        await result.current.startSession(mockDeckId);
      });

      act(() => {
        result.current.flipCard();
      });

      await act(async () => {
        await result.current.rateCard('good');
      });

      expect(posthog.capture).toHaveBeenCalledWith(
        'card_reviewed',
        expect.objectContaining({
          rating: 3,
        })
      );
    });

    it('should track card_reviewed event with rating=4 for "easy"', async () => {
      const { result } = renderHook(() => useReviewStore());

      await act(async () => {
        await result.current.startSession(mockDeckId);
      });

      act(() => {
        result.current.flipCard();
      });

      await act(async () => {
        await result.current.rateCard('easy');
      });

      expect(posthog.capture).toHaveBeenCalledWith(
        'card_reviewed',
        expect.objectContaining({
          rating: 4,
        })
      );
    });
  });

  describe('card_reviewed event properties', () => {
    it('should include all required properties in card_reviewed event', async () => {
      const { result } = renderHook(() => useReviewStore());

      await act(async () => {
        await result.current.startSession(mockDeckId);
      });

      act(() => {
        result.current.flipCard();
      });

      await act(async () => {
        await result.current.rateCard('good');
      });

      expect(posthog.capture).toHaveBeenCalledWith(
        'card_reviewed',
        expect.objectContaining({
          deck_id: mockDeckId,
          card_id: 'card-1',
          rating: 3,
          time_ms: expect.any(Number),
          card_status: 'new',
          session_id: expect.any(String),
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
        })
      );
    });

    it('should track time_ms in milliseconds (not seconds)', async () => {
      const { result } = renderHook(() => useReviewStore());

      await act(async () => {
        await result.current.startSession(mockDeckId);
      });

      // Wait 100ms before flipping
      await new Promise((resolve) => setTimeout(resolve, 100));

      act(() => {
        result.current.flipCard();
      });

      await act(async () => {
        await result.current.rateCard('good');
      });

      const captureCall = vi
        .mocked(posthog.capture)
        .mock.calls.find((call) => call[0] === 'card_reviewed');
      expect(captureCall).toBeDefined();

      const properties = captureCall![1] as { time_ms: number };
      // time_ms should be >= 100 (we waited at least 100ms)
      expect(properties.time_ms).toBeGreaterThanOrEqual(100);
    });

    it('should include session_id from activeSession', async () => {
      const { result } = renderHook(() => useReviewStore());

      await act(async () => {
        await result.current.startSession(mockDeckId);
      });

      const sessionId = result.current.activeSession?.sessionId;
      expect(sessionId).toBeDefined();

      act(() => {
        result.current.flipCard();
      });

      await act(async () => {
        await result.current.rateCard('good');
      });

      expect(posthog.capture).toHaveBeenCalledWith(
        'card_reviewed',
        expect.objectContaining({
          session_id: sessionId,
        })
      );
    });

    it('should include card_status from currentCard', async () => {
      const { result } = renderHook(() => useReviewStore());

      await act(async () => {
        await result.current.startSession(mockDeckId);
      });

      // First card has status 'new'
      act(() => {
        result.current.flipCard();
      });

      await act(async () => {
        await result.current.rateCard('good');
      });

      expect(posthog.capture).toHaveBeenCalledWith(
        'card_reviewed',
        expect.objectContaining({
          card_status: 'new',
        })
      );

      vi.mocked(posthog.capture).mockClear();

      // Second card has status 'learning'
      act(() => {
        result.current.flipCard();
      });

      await act(async () => {
        await result.current.rateCard('good');
      });

      expect(posthog.capture).toHaveBeenCalledWith(
        'card_reviewed',
        expect.objectContaining({
          card_status: 'learning',
        })
      );
    });
  });

  describe('error handling', () => {
    it('should not break review flow if PostHog capture throws', async () => {
      // Make PostHog throw an error
      vi.mocked(posthog.capture).mockImplementation(() => {
        throw new Error('PostHog network error');
      });

      const { result } = renderHook(() => useReviewStore());

      await act(async () => {
        await result.current.startSession(mockDeckId);
      });

      act(() => {
        result.current.flipCard();
      });

      // Should not throw - review should still complete
      await act(async () => {
        await result.current.rateCard('good');
      });

      // Verify the review still advanced to next card
      expect(result.current.currentCardIndex).toBe(1);
      expect(result.current.sessionStats.cardsReviewed).toBe(1);
    });

    it('should not break review flow if PostHog is undefined', async () => {
      // Temporarily make posthog.capture undefined
      const originalCapture = posthog.capture;
      (posthog as Record<string, unknown>).capture = undefined;

      const { result } = renderHook(() => useReviewStore());

      await act(async () => {
        await result.current.startSession(mockDeckId);
      });

      act(() => {
        result.current.flipCard();
      });

      // Should not throw
      await act(async () => {
        await result.current.rateCard('good');
      });

      // Verify the review still completed
      expect(result.current.currentCardIndex).toBe(1);

      // Restore
      (posthog as Record<string, unknown>).capture = originalCapture;
    });
  });
});
