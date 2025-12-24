/**
 * Culture Practice Session State Management Store
 *
 * Uses Zustand for state management with sessionStorage recovery.
 * Manages the complete culture exam practice session lifecycle.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import { useAuthStore } from '@/stores/authStore';
import type {
  CultureQuestionResponse,
  CultureAnswerResponse,
  CultureLanguage,
  CultureCategory,
} from '@/types/culture';
import type {
  CultureSession,
  CultureSessionConfig,
  CultureSessionState,
  CultureSessionStats,
  CultureSessionSummary,
  CultureQuestionState,
  CultureQuestionResult,
  CultureSessionRecoveryData,
} from '@/types/cultureSession';
import {
  DEFAULT_SESSION_STATS,
  CULTURE_SESSION_STORAGE_KEY,
  CULTURE_SESSION_RECOVERY_VERSION,
} from '@/types/cultureSession';
import { generateSessionId } from '@/utils/analytics';

/**
 * Create initial question state from question data
 */
function createQuestionState(question: CultureQuestionResponse): CultureQuestionState {
  return {
    question,
    selectedOption: null,
    isCorrect: null,
    xpEarned: 0,
    timeTaken: null,
    startedAt: null,
    answeredAt: null,
  };
}

/**
 * Calculate updated stats after answering a question
 */
function calculateUpdatedStats(
  currentStats: CultureSessionStats,
  isCorrect: boolean,
  xpEarned: number,
  timeTakenMs: number
): CultureSessionStats {
  const questionsAnswered = currentStats.questionsAnswered + 1;
  const questionsRemaining = currentStats.questionsRemaining - 1;
  const correctCount = currentStats.correctCount + (isCorrect ? 1 : 0);
  const incorrectCount = currentStats.incorrectCount + (isCorrect ? 0 : 1);
  const accuracy = questionsAnswered > 0 ? Math.round((correctCount / questionsAnswered) * 100) : 0;
  const totalTimeSeconds = currentStats.totalTimeSeconds + Math.round(timeTakenMs / 1000);
  const averageTimeSeconds =
    questionsAnswered > 0 ? Math.round(totalTimeSeconds / questionsAnswered) : 0;
  const totalXpEarned = currentStats.xpEarned + xpEarned;

  return {
    questionsAnswered,
    questionsRemaining,
    correctCount,
    incorrectCount,
    accuracy,
    totalTimeSeconds,
    averageTimeSeconds,
    xpEarned: totalXpEarned,
  };
}

/**
 * Save session to sessionStorage for crash recovery
 */
function saveToSessionStorage(session: CultureSession): void {
  try {
    const recoveryData: CultureSessionRecoveryData = {
      session,
      savedAt: new Date().toISOString(),
      version: CULTURE_SESSION_RECOVERY_VERSION,
    };
    sessionStorage.setItem(CULTURE_SESSION_STORAGE_KEY, JSON.stringify(recoveryData));
  } catch (error) {
    console.warn('Failed to save culture session to sessionStorage:', error);
  }
}

/**
 * Clear session from sessionStorage
 */
