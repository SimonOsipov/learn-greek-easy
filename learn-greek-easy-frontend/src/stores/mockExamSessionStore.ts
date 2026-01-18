/**
 * Mock Exam Session State Management Store
 *
 * Uses Zustand for state management with sessionStorage recovery.
 * Manages the complete mock citizenship exam session lifecycle including:
 * - Session creation and resumption
 * - Question answering and navigation
 * - 45-minute countdown timer with warning thresholds
 * - Auto-submission on timer expiry
 * - Session recovery from sessionStorage
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import log from '@/lib/logger';
import { mockExamAPI } from '@/services/mockExamAPI';
import { useAuthStore } from '@/stores/authStore';
import type { MockExamQuestion, MockExamAnswerResponse } from '@/types/mockExam';
import type {
  MockExamSessionData,
  MockExamSessionState,
  MockExamSessionSummary,
  MockExamQuestionState,
  MockExamTimerState,
  MockExamSessionStats,
  MockExamSessionRecoveryData,
  MockExamTimerWarningLevel,
} from '@/types/mockExamSession';
import {
  MOCK_EXAM_TIME_LIMIT_SECONDS,
  MOCK_EXAM_WARNING_5MIN,
  MOCK_EXAM_WARNING_1MIN,
  MOCK_EXAM_SESSION_STORAGE_KEY,
  MOCK_EXAM_SESSION_RECOVERY_VERSION,
  DEFAULT_SESSION_STATS,
} from '@/types/mockExamSession';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create initial question state from question data
 */
function createQuestionState(question: MockExamQuestion): MockExamQuestionState {
  return {
    question,
    selectedOption: null,
    correctOption: null,
    isCorrect: null,
    xpEarned: 0,
    timeTaken: null,
    startedAt: null,
    answeredAt: null,
  };
}

/**
 * Determine timer warning level based on remaining seconds
 */
function getWarningLevel(remainingSeconds: number): MockExamTimerWarningLevel {
  if (remainingSeconds <= MOCK_EXAM_WARNING_1MIN) {
    return 'warning_1min';
  }
  if (remainingSeconds <= MOCK_EXAM_WARNING_5MIN) {
    return 'warning_5min';
  }
  return 'none';
}

/**
 * Calculate updated stats after answering a question
 */
function calculateUpdatedStats(
  currentStats: MockExamSessionStats,
  isCorrect: boolean,
  xpEarned: number
): MockExamSessionStats {
  const questionsAnswered = currentStats.questionsAnswered + 1;
  const correctCount = currentStats.correctCount + (isCorrect ? 1 : 0);
  const accuracy = questionsAnswered > 0 ? Math.round((correctCount / questionsAnswered) * 100) : 0;
  const totalXpEarned = currentStats.xpEarned + xpEarned;

  return {
    questionsAnswered,
    correctCount,
    accuracy,
    xpEarned: totalXpEarned,
  };
}

/**
 * Save session to sessionStorage for crash recovery
 */
function saveToSessionStorage(session: MockExamSessionData): void {
  try {
    const recoveryData: MockExamSessionRecoveryData = {
      session,
      savedAt: new Date().toISOString(),
      version: MOCK_EXAM_SESSION_RECOVERY_VERSION,
    };
    sessionStorage.setItem(MOCK_EXAM_SESSION_STORAGE_KEY, JSON.stringify(recoveryData));
  } catch (error) {
    log.warn('Failed to save mock exam session to sessionStorage:', error);
  }
}

/**
 * Clear session from sessionStorage
 */
function clearSessionStorage(): void {
  try {
    sessionStorage.removeItem(MOCK_EXAM_SESSION_STORAGE_KEY);
  } catch (error) {
    log.warn('Failed to clear mock exam session from sessionStorage:', error);
  }
}

/**
 * Load recovery data from sessionStorage
 */
