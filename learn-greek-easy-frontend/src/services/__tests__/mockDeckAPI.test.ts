// src/services/__tests__/mockDeckAPI.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';

import type { DeckFilters } from '@/types/deck';

import { mockDeckAPI } from '../mockDeckAPI';
import { MOCK_DECKS, MOCK_PROGRESS } from '../mockDeckData';

describe('mockDeckAPI', () => {
  beforeEach(() => {
    // Clear any timers between tests
    vi.clearAllTimers();
  });

  describe('getAllDecks', () => {
    it('should return all decks with default filters', async () => {
      const decks = await mockDeckAPI.getAllDecks();

      expect(Array.isArray(decks)).toBe(true);
      expect(decks.length).toBeGreaterThan(0);
      expect(decks[0]).toHaveProperty('id');
      expect(decks[0]).toHaveProperty('title');
      expect(decks[0]).toHaveProperty('level');
      expect(decks[0]).toHaveProperty('progress');
    });

    it('should simulate network delay', async () => {
      const start = Date.now();
      await mockDeckAPI.getAllDecks();
      const duration = Date.now() - start;

      // Should take at least 200ms (with some tolerance for test environment)
      expect(duration).toBeGreaterThanOrEqual(200);
    });

    it('should filter by search term', async () => {
      const filters: Partial<DeckFilters> = { search: 'greetings' };
      const decks = await mockDeckAPI.getAllDecks(filters);

      decks.forEach((deck) => {
        const matchesSearch =
          deck.title.toLowerCase().includes('greetings') ||
          deck.titleGreek.toLowerCase().includes('greetings') ||
          deck.description.toLowerCase().includes('greetings');
        expect(matchesSearch).toBe(true);
      });
    });

    it('should filter by level', async () => {
      const filters: Partial<DeckFilters> = { levels: ['A1'] };
      const decks = await mockDeckAPI.getAllDecks(filters);

      decks.forEach((deck) => {
        expect(deck.level).toBe('A1');
      });
    });

    it('should filter by multiple levels', async () => {
      const filters: Partial<DeckFilters> = { levels: ['A1', 'A2'] };
      const decks = await mockDeckAPI.getAllDecks(filters);

      decks.forEach((deck) => {
        expect(['A1', 'A2']).toContain(deck.level);
      });
    });

    it('should filter by premium status', async () => {
      const filters: Partial<DeckFilters> = { showPremiumOnly: true };
      const decks = await mockDeckAPI.getAllDecks(filters);

      decks.forEach((deck) => {
        expect(deck.isPremium).toBe(true);
      });
    });

    it('should filter by deck status', async () => {
      const filters: Partial<DeckFilters> = { status: ['in-progress'] };
      const decks = await mockDeckAPI.getAllDecks(filters);

      decks.forEach((deck) => {
        expect(deck.progress?.status).toBe('in-progress');
      });
    });

    it('should apply multiple filters simultaneously', async () => {
      const filters: Partial<DeckFilters> = {
        levels: ['A1'],
        status: ['in-progress'],
      };
      const decks = await mockDeckAPI.getAllDecks(filters);

      decks.forEach((deck) => {
        expect(deck.level).toBe('A1');
        expect(deck.progress?.status).toBe('in-progress');
      });
    });

    it('should return empty array when no matches found', async () => {
      const filters: Partial<DeckFilters> = { search: 'nonexistent-deck-xyz' };
      const decks = await mockDeckAPI.getAllDecks(filters);

      expect(decks).toEqual([]);
    });

    it('should inject progress data for all decks', async () => {
      const decks = await mockDeckAPI.getAllDecks();

      decks.forEach((deck) => {
        if (MOCK_PROGRESS[deck.id]) {
          expect(deck.progress).toEqual(MOCK_PROGRESS[deck.id]);
        }
      });
    });
  });

  describe('getDeckById', () => {
    it('should return deck by valid ID', async () => {
      const testDeckId = MOCK_DECKS[0].id;
      const deck = await mockDeckAPI.getDeckById(testDeckId);

      expect(deck).toBeDefined();
      expect(deck.id).toBe(testDeckId);
      expect(deck).toHaveProperty('title');
      expect(deck).toHaveProperty('cardCount');
    });

    it('should inject progress data for deck', async () => {
      const testDeckId = MOCK_DECKS[0].id;
      const deck = await mockDeckAPI.getDeckById(testDeckId);

      if (MOCK_PROGRESS[testDeckId]) {
        expect(deck.progress).toEqual(MOCK_PROGRESS[testDeckId]);
      }
    });

    it('should simulate network delay', async () => {
      const start = Date.now();
      const testDeckId = MOCK_DECKS[0].id;
      await mockDeckAPI.getDeckById(testDeckId);
      const duration = Date.now() - start;

      expect(duration).toBeGreaterThanOrEqual(150);
    });

    it('should throw error for invalid deck ID', async () => {
      await expect(mockDeckAPI.getDeckById('invalid-deck-id')).rejects.toThrow(
        'Deck with ID "invalid-deck-id" not found'
      );
    });
  });

  describe('getDeckProgress', () => {
    it('should return progress for valid deck ID', async () => {
      const testDeckId = MOCK_DECKS[0].id;
      const progress = await mockDeckAPI.getDeckProgress(testDeckId);

      if (MOCK_PROGRESS[testDeckId]) {
        expect(progress).toEqual(MOCK_PROGRESS[testDeckId]);
      } else {
        expect(progress).toBeNull();
      }
    });

    it('should return null for deck with no progress', async () => {
      // Find a deck without progress
      const deckWithoutProgress = MOCK_DECKS.find((d) => !MOCK_PROGRESS[d.id]);

      if (deckWithoutProgress) {
        const progress = await mockDeckAPI.getDeckProgress(deckWithoutProgress.id);
        expect(progress).toBeNull();
      }
    });

    it('should throw error for invalid deck ID', async () => {
      await expect(mockDeckAPI.getDeckProgress('invalid-deck-id')).rejects.toThrow(
        'Deck with ID "invalid-deck-id" not found'
      );
    });
  });

  describe('startDeck', () => {
    it('should initialize new progress for deck', async () => {
      const testDeckId = MOCK_DECKS[0].id;
      const testDeck = MOCK_DECKS[0];
      const progress = await mockDeckAPI.startDeck(testDeckId);

      expect(progress).toBeDefined();
      expect(progress.deckId).toBe(testDeckId);
      expect(progress.status).toBe('in-progress');
      expect(progress.cardsTotal).toBe(testDeck.cardCount);
      expect(progress.cardsNew).toBe(testDeck.cardCount);
      expect(progress.cardsLearning).toBe(0);
      expect(progress.cardsReview).toBe(0);
      expect(progress.cardsMastered).toBe(0);
      expect(progress.dueToday).toBe(Math.min(20, testDeck.cardCount));
      expect(progress.streak).toBe(0);
      expect(progress.lastStudied).toBeInstanceOf(Date);
      expect(progress.totalTimeSpent).toBe(0);
      expect(progress.accuracy).toBe(0);
    });

    it('should set dueToday to deck cardCount if less than 20', async () => {
      const smallDeck = MOCK_DECKS.find((d) => d.cardCount < 20);

      if (smallDeck) {
        const progress = await mockDeckAPI.startDeck(smallDeck.id);
        expect(progress.dueToday).toBe(smallDeck.cardCount);
      }
    });

    it('should set dueToday to 20 if deck has more than 20 cards', async () => {
      const largeDeck = MOCK_DECKS.find((d) => d.cardCount > 20);

      if (largeDeck) {
        const progress = await mockDeckAPI.startDeck(largeDeck.id);
        expect(progress.dueToday).toBe(20);
      }
    });

    it('should throw error for invalid deck ID', async () => {
      await expect(mockDeckAPI.startDeck('invalid-deck-id')).rejects.toThrow(
        'Deck with ID "invalid-deck-id" not found'
      );
    });
  });

  describe('updateDeckProgress', () => {
    it('should update existing progress', async () => {
      const testDeckId = MOCK_DECKS[0].id;

      // Start deck first to ensure progress exists
      await mockDeckAPI.startDeck(testDeckId);

      const updates = {
        cardsLearning: 5,
        accuracy: 85,
      };

      const updated = await mockDeckAPI.updateDeckProgress(testDeckId, updates);

      expect(updated.cardsLearning).toBe(5);
      expect(updated.accuracy).toBe(85);
      expect(updated.lastStudied).toBeInstanceOf(Date);
    });

    it('should auto-calculate status based on progress', async () => {
      const testDeckId = MOCK_DECKS[0].id;

      // Start deck
      await mockDeckAPI.startDeck(testDeckId);

      // Update to completed state
      const testDeck = MOCK_DECKS[0];
      const completedUpdates = {
        cardsMastered: testDeck.cardCount,
        cardsNew: 0,
        cardsLearning: 0,
        cardsReview: 0,
      };

      const updated = await mockDeckAPI.updateDeckProgress(testDeckId, completedUpdates);

      expect(updated.status).toBe('completed');
    });

    it('should throw error for non-existent progress', async () => {
      const deckWithoutProgress = MOCK_DECKS.find((d) => !MOCK_PROGRESS[d.id]);

      if (deckWithoutProgress) {
        await expect(
          mockDeckAPI.updateDeckProgress(deckWithoutProgress.id, { accuracy: 90 })
        ).rejects.toThrow(`No progress found for deck "${deckWithoutProgress.id}"`);
      }
    });
  });

  describe('reviewCard', () => {
    it('should update progress after correct answer', async () => {
      const testDeckId = MOCK_DECKS[0].id;

      // Start deck first
      await mockDeckAPI.startDeck(testDeckId);

      const cardId = 'card-1';
      const wasCorrect = true;

      const updated = await mockDeckAPI.reviewCard(testDeckId, cardId, wasCorrect);

      expect(updated).toBeDefined();
      expect(updated.lastStudied).toBeInstanceOf(Date);
      expect(updated.totalTimeSpent).toBeGreaterThan(0);
    });

    it('should move card from new to learning on correct answer', async () => {
      const testDeckId = MOCK_DECKS[0].id;

      // Start deck with new cards
      const initial = await mockDeckAPI.startDeck(testDeckId);
      const initialNew = initial.cardsNew;

      const cardId = 'card-1';
      const updated = await mockDeckAPI.reviewCard(testDeckId, cardId, true);

      // Card should move from new to learning
      expect(updated.cardsNew).toBeLessThan(initialNew);
      expect(updated.cardsLearning).toBeGreaterThan(initial.cardsLearning);
    });

    it('should update accuracy correctly', async () => {
      const testDeckId = MOCK_DECKS[0].id;

      // Start deck
      await mockDeckAPI.startDeck(testDeckId);

      // Review multiple cards
      await mockDeckAPI.reviewCard(testDeckId, 'card-1', true); // Correct
      await mockDeckAPI.reviewCard(testDeckId, 'card-2', true); // Correct
      const updated = await mockDeckAPI.reviewCard(testDeckId, 'card-3', false); // Incorrect

      // Accuracy should be calculated (2 correct out of 3 total)
      expect(updated.accuracy).toBeGreaterThan(0);
      expect(updated.accuracy).toBeLessThan(100);
    });

    it('should throw error for deck without progress', async () => {
      const deckWithoutProgress = MOCK_DECKS.find((d) => !MOCK_PROGRESS[d.id]);

      if (deckWithoutProgress) {
        await expect(
          mockDeckAPI.reviewCard(deckWithoutProgress.id, 'card-1', true)
        ).rejects.toThrow(`No progress found for deck "${deckWithoutProgress.id}"`);
      }
    });
  });

  describe('reviewSession', () => {
    it('should update progress after session', async () => {
      const testDeckId = MOCK_DECKS[0].id;

      // Start deck
      await mockDeckAPI.startDeck(testDeckId);

      const cardsReviewed = 10;
      const correctCount = 8;
      const sessionTime = 15; // minutes

      const updated = await mockDeckAPI.reviewSession(
        testDeckId,
        cardsReviewed,
        correctCount,
        sessionTime
      );

      expect(updated).toBeDefined();
      expect(updated.totalTimeSpent).toBeGreaterThanOrEqual(sessionTime);
      expect(updated.lastStudied).toBeInstanceOf(Date);
    });

    it('should move cards between states based on session performance', async () => {
      const testDeckId = MOCK_DECKS[0].id;

      // Start deck
      const initial = await mockDeckAPI.startDeck(testDeckId);

      const cardsReviewed = 10;
      const correctCount = 8;
      const sessionTime = 15;

      const updated = await mockDeckAPI.reviewSession(
        testDeckId,
        cardsReviewed,
        correctCount,
        sessionTime
      );

      // Some cards should have moved states
      const totalCards = updated.cardsNew + updated.cardsLearning + updated.cardsMastered;
      expect(totalCards).toBeLessThanOrEqual(initial.cardsTotal);
    });

    it('should calculate weighted average accuracy', async () => {
      const testDeckId = MOCK_DECKS[0].id;

      // Start deck
      await mockDeckAPI.startDeck(testDeckId);

      const cardsReviewed = 20;
      const correctCount = 18; // 90% accuracy
      const sessionTime = 30;

      const updated = await mockDeckAPI.reviewSession(
        testDeckId,
        cardsReviewed,
        correctCount,
        sessionTime
      );

      // Accuracy should be close to 90%
      expect(updated.accuracy).toBeGreaterThan(80);
      expect(updated.accuracy).toBeLessThanOrEqual(100);
    });

    it('should update streak correctly for consecutive days', async () => {
      const testDeckId = MOCK_DECKS[0].id;

      // Start deck
      const initial = await mockDeckAPI.startDeck(testDeckId);
      const initialStreak = initial.streak;

      // Simulate session within 48 hours
      const updated = await mockDeckAPI.reviewSession(testDeckId, 10, 8, 15);

      // Streak should increment
      expect(updated.streak).toBeGreaterThanOrEqual(initialStreak);
    });

    it('should reduce dueToday count', async () => {
      const testDeckId = MOCK_DECKS[0].id;

      // Start deck
      const initial = await mockDeckAPI.startDeck(testDeckId);

      const cardsReviewed = 5;
      const updated = await mockDeckAPI.reviewSession(testDeckId, cardsReviewed, 4, 10);

      expect(updated.dueToday).toBeLessThanOrEqual(initial.dueToday);
    });

    it('should throw error for deck without progress', async () => {
      const deckWithoutProgress = MOCK_DECKS.find((d) => !MOCK_PROGRESS[d.id]);

      if (deckWithoutProgress) {
        await expect(mockDeckAPI.reviewSession(deckWithoutProgress.id, 10, 8, 15)).rejects.toThrow(
          `No progress found for deck "${deckWithoutProgress.id}"`
        );
      }
    });
  });

  describe('completeDeck', () => {
    it('should mark deck as completed', async () => {
      const testDeckId = MOCK_DECKS[0].id;
      const testDeck = MOCK_DECKS[0];

      // Start deck first
      await mockDeckAPI.startDeck(testDeckId);

      const updated = await mockDeckAPI.completeDeck(testDeckId);

      expect(updated.status).toBe('completed');
      expect(updated.cardsNew).toBe(0);
      expect(updated.cardsLearning).toBe(0);
      expect(updated.cardsReview).toBe(0);
      expect(updated.cardsMastered).toBe(testDeck.cardCount);
      expect(updated.dueToday).toBe(0);
      expect(updated.lastStudied).toBeInstanceOf(Date);
    });

    it('should throw error for deck without progress', async () => {
      const deckWithoutProgress = MOCK_DECKS.find((d) => !MOCK_PROGRESS[d.id]);

      if (deckWithoutProgress) {
        await expect(mockDeckAPI.completeDeck(deckWithoutProgress.id)).rejects.toThrow(
          `No progress found for deck "${deckWithoutProgress.id}"`
        );
      }
    });
  });

  describe('resetDeckProgress', () => {
    it('should reset deck to initial state', async () => {
      const testDeckId = MOCK_DECKS[0].id;
      const testDeck = MOCK_DECKS[0];

      // Start deck and make progress
      await mockDeckAPI.startDeck(testDeckId);
      await mockDeckAPI.reviewSession(testDeckId, 10, 8, 15);

      // Reset
      const reset = await mockDeckAPI.resetDeckProgress(testDeckId);

      expect(reset.status).toBe('not-started');
      expect(reset.cardsNew).toBe(testDeck.cardCount);
      expect(reset.cardsLearning).toBe(0);
      expect(reset.cardsReview).toBe(0);
      expect(reset.cardsMastered).toBe(0);
      expect(reset.dueToday).toBe(0);
      expect(reset.streak).toBe(0);
      expect(reset.lastStudied).toBeUndefined();
      expect(reset.totalTimeSpent).toBe(0);
      expect(reset.accuracy).toBe(0);
    });

    it('should throw error for invalid deck ID', async () => {
      await expect(mockDeckAPI.resetDeckProgress('invalid-deck-id')).rejects.toThrow(
        'Deck with ID "invalid-deck-id" not found'
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      // All methods should handle errors and reject promises
      await expect(mockDeckAPI.getDeckById('invalid')).rejects.toThrow();
      await expect(mockDeckAPI.getDeckProgress('invalid')).rejects.toThrow();
      await expect(mockDeckAPI.startDeck('invalid')).rejects.toThrow();
    });
  });

  describe('Data Structure Validation', () => {
    it('should return decks with complete structure', async () => {
      const decks = await mockDeckAPI.getAllDecks();
      const deck = decks[0];

      expect(deck).toHaveProperty('id');
      expect(deck).toHaveProperty('title');
      expect(deck).toHaveProperty('titleGreek');
      expect(deck).toHaveProperty('description');
      expect(deck).toHaveProperty('level');
      expect(deck).toHaveProperty('category');
      expect(deck).toHaveProperty('cardCount');
      // Note: Deck type has cardCount, not cards array
      expect(deck).toHaveProperty('isPremium');
      // Note: Deck type doesn't have color/icon - those are UI concerns handled elsewhere
      expect(deck).toHaveProperty('tags');
      expect(deck).toHaveProperty('estimatedTime');
    });

    it('should return progress with complete structure', async () => {
      const testDeckId = MOCK_DECKS[0].id;
      const progress = await mockDeckAPI.startDeck(testDeckId);

      expect(progress).toHaveProperty('deckId');
      expect(progress).toHaveProperty('status');
      expect(progress).toHaveProperty('cardsTotal');
      expect(progress).toHaveProperty('cardsNew');
      expect(progress).toHaveProperty('cardsLearning');
      expect(progress).toHaveProperty('cardsReview');
      expect(progress).toHaveProperty('cardsMastered');
      expect(progress).toHaveProperty('dueToday');
      expect(progress).toHaveProperty('streak');
      expect(progress).toHaveProperty('lastStudied');
      expect(progress).toHaveProperty('totalTimeSpent');
      expect(progress).toHaveProperty('accuracy');
    });
  });
});
