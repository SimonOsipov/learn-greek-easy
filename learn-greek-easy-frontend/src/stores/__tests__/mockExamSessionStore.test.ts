// src/stores/__tests__/mockExamSessionStore.test.ts

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mockExamAPI } from '@/services/mockExamAPI';
import type {
  MockExamAnswerResult,
  MockExamCreateResponse,
  MockExamQuestion,
  MockExamSession,
  MockExamSubmitAllResponse,
} from '@/types/mockExam';
import type { MockExamQuestionState, MockExamSessionData } from '@/types/mockExamSession';
import {
  MOCK_EXAM_SESSION_RECOVERY_VERSION,
  MOCK_EXAM_SESSION_STORAGE_KEY,
  MOCK_EXAM_TIME_LIMIT_SECONDS,
} from '@/types/mockExamSession';

import { useAuthStore } from '../authStore';
import { useMockExamSessionStore } from '../mockExamSessionStore';

// Mock the mockExamAPI
vi.mock('@/services/mockExamAPI', () => ({
  mockExamAPI: {
    createSession: vi.fn(),
    submitAnswer: vi.fn(),
    submitAll: vi.fn(),
    abandonSession: vi.fn(),
    completeSession: vi.fn(),
    getStatistics: vi.fn(),
    getQuestionQueue: vi.fn(),
  },
}));

// Mock authStore
vi.mock('../authStore');

