/**
 * Mock Exam Session TypeScript type definitions.
 * Used by mockExamSessionStore and mock exam pages.
 */

import type { MockExamQuestion, MockExamSession } from './mockExam';

// ============================================================================
// Constants
// ============================================================================

/** Total time for mock exam in seconds (45 minutes) */
export const MOCK_EXAM_TIME_LIMIT_SECONDS = 2700;

/** Warning threshold at 5 minutes remaining */
export const MOCK_EXAM_WARNING_5MIN = 300;

/** Warning threshold at 1 minute remaining */
export const MOCK_EXAM_WARNING_1MIN = 60;

/** Session storage key for recovery data */
export const MOCK_EXAM_SESSION_STORAGE_KEY = 'learn-greek-easy:mock-exam-session';

/** Current version of recovery data format */
export const MOCK_EXAM_SESSION_RECOVERY_VERSION = 1;

// ============================================================================
// Types
// ============================================================================

/**
 * Session status for frontend state management.
 * Extends backend status with 'idle' and 'expired' states.
 */
export type MockExamFrontendSessionStatus =
  | 'idle' // No active session
  | 'active' // Exam in progress
  | 'completed' // Successfully completed
  | 'abandoned' // User quit early
  | 'expired'; // Timer ran out

/**
 * Timer warning level for UI feedback
 */
export type MockExamTimerWarningLevel = 'none' | 'warning_5min' | 'warning_1min';

/**
 * State of an individual question within a session
 */
export interface MockExamQuestionState {
  /** The question data from backend */
  question: MockExamQuestion;
  /** User's selected option (1-4) or null if not answered */
  selectedOption: number | null;
  /** The correct option (1-4), populated after answering */
  correctOption: number | null;
  /** Whether the answer was correct (null until answered) */
  isCorrect: boolean | null;
  /** XP earned for this question */
  xpEarned: number;
  /** Time taken to answer in seconds */
  timeTaken: number | null;
  /** When the question was shown (ISO string) */
  startedAt: string | null;
  /** When the question was answered (ISO string) */
  answeredAt: string | null;
}

/**
 * Timer state for the mock exam countdown
 */
export interface MockExamTimerState {
  /** Total time allowed in seconds (2700 = 45 min) */
  totalSeconds: number;
  /** Remaining time in seconds */
  remainingSeconds: number;
  /** Whether timer is currently running */
  isRunning: boolean;
  /** Current warning level based on remaining time */
  warningLevel: MockExamTimerWarningLevel;
  /** Last tick timestamp for recovery calculations */
  lastTickAt: string | null;
}

/**
 * Cumulative session statistics
 */
export interface MockExamSessionStats {
  /** Total questions answered so far */
  questionsAnswered: number;
  /** Number of correct answers */
  correctCount: number;
  /** Accuracy percentage (0-100) */
  accuracy: number;
  /** Total XP earned so far */
  xpEarned: number;
}

/**
 * Main mock exam session data structure for frontend state
 */
export interface MockExamSessionData {
  /** Backend session data (id, user_id, etc.) */
  backendSession: MockExamSession;
  /** All questions with their current state */
  questions: MockExamQuestionState[];
  /** Current question index (0-based) */
  currentIndex: number;
  /** Frontend session status */
  status: MockExamFrontendSessionStatus;
  /** Timer state */
  timer: MockExamTimerState;
  /** Cumulative statistics */
  stats: MockExamSessionStats;
  /** Whether this session was resumed from backend */
  isResumed: boolean;
  /** When the frontend session started (ISO string) */
  startedAt: string;
}

/**
 * Session summary for results page after completion
 */
export interface MockExamSessionSummary {
  /** Session ID */
  sessionId: string;
  /** Whether the user passed (80%+) */
  passed: boolean;
  /** Final score (correct answers) */
  score: number;
  /** Total questions in exam */
  totalQuestions: number;
  /** Score as percentage */
  percentage: number;
  /** Pass threshold percentage */
  passThreshold: number;
  /** Total XP earned */
  xpEarned: number;
  /** Total time taken in seconds */
  timeTakenSeconds: number;
  /** Individual question results */
  questionResults: MockExamQuestionState[];
  /** Whether exam was auto-submitted due to timer */
  timerExpired: boolean;
  /** When exam was completed */
  completedAt: string;
}

/**
 * Recovery data stored in sessionStorage
 */
export interface MockExamSessionRecoveryData {
  /** Session data at time of save */
  session: MockExamSessionData;
  /** Timestamp when saved (ISO string) */
  savedAt: string;
  /** Version for compatibility */
  version: number;
}

/**
 * Mock exam session store state interface
 */
export interface MockExamSessionState {
  /** Active session (null when not in session) */
  session: MockExamSessionData | null;

  /** Session summary after completion (null before completion) */
  summary: MockExamSessionSummary | null;

  /** Loading state for async operations */
  isLoading: boolean;

  /** Error message for user display */
  error: string | null;

  /** Whether there's a recoverable session in storage */
  hasRecoverableSession: boolean;

  // ========== Computed properties ==========
  readonly currentQuestion: MockExamQuestionState | null;
  readonly progress: { current: number; total: number };
  readonly hasNextQuestion: boolean;

  // ========== Actions ==========

  /** Start a new exam or resume an existing one */
  startExam: () => Promise<void>;

  /** Submit answer for current question */
  answerQuestion: (selectedOption: number) => Promise<void>;

  /** Move to next question */
  nextQuestion: () => void;

  /** Abandon the exam (user quit) */
  abandonExam: () => Promise<void>;

  /** Complete the exam (all questions answered or timer expired) */
  completeExam: (timerExpired?: boolean) => Promise<void>;

  /** Timer tick - decrements timer, checks warnings, auto-submits if expired */
  tickTimer: () => void;

  /** Pause the timer */
  pauseTimer: () => void;

  /** Resume the timer */
  resumeTimer: () => void;

  /** Check if there's a recoverable session */
  checkRecoverableSession: () => boolean;

  /** Recover session from sessionStorage */
  recoverSession: () => Promise<boolean>;

  /** Dismiss recovery without recovering */
  dismissRecovery: () => void;

  /** Reset session state completely */
  resetSession: () => void;

  /** Clear error message */
  clearError: () => void;
}

/**
 * Default timer state
 */
export const DEFAULT_TIMER_STATE: MockExamTimerState = {
  totalSeconds: MOCK_EXAM_TIME_LIMIT_SECONDS,
  remainingSeconds: MOCK_EXAM_TIME_LIMIT_SECONDS,
  isRunning: false,
  warningLevel: 'none',
  lastTickAt: null,
};

/**
 * Default session stats
 */
export const DEFAULT_SESSION_STATS: MockExamSessionStats = {
  questionsAnswered: 0,
  correctCount: 0,
  accuracy: 0,
  xpEarned: 0,
};