function clearSessionStorage(): void {
  try {
    sessionStorage.removeItem(CULTURE_SESSION_STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to clear culture session from sessionStorage:', error);
  }
}

/**
 * Load recovery data from sessionStorage
 */
function loadFromSessionStorage(): CultureSessionRecoveryData | null {
  try {
    const data = sessionStorage.getItem(CULTURE_SESSION_STORAGE_KEY);
    if (!data) return null;

    const recoveryData: CultureSessionRecoveryData = JSON.parse(data);

    // Check version compatibility
    if (recoveryData.version !== CULTURE_SESSION_RECOVERY_VERSION) {
      console.warn('Culture session recovery data version mismatch, discarding');
      clearSessionStorage();
      return null;
    }

    // Check if session is still recoverable (not too old)
    const savedAt = new Date(recoveryData.savedAt);
    const now = new Date();
    const hoursSinceSave = (now.getTime() - savedAt.getTime()) / (1000 * 60 * 60);

    // Sessions older than 24 hours are not recoverable
    if (hoursSinceSave > 24) {
      console.warn('Culture session recovery data too old, discarding');
      clearSessionStorage();
      return null;
    }

    // Only recover active or paused sessions
    if (recoveryData.session.status !== 'active' && recoveryData.session.status !== 'paused') {
      clearSessionStorage();
      return null;
    }

    return recoveryData;
  } catch (error) {
    console.warn('Failed to load culture session from sessionStorage:', error);
    clearSessionStorage();
    return null;
  }
}

/**
 * Culture Session Store
 */
export const useCultureSessionStore = create<CultureSessionState>()(
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
       * Start a new culture practice session
       */
      startSession: (
        deckId: string,
        deckName: string,
        category: CultureCategory,
        questions: CultureQuestionResponse[],
        config: CultureSessionConfig
      ) => {
        const { user } = useAuthStore.getState();
        if (!user) {
          set({ error: 'You must be logged in to start a practice session' });
          return;
        }

        if (questions.length === 0) {
          set({ error: 'No questions available for practice' });
          return;
        }

        // Create question states
        const questionStates = questions.map(createQuestionState);

        // Mark first question as started
        questionStates[0].startedAt = new Date().toISOString();

        // Create session
        const session: CultureSession = {
          sessionId: generateSessionId(),
          deckId,
          deckName,
          category,
          userId: user.id,
          config,
          questions: questionStates,
          currentIndex: 0,
          status: 'active',
          phase: 'question',
          stats: {
            ...DEFAULT_SESSION_STATS,
            questionsRemaining: questions.length,
          },
          startedAt: new Date().toISOString(),
          pausedAt: null,
          endedAt: null,
        };

        set({
          session,
          summary: null,
          isLoading: false,
          error: null,
          hasRecoverableSession: false,
          currentQuestion: questionStates[0],
          progress: { current: 1, total: questions.length },
          hasNextQuestion: questions.length > 1,
        });

        // Save to sessionStorage for recovery
        saveToSessionStorage(session);
      },

      /**
       * Process answer for current question
       */
      answerQuestion: (selectedOption: number, answerResponse: CultureAnswerResponse) => {
        const { session } = get();
        if (!session || session.status !== 'active') {
          console.warn('No active session to answer question');
          return;
        }

        const currentQuestion = session.questions[session.currentIndex];
        if (!currentQuestion) {
          console.warn('No current question');
          return;
        }

        // Calculate time taken
        const startedAt = currentQuestion.startedAt
          ? new Date(currentQuestion.startedAt)
          : new Date();
        const answeredAt = new Date();
        const timeTakenMs = answeredAt.getTime() - startedAt.getTime();

        // Update question state
        const updatedQuestions = [...session.questions];
        updatedQuestions[session.currentIndex] = {
          ...currentQuestion,
          selectedOption,
          isCorrect: answerResponse.is_correct,
          xpEarned: answerResponse.xp_earned,
          timeTaken: timeTakenMs,
          answeredAt: answeredAt.toISOString(),
        };

        // Update stats
        const updatedStats = calculateUpdatedStats(
          session.stats,
          answerResponse.is_correct,
          answerResponse.xp_earned,
          timeTakenMs
        );

        // Update session
        const updatedSession: CultureSession = {
          ...session,
          questions: updatedQuestions,
          stats: updatedStats,
          phase: 'feedback',
        };

        set({
          session: updatedSession,
          currentQuestion: updatedQuestions[session.currentIndex],
        });

        // Save to sessionStorage
        saveToSessionStorage(updatedSession);
      },

      /**
       * Move to next question or complete session
       */
      nextQuestion: () => {
        const { session } = get();
        if (!session || session.status !== 'active') {
          console.warn('No active session');
          return;
        }

        const nextIndex = session.currentIndex + 1;
        const isLastQuestion = nextIndex >= session.questions.length;

        if (isLastQuestion) {
          // End session
          get().endSession();
          return;
        }

        // Mark next question as started
        const updatedQuestions = [...session.questions];
        updatedQuestions[nextIndex] = {
          ...updatedQuestions[nextIndex],
          startedAt: new Date().toISOString(),
        };

        // Update session
        const updatedSession: CultureSession = {
          ...session,
          questions: updatedQuestions,
          currentIndex: nextIndex,
          phase: 'question',
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
       * Pause the session
       */
      pauseSession: () => {
        const { session } = get();
        if (!session || session.status !== 'active') {
          console.warn('No active session to pause');
          return;
        }

        const updatedSession: CultureSession = {
          ...session,
          status: 'paused',
          pausedAt: new Date().toISOString(),
        };

        set({ session: updatedSession });
        saveToSessionStorage(updatedSession);
      },

      /**
       * Resume a paused session
       */
      resumeSession: () => {
        const { session } = get();
        if (!session || session.status !== 'paused') {
          console.warn('No paused session to resume');
          return;
        }

        // Reset the current question start time
        const updatedQuestions = [...session.questions];
        const currentQuestion = updatedQuestions[session.currentIndex];
        if (currentQuestion && currentQuestion.answeredAt === null) {
          updatedQuestions[session.currentIndex] = {
            ...currentQuestion,
            startedAt: new Date().toISOString(),
          };
        }

        const updatedSession: CultureSession = {
          ...session,
          questions: updatedQuestions,
          status: 'active',
          pausedAt: null,
        };

        set({
          session: updatedSession,
          currentQuestion: updatedQuestions[session.currentIndex],
        });
        saveToSessionStorage(updatedSession);
      },

      /**
       * End session and return summary
       */
      endSession: (): CultureSessionSummary => {
        const { session } = get();
        if (!session) {
          throw new Error('No session to end');
        }

        const endedAt = new Date().toISOString();
        const startedAt = new Date(session.startedAt);
        const durationSeconds = Math.round(
          (new Date(endedAt).getTime() - startedAt.getTime()) / 1000
        );

        // Build question results
        const questionResults: CultureQuestionResult[] = session.questions
          .filter((q) => q.selectedOption !== null)
          .map((q, index) => ({
            index,
            question: q.question,
            selectedOption: q.selectedOption!,
            correctOption: q.isCorrect
              ? q.selectedOption!
              : session.questions[index].question.options.findIndex(
                  (_, i) => i + 1 !== q.selectedOption
                ) + 1, // This is simplified; actual correct option comes from answerResponse
            isCorrect: q.isCorrect!,
            xpEarned: q.xpEarned,
            timeSeconds: Math.round((q.timeTaken || 0) / 1000),
          }));

        // Create summary
        const summary: CultureSessionSummary = {
          sessionId: session.sessionId,
          deckId: session.deckId,
          deckName: session.deckName,
          category: session.category,
          userId: session.userId,
          config: session.config,
          stats: session.stats,
          questionResults,
          durationSeconds,
          startedAt: session.startedAt,
          endedAt,
        };

        // Update session status
        const completedSession: CultureSession = {
          ...session,
          status: 'completed',
          endedAt,
        };

        set({
          session: completedSession,
          summary,
        });

        // Clear sessionStorage (no need to recover completed session)
        clearSessionStorage();

        return summary;
      },

      /**
       * Abandon session without saving progress
       */
      abandonSession: () => {
        const { session } = get();
        if (session) {
          const abandonedSession: CultureSession = {
            ...session,
            status: 'abandoned',
            endedAt: new Date().toISOString(),
          };
          set({ session: abandonedSession });
        }

        clearSessionStorage();
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

      /**
       * Clear session summary
       */
      clearSummary: () => {
        set({ summary: null });
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
      recoverSession: (): boolean => {
        const recoveryData = loadFromSessionStorage();
        if (!recoveryData) {
          set({ hasRecoverableSession: false });
          return false;
        }

        const { session } = recoveryData;

        // Verify user matches
        const { user } = useAuthStore.getState();
        if (!user || user.id !== session.userId) {
          console.warn('User mismatch, cannot recover session');
          clearSessionStorage();
          set({ hasRecoverableSession: false });
          return false;
        }

        // Reset current question start time if in question phase
        const updatedQuestions = [...session.questions];
        const currentQuestion = updatedQuestions[session.currentIndex];
        if (
          session.phase === 'question' &&
          currentQuestion &&
          currentQuestion.answeredAt === null
        ) {
          updatedQuestions[session.currentIndex] = {
            ...currentQuestion,
            startedAt: new Date().toISOString(),
          };
        }

        const recoveredSession: CultureSession = {
          ...session,
          questions: updatedQuestions,
          status: 'active',
          pausedAt: null,
        };

        set({
          session: recoveredSession,
          summary: null,
          isLoading: false,
          error: null,
          hasRecoverableSession: false,
          currentQuestion: updatedQuestions[session.currentIndex],
          progress: { current: session.currentIndex + 1, total: session.questions.length },
          hasNextQuestion: session.currentIndex < session.questions.length - 1,
        });

        // Save updated session
        saveToSessionStorage(recoveredSession);

        console.log('Culture session recovered:', session.sessionId);
        return true;
      },

      /**
       * Dismiss recovery prompt without recovering
       */
      dismissRecovery: () => {
        clearSessionStorage();
        set({ hasRecoverableSession: false });
      },

      /**
       * Change the display language for questions
       */
      setLanguage: (language: CultureLanguage) => {
        const { session } = get();
        if (!session) return;

        const updatedSession: CultureSession = {
          ...session,
          config: {
            ...session.config,
            language,
          },
        };

        set({ session: updatedSession });
        saveToSessionStorage(updatedSession);
      },
    }),
    { name: 'cultureSessionStore' }
  )
);

/**
 * Check for recoverable session on app load
 */
export function checkCultureSessionRecovery(): boolean {
  return useCultureSessionStore.getState().checkRecoverableSession();
}
