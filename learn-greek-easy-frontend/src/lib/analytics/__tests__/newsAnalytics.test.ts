/**
 * News Analytics Unit Tests
 *
 * Tests all tracking functions in newsAnalytics.ts
 * Verifies PostHog integration and graceful handling when PostHog is unavailable.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import posthog from 'posthog-js';

import {
  trackNewsArticleClicked,
  trackNewsQuestionsButtonClicked,
  trackNewsSourceLinkClicked,
} from '../newsAnalytics';

// Mock posthog-js
vi.mock('posthog-js', () => ({
  default: {
    capture: vi.fn(),
  },
}));

describe('newsAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // trackNewsArticleClicked
  // ==========================================================================

  describe('trackNewsArticleClicked', () => {
    it('should call posthog.capture with correct event name and properties', () => {
      trackNewsArticleClicked({
        item_id: 'news-item-123',
        article_domain: 'ekathimerini.com',
      });

      expect(posthog.capture).toHaveBeenCalledWith('news_article_clicked', {
        item_id: 'news-item-123',
        article_domain: 'ekathimerini.com',
      });
    });

    it('should track with different domains', () => {
      trackNewsArticleClicked({
        item_id: 'news-item-456',
        article_domain: 'in.gr',
      });

      expect(posthog.capture).toHaveBeenCalledWith('news_article_clicked', {
        item_id: 'news-item-456',
        article_domain: 'in.gr',
      });
    });

    it('should not throw if posthog.capture is undefined', () => {
      const originalCapture = posthog.capture;
      (posthog as Record<string, unknown>).capture = undefined;

      expect(() => {
        trackNewsArticleClicked({
          item_id: 'news-item-789',
          article_domain: 'example.com',
        });
      }).not.toThrow();

      (posthog as Record<string, unknown>).capture = originalCapture;
    });

    it('should not throw if posthog.capture is null', () => {
      const originalCapture = posthog.capture;
      (posthog as Record<string, unknown>).capture = null;

      expect(() => {
        trackNewsArticleClicked({
          item_id: 'news-item-abc',
          article_domain: 'test.com',
        });
      }).not.toThrow();

      (posthog as Record<string, unknown>).capture = originalCapture;
    });
  });

  // ==========================================================================
  // trackNewsQuestionsButtonClicked
  // ==========================================================================

  describe('trackNewsQuestionsButtonClicked', () => {
    it('should call posthog.capture with correct event name and properties', () => {
      trackNewsQuestionsButtonClicked({
        news_item_id: 'news-123',
        deck_id: 'deck-456',
      });

      expect(posthog.capture).toHaveBeenCalledWith('news_questions_button_clicked', {
        news_item_id: 'news-123',
        deck_id: 'deck-456',
      });
    });

    it('should track with UUID-formatted IDs', () => {
      trackNewsQuestionsButtonClicked({
        news_item_id: '550e8400-e29b-41d4-a716-446655440000',
        deck_id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      });

      expect(posthog.capture).toHaveBeenCalledWith('news_questions_button_clicked', {
        news_item_id: '550e8400-e29b-41d4-a716-446655440000',
        deck_id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      });
    });

    it('should not throw if posthog.capture is undefined', () => {
      const originalCapture = posthog.capture;
      (posthog as Record<string, unknown>).capture = undefined;

      expect(() => {
        trackNewsQuestionsButtonClicked({
          news_item_id: 'news-789',
          deck_id: 'deck-012',
        });
      }).not.toThrow();

      (posthog as Record<string, unknown>).capture = originalCapture;
    });

    it('should not throw if posthog.capture is null', () => {
      const originalCapture = posthog.capture;
      (posthog as Record<string, unknown>).capture = null;

      expect(() => {
        trackNewsQuestionsButtonClicked({
          news_item_id: 'news-xyz',
          deck_id: 'deck-xyz',
        });
      }).not.toThrow();

      (posthog as Record<string, unknown>).capture = originalCapture;
    });
  });

  // ==========================================================================
  // trackNewsSourceLinkClicked
  // ==========================================================================

  describe('trackNewsSourceLinkClicked', () => {
    it('should call posthog.capture with correct event name and properties', () => {
      trackNewsSourceLinkClicked({
        card_id: 'card-123',
        article_domain: 'ekathimerini.com',
      });

      expect(posthog.capture).toHaveBeenCalledWith('news_source_link_clicked', {
        card_id: 'card-123',
        article_domain: 'ekathimerini.com',
      });
    });

    it('should track with UUID-formatted card_id', () => {
      trackNewsSourceLinkClicked({
        card_id: '550e8400-e29b-41d4-a716-446655440000',
        article_domain: 'in.gr',
      });

      expect(posthog.capture).toHaveBeenCalledWith('news_source_link_clicked', {
        card_id: '550e8400-e29b-41d4-a716-446655440000',
        article_domain: 'in.gr',
      });
    });

    it('should track with unknown domain fallback', () => {
      trackNewsSourceLinkClicked({
        card_id: 'card-456',
        article_domain: 'unknown',
      });

      expect(posthog.capture).toHaveBeenCalledWith('news_source_link_clicked', {
        card_id: 'card-456',
        article_domain: 'unknown',
      });
    });

    it('should not throw if posthog.capture is undefined', () => {
      const originalCapture = posthog.capture;
      (posthog as Record<string, unknown>).capture = undefined;

      expect(() => {
        trackNewsSourceLinkClicked({
          card_id: 'card-789',
          article_domain: 'example.com',
        });
      }).not.toThrow();

      (posthog as Record<string, unknown>).capture = originalCapture;
    });

    it('should not throw if posthog.capture is null', () => {
      const originalCapture = posthog.capture;
      (posthog as Record<string, unknown>).capture = null;

      expect(() => {
        trackNewsSourceLinkClicked({
          card_id: 'card-abc',
          article_domain: 'test.com',
        });
      }).not.toThrow();

      (posthog as Record<string, unknown>).capture = originalCapture;
    });
  });

  // ==========================================================================
  // PostHog Null Safety Tests
  // ==========================================================================

  describe('PostHog null safety', () => {
    it('should handle posthog.capture being a non-function value', () => {
      const originalCapture = posthog.capture;
      (posthog as Record<string, unknown>).capture = 'not a function';

      expect(() => {
        trackNewsArticleClicked({
          item_id: 'news-item-test',
          article_domain: 'example.com',
        });
      }).not.toThrow();

      expect(() => {
        trackNewsQuestionsButtonClicked({
          news_item_id: 'news-test',
          deck_id: 'deck-test',
        });
      }).not.toThrow();

      expect(() => {
        trackNewsSourceLinkClicked({
          card_id: 'card-test',
          article_domain: 'example.com',
        });
      }).not.toThrow();

      (posthog as Record<string, unknown>).capture = originalCapture;
    });

    it('should handle posthog being undefined', () => {
      const originalCapture = posthog.capture;
      (posthog as Record<string, unknown>).capture = undefined;

      // All functions should gracefully handle this case
      expect(() => {
        trackNewsArticleClicked({
          item_id: 'news-1',
          article_domain: 'test.com',
        });
        trackNewsQuestionsButtonClicked({
          news_item_id: 'news-2',
          deck_id: 'deck-2',
        });
        trackNewsSourceLinkClicked({
          card_id: 'card-1',
          article_domain: 'test.com',
        });
      }).not.toThrow();

      (posthog as Record<string, unknown>).capture = originalCapture;
    });
  });
});
