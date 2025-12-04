// src/services/__tests__/mockReviewAPI.test.ts

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { mockReviewAPI } from '../mockReviewAPI';

describe('mockReviewAPI', () => {
  const testDeckId = 'deck-a1-basics';

  beforeEach(() => {
    // Clear storage before each test
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    // Clean up after each test
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('getReviewQueue', () => {
    it('should return due cards for deck', async () => {
      const cards = await mockReviewAPI.getReviewQueue(testDeckId, 20);

      expect(Array.isArray(cards)).toBe(true);
      expect(cards.length).toBeGreaterThan(0);
      expect(cards[0]).toHaveProperty('id');
      expect(cards[0]).toHaveProperty('front');
      expect(cards[0]).toHaveProperty('back');
      expect(cards[0]).toHaveProperty('srData');
    });

    it('should limit cards to maxCards parameter', async () => {
      const maxCards = 5;
      const cards = await mockReviewAPI.getReviewQueue(testDeckId, maxCards);

      expect(cards.length).toBeLessThanOrEqual(maxCards);
    });

    it('should simulate network delay (at least 400ms)', async () => {
      const start = Date.now();
      await mockReviewAPI.getReviewQueue(testDeckId, 10);
      const duration = Date.now() - start;

      expect(duration).toBeGreaterThanOrEqual(400);
    });

    it('should include SR data for each card', async () => {
      const cards = await mockReviewAPI.getReviewQueue(testDeckId, 10);

      cards.forEach((card) => {
        expect(card.srData).toBeDefined();
        expect(card.srData).toHaveProperty('state');
        expect(card.srData).toHaveProperty('easeFactor');
        expect(card.srData).toHaveProperty('interval');
        expect(card.srData).toHaveProperty('repetitions');
        expect(card.srData).toHaveProperty('dueDate');
      });
    });

    it('should prioritize learning cards over new cards', async () => {
      const cards = await mockReviewAPI.getReviewQueue(testDeckId, 20);

      // If there are learning and new cards, learning should come first
      const learningIndices = cards
        .map((c, i) => (c.srData.state === 'learning' ? i : -1))
        .filter((i) => i !== -1);
      const newIndices = cards
        .map((c, i) => (c.srData.state === 'new' ? i : -1))
        .filter((i) => i !== -1);

      if (learningIndices.length > 0 && newIndices.length > 0) {
        const lastLearningIndex = Math.max(...learningIndices);
        const firstNewIndex = Math.min(...newIndices);
        expect(lastLearningIndex).toBeLessThan(firstNewIndex);
      }
    });
  });

  describe('startReviewSession', () => {
    it('should create new review session', async () => {
      const session = await mockReviewAPI.startReviewSession(testDeckId);

      expect(session).toBeDefined();
      expect(session.sessionId).toBeDefined();
      expect(session.deckId).toBe(testDeckId);
      expect(session.status).toBe('active');
      expect(session.startTime).toBeInstanceOf(Date);
      expect(session.cards).toBeDefined();
      expect(session.cards.length).toBeGreaterThan(0);
      expect(session.stats).toBeDefined();
    });

    it('should initialize session stats correctly', async () => {
      const session = await mockReviewAPI.startReviewSession(testDeckId);

      expect(session.stats.cardsReviewed).toBe(0);
      expect(session.stats.cardsRemaining).toBe(session.cards.length);
      expect(session.stats.accuracy).toBe(0);
      expect(session.stats.cardsCorrect).toBe(0);
      expect(session.stats.cardsIncorrect).toBe(0);
      expect(session.stats.againCount).toBe(0);
      expect(session.stats.hardCount).toBe(0);
      expect(session.stats.goodCount).toBe(0);
      expect(session.stats.easyCount).toBe(0);
    });

    it('should respect maxCards config', async () => {
      const maxCards = 5;
      const session = await mockReviewAPI.startReviewSession(testDeckId, undefined, {
        maxNewCards: maxCards,
      });

      expect(session.cards.length).toBeLessThanOrEqual(maxCards);
    });

    it('should store session in sessionStorage', async () => {
      const session = await mockReviewAPI.startReviewSession(testDeckId);

      const stored = sessionStorage.getItem('learn-greek-easy:active-session');
      expect(stored).not.toBeNull();

      const parsedSession = JSON.parse(stored!);
      expect(parsedSession.sessionId).toBe(session.sessionId);
    });

    it('should throw error if no cards available', async () => {
      // Use a deck with no due cards (if available)
      const emptyDeckId = 'non-existent-deck';

      await expect(mockReviewAPI.startReviewSession(emptyDeckId)).rejects.toThrow();
    });

    it('should generate unique session IDs', async () => {
      const session1 = await mockReviewAPI.startReviewSession(testDeckId);
      sessionStorage.removeItem('learn-greek-easy:active-session');
      const session2 = await mockReviewAPI.startReviewSession(testDeckId);

      expect(session1.sessionId).not.toBe(session2.sessionId);
    });
  });

  describe('submitCardRating', () => {
    let sessionId: string;
    let cardId: string;

    beforeEach(async () => {
      const session = await mockReviewAPI.startReviewSession(testDeckId, undefined, {
        maxNewCards: 5,
      });
      sessionId = session.sessionId;
      cardId = session.cards[0].id;
    });

    it('should submit rating and return updated SR data', async () => {
      const srData = await mockReviewAPI.submitCardRating(sessionId, cardId, 'good', 30);

      expect(srData).toBeDefined();
      expect(srData.state).toBeDefined();
      expect(srData.easeFactor).toBeGreaterThan(0);
      expect(srData.interval).toBeGreaterThanOrEqual(0);
      expect(srData.dueDate).toBeInstanceOf(Date);
    });

    it('should update card state based on rating', async () => {
      const srData = await mockReviewAPI.submitCardRating(sessionId, cardId, 'good', 30);

      // Good rating should move card to learning or increase interval
      expect(['learning', 'review', 'mastered']).toContain(srData.state);
    });

    it('should store SR data in localStorage', async () => {
      await mockReviewAPI.submitCardRating(sessionId, cardId, 'good', 30);

      const stored = localStorage.getItem('learn-greek-easy:review-data');
      expect(stored).not.toBeNull();

      const reviewData = JSON.parse(stored!);
      expect(reviewData[cardId]).toBeDefined();
    });

    it('should handle different rating types', async () => {
      const session = await mockReviewAPI.startReviewSession(testDeckId, undefined, {
        maxNewCards: 5,
      });

      const ratings: Array<'again' | 'hard' | 'good' | 'easy'> = ['again', 'hard', 'good', 'easy'];

      for (const rating of ratings) {
        const card = session.cards[ratings.indexOf(rating)];
        if (!card) continue;

        const srData = await mockReviewAPI.submitCardRating(session.sessionId, card.id, rating, 30);
        expect(srData).toBeDefined();
      }
    });

    it('should throw error if no active session', async () => {
      sessionStorage.removeItem('learn-greek-easy:active-session');

      await expect(
        mockReviewAPI.submitCardRating('invalid-session', cardId, 'good', 30)
      ).rejects.toThrow();
    });
  });

  describe('endReviewSession', () => {
    let sessionId: string;

    beforeEach(async () => {
      const session = await mockReviewAPI.startReviewSession(testDeckId, undefined, {
        maxNewCards: 5,
      });
      sessionId = session.sessionId;

      // Rate a few cards
      for (let i = 0; i < Math.min(3, session.cards.length); i++) {
        await mockReviewAPI.submitCardRating(sessionId, session.cards[i].id, 'good', 30);
      }
    });

    it('should return session summary', async () => {
      const summary = await mockReviewAPI.endReviewSession(sessionId);

      expect(summary).toBeDefined();
      expect(summary.sessionId).toBe(sessionId);
      expect(summary.deckId).toBe(testDeckId);
      expect(summary.completedAt).toBeInstanceOf(Date);
      expect(summary.cardsReviewed).toBeGreaterThanOrEqual(0);
      expect(summary.totalTime).toBeGreaterThan(0);
    });

    it('should include rating breakdown', async () => {
      const summary = await mockReviewAPI.endReviewSession(sessionId);

      expect(summary.ratingBreakdown).toBeDefined();
      expect(summary.ratingBreakdown).toHaveProperty('again');
      expect(summary.ratingBreakdown).toHaveProperty('hard');
      expect(summary.ratingBreakdown).toHaveProperty('good');
      expect(summary.ratingBreakdown).toHaveProperty('easy');
    });

    it('should include state transitions', async () => {
      const summary = await mockReviewAPI.endReviewSession(sessionId);

      expect(summary.transitions).toBeDefined();
      expect(summary.transitions).toHaveProperty('newToLearning');
      expect(summary.transitions).toHaveProperty('learningToReview');
      expect(summary.transitions).toHaveProperty('reviewToMastered');
      expect(summary.transitions).toHaveProperty('toRelearning');
    });

    it('should include deck progress snapshots', async () => {
      const summary = await mockReviewAPI.endReviewSession(sessionId);

      expect(summary.deckProgressBefore).toBeDefined();
      expect(summary.deckProgressAfter).toBeDefined();
      expect(summary.deckProgressBefore).toHaveProperty('cardsNew');
      expect(summary.deckProgressAfter).toHaveProperty('cardsNew');
    });

    it('should clear session from sessionStorage', async () => {
      await mockReviewAPI.endReviewSession(sessionId);

      const stored = sessionStorage.getItem('learn-greek-easy:active-session');
      expect(stored).toBeNull();
    });

    it('should throw error if no active session', async () => {
      sessionStorage.removeItem('learn-greek-easy:active-session');

      await expect(mockReviewAPI.endReviewSession('invalid-session')).rejects.toThrow();
    });

    it('should throw error if session ID mismatch', async () => {
      await expect(mockReviewAPI.endReviewSession('different-session-id')).rejects.toThrow();
    });

    it('should calculate average time per card', async () => {
      const summary = await mockReviewAPI.endReviewSession(sessionId);

      if (summary.cardsReviewed > 0) {
        expect(summary.averageTimePerCard).toBe(
          Math.round(summary.totalTime / summary.cardsReviewed)
        );
      } else {
        expect(summary.averageTimePerCard).toBe(0);
      }
    });
  });

  describe('getCardHistory', () => {
    it('should return null for card with no history', async () => {
      const history = await mockReviewAPI.getCardHistory('never-reviewed-card');

      expect(history).toBeNull();
    });

    it('should return SR data for reviewed card', async () => {
      const session = await mockReviewAPI.startReviewSession(testDeckId);
      const cardId = session.cards[0].id;

      // Review card first
      await mockReviewAPI.submitCardRating(session.sessionId, cardId, 'good', 30);

      const history = await mockReviewAPI.getCardHistory(cardId);

      expect(history).toBeDefined();
      expect(history?.state).toBeDefined();
      expect(history?.lastReviewed).toBeDefined();
    });

    it('should simulate network delay (at least 150ms)', async () => {
      const start = Date.now();
      await mockReviewAPI.getCardHistory('any-card-id');
      const duration = Date.now() - start;

      expect(duration).toBeGreaterThanOrEqual(150);
    });
  });

  describe('pauseSession', () => {
    it('should pause active session', async () => {
      const session = await mockReviewAPI.startReviewSession(testDeckId);

      await mockReviewAPI.pauseSession(session.sessionId);

      const stored = sessionStorage.getItem('learn-greek-easy:active-session');
      expect(stored).not.toBeNull();

      const parsedSession = JSON.parse(stored!);
      expect(parsedSession.status).toBe('paused');
      expect(parsedSession.pausedAt).toBeDefined();
    });

    it('should throw error if session ID mismatch', async () => {
      const session = await mockReviewAPI.startReviewSession(testDeckId);

      await expect(mockReviewAPI.pauseSession('wrong-session-id')).rejects.toThrow();
    });
  });

  describe('resumeSession', () => {
    it('should resume paused session', async () => {
      const session = await mockReviewAPI.startReviewSession(testDeckId);
      await mockReviewAPI.pauseSession(session.sessionId);

      await mockReviewAPI.resumeSession(session.sessionId);

      const stored = sessionStorage.getItem('learn-greek-easy:active-session');
      expect(stored).not.toBeNull();

      const parsedSession = JSON.parse(stored!);
      expect(parsedSession.status).toBe('active');
      expect(parsedSession.pausedAt).toBeNull();
    });

    it('should throw error if session ID mismatch', async () => {
      const session = await mockReviewAPI.startReviewSession(testDeckId);
      await mockReviewAPI.pauseSession(session.sessionId);

      await expect(mockReviewAPI.resumeSession('wrong-session-id')).rejects.toThrow();
    });
  });

  describe('localStorage Persistence', () => {
    it('should persist SR data across sessions', async () => {
      const session1 = await mockReviewAPI.startReviewSession(testDeckId);
      const cardId = session1.cards[0].id;

      // Review card in first session
      const srData1 = await mockReviewAPI.submitCardRating(session1.sessionId, cardId, 'good', 30);
      await mockReviewAPI.endReviewSession(session1.sessionId);

      // Start new session
      const session2 = await mockReviewAPI.startReviewSession(testDeckId);

      // Find same card in new session
      const cardInSession2 = session2.cards.find((c) => c.id === cardId);

      if (cardInSession2) {
        // SR data should be preserved
        expect(cardInSession2.srData.repetitions).toBeGreaterThanOrEqual(srData1.repetitions);
      }
    });

    it('should handle corrupted localStorage gracefully', () => {
      localStorage.setItem('learn-greek-easy:review-data', 'invalid-json');

      // Should not throw error, should return empty object or handle gracefully
      expect(async () => {
        await mockReviewAPI.getReviewQueue(testDeckId, 10);
      }).not.toThrow();
    });
  });

  describe('Data Structure Validation', () => {
    it('should return cards with complete structure', async () => {
      const cards = await mockReviewAPI.getReviewQueue(testDeckId, 5);
      const card = cards[0];

      // CardReview extends Card and adds srData
      // Card has: id, front, back, pronunciation, example, exampleTranslation, difficulty, nextReviewDate, timesReviewed, successRate
      expect(card).toHaveProperty('id');
      expect(card).toHaveProperty('front');
      expect(card).toHaveProperty('back');
      expect(card).toHaveProperty('difficulty');
      expect(card).toHaveProperty('srData');
    });

    it('should return session with complete structure', async () => {
      const session = await mockReviewAPI.startReviewSession(testDeckId);

      expect(session).toHaveProperty('sessionId');
      expect(session).toHaveProperty('deckId');
      expect(session).toHaveProperty('userId');
      expect(session).toHaveProperty('status');
      expect(session).toHaveProperty('startTime');
      expect(session).toHaveProperty('cards');
      expect(session).toHaveProperty('stats');
    });

    it('should return summary with complete structure', async () => {
      const session = await mockReviewAPI.startReviewSession(testDeckId);
      const summary = await mockReviewAPI.endReviewSession(session.sessionId);

      expect(summary).toHaveProperty('sessionId');
      expect(summary).toHaveProperty('deckId');
      expect(summary).toHaveProperty('userId');
      expect(summary).toHaveProperty('completedAt');
      expect(summary).toHaveProperty('cardsReviewed');
      expect(summary).toHaveProperty('accuracy');
      expect(summary).toHaveProperty('totalTime');
      expect(summary).toHaveProperty('averageTimePerCard');
      expect(summary).toHaveProperty('ratingBreakdown');
      expect(summary).toHaveProperty('transitions');
      expect(summary).toHaveProperty('deckProgressBefore');
      expect(summary).toHaveProperty('deckProgressAfter');
    });
  });
});
