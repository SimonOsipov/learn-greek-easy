/**
 * Grammar Analytics Unit Tests
 *
 * Tests all tracking functions in grammarAnalytics.ts
 * Verifies PostHog integration and graceful handling when PostHog is unavailable.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import posthog from 'posthog-js';

import {
  trackGrammarCardViewed,
  trackGrammarTenseChanged,
  trackGrammarVoiceToggled,
  trackGrammarGenderChanged,
} from '../grammarAnalytics';

// Mock posthog-js
vi.mock('posthog-js', () => ({
  default: {
    capture: vi.fn(),
  },
}));

describe('grammarAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // trackGrammarCardViewed
  // ==========================================================================

  describe('trackGrammarCardViewed', () => {
    it('should call posthog.capture with correct event name and properties', () => {
      trackGrammarCardViewed({
        card_id: 'card-123',
        part_of_speech: 'verb',
        deck_id: 'deck-456',
        session_id: 'session-789',
        has_grammar_data: true,
      });

      expect(posthog.capture).toHaveBeenCalledWith('grammar_card_viewed', {
        card_id: 'card-123',
        part_of_speech: 'verb',
        deck_id: 'deck-456',
        session_id: 'session-789',
        has_grammar_data: true,
      });
    });

    it('should track with different parts of speech', () => {
      trackGrammarCardViewed({
        card_id: 'card-abc',
        part_of_speech: 'noun',
        deck_id: 'deck-def',
        session_id: 'session-ghi',
        has_grammar_data: false,
      });

      expect(posthog.capture).toHaveBeenCalledWith('grammar_card_viewed', {
        card_id: 'card-abc',
        part_of_speech: 'noun',
        deck_id: 'deck-def',
        session_id: 'session-ghi',
        has_grammar_data: false,
      });
    });

    it('should not throw if posthog.capture is undefined', () => {
      const originalCapture = posthog.capture;
      (posthog as Record<string, unknown>).capture = undefined;

      expect(() => {
        trackGrammarCardViewed({
          card_id: 'card-test',
          part_of_speech: 'adjective',
          deck_id: 'deck-test',
          session_id: 'session-test',
          has_grammar_data: true,
        });
      }).not.toThrow();

      (posthog as Record<string, unknown>).capture = originalCapture;
    });

    it('should not throw if posthog.capture is null', () => {
      const originalCapture = posthog.capture;
      (posthog as Record<string, unknown>).capture = null;

      expect(() => {
        trackGrammarCardViewed({
          card_id: 'card-test',
          part_of_speech: 'adverb',
          deck_id: 'deck-test',
          session_id: 'session-test',
          has_grammar_data: false,
        });
      }).not.toThrow();

      (posthog as Record<string, unknown>).capture = originalCapture;
    });
  });

  // ==========================================================================
  // trackGrammarTenseChanged
  // ==========================================================================

  describe('trackGrammarTenseChanged', () => {
    it('should call posthog.capture with correct event name and properties', () => {
      trackGrammarTenseChanged({
        card_id: 'card-123',
        part_of_speech: 'verb',
        from_tense: 'present',
        to_tense: 'past',
        session_id: 'session-456',
      });

      expect(posthog.capture).toHaveBeenCalledWith('grammar_tense_changed', {
        card_id: 'card-123',
        part_of_speech: 'verb',
        from_tense: 'present',
        to_tense: 'past',
        session_id: 'session-456',
      });
    });

    it('should track different tense combinations', () => {
      trackGrammarTenseChanged({
        card_id: 'card-abc',
        part_of_speech: 'verb',
        from_tense: 'imperfect',
        to_tense: 'future',
        session_id: 'session-def',
      });

      expect(posthog.capture).toHaveBeenCalledWith('grammar_tense_changed', {
        card_id: 'card-abc',
        part_of_speech: 'verb',
        from_tense: 'imperfect',
        to_tense: 'future',
        session_id: 'session-def',
      });
    });

    it('should not throw if posthog.capture is undefined', () => {
      const originalCapture = posthog.capture;
      (posthog as Record<string, unknown>).capture = undefined;

      expect(() => {
        trackGrammarTenseChanged({
          card_id: 'card-test',
          part_of_speech: 'verb',
          from_tense: 'present',
          to_tense: 'perfect',
          session_id: 'session-test',
        });
      }).not.toThrow();

      (posthog as Record<string, unknown>).capture = originalCapture;
    });

    it('should not throw if posthog.capture is null', () => {
      const originalCapture = posthog.capture;
      (posthog as Record<string, unknown>).capture = null;

      expect(() => {
        trackGrammarTenseChanged({
          card_id: 'card-test',
          part_of_speech: 'verb',
          from_tense: 'past',
          to_tense: 'imperative',
          session_id: 'session-test',
        });
      }).not.toThrow();

      (posthog as Record<string, unknown>).capture = originalCapture;
    });
  });

  // ==========================================================================
  // trackGrammarVoiceToggled
  // ==========================================================================

  describe('trackGrammarVoiceToggled', () => {
    it('should call posthog.capture with correct event name and properties', () => {
      trackGrammarVoiceToggled({
        card_id: 'card-123',
        part_of_speech: 'verb',
        from_voice: 'active',
        to_voice: 'passive',
        session_id: 'session-456',
      });

      expect(posthog.capture).toHaveBeenCalledWith('grammar_voice_toggled', {
        card_id: 'card-123',
        part_of_speech: 'verb',
        from_voice: 'active',
        to_voice: 'passive',
        session_id: 'session-456',
      });
    });

    it('should track passive to active change', () => {
      trackGrammarVoiceToggled({
        card_id: 'card-abc',
        part_of_speech: 'verb',
        from_voice: 'passive',
        to_voice: 'active',
        session_id: 'session-def',
      });

      expect(posthog.capture).toHaveBeenCalledWith('grammar_voice_toggled', {
        card_id: 'card-abc',
        part_of_speech: 'verb',
        from_voice: 'passive',
        to_voice: 'active',
        session_id: 'session-def',
      });
    });

    it('should not throw if posthog.capture is undefined', () => {
      const originalCapture = posthog.capture;
      (posthog as Record<string, unknown>).capture = undefined;

      expect(() => {
        trackGrammarVoiceToggled({
          card_id: 'card-test',
          part_of_speech: 'verb',
          from_voice: 'active',
          to_voice: 'passive',
          session_id: 'session-test',
        });
      }).not.toThrow();

      (posthog as Record<string, unknown>).capture = originalCapture;
    });

    it('should not throw if posthog.capture is null', () => {
      const originalCapture = posthog.capture;
      (posthog as Record<string, unknown>).capture = null;

      expect(() => {
        trackGrammarVoiceToggled({
          card_id: 'card-test',
          part_of_speech: 'verb',
          from_voice: 'passive',
          to_voice: 'active',
          session_id: 'session-test',
        });
      }).not.toThrow();

      (posthog as Record<string, unknown>).capture = originalCapture;
    });
  });

  // ==========================================================================
  // trackGrammarGenderChanged
  // ==========================================================================

  describe('trackGrammarGenderChanged', () => {
    it('should call posthog.capture with correct event name and properties', () => {
      trackGrammarGenderChanged({
        card_id: 'card-123',
        part_of_speech: 'adjective',
        from_gender: 'masculine',
        to_gender: 'feminine',
        session_id: 'session-456',
      });

      expect(posthog.capture).toHaveBeenCalledWith('grammar_gender_changed', {
        card_id: 'card-123',
        part_of_speech: 'adjective',
        from_gender: 'masculine',
        to_gender: 'feminine',
        session_id: 'session-456',
      });
    });

    it('should track different gender combinations', () => {
      trackGrammarGenderChanged({
        card_id: 'card-abc',
        part_of_speech: 'adjective',
        from_gender: 'feminine',
        to_gender: 'neuter',
        session_id: 'session-def',
      });

      expect(posthog.capture).toHaveBeenCalledWith('grammar_gender_changed', {
        card_id: 'card-abc',
        part_of_speech: 'adjective',
        from_gender: 'feminine',
        to_gender: 'neuter',
        session_id: 'session-def',
      });
    });

    it('should not throw if posthog.capture is undefined', () => {
      const originalCapture = posthog.capture;
      (posthog as Record<string, unknown>).capture = undefined;

      expect(() => {
        trackGrammarGenderChanged({
          card_id: 'card-test',
          part_of_speech: 'adjective',
          from_gender: 'masculine',
          to_gender: 'neuter',
          session_id: 'session-test',
        });
      }).not.toThrow();

      (posthog as Record<string, unknown>).capture = originalCapture;
    });

    it('should not throw if posthog.capture is null', () => {
      const originalCapture = posthog.capture;
      (posthog as Record<string, unknown>).capture = null;

      expect(() => {
        trackGrammarGenderChanged({
          card_id: 'card-test',
          part_of_speech: 'adjective',
          from_gender: 'neuter',
          to_gender: 'masculine',
          session_id: 'session-test',
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
        trackGrammarCardViewed({
          card_id: 'card-test',
          part_of_speech: 'verb',
          deck_id: 'deck-test',
          session_id: 'session-test',
          has_grammar_data: true,
        });
      }).not.toThrow();

      expect(() => {
        trackGrammarTenseChanged({
          card_id: 'card-test',
          part_of_speech: 'verb',
          from_tense: 'present',
          to_tense: 'past',
          session_id: 'session-test',
        });
      }).not.toThrow();

      expect(() => {
        trackGrammarVoiceToggled({
          card_id: 'card-test',
          part_of_speech: 'verb',
          from_voice: 'active',
          to_voice: 'passive',
          session_id: 'session-test',
        });
      }).not.toThrow();

      expect(() => {
        trackGrammarGenderChanged({
          card_id: 'card-test',
          part_of_speech: 'adjective',
          from_gender: 'masculine',
          to_gender: 'feminine',
          session_id: 'session-test',
        });
      }).not.toThrow();

      (posthog as Record<string, unknown>).capture = originalCapture;
    });

    it('should handle posthog being undefined', () => {
      const originalCapture = posthog.capture;
      (posthog as Record<string, unknown>).capture = undefined;

      // All functions should gracefully handle this case
      expect(() => {
        trackGrammarCardViewed({
          card_id: 'card-1',
          part_of_speech: 'noun',
          deck_id: 'deck-1',
          session_id: 'session-1',
          has_grammar_data: false,
        });
        trackGrammarTenseChanged({
          card_id: 'card-2',
          part_of_speech: 'verb',
          from_tense: 'present',
          to_tense: 'future',
          session_id: 'session-2',
        });
        trackGrammarVoiceToggled({
          card_id: 'card-3',
          part_of_speech: 'verb',
          from_voice: 'active',
          to_voice: 'passive',
          session_id: 'session-3',
        });
        trackGrammarGenderChanged({
          card_id: 'card-4',
          part_of_speech: 'adjective',
          from_gender: 'neuter',
          to_gender: 'masculine',
          session_id: 'session-4',
        });
      }).not.toThrow();

      (posthog as Record<string, unknown>).capture = originalCapture;
    });
  });
});
