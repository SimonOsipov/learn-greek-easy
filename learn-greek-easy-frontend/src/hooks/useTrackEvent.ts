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
  | 'card_reviewed'
  // Engagement events
  | 'deck_selected'
  | 'streak_achieved'
  | 'card_mastered'
  // Future monetization events
  | 'pricing_page_viewed'
  | 'purchase_started'
  | 'purchase_completed';

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
  card_status: 'new' | 'learning' | 'review' | 'relearning';
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
