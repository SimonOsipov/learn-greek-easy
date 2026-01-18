/**
 * Mock Exam Analytics Unit Tests
 *
 * Tests all tracking functions in mockExamAnalytics.ts
 * Verifies PostHog integration and graceful handling when PostHog is unavailable.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import posthog from 'posthog-js';

import {
  trackMockExamPageViewed,
  trackMockExamStarted,
  trackMockExamQuestionAnswered,
  trackMockExamCompleted,
  trackMockExamAbandoned,
  trackMockExamTimerWarning,
  trackMockExamResultsViewed,
  trackMockExamIncorrectReviewExpanded,
  trackMockExamRetryClicked,
} from '../mockExamAnalytics';

// Mock posthog-js
vi.mock('posthog-js', () => ({
  default: {
    capture: vi.fn(),
  },
}));

describe('mockExamAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Page View Events
  // ==========================================================================

  describe('trackMockExamPageViewed', () => {
    it('should call posthog.capture with correct event name and properties', () => {
      trackMockExamPageViewed({
        has_previous_attempts: true,
        best_score: 85,
        total_attempts: 5,
      });

      expect(posthog.capture).toHaveBeenCalledWith('mock_exam_page_viewed', {
        has_previous_attempts: true,
        best_score: 85,
        total_attempts: 5,
      });
    });

    it('should track when user has no previous attempts', () => {
      trackMockExamPageViewed({
        has_previous_attempts: false,
        best_score: null,
        total_attempts: 0,
      });

      expect(posthog.capture).toHaveBeenCalledWith('mock_exam_page_viewed', {
        has_previous_attempts: false,
        best_score: null,
        total_attempts: 0,
      });
    });

    it('should not throw if posthog.capture is undefined', () => {
      const originalCapture = posthog.capture;
      (posthog as Record<string, unknown>).capture = undefined;

      expect(() => {
        trackMockExamPageViewed({
          has_previous_attempts: true,
          best_score: 90,
          total_attempts: 3,
        });
      }).not.toThrow();

      (posthog as Record<string, unknown>).capture = originalCapture;
    });
  });

  // ==========================================================================
  // Session Started Events
  // ==========================================================================

  describe('trackMockExamStarted', () => {
    it('should call posthog.capture with correct event name and properties', () => {
      trackMockExamStarted({
        session_id: 'session-123',
        total_questions: 20,
        is_resumed: false,
      });

      expect(posthog.capture).toHaveBeenCalledWith('mock_exam_started', {
        session_id: 'session-123',
        total_questions: 20,
        is_resumed: false,
      });
    });

    it('should track resumed sessions', () => {
      trackMockExamStarted({
        session_id: 'session-456',
        total_questions: 20,
        is_resumed: true,
      });

      expect(posthog.capture).toHaveBeenCalledWith('mock_exam_started', {
        session_id: 'session-456',
        total_questions: 20,
        is_resumed: true,
      });
    });

    it('should not throw if posthog.capture is undefined', () => {
      const originalCapture = posthog.capture;
      (posthog as Record<string, unknown>).capture = undefined;

      expect(() => {
        trackMockExamStarted({
          session_id: 'session-789',
          total_questions: 20,
          is_resumed: false,
        });
      }).not.toThrow();

      (posthog as Record<string, unknown>).capture = originalCapture;
    });
  });

  // ==========================================================================
  // Question Answered Events
  // ==========================================================================

  describe('trackMockExamQuestionAnswered', () => {
    it('should call posthog.capture with correct event name and properties', () => {
      trackMockExamQuestionAnswered({
        session_id: 'session-123',
        question_id: 'question-456',
        question_number: 5,
        selected_option: 2,
        is_correct: true,
        timer_remaining_seconds: 1800,
      });

      expect(posthog.capture).toHaveBeenCalledWith('mock_exam_question_answered', {
        session_id: 'session-123',
        question_id: 'question-456',
        question_number: 5,
        selected_option: 2,
        is_correct: true,
        timer_remaining_seconds: 1800,
      });
    });

    it('should track incorrect answers', () => {
      trackMockExamQuestionAnswered({
        session_id: 'session-123',
        question_id: 'question-789',
        question_number: 10,
        selected_option: 3,
        is_correct: false,
        timer_remaining_seconds: 600,
      });

      expect(posthog.capture).toHaveBeenCalledWith('mock_exam_question_answered', {
        session_id: 'session-123',
        question_id: 'question-789',
        question_number: 10,
        selected_option: 3,
        is_correct: false,
        timer_remaining_seconds: 600,
      });
    });

    it('should not throw if posthog.capture is undefined', () => {
      const originalCapture = posthog.capture;
      (posthog as Record<string, unknown>).capture = undefined;

      expect(() => {
        trackMockExamQuestionAnswered({
          session_id: 'session-123',
          question_id: 'question-456',
          question_number: 1,
          selected_option: 1,
          is_correct: true,
          timer_remaining_seconds: 2700,
        });
      }).not.toThrow();

      (posthog as Record<string, unknown>).capture = originalCapture;
    });
  });

  // ==========================================================================
  // Session Completed Events
  // ==========================================================================

  describe('trackMockExamCompleted', () => {
    it('should call posthog.capture with correct event name and properties for passed exam', () => {
      trackMockExamCompleted({
        session_id: 'session-123',
        score: 17,
        total_questions: 20,
        passed: true,
        percentage: 85,
        time_taken_seconds: 1200,
        time_expired: false,
        xp_earned: 100,
      });

      expect(posthog.capture).toHaveBeenCalledWith('mock_exam_completed', {
        session_id: 'session-123',
        score: 17,
        total_questions: 20,
        passed: true,
        percentage: 85,
        time_taken_seconds: 1200,
        time_expired: false,
        xp_earned: 100,
      });
    });

    it('should track failed exam with timer expired', () => {
      trackMockExamCompleted({
        session_id: 'session-456',
        score: 10,
        total_questions: 20,
        passed: false,
        percentage: 50,
        time_taken_seconds: 2700,
        time_expired: true,
        xp_earned: 25,
      });

      expect(posthog.capture).toHaveBeenCalledWith('mock_exam_completed', {
        session_id: 'session-456',
        score: 10,
        total_questions: 20,
        passed: false,
        percentage: 50,
        time_taken_seconds: 2700,
        time_expired: true,
        xp_earned: 25,
      });
    });

    it('should not throw if posthog.capture is undefined', () => {
      const originalCapture = posthog.capture;
      (posthog as Record<string, unknown>).capture = undefined;

      expect(() => {
        trackMockExamCompleted({
          session_id: 'session-789',
          score: 15,
          total_questions: 20,
          passed: true,
          percentage: 75,
          time_taken_seconds: 1800,
          time_expired: false,
          xp_earned: 75,
        });
      }).not.toThrow();

      (posthog as Record<string, unknown>).capture = originalCapture;
    });
  });

  // ==========================================================================
  // Session Abandoned Events
  // ==========================================================================

  describe('trackMockExamAbandoned', () => {
    it('should call posthog.capture with correct event name and properties', () => {
      trackMockExamAbandoned({
        session_id: 'session-123',
        questions_answered: 8,
        timer_remaining_seconds: 1500,
      });

      expect(posthog.capture).toHaveBeenCalledWith('mock_exam_abandoned', {
        session_id: 'session-123',
        questions_answered: 8,
        timer_remaining_seconds: 1500,
      });
    });

    it('should track abandonment at start of exam', () => {
      trackMockExamAbandoned({
        session_id: 'session-456',
        questions_answered: 0,
        timer_remaining_seconds: 2700,
      });

      expect(posthog.capture).toHaveBeenCalledWith('mock_exam_abandoned', {
        session_id: 'session-456',
        questions_answered: 0,
        timer_remaining_seconds: 2700,
      });
    });

    it('should not throw if posthog.capture is undefined', () => {
      const originalCapture = posthog.capture;
      (posthog as Record<string, unknown>).capture = undefined;

      expect(() => {
        trackMockExamAbandoned({
          session_id: 'session-789',
          questions_answered: 15,
          timer_remaining_seconds: 300,
        });
      }).not.toThrow();

      (posthog as Record<string, unknown>).capture = originalCapture;
    });
  });

  // ==========================================================================
  // Timer Warning Events
  // ==========================================================================

  describe('trackMockExamTimerWarning', () => {
    it('should call posthog.capture with 5 minute warning', () => {
      trackMockExamTimerWarning({
        session_id: 'session-123',
        warning_level: 'warning_5min',
        questions_answered: 15,
      });

      expect(posthog.capture).toHaveBeenCalledWith('mock_exam_timer_warning', {
        session_id: 'session-123',
        warning_level: 'warning_5min',
        questions_answered: 15,
      });
    });

    it('should call posthog.capture with 1 minute warning', () => {
      trackMockExamTimerWarning({
        session_id: 'session-456',
        warning_level: 'warning_1min',
        questions_answered: 18,
      });

      expect(posthog.capture).toHaveBeenCalledWith('mock_exam_timer_warning', {
        session_id: 'session-456',
        warning_level: 'warning_1min',
        questions_answered: 18,
      });
    });

    it('should not throw if posthog.capture is undefined', () => {
      const originalCapture = posthog.capture;
      (posthog as Record<string, unknown>).capture = undefined;

      expect(() => {
        trackMockExamTimerWarning({
          session_id: 'session-789',
          warning_level: 'warning_5min',
          questions_answered: 10,
        });
      }).not.toThrow();

      (posthog as Record<string, unknown>).capture = originalCapture;
    });
  });

  // ==========================================================================
  // Results Viewed Events
  // ==========================================================================

  describe('trackMockExamResultsViewed', () => {
    it('should call posthog.capture with correct event name and properties for passed exam', () => {
      trackMockExamResultsViewed({
        session_id: 'session-123',
        score: 18,
        total_questions: 20,
        passed: true,
        percentage: 90,
        timer_expired: false,
        xp_earned: 100,
      });

      expect(posthog.capture).toHaveBeenCalledWith('mock_exam_results_viewed', {
        session_id: 'session-123',
        score: 18,
        total_questions: 20,
        passed: true,
        percentage: 90,
        timer_expired: false,
        xp_earned: 100,
      });
    });

    it('should track failed exam results with timer expired', () => {
      trackMockExamResultsViewed({
        session_id: 'session-456',
        score: 12,
        total_questions: 20,
        passed: false,
        percentage: 60,
        timer_expired: true,
        xp_earned: 30,
      });

      expect(posthog.capture).toHaveBeenCalledWith('mock_exam_results_viewed', {
        session_id: 'session-456',
        score: 12,
        total_questions: 20,
        passed: false,
        percentage: 60,
        timer_expired: true,
        xp_earned: 30,
      });
    });

    it('should not throw if posthog.capture is undefined', () => {
      const originalCapture = posthog.capture;
      (posthog as Record<string, unknown>).capture = undefined;

      expect(() => {
        trackMockExamResultsViewed({
          session_id: 'session-789',
          score: 14,
          total_questions: 20,
          passed: true,
          percentage: 70,
          timer_expired: false,
          xp_earned: 70,
        });
      }).not.toThrow();

      (posthog as Record<string, unknown>).capture = originalCapture;
    });
  });

  // ==========================================================================
  // Incorrect Review Expanded Events
  // ==========================================================================

  describe('trackMockExamIncorrectReviewExpanded', () => {
    it('should call posthog.capture with correct event name and properties', () => {
      trackMockExamIncorrectReviewExpanded({
        session_id: 'session-123',
        incorrect_count: 5,
      });

      expect(posthog.capture).toHaveBeenCalledWith('mock_exam_incorrect_review_expanded', {
        session_id: 'session-123',
        incorrect_count: 5,
      });
    });

    it('should track when no incorrect answers', () => {
      trackMockExamIncorrectReviewExpanded({
        session_id: 'session-456',
        incorrect_count: 0,
      });

      expect(posthog.capture).toHaveBeenCalledWith('mock_exam_incorrect_review_expanded', {
        session_id: 'session-456',
        incorrect_count: 0,
      });
    });

    it('should not throw if posthog.capture is undefined', () => {
      const originalCapture = posthog.capture;
      (posthog as Record<string, unknown>).capture = undefined;

      expect(() => {
        trackMockExamIncorrectReviewExpanded({
          session_id: 'session-789',
          incorrect_count: 3,
        });
      }).not.toThrow();

      (posthog as Record<string, unknown>).capture = originalCapture;
    });
  });

  // ==========================================================================
  // Retry Clicked Events
  // ==========================================================================

  describe('trackMockExamRetryClicked', () => {
    it('should call posthog.capture with correct event name and properties for passed exam retry', () => {
      trackMockExamRetryClicked({
        session_id: 'session-123',
        previous_passed: true,
        previous_score: 85,
      });

      expect(posthog.capture).toHaveBeenCalledWith('mock_exam_retry_clicked', {
        session_id: 'session-123',
        previous_passed: true,
        previous_score: 85,
      });
    });

    it('should track retry after failed exam', () => {
      trackMockExamRetryClicked({
        session_id: 'session-456',
        previous_passed: false,
        previous_score: 55,
      });

      expect(posthog.capture).toHaveBeenCalledWith('mock_exam_retry_clicked', {
        session_id: 'session-456',
        previous_passed: false,
        previous_score: 55,
      });
    });

    it('should not throw if posthog.capture is undefined', () => {
      const originalCapture = posthog.capture;
      (posthog as Record<string, unknown>).capture = undefined;

      expect(() => {
        trackMockExamRetryClicked({
          session_id: 'session-789',
          previous_passed: true,
          previous_score: 70,
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
        trackMockExamPageViewed({
          has_previous_attempts: true,
          best_score: 80,
          total_attempts: 2,
        });
      }).not.toThrow();

      (posthog as Record<string, unknown>).capture = originalCapture;
    });

    it('should handle posthog.capture being null', () => {
      const originalCapture = posthog.capture;
      (posthog as Record<string, unknown>).capture = null;

      expect(() => {
        trackMockExamStarted({
          session_id: 'session-123',
          total_questions: 20,
          is_resumed: false,
        });
      }).not.toThrow();

      (posthog as Record<string, unknown>).capture = originalCapture;
    });
  });
});
