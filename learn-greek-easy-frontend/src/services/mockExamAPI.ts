/**
 * Mock Exam API Service
 *
 * Provides methods for mock citizenship exam operations including:
 * - Previewing question queue and availability
 * - Creating or resuming exam sessions
 * - Submitting answers during the exam
 * - Completing exams and getting results
 * - Retrieving statistics and history
 * - Abandoning active sessions
 */

import type {
  MockExamAnswerRequest,
  MockExamAnswerResponse,
  MockExamCompleteRequest,
  MockExamCompleteResponse,
  MockExamCreateResponse,
  MockExamQueueResponse,
  MockExamStatisticsResponse,
  MockExamSubmitAllRequest,
  MockExamSubmitAllResponse,
} from '@/types/mockExam';

import { api } from './api';

const MOCK_EXAM_BASE = '/api/v1/culture/mock-exam';

export const mockExamAPI = {
  /**
   * Get preview of available questions and check if exam can start.
   * Returns total available questions, availability status, and sample questions.
   */
  getQuestionQueue: async (): Promise<MockExamQueueResponse> => {
    return api.get<MockExamQueueResponse>(`${MOCK_EXAM_BASE}/queue`);
  },

  /**
   * Create a new mock exam session or resume an existing active session.
   * If user has an active session, returns that session with is_resumed=true.
   * Otherwise creates a new session with 25 random questions.
   */
  createSession: async (): Promise<MockExamCreateResponse> => {
    return api.post<MockExamCreateResponse>(`${MOCK_EXAM_BASE}/sessions`);
  },

  /**
   * Submit an answer for a question during the exam.
   * Processes the answer, updates SM-2 statistics, and awards XP.
   *
   * @param sessionId - UUID of the mock exam session
   * @param request - Answer request with question_id, selected_option, time_taken_seconds
   */
  submitAnswer: async (
    sessionId: string,
    request: MockExamAnswerRequest
  ): Promise<MockExamAnswerResponse> => {
    return api.post<MockExamAnswerResponse>(
      `${MOCK_EXAM_BASE}/sessions/${sessionId}/answers`,
      request
    );
  },

  /**
   * Submit all answers and complete the exam in a single request.
   * This is the preferred method for exam completion as it:
   * - Processes all answers atomically
   * - Handles any previously submitted answers (marks as duplicates)
   * - Completes the session in one transaction
   *
   * @param sessionId - UUID of the mock exam session
   * @param request - Submit-all request with answers array and total_time_seconds
   */
  submitAll: async (
    sessionId: string,
    request: MockExamSubmitAllRequest
  ): Promise<MockExamSubmitAllResponse> => {
    return api.post<MockExamSubmitAllResponse>(
      `${MOCK_EXAM_BASE}/sessions/${sessionId}/submit-all`,
      request
    );
  },

  /**
   * Complete the mock exam and get final results.
   * Marks the session as completed and determines pass/fail status.
   * Pass threshold is 80% (20/25 correct answers).
   *
   * @param sessionId - UUID of the mock exam session
   * @param request - Complete request with total_time_seconds
   */
  completeSession: async (
    sessionId: string,
    request: MockExamCompleteRequest
  ): Promise<MockExamCompleteResponse> => {
    return api.post<MockExamCompleteResponse>(
      `${MOCK_EXAM_BASE}/sessions/${sessionId}/complete`,
      request
    );
  },

  /**
   * Get user's aggregated mock exam statistics and recent exam history.
   * Returns stats like total exams, pass rate, average score, etc.
   * Also includes up to 10 most recent completed exams.
   */
  getStatistics: async (): Promise<MockExamStatisticsResponse> => {
    return api.get<MockExamStatisticsResponse>(`${MOCK_EXAM_BASE}/statistics`);
  },

  /**
   * Abandon an active mock exam session.
   * Marks the session as abandoned. Cannot be resumed after abandonment.
   *
   * @param sessionId - UUID of the mock exam session
   */
  abandonSession: async (sessionId: string): Promise<void> => {
    return api.delete<void>(`${MOCK_EXAM_BASE}/sessions/${sessionId}`);
  },
};
