/**
 * Mock Exam Analytics for PostHog Integration
 *
 * Tracks user interactions with the Mock Citizenship Exam feature.
 * All tracking functions include null safety checks for posthog.capture.
 */

import posthog from 'posthog-js';

// ============================================================================
// Event Property Types
// ============================================================================

export interface MockExamPageViewedProperties {
  has_previous_attempts: boolean;
  best_score: number | null;
  total_attempts: number;
}

export interface MockExamStartedProperties {
  session_id: string;
  total_questions: number;
  is_resumed: boolean;
}

export interface MockExamQuestionAnsweredProperties {
  session_id: string;
  question_id: string;
  question_number: number;
  selected_option: number;
  is_correct: boolean;
  timer_remaining_seconds: number;
}

export interface MockExamCompletedProperties {
  session_id: string;
  score: number;
  total_questions: number;
  passed: boolean;
  percentage: number;
  time_taken_seconds: number;
  time_expired: boolean;
  xp_earned: number;
}

export interface MockExamAbandonedProperties {
  session_id: string;
  questions_answered: number;
  timer_remaining_seconds: number;
}

export interface MockExamTimerWarningProperties {
  session_id: string;
  warning_level: 'warning_5min' | 'warning_1min';
  questions_answered: number;
}

export interface MockExamResultsViewedProperties {
  session_id: string;
  score: number;
  total_questions: number;
  passed: boolean;
  percentage: number;
  timer_expired: boolean;
  xp_earned: number;
}

export interface MockExamIncorrectReviewExpandedProperties {
  session_id: string;
  incorrect_count: number;
}

export interface MockExamRetryClickedProperties {
  session_id: string;
  previous_passed: boolean;
  previous_score: number;
}

// ============================================================================
// Event Tracking Functions
// ============================================================================

/**
 * Track when the Mock Exam landing page is viewed (after data loaded).
 */
export function trackMockExamPageViewed(properties: MockExamPageViewedProperties): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('mock_exam_page_viewed', properties);
  }
}

/**
 * Track when a mock exam session is started.
 */
export function trackMockExamStarted(properties: MockExamStartedProperties): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('mock_exam_started', properties);
  }
}

/**
 * Track when a question is answered during the mock exam.
 */
export function trackMockExamQuestionAnswered(
  properties: MockExamQuestionAnsweredProperties
): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('mock_exam_question_answered', properties);
  }
}

/**
 * Track when a mock exam session is completed (all questions answered or timer expired).
 */
export function trackMockExamCompleted(properties: MockExamCompletedProperties): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('mock_exam_completed', properties);
  }
}

/**
 * Track when a mock exam session is abandoned (user exits before completion).
 */
export function trackMockExamAbandoned(properties: MockExamAbandonedProperties): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('mock_exam_abandoned', properties);
  }
}

/**
 * Track when the timer warning is displayed (5 minutes or 1 minute remaining).
 */
export function trackMockExamTimerWarning(properties: MockExamTimerWarningProperties): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('mock_exam_timer_warning', properties);
  }
}

/**
 * Track when the mock exam results page is viewed.
 */
export function trackMockExamResultsViewed(properties: MockExamResultsViewedProperties): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('mock_exam_results_viewed', properties);
  }
}

/**
 * Track when the incorrect answers accordion is expanded on results page.
 */
export function trackMockExamIncorrectReviewExpanded(
  properties: MockExamIncorrectReviewExpandedProperties
): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('mock_exam_incorrect_review_expanded', properties);
  }
}

/**
 * Track when the user clicks retry on the results page.
 */
export function trackMockExamRetryClicked(properties: MockExamRetryClickedProperties): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('mock_exam_retry_clicked', properties);
  }
}