// Mock logger to reduce noise
vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('mockExamSessionStore', () => {
  // Mock data
  const mockUserId = 'test-user-123';

  const mockQuestions: MockExamQuestion[] = [
    {
      id: 'q1',
      question_text: { el: 'Question 1 Greek', en: 'Question 1 English' },
      options: [
        { el: 'Option 1 Greek', en: 'Option 1 English' },
        { el: 'Option 2 Greek', en: 'Option 2 English' },
        { el: 'Option 3 Greek', en: 'Option 3 English' },
        { el: 'Option 4 Greek', en: 'Option 4 English' },
      ],
      option_count: 4,
      image_url: null,
      order_index: 0,
    },
    {
      id: 'q2',
      question_text: { el: 'Question 2 Greek', en: 'Question 2 English' },
      options: [
        { el: 'Option 1 Greek', en: 'Option 1 English' },
        { el: 'Option 2 Greek', en: 'Option 2 English' },
        { el: 'Option 3 Greek', en: 'Option 3 English' },
        { el: 'Option 4 Greek', en: 'Option 4 English' },
      ],
      option_count: 4,
      image_url: null,
      order_index: 1,
    },
    {
      id: 'q3',
      question_text: { el: 'Question 3 Greek', en: 'Question 3 English' },
      options: [
        { el: 'Option 1 Greek', en: 'Option 1 English' },
        { el: 'Option 2 Greek', en: 'Option 2 English' },
        { el: 'Option 3 Greek', en: 'Option 3 English' },
        { el: 'Option 4 Greek', en: 'Option 4 English' },
      ],
      option_count: 4,
      image_url: null,
      order_index: 2,
    },
  ];

  const mockSession: MockExamSession = {
    id: 'session-123',
    user_id: mockUserId,
    started_at: new Date().toISOString(),
    completed_at: null,
    score: 0,
    total_questions: 3,
    passed: false,
    time_taken_seconds: 0,
    status: 'active',
  };

  const mockCreateResponse: MockExamCreateResponse = {
    session: mockSession,
    questions: mockQuestions,
    is_resumed: false,
  };

  const mockSubmitAllResponse: MockExamSubmitAllResponse = {
    session: { ...mockSession, status: 'completed', completed_at: new Date().toISOString() },
    passed: true,
    score: 2,
    total_questions: 3,
    percentage: 66.67,
    pass_threshold: 60,
    answer_results: [
      {
        question_id: 'q1',
        is_correct: true,
        correct_option: 1,
        selected_option: 1,
        xp_earned: 10,
        was_duplicate: false,
      },
      {
        question_id: 'q2',
        is_correct: true,
        correct_option: 2,
        selected_option: 2,
        xp_earned: 10,
        was_duplicate: false,
      },
    ] as MockExamAnswerResult[],
    total_xp_earned: 20,
    new_answers_count: 2,
    duplicate_answers_count: 0,
  };

  beforeEach(() => {
    // Reset store to initial state
    useMockExamSessionStore.setState({
      session: null,
      summary: null,
      isLoading: false,
      error: null,
      hasRecoverableSession: false,
      currentQuestion: null,
      progress: { current: 0, total: 0 },
      hasNextQuestion: false,
    });

    // Clear all mocks
    vi.clearAllMocks();

    // Clear sessionStorage
    sessionStorage.clear();

    // Setup authStore mock
    vi.mocked(useAuthStore.getState).mockReturnValue({
      user: { id: mockUserId, email: 'test@example.com', name: 'Test User' },
    } as ReturnType<typeof useAuthStore.getState>);
  });

  afterEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useMockExamSessionStore());

      expect(result.current.session).toBeNull();
      expect(result.current.summary).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.hasRecoverableSession).toBe(false);
      expect(result.current.currentQuestion).toBeNull();
      expect(result.current.progress).toEqual({ current: 0, total: 0 });
      expect(result.current.hasNextQuestion).toBe(false);
    });
  });

  describe('startExam', () => {
    it('should start a new exam successfully', async () => {
      vi.mocked(mockExamAPI.createSession).mockResolvedValue(mockCreateResponse);

      const { result } = renderHook(() => useMockExamSessionStore());

      await act(async () => {
        await result.current.startExam();
      });

      expect(mockExamAPI.createSession).toHaveBeenCalledTimes(1);
      expect(result.current.session).not.toBeNull();
      expect(result.current.session?.backendSession.id).toBe('session-123');
      expect(result.current.session?.questions).toHaveLength(3);
      expect(result.current.session?.status).toBe('active');
      expect(result.current.currentQuestion).not.toBeNull();
      expect(result.current.progress).toEqual({ current: 1, total: 3 });
      expect(result.current.hasNextQuestion).toBe(true);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should save session to sessionStorage after starting', async () => {
      vi.mocked(mockExamAPI.createSession).mockResolvedValue(mockCreateResponse);

      const { result } = renderHook(() => useMockExamSessionStore());

      await act(async () => {
        await result.current.startExam();
      });

      const stored = sessionStorage.getItem(MOCK_EXAM_SESSION_STORAGE_KEY);
      expect(stored).not.toBeNull();

      const recoveryData = JSON.parse(stored!);
      expect(recoveryData.version).toBe(MOCK_EXAM_SESSION_RECOVERY_VERSION);
      expect(recoveryData.session.backendSession.id).toBe('session-123');
    });

    it('should handle API errors gracefully', async () => {
      const errorMessage = 'Network error';
      vi.mocked(mockExamAPI.createSession).mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useMockExamSessionStore());

      await act(async () => {
        await result.current.startExam();
      });

      expect(result.current.session).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(errorMessage);
    });

    it('should require user to be logged in', async () => {
      vi.mocked(useAuthStore.getState).mockReturnValue({
        user: null,
      } as ReturnType<typeof useAuthStore.getState>);

      const { result } = renderHook(() => useMockExamSessionStore());

      await act(async () => {
        await result.current.startExam();
      });

      expect(mockExamAPI.createSession).not.toHaveBeenCalled();
      expect(result.current.error).toBe('You must be logged in to start a mock exam');
    });
  });

  describe('answerQuestion', () => {
    beforeEach(async () => {
      vi.mocked(mockExamAPI.createSession).mockResolvedValue(mockCreateResponse);
    });

    it('should update local state without API call', async () => {
      const { result } = renderHook(() => useMockExamSessionStore());

      await act(async () => {
        await result.current.startExam();
      });

      // Answer the first question
      act(() => {
        result.current.answerQuestion(2);
      });

      // Verify NO API call was made (the key behavior of the simplified architecture)
      expect(mockExamAPI.submitAnswer).not.toHaveBeenCalled();
      expect(mockExamAPI.submitAll).not.toHaveBeenCalled();

      // Verify local state was updated
      const answeredQuestion = result.current.session?.questions[0];
      expect(answeredQuestion?.selectedOption).toBe(2);
      expect(answeredQuestion?.timeTaken).not.toBeNull();
      expect(answeredQuestion?.answeredAt).not.toBeNull();
    });

    it('should save to sessionStorage after answering', async () => {
      const { result } = renderHook(() => useMockExamSessionStore());

      await act(async () => {
        await result.current.startExam();
      });

      // Clear sessionStorage to verify it's called again
      sessionStorage.clear();

      act(() => {
        result.current.answerQuestion(2);
      });

      // Verify sessionStorage was updated
      const stored = sessionStorage.getItem(MOCK_EXAM_SESSION_STORAGE_KEY);
      expect(stored).not.toBeNull();

      const recoveryData = JSON.parse(stored!);
      expect(recoveryData.session.questions[0].selectedOption).toBe(2);
    });

    it('should not allow answering same question twice', async () => {
      const { result } = renderHook(() => useMockExamSessionStore());

      await act(async () => {
        await result.current.startExam();
      });

      // Answer first time
      act(() => {
        result.current.answerQuestion(2);
      });

      const firstAnswer = result.current.session?.questions[0].selectedOption;

      // Try to answer again with different option
      act(() => {
        result.current.answerQuestion(3);
      });

      // Should still have the first answer
      expect(result.current.session?.questions[0].selectedOption).toBe(firstAnswer);
      expect(result.current.session?.questions[0].selectedOption).toBe(2);
    });

    it('should increment questionsAnswered stat', async () => {
      const { result } = renderHook(() => useMockExamSessionStore());

      await act(async () => {
        await result.current.startExam();
      });

      expect(result.current.session?.stats.questionsAnswered).toBe(0);

      act(() => {
        result.current.answerQuestion(1);
      });

      expect(result.current.session?.stats.questionsAnswered).toBe(1);
    });

    it('should do nothing if no active session', () => {
      const { result } = renderHook(() => useMockExamSessionStore());

      // Try to answer without a session
      act(() => {
        result.current.answerQuestion(1);
      });

      // Should not throw, just log warning
      expect(mockExamAPI.submitAnswer).not.toHaveBeenCalled();
    });
  });

  describe('nextQuestion', () => {
    beforeEach(async () => {
      vi.mocked(mockExamAPI.createSession).mockResolvedValue(mockCreateResponse);
    });

    it('should move to next question', async () => {
      const { result } = renderHook(() => useMockExamSessionStore());

      await act(async () => {
        await result.current.startExam();
      });

      expect(result.current.session?.currentIndex).toBe(0);
      expect(result.current.progress.current).toBe(1);

      // Answer and go to next
      act(() => {
        result.current.answerQuestion(1);
      });

      act(() => {
        result.current.nextQuestion();
      });

      expect(result.current.session?.currentIndex).toBe(1);
      expect(result.current.progress.current).toBe(2);
      expect(result.current.currentQuestion?.question.id).toBe('q2');
    });

    it('should update hasNextQuestion correctly', async () => {
      const { result } = renderHook(() => useMockExamSessionStore());

      await act(async () => {
        await result.current.startExam();
      });

      // At question 1 of 3 - has next
      expect(result.current.hasNextQuestion).toBe(true);

      // Go to question 2
      act(() => {
        result.current.answerQuestion(1);
        result.current.nextQuestion();
      });

      // At question 2 of 3 - still has next
      expect(result.current.hasNextQuestion).toBe(true);

      // Go to question 3
      act(() => {
        result.current.answerQuestion(2);
        result.current.nextQuestion();
      });

      // At question 3 of 3 - no more questions
      expect(result.current.hasNextQuestion).toBe(false);
    });
  });

  describe('completeExam', () => {
    beforeEach(async () => {
      vi.mocked(mockExamAPI.createSession).mockResolvedValue(mockCreateResponse);
      vi.mocked(mockExamAPI.submitAll).mockResolvedValue(mockSubmitAllResponse);
    });

    it('should submit all answers in single API request', async () => {
      const { result } = renderHook(() => useMockExamSessionStore());

      await act(async () => {
        await result.current.startExam();
      });

      // Answer two questions
      act(() => {
        result.current.answerQuestion(1);
        result.current.nextQuestion();
      });

      act(() => {
        result.current.answerQuestion(2);
      });

      // Complete the exam
      await act(async () => {
        await result.current.completeExam();
      });

      // Verify submitAll was called ONCE with all answers
      expect(mockExamAPI.submitAll).toHaveBeenCalledTimes(1);

      const submitAllCall = vi.mocked(mockExamAPI.submitAll).mock.calls[0];
      expect(submitAllCall[0]).toBe('session-123'); // session ID
      expect(submitAllCall[1].answers).toHaveLength(2); // 2 answered questions
      expect(submitAllCall[1].answers[0].question_id).toBe('q1');
      expect(submitAllCall[1].answers[0].selected_option).toBe(1);
      expect(submitAllCall[1].answers[1].question_id).toBe('q2');
      expect(submitAllCall[1].answers[1].selected_option).toBe(2);
    });

    it('should build summary from API response', async () => {
      const { result } = renderHook(() => useMockExamSessionStore());

      await act(async () => {
        await result.current.startExam();
      });

      // Answer and complete
      act(() => {
        result.current.answerQuestion(1);
        result.current.nextQuestion();
      });

      act(() => {
        result.current.answerQuestion(2);
      });

      await act(async () => {
        await result.current.completeExam();
      });

      // Verify summary was built from response
      expect(result.current.summary).not.toBeNull();
      expect(result.current.summary?.passed).toBe(true);
      expect(result.current.summary?.score).toBe(2);
      expect(result.current.summary?.totalQuestions).toBe(3);
      expect(result.current.summary?.percentage).toBe(66.67);
      expect(result.current.summary?.passThreshold).toBe(60);
      expect(result.current.summary?.xpEarned).toBe(20);
    });

    it('should handle network error gracefully', async () => {
      const { result } = renderHook(() => useMockExamSessionStore());

      await act(async () => {
        await result.current.startExam();
      });

      // Setup error
      vi.mocked(mockExamAPI.submitAll).mockRejectedValue(new Error('Network error'));

      act(() => {
        result.current.answerQuestion(1);
      });

      await act(async () => {
        await result.current.completeExam();
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe('Network error');
      // Session should still exist (not cleared on error)
      expect(result.current.session).not.toBeNull();
    });

    it('should prevent duplicate completion calls', async () => {
      const { result } = renderHook(() => useMockExamSessionStore());

      await act(async () => {
        await result.current.startExam();
      });

      act(() => {
        result.current.answerQuestion(1);
      });

      // Make submitAll slow to simulate race condition
      vi.mocked(mockExamAPI.submitAll).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockSubmitAllResponse), 100))
      );

      // Call completeExam multiple times simultaneously
      await act(async () => {
        const promise1 = result.current.completeExam();
        const promise2 = result.current.completeExam();
        const promise3 = result.current.completeExam();
        await Promise.all([promise1, promise2, promise3]);
      });

      // Should only call API once
      expect(mockExamAPI.submitAll).toHaveBeenCalledTimes(1);
    });

    it('should handle partial answers (timer expired)', async () => {
      const { result } = renderHook(() => useMockExamSessionStore());

      await act(async () => {
        await result.current.startExam();
      });

      // Answer only ONE question (partial)
      act(() => {
        result.current.answerQuestion(1);
      });

      // Setup response for partial submission
      vi.mocked(mockExamAPI.submitAll).mockResolvedValue({
        ...mockSubmitAllResponse,
        score: 1,
        percentage: 33.33,
        passed: false,
        answer_results: [
          {
            question_id: 'q1',
            is_correct: true,
            correct_option: 1,
            selected_option: 1,
            xp_earned: 10,
            was_duplicate: false,
          },
        ],
        total_xp_earned: 10,
        new_answers_count: 1,
      });

      // Complete with timer expired flag
      await act(async () => {
        await result.current.completeExam(true);
      });

      // Verify only 1 answer was submitted
      const submitAllCall = vi.mocked(mockExamAPI.submitAll).mock.calls[0];
      expect(submitAllCall[1].answers).toHaveLength(1);

      // Verify summary reflects timer expiration
      expect(result.current.summary?.timerExpired).toBe(true);
    });

    it('should clear sessionStorage after completion', async () => {
      const { result } = renderHook(() => useMockExamSessionStore());

      await act(async () => {
        await result.current.startExam();
      });

      act(() => {
        result.current.answerQuestion(1);
      });

      // Verify sessionStorage has data before completion
      expect(sessionStorage.getItem(MOCK_EXAM_SESSION_STORAGE_KEY)).not.toBeNull();

      await act(async () => {
        await result.current.completeExam();
      });

      // Verify sessionStorage is cleared after completion
      expect(sessionStorage.getItem(MOCK_EXAM_SESSION_STORAGE_KEY)).toBeNull();
    });

    it('should update session status to completed', async () => {
      const { result } = renderHook(() => useMockExamSessionStore());

      await act(async () => {
        await result.current.startExam();
      });

      act(() => {
        result.current.answerQuestion(1);
      });

      await act(async () => {
        await result.current.completeExam();
      });

      expect(result.current.session?.status).toBe('completed');
      expect(result.current.session?.timer.isRunning).toBe(false);
    });

    it('should update questions with results from backend', async () => {
      const { result } = renderHook(() => useMockExamSessionStore());

      await act(async () => {
        await result.current.startExam();
      });

      act(() => {
        result.current.answerQuestion(1);
        result.current.nextQuestion();
      });

      act(() => {
        result.current.answerQuestion(2);
      });

      await act(async () => {
        await result.current.completeExam();
      });

      // Questions should now have correctOption, isCorrect, xpEarned from backend
      const q1 = result.current.session?.questions[0];
      expect(q1?.correctOption).toBe(1);
      expect(q1?.isCorrect).toBe(true);
      expect(q1?.xpEarned).toBe(10);

      const q2 = result.current.session?.questions[1];
      expect(q2?.correctOption).toBe(2);
      expect(q2?.isCorrect).toBe(true);
      expect(q2?.xpEarned).toBe(10);
    });
  });

  describe('tickTimer', () => {
    beforeEach(async () => {
      vi.mocked(mockExamAPI.createSession).mockResolvedValue(mockCreateResponse);
      vi.mocked(mockExamAPI.submitAll).mockResolvedValue(mockSubmitAllResponse);
    });

    it('should decrement remaining time', async () => {
      const { result } = renderHook(() => useMockExamSessionStore());

      await act(async () => {
        await result.current.startExam();
      });

      const initialRemaining = result.current.session?.timer.remainingSeconds;

      act(() => {
        result.current.tickTimer();
      });

      expect(result.current.session?.timer.remainingSeconds).toBe(initialRemaining! - 1);
    });

    it('should auto-complete exam when timer expires', async () => {
      const { result } = renderHook(() => useMockExamSessionStore());

      await act(async () => {
        await result.current.startExam();
      });

      // Set remaining time to 1 second (wrapped in act)
      act(() => {
        useMockExamSessionStore.setState((state) => ({
          session: state.session
            ? {
                ...state.session,
                timer: {
                  ...state.session.timer,
                  remainingSeconds: 1,
                },
              }
            : null,
        }));
      });

      // Tick to 0
      await act(async () => {
        result.current.tickTimer();
      });

      // Should have called submitAll
      await waitFor(() => {
        expect(mockExamAPI.submitAll).toHaveBeenCalled();
      });

      // Session status should be expired (then completed)
      expect(result.current.session?.status).toBe('completed');
    });

    it('should update warning level at 5 minute threshold', async () => {
      const { result } = renderHook(() => useMockExamSessionStore());

      await act(async () => {
        await result.current.startExam();
      });

      // Set remaining time to 301 seconds (just above 5 min) - wrapped in act
      act(() => {
        useMockExamSessionStore.setState((state) => ({
          session: state.session
            ? {
                ...state.session,
                timer: {
                  ...state.session.timer,
                  remainingSeconds: 301,
                  warningLevel: 'none',
                },
              }
            : null,
        }));
      });

      expect(result.current.session?.timer.warningLevel).toBe('none');

      // Tick to 300 (5 min)
      act(() => {
        result.current.tickTimer();
      });

      expect(result.current.session?.timer.warningLevel).toBe('warning_5min');
    });

    it('should update warning level at 1 minute threshold', async () => {
      const { result } = renderHook(() => useMockExamSessionStore());

      await act(async () => {
        await result.current.startExam();
      });

      // Set remaining time to 61 seconds - wrapped in act
      act(() => {
        useMockExamSessionStore.setState((state) => ({
          session: state.session
            ? {
                ...state.session,
                timer: {
                  ...state.session.timer,
                  remainingSeconds: 61,
                  warningLevel: 'warning_5min',
                },
              }
            : null,
        }));
      });

      // Tick to 60 (1 min)
      act(() => {
        result.current.tickTimer();
      });

      expect(result.current.session?.timer.warningLevel).toBe('warning_1min');
    });
  });

  describe('abandonExam', () => {
    beforeEach(async () => {
      vi.mocked(mockExamAPI.createSession).mockResolvedValue(mockCreateResponse);
      vi.mocked(mockExamAPI.abandonSession).mockResolvedValue(undefined);
    });

    it('should call abandon API and update status', async () => {
      const { result } = renderHook(() => useMockExamSessionStore());

      await act(async () => {
        await result.current.startExam();
      });

      await act(async () => {
        await result.current.abandonExam();
      });

      expect(mockExamAPI.abandonSession).toHaveBeenCalledWith('session-123');
      expect(result.current.session?.status).toBe('abandoned');
      expect(result.current.session?.timer.isRunning).toBe(false);
    });

    it('should clear sessionStorage after abandoning', async () => {
      const { result } = renderHook(() => useMockExamSessionStore());

      await act(async () => {
        await result.current.startExam();
      });

      expect(sessionStorage.getItem(MOCK_EXAM_SESSION_STORAGE_KEY)).not.toBeNull();

      await act(async () => {
        await result.current.abandonExam();
      });

      expect(sessionStorage.getItem(MOCK_EXAM_SESSION_STORAGE_KEY)).toBeNull();
    });
  });

  describe('Session Recovery', () => {
    beforeEach(async () => {
      vi.mocked(mockExamAPI.createSession).mockResolvedValue(mockCreateResponse);
    });

    it('should check for recoverable session', async () => {
      const { result } = renderHook(() => useMockExamSessionStore());

      // Initially no recoverable session
      let hasRecoverable = false;
      act(() => {
        hasRecoverable = result.current.checkRecoverableSession();
      });
      expect(hasRecoverable).toBe(false);
      expect(result.current.hasRecoverableSession).toBe(false);

      // Start and save a session
      await act(async () => {
        await result.current.startExam();
      });

      // Reset store but keep sessionStorage (wrapped in act)
      act(() => {
        useMockExamSessionStore.setState({
          session: null,
          hasRecoverableSession: false,
        });
      });

      // Now should detect recoverable session
      act(() => {
        hasRecoverable = result.current.checkRecoverableSession();
      });
      expect(hasRecoverable).toBe(true);
      expect(result.current.hasRecoverableSession).toBe(true);
    });

    it('should recover session from sessionStorage', async () => {
      const { result } = renderHook(() => useMockExamSessionStore());

      // Start and answer a question
      await act(async () => {
        await result.current.startExam();
      });

      act(() => {
        result.current.answerQuestion(2);
      });

      const originalSessionId = result.current.session?.backendSession.id;

      // Reset store but keep sessionStorage (wrapped in act)
      act(() => {
        useMockExamSessionStore.setState({
          session: null,
          summary: null,
          hasRecoverableSession: false,
          currentQuestion: null,
          progress: { current: 0, total: 0 },
          hasNextQuestion: false,
        });
      });

      // Recover session
      let recovered = false;
      await act(async () => {
        recovered = await result.current.recoverSession();
      });

      expect(recovered).toBe(true);
      expect(result.current.session?.backendSession.id).toBe(originalSessionId);
      expect(result.current.session?.questions[0].selectedOption).toBe(2);
    });

    it('should not recover expired session', async () => {
      const { result } = renderHook(() => useMockExamSessionStore());

      // Start a session
      await act(async () => {
        await result.current.startExam();
      });

      // Manually create an expired recovery entry
      const expiredData = {
        session: {
          ...result.current.session,
          timer: {
            ...result.current.session!.timer,
            remainingSeconds: 10, // Very little time left
          },
        },
        savedAt: new Date(Date.now() - 60000).toISOString(), // Saved 60 seconds ago
        version: MOCK_EXAM_SESSION_RECOVERY_VERSION,
      };
      sessionStorage.setItem(MOCK_EXAM_SESSION_STORAGE_KEY, JSON.stringify(expiredData));

      // Reset store (wrapped in act)
      act(() => {
        useMockExamSessionStore.setState({
          session: null,
          hasRecoverableSession: false,
        });
      });

      // Check should return false for expired session
      let hasRecoverable = false;
      act(() => {
        hasRecoverable = result.current.checkRecoverableSession();
      });
      expect(hasRecoverable).toBe(false);
    });

    it('should dismiss recovery and clear sessionStorage', async () => {
      const { result } = renderHook(() => useMockExamSessionStore());

      await act(async () => {
        await result.current.startExam();
      });

      // Reset store (wrapped in act)
      act(() => {
        useMockExamSessionStore.setState({
          session: null,
          hasRecoverableSession: true,
        });
      });

      // Dismiss recovery
      act(() => {
        result.current.dismissRecovery();
      });

      expect(result.current.hasRecoverableSession).toBe(false);
      expect(sessionStorage.getItem(MOCK_EXAM_SESSION_STORAGE_KEY)).toBeNull();
    });
  });

  describe('resetSession', () => {
    beforeEach(async () => {
      vi.mocked(mockExamAPI.createSession).mockResolvedValue(mockCreateResponse);
    });

    it('should reset all state to initial values', async () => {
      const { result } = renderHook(() => useMockExamSessionStore());

      await act(async () => {
        await result.current.startExam();
      });

      expect(result.current.session).not.toBeNull();

      act(() => {
        result.current.resetSession();
      });

      expect(result.current.session).toBeNull();
      expect(result.current.summary).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.hasRecoverableSession).toBe(false);
      expect(result.current.currentQuestion).toBeNull();
      expect(result.current.progress).toEqual({ current: 0, total: 0 });
      expect(result.current.hasNextQuestion).toBe(false);
    });

    it('should clear sessionStorage', async () => {
      const { result } = renderHook(() => useMockExamSessionStore());

      await act(async () => {
        await result.current.startExam();
      });

      expect(sessionStorage.getItem(MOCK_EXAM_SESSION_STORAGE_KEY)).not.toBeNull();

      act(() => {
        result.current.resetSession();
      });

      expect(sessionStorage.getItem(MOCK_EXAM_SESSION_STORAGE_KEY)).toBeNull();
    });
  });

  describe('pauseTimer / resumeTimer', () => {
    beforeEach(async () => {
      vi.mocked(mockExamAPI.createSession).mockResolvedValue(mockCreateResponse);
    });

    it('should pause the timer', async () => {
      const { result } = renderHook(() => useMockExamSessionStore());

      await act(async () => {
        await result.current.startExam();
      });

      expect(result.current.session?.timer.isRunning).toBe(true);

      act(() => {
        result.current.pauseTimer();
      });

      expect(result.current.session?.timer.isRunning).toBe(false);
    });

    it('should resume the timer', async () => {
      const { result } = renderHook(() => useMockExamSessionStore());

      await act(async () => {
        await result.current.startExam();
      });

      act(() => {
        result.current.pauseTimer();
      });

      expect(result.current.session?.timer.isRunning).toBe(false);

      act(() => {
        result.current.resumeTimer();
      });

      expect(result.current.session?.timer.isRunning).toBe(true);
    });
  });

  describe('clearError', () => {
    it('should clear error message', async () => {
      const { result } = renderHook(() => useMockExamSessionStore());

      // Set an error (wrapped in act)
      act(() => {
        useMockExamSessionStore.setState({ error: 'Test error' });
      });
      expect(result.current.error).toBe('Test error');

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });
});
