/**
 * Culture Exam Analytics for PostHog Integration
 *
 * Provides analytics tracking for culture exam features:
 * - Deck viewing and filtering
 * - Session start/completion/abandonment
 * - Question answering
 * - Language preference changes
 */

import posthog from 'posthog-js';

import type { CultureLanguage } from '@/types/culture';

// ============================================================================
// Type Interfaces
// ============================================================================

export interface CultureDeckViewedProperties {
  deck_id: string;
  category: string;
}

export interface CultureSessionStartedProperties {
  deck_id: string;
  question_count: number;
  session_id: string;
}

export interface CultureQuestionAnsweredProperties {
  question_id: string;
  is_correct: boolean;
  time_taken: number;
  language: 'el' | 'en' | 'ru';
  session_id: string;
}

export interface CultureSessionCompletedProperties {
  deck_id: string;
  correct_count: number;
  total_count: number;
  duration: number;
  session_id: string;
}

export interface CultureSessionAbandonedProperties {
  deck_id: string;
  questions_answered: number;
  reason: 'navigation' | 'timeout' | 'user_exit';
  session_id: string;
}

export interface CultureLanguageChangedProperties {
  from_lang: 'el' | 'en' | 'ru';
  to_lang: 'el' | 'en' | 'ru';
}

export interface DeckFilterChangedProperties {
  filter_type: 'culture' | 'vocabulary' | 'all';
}

export interface CultureQuestionGridViewedProperties {
  deck_id: string;
  question_count: number;
}

export interface CultureQuestionGridSearchedProperties {
  deck_id: string;
  query_length: number;
  result_count: number;
}

export interface CultureQuestionGridFilteredProperties {
  deck_id: string;
  filter_type: string;
  result_count: number;
}

// ============================================================================
// Tracking Functions
// ============================================================================

/**
 * Track when user views a culture deck detail page.
 */
export function trackCultureDeckViewed(properties: CultureDeckViewedProperties): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('culture_deck_viewed', properties);
  }
}

/**
 * Track when user starts a culture practice session.
 */
export function trackCultureSessionStarted(properties: CultureSessionStartedProperties): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('culture_session_started', properties);
  }
}

/**
 * Track each culture question answer.
 */
export function trackCultureQuestionAnswered(properties: CultureQuestionAnsweredProperties): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('culture_question_answered', properties);
  }
}

/**
 * Track when user completes a culture practice session.
 */
export function trackCultureSessionCompleted(properties: CultureSessionCompletedProperties): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('culture_session_completed', properties);
  }
}

/**
 * Track when user abandons a culture practice session.
 * Should be called with beforeunload event handler.
 */
export function trackCultureSessionAbandoned(properties: CultureSessionAbandonedProperties): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('culture_session_abandoned', properties);
  }
}

/**
 * Track when user changes culture question display language.
 *
 * This is separate from the main interface language change because:
 * - It's specific to question content, not UI chrome
 * - Users may prefer different languages for questions vs interface
 *
 * @param fromLang - Previous language code
 * @param toLang - New language code
 */
export function trackCultureLanguageChanged(
  fromLang: CultureLanguage,
  toLang: CultureLanguage
): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('culture_language_changed', {
      from_lang: fromLang,
      to_lang: toLang,
    });
  }
}

/**
 * Track when user changes the deck type filter.
 */
export function trackDeckFilterChanged(properties: DeckFilterChangedProperties): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('deck_filter_changed', properties);
  }
}

/**
 * Track when user views the question grid on a culture deck detail page.
 */
export function trackCultureQuestionGridViewed(
  properties: CultureQuestionGridViewedProperties
): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('culture_question_grid_viewed', properties);
  }
}

/**
 * Track when user searches within the question grid.
 */
export function trackCultureQuestionGridSearched(
  properties: CultureQuestionGridSearchedProperties
): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('culture_question_grid_searched', properties);
  }
}

/**
 * Track when user filters the question grid by status.
 */
export function trackCultureQuestionGridFiltered(
  properties: CultureQuestionGridFilteredProperties
): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('culture_question_grid_filtered', properties);
  }
}

/**
 * Generate a unique session ID for tracking.
 */
export function generateCultureSessionId(): string {
  return `culture_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
