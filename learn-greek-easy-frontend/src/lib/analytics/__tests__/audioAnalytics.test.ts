/**
 * Audio Analytics Unit Tests
 *
 * Tests all tracking functions in audioAnalytics.ts
 * Verifies PostHog integration and graceful handling when PostHog is unavailable.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import posthog from 'posthog-js';

import {
  trackExampleAudioPlayed,
  trackWordAudioFailed,
  trackWordAudioPlayed,
} from '../audioAnalytics';

// Mock posthog-js
vi.mock('posthog-js', () => ({
  default: {
    capture: vi.fn(),
  },
}));

describe('audioAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // trackWordAudioPlayed
  // ==========================================================================

  describe('trackWordAudioPlayed', () => {
    it('should call posthog.capture with correct event name and properties', () => {
      trackWordAudioPlayed({
        word_entry_id: 'we-123',
        lemma: 'γράφω',
        part_of_speech: 'verb',
        context: 'review',
        deck_id: 'deck-456',
      });

      expect(posthog.capture).toHaveBeenCalledWith('word_audio_played', {
        word_entry_id: 'we-123',
        lemma: 'γράφω',
        part_of_speech: 'verb',
        context: 'review',
        deck_id: 'deck-456',
      });
    });

    it('should track with null part_of_speech and reference context', () => {
      trackWordAudioPlayed({
        word_entry_id: 'we-abc',
        lemma: 'καλός',
        part_of_speech: null,
        context: 'reference',
        deck_id: 'deck-def',
      });

      expect(posthog.capture).toHaveBeenCalledWith('word_audio_played', {
        word_entry_id: 'we-abc',
        lemma: 'καλός',
        part_of_speech: null,
        context: 'reference',
        deck_id: 'deck-def',
      });
    });

    it('should not throw if posthog.capture is undefined', () => {
      const originalCapture = posthog.capture;
      (posthog as Record<string, unknown>).capture = undefined;

      expect(() => {
        trackWordAudioPlayed({
          word_entry_id: 'we-test',
          lemma: 'test',
          part_of_speech: 'noun',
          context: 'review',
          deck_id: 'deck-test',
        });
      }).not.toThrow();

      (posthog as Record<string, unknown>).capture = originalCapture;
    });

    it('should not throw if posthog.capture is null', () => {
      const originalCapture = posthog.capture;
      (posthog as Record<string, unknown>).capture = null;

      expect(() => {
        trackWordAudioPlayed({
          word_entry_id: 'we-test',
          lemma: 'test',
          part_of_speech: 'verb',
          context: 'reference',
          deck_id: 'deck-test',
        });
      }).not.toThrow();

      (posthog as Record<string, unknown>).capture = originalCapture;
    });
  });

  // ==========================================================================
  // trackExampleAudioPlayed
  // ==========================================================================

  describe('trackExampleAudioPlayed', () => {
    it('should call posthog.capture with correct event name and properties', () => {
      trackExampleAudioPlayed({
        word_entry_id: 'we-123',
        example_id: 'ex-456',
        context: 'review',
        deck_id: 'deck-789',
      });

      expect(posthog.capture).toHaveBeenCalledWith('example_audio_played', {
        word_entry_id: 'we-123',
        example_id: 'ex-456',
        context: 'review',
        deck_id: 'deck-789',
      });
    });

    it('should track with reference context', () => {
      trackExampleAudioPlayed({
        word_entry_id: 'we-abc',
        example_id: 'ex-def',
        context: 'reference',
        deck_id: 'deck-ghi',
      });

      expect(posthog.capture).toHaveBeenCalledWith('example_audio_played', {
        word_entry_id: 'we-abc',
        example_id: 'ex-def',
        context: 'reference',
        deck_id: 'deck-ghi',
      });
    });

    it('should not throw if posthog.capture is undefined', () => {
      const originalCapture = posthog.capture;
      (posthog as Record<string, unknown>).capture = undefined;

      expect(() => {
        trackExampleAudioPlayed({
          word_entry_id: 'we-test',
          example_id: 'ex-test',
          context: 'review',
          deck_id: 'deck-test',
        });
      }).not.toThrow();

      (posthog as Record<string, unknown>).capture = originalCapture;
    });

    it('should not throw if posthog.capture is null', () => {
      const originalCapture = posthog.capture;
      (posthog as Record<string, unknown>).capture = null;

      expect(() => {
        trackExampleAudioPlayed({
          word_entry_id: 'we-test',
          example_id: 'ex-test',
          context: 'reference',
          deck_id: 'deck-test',
        });
      }).not.toThrow();

      (posthog as Record<string, unknown>).capture = originalCapture;
    });
  });

  // ==========================================================================
  // trackWordAudioFailed
  // ==========================================================================

  describe('trackWordAudioFailed', () => {
    it('should call posthog.capture with correct event name and properties', () => {
      trackWordAudioFailed({
        word_entry_id: 'we-123',
        error: 'Network error',
        audio_type: 'word',
        context: 'review',
      });

      expect(posthog.capture).toHaveBeenCalledWith('word_audio_failed', {
        word_entry_id: 'we-123',
        error: 'Network error',
        audio_type: 'word',
        context: 'review',
      });
    });

    it('should track example audio_type and reference context', () => {
      trackWordAudioFailed({
        word_entry_id: 'we-abc',
        error: 'Failed to play audio',
        audio_type: 'example',
        context: 'reference',
      });

      expect(posthog.capture).toHaveBeenCalledWith('word_audio_failed', {
        word_entry_id: 'we-abc',
        error: 'Failed to play audio',
        audio_type: 'example',
        context: 'reference',
      });
    });

    it('should not throw if posthog.capture is undefined', () => {
      const originalCapture = posthog.capture;
      (posthog as Record<string, unknown>).capture = undefined;

      expect(() => {
        trackWordAudioFailed({
          word_entry_id: 'we-test',
          error: 'error',
          audio_type: 'word',
          context: 'review',
        });
      }).not.toThrow();

      (posthog as Record<string, unknown>).capture = originalCapture;
    });

    it('should not throw if posthog.capture is null', () => {
      const originalCapture = posthog.capture;
      (posthog as Record<string, unknown>).capture = null;

      expect(() => {
        trackWordAudioFailed({
          word_entry_id: 'we-test',
          error: 'error',
          audio_type: 'example',
          context: 'reference',
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
        trackWordAudioPlayed({
          word_entry_id: 'we-1',
          lemma: 'test',
          part_of_speech: 'noun',
          context: 'review',
          deck_id: 'deck-1',
        });
      }).not.toThrow();

      expect(() => {
        trackExampleAudioPlayed({
          word_entry_id: 'we-2',
          example_id: 'ex-2',
          context: 'review',
          deck_id: 'deck-2',
        });
      }).not.toThrow();

      expect(() => {
        trackWordAudioFailed({
          word_entry_id: 'we-3',
          error: 'err',
          audio_type: 'word',
          context: 'review',
        });
      }).not.toThrow();

      (posthog as Record<string, unknown>).capture = originalCapture;
    });

    it('should handle posthog.capture being undefined gracefully for all functions', () => {
      const originalCapture = posthog.capture;
      (posthog as Record<string, unknown>).capture = undefined;

      expect(() => {
        trackWordAudioPlayed({
          word_entry_id: 'we-1',
          lemma: 'test',
          part_of_speech: null,
          context: 'reference',
          deck_id: 'deck-1',
        });
        trackExampleAudioPlayed({
          word_entry_id: 'we-2',
          example_id: 'ex-2',
          context: 'reference',
          deck_id: 'deck-2',
        });
        trackWordAudioFailed({
          word_entry_id: 'we-3',
          error: 'err',
          audio_type: 'example',
          context: 'reference',
        });
      }).not.toThrow();

      (posthog as Record<string, unknown>).capture = originalCapture;
    });
  });
});
