/**
 * Grammar UI Analytics for PostHog Integration
 *
 * Provides analytics tracking for grammar UI interactions:
 * - Grammar card viewing
 * - Tense tab changes
 * - Voice toggle changes
 * - Gender tab changes
 */

import posthog from 'posthog-js';

import type { PartOfSpeech, VerbVoice } from '@/types/grammar';

// ============================================================================
// Type Interfaces
// ============================================================================

export interface GrammarCardViewedProperties {
  card_id: string;
  part_of_speech: PartOfSpeech;
  deck_id: string;
  session_id: string;
  has_grammar_data: boolean;
}

export interface GrammarTenseChangedProperties {
  card_id: string;
  part_of_speech: PartOfSpeech;
  from_tense: string;
  to_tense: string;
  session_id: string;
}

export interface GrammarVoiceToggledProperties {
  card_id: string;
  part_of_speech: PartOfSpeech;
  from_voice: VerbVoice;
  to_voice: VerbVoice;
  session_id: string;
}

export interface GrammarGenderChangedProperties {
  card_id: string;
  part_of_speech: PartOfSpeech;
  from_gender: string;
  to_gender: string;
  session_id: string;
}

// ============================================================================
// Tracking Functions
// ============================================================================

/**
 * Track when user views a grammar card (when flipped to reveal grammar data).
 */
export function trackGrammarCardViewed(properties: GrammarCardViewedProperties): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('grammar_card_viewed', properties);
  }
}

/**
 * Track when user changes the verb tense tab.
 */
export function trackGrammarTenseChanged(properties: GrammarTenseChangedProperties): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('grammar_tense_changed', properties);
  }
}

/**
 * Track when user toggles verb voice (active/passive).
 */
export function trackGrammarVoiceToggled(properties: GrammarVoiceToggledProperties): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('grammar_voice_toggled', properties);
  }
}

/**
 * Track when user changes adjective gender tab.
 */
export function trackGrammarGenderChanged(properties: GrammarGenderChangedProperties): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('grammar_gender_changed', properties);
  }
}
