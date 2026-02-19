/**
 * Word Audio Analytics for PostHog Integration
 *
 * Provides analytics tracking for word audio playback interactions:
 * - Word-level audio playback
 * - Example sentence audio playback
 * - Audio playback failures
 */

import posthog from 'posthog-js';

// ============================================================================
// Type Interfaces
// ============================================================================

export interface WordAudioPlayedProperties {
  word_entry_id: string;
  lemma: string;
  part_of_speech: string | null;
  context: 'review' | 'reference';
  deck_id: string;
}

export interface ExampleAudioPlayedProperties {
  word_entry_id: string;
  example_id: string;
  context: 'review' | 'reference';
  deck_id: string;
}

export interface WordAudioFailedProperties {
  word_entry_id: string;
  error: string;
  audio_type: 'word' | 'example';
  context: 'review' | 'reference';
}

// ============================================================================
// Tracking Functions
// ============================================================================

/**
 * Track when user plays word-level audio.
 */
export function trackWordAudioPlayed(properties: WordAudioPlayedProperties): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('word_audio_played', properties);
  }
}

/**
 * Track when user plays an example sentence audio.
 */
export function trackExampleAudioPlayed(properties: ExampleAudioPlayedProperties): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('example_audio_played', properties);
  }
}

/**
 * Track when word or example audio fails to play.
 */
export function trackWordAudioFailed(properties: WordAudioFailedProperties): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('word_audio_failed', properties);
  }
}
