import { useCallback } from 'react';

import posthog from 'posthog-js';

// Event names - add new events here as features grow
export type AnalyticsEventName =
  // Auth events
  | 'user_signed_up'
  | 'user_logged_in'
  | 'user_logged_out'
  // Study session events
  | 'study_session_started'
  | 'study_session_completed'
  | 'study_session_abandoned'
  | 'card_reviewed'
  // Culture practice session events
  | 'culture_session_started'
  | 'culture_session_completed'
  | 'culture_session_abandoned'
  | 'culture_question_answered'
  // Culture audio events
  | 'culture_audio_started'
  | 'culture_audio_completed'
  | 'culture_audio_speed_changed'
  // Word audio events
  | 'word_audio_played'
  | 'example_audio_played'
  | 'word_audio_failed'
  // Engagement events
  | 'deck_selected'
  | 'streak_achieved'
  | 'card_mastered'
  // Future monetization events
  | 'pricing_page_viewed'
  | 'purchase_started'
  | 'purchase_completed'
  // Billing events
  | 'checkout_abandoned'
  | 'upgrade_page_viewed'
  | 'billing_cycle_selected';

// Base properties included with all events
interface BaseEventProperties {
  timestamp?: string; // ISO 8601, auto-added if not provided
}

// Event-specific property types (optional strict typing)
export interface StudySessionStartedProperties extends BaseEventProperties {
  deck_id: string;
  deck_level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  cards_due: number;
  is_first_session: boolean;
  session_id: string;
}

export interface CardReviewedProperties extends BaseEventProperties {
  deck_id: string;
  card_id: string;
  rating: 1 | 2 | 3 | 4;
  time_ms: number;
  card_status: 'new' | 'learning' | 'review' | 'mastered';
  session_id: string;
}

export interface StudySessionCompletedProperties extends BaseEventProperties {
  deck_id: string;
  session_id: string;
  cards_reviewed: number;
  duration_sec: number;
  accuracy: number;
  cards_mastered: number;
  cards_failed: number;
}

export interface StudySessionAbandonedProperties extends BaseEventProperties {
  deck_id: string;
  session_id: string;
  cards_reviewed: number;
  duration_sec: number;
}

// Engagement event properties
export interface DeckSelectedProperties extends BaseEventProperties {
  deck_id: string;
  deck_name: string;
  level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  total_cards: number;
  cards_due: number;
}

export interface StreakAchievedProperties extends BaseEventProperties {
  streak_days: number;
  milestone: 3 | 7 | 14 | 30 | 60 | 90 | 180 | 365;
}

export interface CardMasteredProperties extends BaseEventProperties {
  deck_id: string;
  card_id: string;
  reviews_to_master: number;
  days_to_master: number;
}

// Culture practice session event properties
export interface CultureSessionStartedProperties extends BaseEventProperties {
  deck_id: string;
  deck_name: string;
  category: string;
  question_count: number;
  language: string;
  session_id: string;
}

export interface CultureSessionCompletedProperties extends BaseEventProperties {
  deck_id: string;
  session_id: string;
  questions_total: number;
  questions_correct: number;
  accuracy: number;
  duration_sec: number;
  xp_earned: number;
}

export interface CultureSessionAbandonedProperties extends BaseEventProperties {
  deck_id: string;
  session_id: string;
  questions_answered: number;
  duration_sec: number;
}

export interface CultureQuestionAnsweredProperties extends BaseEventProperties {
  deck_id: string;
  session_id: string;
  question_id: string;
  selected_option: number;
  is_correct: boolean;
  time_ms: number;
  xp_earned: number;
}

// Culture audio playback event properties
export interface CultureAudioStartedProperties extends BaseEventProperties {
  deck_id: string; // Culture deck UUID
  question_id: string; // Culture question UUID
  duration_sec: number; // Audio duration in seconds (integer, rounded)
}

export interface CultureAudioCompletedProperties extends BaseEventProperties {
  deck_id: string; // Culture deck UUID
  question_id: string; // Culture question UUID
  duration_sec: number; // Audio duration in seconds (integer, rounded)
  playback_speed: number; // Playback rate (e.g., 0.75, 1.0, 1.25, 1.5)
}

export interface CultureAudioSpeedChangedProperties extends BaseEventProperties {
  deck_id: string; // Culture deck UUID
  question_id: string; // Culture question UUID
  from_speed: number; // Previous playback rate
  to_speed: number; // New playback rate
}

// Generic properties type for flexibility
export type EventProperties = Record<string, unknown>;

export function useTrackEvent() {
  const track = useCallback((event: AnalyticsEventName, properties?: EventProperties) => {
    if (typeof posthog?.capture === 'function') {
      posthog.capture(event, {
        ...properties,
        timestamp: properties?.timestamp || new Date().toISOString(),
      });
    }
  }, []);

  const identify = useCallback((userId: string, properties?: EventProperties) => {
    if (typeof posthog?.identify === 'function') {
      posthog.identify(userId, properties);
    }
  }, []);

  const reset = useCallback(() => {
    if (typeof posthog?.reset === 'function') {
      posthog.reset();
    }
  }, []);

  const setUserProperties = useCallback((properties: EventProperties) => {
    if (typeof posthog?.people?.set === 'function') {
      posthog.people.set(properties);
    }
  }, []);

  return { track, identify, reset, setUserProperties };
}
