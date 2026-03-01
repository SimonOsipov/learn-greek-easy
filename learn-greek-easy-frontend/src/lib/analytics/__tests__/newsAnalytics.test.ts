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
  trackNewsAudioPlayStarted,
  trackNewsLevelToggled,
  trackNewsQuestionsButtonClicked,
  trackNewsSourceLinkClicked,
  trackNewsPageViewed,
  trackNewsPagePaginated,
  trackNewsPageArticleClicked,
  trackNewsPageQuestionsClicked,
  trackNewsPageSeeAllClicked,
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
        level: 'b2',
      });

      expect(posthog.capture).toHaveBeenCalledWith('news_article_clicked', {
        item_id: 'news-item-123',
        article_domain: 'ekathimerini.com',
        level: 'b2',
      });
    });

    it('should track with different domains', () => {
      trackNewsArticleClicked({
        item_id: 'news-item-456',
        article_domain: 'in.gr',
        level: 'b2',
      });

      expect(posthog.capture).toHaveBeenCalledWith('news_article_clicked', {
        item_id: 'news-item-456',
        article_domain: 'in.gr',
        level: 'b2',
      });
    });

    it('should not throw if posthog.capture is undefined', () => {
      const originalCapture = posthog.capture;
      (posthog as Record<string, unknown>).capture = undefined;

      expect(() => {
        trackNewsArticleClicked({
          item_id: 'news-item-789',
          article_domain: 'example.com',
          level: 'b2',
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
          level: 'b2',
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
  // trackNewsPageViewed
  // ==========================================================================

  describe('trackNewsPageViewed', () => {
    it('should call posthog.capture with correct event name and properties', () => {
      trackNewsPageViewed({
        total_articles: 25,
      });

      expect(posthog.capture).toHaveBeenCalledWith('news_page_viewed', {
        total_articles: 25,
      });
    });

    it('should track with different article counts', () => {
      trackNewsPageViewed({
        total_articles: 100,
      });

      expect(posthog.capture).toHaveBeenCalledWith('news_page_viewed', {
        total_articles: 100,
      });
    });

    it('should not throw if posthog.capture is undefined', () => {
      const originalCapture = posthog.capture;
      (posthog as Record<string, unknown>).capture = undefined;

      expect(() => {
        trackNewsPageViewed({
          total_articles: 50,
        });
      }).not.toThrow();

      (posthog as Record<string, unknown>).capture = originalCapture;
    });

    it('should not throw if posthog.capture is null', () => {
      const originalCapture = posthog.capture;
      (posthog as Record<string, unknown>).capture = null;

      expect(() => {
        trackNewsPageViewed({
          total_articles: 0,
        });
      }).not.toThrow();

      (posthog as Record<string, unknown>).capture = originalCapture;
    });
  });

  // ==========================================================================
  // trackNewsPagePaginated
  // ==========================================================================

  describe('trackNewsPagePaginated', () => {
    it('should call posthog.capture with correct event name and properties', () => {
      trackNewsPagePaginated({
        from_page: 1,
        to_page: 2,
        total_pages: 5,
      });

      expect(posthog.capture).toHaveBeenCalledWith('news_page_paginated', {
        from_page: 1,
        to_page: 2,
        total_pages: 5,
      });
    });

    it('should track navigating backwards', () => {
      trackNewsPagePaginated({
        from_page: 3,
        to_page: 2,
        total_pages: 10,
      });

      expect(posthog.capture).toHaveBeenCalledWith('news_page_paginated', {
        from_page: 3,
        to_page: 2,
        total_pages: 10,
      });
    });

    it('should not throw if posthog.capture is undefined', () => {
      const originalCapture = posthog.capture;
      (posthog as Record<string, unknown>).capture = undefined;

      expect(() => {
        trackNewsPagePaginated({
          from_page: 1,
          to_page: 2,
          total_pages: 3,
        });
      }).not.toThrow();

      (posthog as Record<string, unknown>).capture = originalCapture;
    });

    it('should not throw if posthog.capture is null', () => {
      const originalCapture = posthog.capture;
      (posthog as Record<string, unknown>).capture = null;

      expect(() => {
        trackNewsPagePaginated({
          from_page: 2,
          to_page: 1,
          total_pages: 5,
        });
      }).not.toThrow();

      (posthog as Record<string, unknown>).capture = originalCapture;
    });
  });

  // ==========================================================================
  // trackNewsPageArticleClicked
  // ==========================================================================

  describe('trackNewsPageArticleClicked', () => {
    it('should call posthog.capture with correct event name and properties', () => {
      trackNewsPageArticleClicked({
        article_id: '550e8400-e29b-41d4-a716-446655440000',
        article_title: 'Greek Economy Update',
        position: 0,
      });

      expect(posthog.capture).toHaveBeenCalledWith('news_page_article_clicked', {
        article_id: '550e8400-e29b-41d4-a716-446655440000',
        article_title: 'Greek Economy Update',
        position: 0,
      });
    });

    it('should track articles at different positions', () => {
      trackNewsPageArticleClicked({
        article_id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        article_title: 'Athens Festival News',
        position: 5,
      });

      expect(posthog.capture).toHaveBeenCalledWith('news_page_article_clicked', {
        article_id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        article_title: 'Athens Festival News',
        position: 5,
      });
    });

    it('should not throw if posthog.capture is undefined', () => {
      const originalCapture = posthog.capture;
      (posthog as Record<string, unknown>).capture = undefined;

      expect(() => {
        trackNewsPageArticleClicked({
          article_id: 'test-id',
          article_title: 'Test Article',
          position: 0,
        });
      }).not.toThrow();

      (posthog as Record<string, unknown>).capture = originalCapture;
    });

    it('should not throw if posthog.capture is null', () => {
      const originalCapture = posthog.capture;
      (posthog as Record<string, unknown>).capture = null;

      expect(() => {
        trackNewsPageArticleClicked({
          article_id: 'test-id-2',
          article_title: 'Test Article 2',
          position: 3,
        });
      }).not.toThrow();

      (posthog as Record<string, unknown>).capture = originalCapture;
    });
  });

  // ==========================================================================
  // trackNewsPageQuestionsClicked
  // ==========================================================================

  describe('trackNewsPageQuestionsClicked', () => {
    it('should call posthog.capture with correct event name and properties', () => {
      trackNewsPageQuestionsClicked({
        article_id: '550e8400-e29b-41d4-a716-446655440000',
        has_questions: true,
      });

      expect(posthog.capture).toHaveBeenCalledWith('news_page_questions_clicked', {
        article_id: '550e8400-e29b-41d4-a716-446655440000',
        has_questions: true,
      });
    });

    it('should track when article has no questions', () => {
      trackNewsPageQuestionsClicked({
        article_id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        has_questions: false,
      });

      expect(posthog.capture).toHaveBeenCalledWith('news_page_questions_clicked', {
        article_id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        has_questions: false,
      });
    });

    it('should not throw if posthog.capture is undefined', () => {
      const originalCapture = posthog.capture;
      (posthog as Record<string, unknown>).capture = undefined;

      expect(() => {
        trackNewsPageQuestionsClicked({
          article_id: 'test-id',
          has_questions: true,
        });
      }).not.toThrow();

      (posthog as Record<string, unknown>).capture = originalCapture;
    });

    it('should not throw if posthog.capture is null', () => {
      const originalCapture = posthog.capture;
      (posthog as Record<string, unknown>).capture = null;

      expect(() => {
        trackNewsPageQuestionsClicked({
          article_id: 'test-id-2',
          has_questions: false,
        });
      }).not.toThrow();

      (posthog as Record<string, unknown>).capture = originalCapture;
    });
  });

  // ==========================================================================
  // trackNewsPageSeeAllClicked
  // ==========================================================================

  describe('trackNewsPageSeeAllClicked', () => {
    it('should call posthog.capture with correct event name', () => {
      trackNewsPageSeeAllClicked();

      expect(posthog.capture).toHaveBeenCalledWith('news_page_see_all_clicked');
    });

    it('should call posthog.capture without properties', () => {
      trackNewsPageSeeAllClicked();

      // Verify it was called with only the event name (no second argument)
      expect(posthog.capture).toHaveBeenCalledTimes(1);
      expect(posthog.capture).toHaveBeenLastCalledWith('news_page_see_all_clicked');
    });

    it('should not throw if posthog.capture is undefined', () => {
      const originalCapture = posthog.capture;
      (posthog as Record<string, unknown>).capture = undefined;

      expect(() => {
        trackNewsPageSeeAllClicked();
      }).not.toThrow();

      (posthog as Record<string, unknown>).capture = originalCapture;
    });

    it('should not throw if posthog.capture is null', () => {
      const originalCapture = posthog.capture;
      (posthog as Record<string, unknown>).capture = null;

      expect(() => {
        trackNewsPageSeeAllClicked();
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
          level: 'b2',
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

      expect(() => {
        trackNewsPageViewed({ total_articles: 10 });
      }).not.toThrow();

      expect(() => {
        trackNewsPagePaginated({ from_page: 1, to_page: 2, total_pages: 5 });
      }).not.toThrow();

      expect(() => {
        trackNewsPageArticleClicked({
          article_id: 'id',
          article_title: 'Title',
          position: 0,
        });
      }).not.toThrow();

      expect(() => {
        trackNewsPageQuestionsClicked({ article_id: 'id', has_questions: true });
      }).not.toThrow();

      expect(() => {
        trackNewsPageSeeAllClicked();
      }).not.toThrow();

      expect(() => {
        trackNewsLevelToggled({ level: 'b2', page: 'dashboard' });
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
          level: 'b2',
        });
        trackNewsQuestionsButtonClicked({
          news_item_id: 'news-2',
          deck_id: 'deck-2',
        });
        trackNewsSourceLinkClicked({
          card_id: 'card-1',
          article_domain: 'test.com',
        });
        trackNewsPageViewed({ total_articles: 10 });
        trackNewsPagePaginated({ from_page: 1, to_page: 2, total_pages: 5 });
        trackNewsPageArticleClicked({
          article_id: 'id',
          article_title: 'Title',
          position: 0,
        });
        trackNewsPageQuestionsClicked({ article_id: 'id', has_questions: true });
        trackNewsPageSeeAllClicked();
        trackNewsLevelToggled({ level: 'a2', page: 'news' });
      }).not.toThrow();

      (posthog as Record<string, unknown>).capture = originalCapture;
    });
  });

  // ==========================================================================
  // trackNewsAudioPlayStarted
  // ==========================================================================

  describe('trackNewsAudioPlayStarted', () => {
    it('should call posthog.capture with correct event name and properties', () => {
      trackNewsAudioPlayStarted({
        news_item_id: 'news-123',
        audio_duration_seconds: 120,
        page: 'news',
        playback_speed: 1,
        level: 'b2',
      });

      expect(posthog.capture).toHaveBeenCalledWith('news_audio_play_started', {
        news_item_id: 'news-123',
        audio_duration_seconds: 120,
        page: 'news',
        playback_speed: 1,
        level: 'b2',
      });
    });

    it('should track with dashboard page and playback_speed: 1', () => {
      trackNewsAudioPlayStarted({
        news_item_id: 'news-456',
        audio_duration_seconds: 60,
        page: 'dashboard',
        playback_speed: 1,
        level: 'b2',
      });

      expect(posthog.capture).toHaveBeenCalledWith('news_audio_play_started', {
        news_item_id: 'news-456',
        audio_duration_seconds: 60,
        page: 'dashboard',
        playback_speed: 1,
        level: 'b2',
      });
    });
  });

  // ==========================================================================
  // trackNewsLevelToggled
  // ==========================================================================

  describe('trackNewsLevelToggled', () => {
    it('should fire news_level_toggled with correct properties', () => {
      trackNewsLevelToggled({ level: 'a2', page: 'news' });

      expect(posthog.capture).toHaveBeenCalledWith('news_level_toggled', {
        level: 'a2',
        page: 'news',
      });
    });

    it('should pass page: dashboard correctly', () => {
      trackNewsLevelToggled({ level: 'b2', page: 'dashboard' });

      expect(posthog.capture).toHaveBeenCalledWith('news_level_toggled', {
        level: 'b2',
        page: 'dashboard',
      });
    });

    it('should not throw if posthog.capture is undefined', () => {
      const originalCapture = posthog.capture;
      (posthog as Record<string, unknown>).capture = undefined;

      expect(() => {
        trackNewsLevelToggled({ level: 'a2', page: 'news' });
      }).not.toThrow();

      (posthog as Record<string, unknown>).capture = originalCapture;
    });

    it('should not throw if posthog.capture is null', () => {
      const originalCapture = posthog.capture;
      (posthog as Record<string, unknown>).capture = null;

      expect(() => {
        trackNewsLevelToggled({ level: 'b2', page: 'dashboard' });
      }).not.toThrow();

      (posthog as Record<string, unknown>).capture = originalCapture;
    });
  });
});