function loadFromSessionStorage(): MockExamSessionRecoveryData | null {
  try {
    const data = sessionStorage.getItem(MOCK_EXAM_SESSION_STORAGE_KEY);
    if (!data) return null;

    const recoveryData: MockExamSessionRecoveryData = JSON.parse(data);

    // Check version compatibility
    if (recoveryData.version !== MOCK_EXAM_SESSION_RECOVERY_VERSION) {
      log.warn('Mock exam session recovery data version mismatch, discarding');
      clearSessionStorage();
      return null;
    }

    // Check if session is still active (only recover active sessions)
    if (recoveryData.session.status !== 'active') {
      clearSessionStorage();
      return null;
    }

    // Calculate elapsed time since last save
    const savedAt = new Date(recoveryData.savedAt);
    const now = new Date();
    const elapsedSeconds = Math.round((now.getTime() - savedAt.getTime()) / 1000);

    // Check if timer would have expired
    const adjustedRemaining = recoveryData.session.timer.remainingSeconds - elapsedSeconds;
    if (adjustedRemaining <= 0) {
      log.warn('Mock exam session timer has expired, session not recoverable');
      clearSessionStorage();
      return null;
    }

    return recoveryData;
  } catch (error) {
    log.warn('Failed to load mock exam session from sessionStorage:', error);
    clearSessionStorage();
    return null;
  }
}

// ============================================================================
// Store
// ============================================================================

