/**
 * Shared API Mocks for Integration Tests
 *
 * This file provides mock implementations for all backend API services.
 * Import and use vi.mock() with these mocks in integration tests that
 * interact with stores that use real API services.
 *
 * Usage in test files:
 * ```typescript
 * import { vi } from 'vitest';
 * import {
 *   mockAuthAPI,
 *   mockDeckAPI,
 *   mockProgressAPI,
 *   mockStudyAPI,
 *   mockReviewAPI,
 * } from './__mocks__/api-mocks';
 *
 * vi.mock('@/services/authAPI', () => mockAuthAPI);
 * vi.mock('@/services/deckAPI', () => mockDeckAPI);
 * vi.mock('@/services/progressAPI', () => mockProgressAPI);
 * vi.mock('@/services/studyAPI', () => mockStudyAPI);
 * vi.mock('@/services/reviewAPI', () => mockReviewAPI);
 * ```
 */

import { vi } from 'vitest';

// Mock Auth API
export const mockAuthAPI = {
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
};

// Mock Deck API
export const mockDeckAPI = {
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
};

// Mock Progress API
export const mockProgressAPI = {
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
};

// Mock Study Queue Cards
export const mockStudyQueueCards = [
  {
    card_id: 'card-1',
    greek_word: 'Gamma Epsilon Iota Alpha',
    english_translation: 'Hello',
    pronunciation: 'ya soo',
    example_sentence: 'Gamma Epsilon Iota Alpha, how are you?',
    example_translation: 'Hello, how are you?',
    status: 'new',
    difficulty: 'easy',
    easiness_factor: 2.5,
    interval: 0,
    repetitions: 0,
    next_review_date: null,
  },
  {
    card_id: 'card-2',
    greek_word: 'Kappa Alpha Lambda Eta Mu Epsilon Rho Alpha',
    english_translation: 'Good morning',
    pronunciation: 'kah-lee-MEH-rah',
    example_sentence: 'Good morning, how are you doing?',
    example_translation: 'Good morning, how are you doing?',
    status: 'new',
    difficulty: 'easy',
    easiness_factor: 2.5,
    interval: 0,
    repetitions: 0,
    next_review_date: null,
  },
  {
    card_id: 'card-3',
    greek_word: 'Epsilon Upsilon Chi Alpha Rho Iota Sigma Tau Omega',
    english_translation: 'Thank you',
    pronunciation: 'ef-ha-ree-STO',
    example_sentence: 'Thank you very much!',
    example_translation: 'Thank you very much!',
    status: 'learning',
    difficulty: 'medium',
    easiness_factor: 2.3,
    interval: 1,
    repetitions: 1,
    next_review_date: '2025-01-08',
  },
  {
    card_id: 'card-4',
    greek_word: 'Pi Alpha Rho Alpha Kappa Alpha Lambda Omega',
    english_translation: "You're welcome / Please",
    pronunciation: 'pah-rah-kah-LO',
    example_sentence: 'Please, sit down.',
    example_translation: 'Please, sit down.',
    status: 'review',
    difficulty: 'medium',
    easiness_factor: 2.4,
    interval: 3,
    repetitions: 2,
    next_review_date: '2025-01-08',
  },
  {
    card_id: 'card-5',
    greek_word: 'Nu Alpha Iota',
    english_translation: 'Yes',
    pronunciation: 'neh',
    example_sentence: 'Yes, I am fine.',
    example_translation: 'Yes, I am fine.',
    status: 'mastered',
    difficulty: 'easy',
    easiness_factor: 2.6,
    interval: 7,
    repetitions: 5,
    next_review_date: '2025-01-15',
  },
];

// Mock Study API
export const mockStudyAPI = {
  studyAPI: {
    getQueue: vi.fn().mockImplementation(({ deck_id }: { deck_id: string }) => {
      if (deck_id === 'invalid-deck-id-12345' || deck_id === 'invalid-deck-999') {
        return Promise.reject(new Error('Deck not found'));
      }
      if (!deck_id) {
        return Promise.reject(new Error('Deck ID is required'));
      }
      return Promise.resolve({
        deck_id,
        total_due: mockStudyQueueCards.length,
        new_count: 2,
        learning_count: 1,
        review_count: 2,
        cards: mockStudyQueueCards,
      });
    }),
    getDeckQueue: vi.fn().mockResolvedValue({
      deck_id: 'deck-a1-basics',
      cards: mockStudyQueueCards,
    }),
    initializeCards: vi.fn().mockResolvedValue({ initialized_count: 10 }),
  },
};

// Mock Review API
export const mockReviewAPI = {
  reviewAPI: {
    submit: vi.fn().mockResolvedValue({
      success: true,
      next_review_date: '2025-01-10',
      new_interval: 2,
      new_easiness_factor: 2.5,
    }),
  },
};

// Helper to set up authenticated user state directly
export const setupAuthenticatedUser = (useAuthStore: any) => {
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

// Helper to clear auth state
export const clearAuthState = (useAuthStore: any) => {
  useAuthStore.setState({
    user: null,
    token: null,
    refreshToken: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
    rememberMe: false,
  });
};

// Helper to set up decks in store
export const setupDecks = (useDeckStore: any) => {
  useDeckStore.setState({
    decks: [
      {
        id: 'deck-a1-basics',
        title: 'A1 Basics',
        description: 'Basic Greek vocabulary',
        level: 'A1',
        category: 'vocabulary',
        totalCards: 10,
        estimatedTime: 15,
        difficulty: 'beginner',
        isPremium: false,
        tags: ['basics'],
        imageUrl: '/images/decks/a1.jpg',
        status: 'in-progress',
        progress: {
          cardsLearned: 2,
          cardsReviewed: 5,
          masteryPercentage: 20,
          lastStudied: new Date('2025-01-08'),
          timeSpentMinutes: 5,
          streak: 0,
          averageAccuracy: 20,
        },
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
      },
    ],
    selectedDeck: null,
    filters: { search: '', levels: [], categories: [], status: [], showPremiumOnly: false },
    isLoading: false,
    error: null,
  });
};