export const useMockExamSessionStore = create<MockExamSessionState>()(
  devtools(
    (set, get) => ({
      // Initial state
      session: null,
      summary: null,
      isLoading: false,
      error: null,
      hasRecoverableSession: false,

      // Computed properties (need to be recalculated)
      currentQuestion: null,
      progress: { current: 0, total: 0 },
      hasNextQuestion: false,

      /**
       * Start a new mock exam or resume an existing one
       */
      startExam: async () => {
        const { user } = useAuthStore.getState();
        if (!user) {
          set({ error: 'You must be logged in to start a mock exam' });
          return;
        }

        set({ isLoading: true, error: null });

        try {
          // Call backend to create or resume session
          const response = await mockExamAPI.createSession();

          // Create question states
          const questionStates = response.questions.map(createQuestionState);

          // Mark first question as started
          questionStates[0].startedAt = new Date().toISOString();

          // Calculate initial remaining time if resumed
          let remainingSeconds = MOCK_EXAM_TIME_LIMIT_SECONDS;
          if (response.is_resumed && response.session.started_at) {
            const startedAt = new Date(response.session.started_at);
            const now = new Date();
            const elapsedSeconds = Math.round((now.getTime() - startedAt.getTime()) / 1000);
            remainingSeconds = Math.max(0, MOCK_EXAM_TIME_LIMIT_SECONDS - elapsedSeconds);
          }

          // Create timer state
          const timer: MockExamTimerState = {
            totalSeconds: MOCK_EXAM_TIME_LIMIT_SECONDS,
            remainingSeconds,
            isRunning: true,
            warningLevel: getWarningLevel(remainingSeconds),
            lastTickAt: new Date().toISOString(),
          };

          // Create session
          const session: MockExamSessionData = {
            backendSession: response.session,
            questions: questionStates,
            currentIndex: 0,
            status: 'active',
            timer,
            stats: { ...DEFAULT_SESSION_STATS },
            isResumed: response.is_resumed,
            startedAt: new Date().toISOString(),
          };

          set({
            session,
            summary: null,
            isLoading: false,
            error: null,
            hasRecoverableSession: false,
            currentQuestion: questionStates[0],
            progress: { current: 1, total: questionStates.length },
            hasNextQuestion: questionStates.length > 1,
          });

          // Save to sessionStorage for recovery
          saveToSessionStorage(session);

          log.info(
            `Mock exam ${response.is_resumed ? 'resumed' : 'started'}:`,
            response.session.id
          );
        } catch (error) {
          log.error('Failed to start mock exam:', error);
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Failed to start exam',
          });
        }
      },

      /**
       * Submit answer for current question
       */
      answerQuestion: async (selectedOption: number) => {
        const { session } = get();
        if (!session || session.status !== 'active') {
          log.warn('No active session to answer question');
          return;
        }

        const currentQuestion = session.questions[session.currentIndex];
        if (!currentQuestion) {
          log.warn('No current question');
          return;
        }

        // Calculate time taken
        const startedAt = currentQuestion.startedAt
          ? new Date(currentQuestion.startedAt)
          : new Date();
        const answeredAt = new Date();
        const timeTakenSeconds = Math.round((answeredAt.getTime() - startedAt.getTime()) / 1000);

        set({ isLoading: true });

        try {
          // Submit to backend
          const response: MockExamAnswerResponse = await mockExamAPI.submitAnswer(
            session.backendSession.id,
            {
              question_id: currentQuestion.question.id,
              selected_option: selectedOption,
              time_taken_seconds: timeTakenSeconds,
            }
          );

          // Skip if this was a duplicate answer
          if (response.duplicate) {
            log.warn('Duplicate answer submitted, skipping update');
            set({ isLoading: false });
            return;
          }

          // Update question state
          const updatedQuestions = [...session.questions];
          updatedQuestions[session.currentIndex] = {
            ...currentQuestion,
            selectedOption,
            correctOption: response.correct_option,
            isCorrect: response.is_correct,
            xpEarned: response.xp_earned,
            timeTaken: timeTakenSeconds,
            answeredAt: answeredAt.toISOString(),
          };

          // Update stats
          const updatedStats = calculateUpdatedStats(
            session.stats,
            response.is_correct ?? false,
            response.xp_earned
          );

          // Update session
          const updatedSession: MockExamSessionData = {
            ...session,
            questions: updatedQuestions,
            stats: updatedStats,
          };

          set({
            session: updatedSession,
            currentQuestion: updatedQuestions[session.currentIndex],
            isLoading: false,
          });

          // Save to sessionStorage
          saveToSessionStorage(updatedSession);
        } catch (error) {
          log.error('Failed to submit answer:', error);
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Failed to submit answer',
          });
        }
      },

      /**
       * Move to next question or complete session
       */
      nextQuestion: () => {
        const { session, completeExam } = get();
        if (!session || session.status !== 'active') {
          log.warn('No active session');
          return;
        }

        const nextIndex = session.currentIndex + 1;
        const isLastQuestion = nextIndex >= session.questions.length;

        if (isLastQuestion) {
          // All questions answered, complete the exam
          completeExam(false);
          return;
        }

        // Mark next question as started
        const updatedQuestions = [...session.questions];
        updatedQuestions[nextIndex] = {
          ...updatedQuestions[nextIndex],
          startedAt: new Date().toISOString(),
        };

        // Update session
        const updatedSession: MockExamSessionData = {
          ...session,
          questions: updatedQuestions,
          currentIndex: nextIndex,
        };

        set({
          session: updatedSession,
          currentQuestion: updatedQuestions[nextIndex],
          progress: { current: nextIndex + 1, total: session.questions.length },
          hasNextQuestion: nextIndex < session.questions.length - 1,
        });

        // Save to sessionStorage
        saveToSessionStorage(updatedSession);
      },

      /**
       * Abandon the exam
       */
      abandonExam: async () => {
        const { session } = get();
        if (!session) {
          log.warn('No session to abandon');
          return;
        }

        set({ isLoading: true });

        try {
          await mockExamAPI.abandonSession(session.backendSession.id);

          const abandonedSession: MockExamSessionData = {
            ...session,
            status: 'abandoned',
            timer: { ...session.timer, isRunning: false },
          };

          set({
            session: abandonedSession,
            isLoading: false,
          });

          clearSessionStorage();

          log.info('Mock exam abandoned:', session.backendSession.id);
        } catch (error) {
          log.error('Failed to abandon exam:', error);
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Failed to abandon exam',
          });
        }
      },

      /**
       * Complete the exam and get final results
       */
      completeExam: async (timerExpired = false) => {
        const { session } = get();
        if (!session) {
          log.warn('No session to complete');
          return;
        }

        // Stop the timer
        const completedAt = new Date().toISOString();
        const totalTimeSeconds = MOCK_EXAM_TIME_LIMIT_SECONDS - session.timer.remainingSeconds;

        set({ isLoading: true });

        try {
          // Complete on backend
          const response = await mockExamAPI.completeSession(session.backendSession.id, {
            total_time_seconds: totalTimeSeconds,
          });

          // Build summary
          const summary: MockExamSessionSummary = {
            sessionId: session.backendSession.id,
            passed: response.passed,
            score: response.score,
            totalQuestions: response.total_questions,
            percentage: response.percentage,
            passThreshold: response.pass_threshold,
            xpEarned: session.stats.xpEarned,
            timeTakenSeconds: totalTimeSeconds,
            questionResults: session.questions,
            timerExpired,
            completedAt,
          };

          // Update session status
          const completedSession: MockExamSessionData = {
            ...session,
            status: 'completed',
            timer: { ...session.timer, isRunning: false },
          };

          set({
            session: completedSession,
            summary,
            isLoading: false,
          });

          // Clear sessionStorage (no need to recover completed session)
          clearSessionStorage();

          log.info('Mock exam completed:', session.backendSession.id, {
            passed: response.passed,
            score: response.score,
            timerExpired,
          });
        } catch (error) {
          log.error('Failed to complete exam:', error);
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Failed to complete exam',
          });
        }
      },

      /**
       * Timer tick - decrement timer, check warnings, auto-submit if expired
       */
      tickTimer: () => {
        const { session, completeExam } = get();
        if (!session || session.status !== 'active' || !session.timer.isRunning) {
          return;
        }

        const newRemainingSeconds = session.timer.remainingSeconds - 1;

        // Timer expired - auto-submit
        if (newRemainingSeconds <= 0) {
          const expiredSession: MockExamSessionData = {
            ...session,
            status: 'expired',
            timer: {
              ...session.timer,
              remainingSeconds: 0,
              isRunning: false,
              warningLevel: 'warning_1min',
              lastTickAt: new Date().toISOString(),
            },
          };
          set({ session: expiredSession });
          completeExam(true);
          return;
        }

        // Update timer
        const newWarningLevel = getWarningLevel(newRemainingSeconds);
        const updatedTimer: MockExamTimerState = {
          ...session.timer,
          remainingSeconds: newRemainingSeconds,
          warningLevel: newWarningLevel,
          lastTickAt: new Date().toISOString(),
        };

        const updatedSession: MockExamSessionData = {
          ...session,
          timer: updatedTimer,
        };

        set({ session: updatedSession });

        // Throttle sessionStorage writes (every 10 seconds)
        if (newRemainingSeconds % 10 === 0) {
          saveToSessionStorage(updatedSession);
        }
      },

      /**
       * Pause the timer
       */
      pauseTimer: () => {
        const { session } = get();
        if (!session || session.status !== 'active') {
          return;
        }

        const updatedSession: MockExamSessionData = {
          ...session,
          timer: {
            ...session.timer,
            isRunning: false,
            lastTickAt: new Date().toISOString(),
          },
        };

        set({ session: updatedSession });
        saveToSessionStorage(updatedSession);
      },

      /**
       * Resume the timer
       */
      resumeTimer: () => {
        const { session } = get();
        if (!session || session.status !== 'active') {
          return;
        }

        const updatedSession: MockExamSessionData = {
          ...session,
          timer: {
            ...session.timer,
            isRunning: true,
            lastTickAt: new Date().toISOString(),
          },
        };

        set({ session: updatedSession });
        saveToSessionStorage(updatedSession);
      },

      /**
       * Check if there's a recoverable session in sessionStorage
       */
      checkRecoverableSession: (): boolean => {
        const recoveryData = loadFromSessionStorage();
        const hasRecoverable = recoveryData !== null;
        set({ hasRecoverableSession: hasRecoverable });
        return hasRecoverable;
      },

      /**
       * Recover session from sessionStorage
       */
      recoverSession: async (): Promise<boolean> => {
        const recoveryData = loadFromSessionStorage();
        if (!recoveryData) {
          set({ hasRecoverableSession: false });
          return false;
        }

        const { session: savedSession } = recoveryData;

        // Verify user matches
        const { user } = useAuthStore.getState();
        if (!user || user.id !== savedSession.backendSession.user_id) {
          log.warn('User mismatch, cannot recover mock exam session');
          clearSessionStorage();
          set({ hasRecoverableSession: false });
          return false;
        }

        // Calculate adjusted remaining time
        const savedAt = new Date(recoveryData.savedAt);
        const now = new Date();
        const elapsedSeconds = Math.round((now.getTime() - savedAt.getTime()) / 1000);
        const adjustedRemaining = Math.max(0, savedSession.timer.remainingSeconds - elapsedSeconds);

        // If timer would be expired, don't recover
        if (adjustedRemaining <= 0) {
          log.warn('Mock exam timer expired during recovery');
          clearSessionStorage();
          set({ hasRecoverableSession: false });
          return false;
        }

        // Reset current question start time if not yet answered
        const updatedQuestions = [...savedSession.questions];
        const currentQuestion = updatedQuestions[savedSession.currentIndex];
        if (currentQuestion && currentQuestion.answeredAt === null) {
          updatedQuestions[savedSession.currentIndex] = {
            ...currentQuestion,
            startedAt: new Date().toISOString(),
          };
        }

        // Update timer with adjusted time
        const updatedTimer: MockExamTimerState = {
          ...savedSession.timer,
          remainingSeconds: adjustedRemaining,
          isRunning: true,
          warningLevel: getWarningLevel(adjustedRemaining),
          lastTickAt: new Date().toISOString(),
        };

        const recoveredSession: MockExamSessionData = {
          ...savedSession,
          questions: updatedQuestions,
          timer: updatedTimer,
          status: 'active',
        };

        set({
          session: recoveredSession,
          summary: null,
          isLoading: false,
          error: null,
          hasRecoverableSession: false,
          currentQuestion: updatedQuestions[savedSession.currentIndex],
          progress: {
            current: savedSession.currentIndex + 1,
            total: savedSession.questions.length,
          },
          hasNextQuestion: savedSession.currentIndex < savedSession.questions.length - 1,
        });

        // Save updated session
        saveToSessionStorage(recoveredSession);

        log.info(
          'Mock exam session recovered:',
          savedSession.backendSession.id,
          `(${adjustedRemaining}s remaining)`
        );
        return true;
      },

      /**
       * Dismiss recovery without recovering
       */
      dismissRecovery: () => {
        clearSessionStorage();
        set({ hasRecoverableSession: false });
      },

      /**
       * Reset session state completely
       */
      resetSession: () => {
        set({
          session: null,
          summary: null,
          isLoading: false,
          error: null,
          hasRecoverableSession: false,
          currentQuestion: null,
          progress: { current: 0, total: 0 },
          hasNextQuestion: false,
        });
        clearSessionStorage();
      },

      /**
       * Clear error message
       */
      clearError: () => {
        set({ error: null });
      },
    }),
    { name: 'mockExamSessionStore' }
  )
);

/**
 * Check for recoverable mock exam session on app load
 */
export function checkMockExamSessionRecovery(): boolean {
  return useMockExamSessionStore.getState().checkRecoverableSession();
}
