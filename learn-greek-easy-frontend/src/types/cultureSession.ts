/**
 * Culture Practice Session TypeScript type definitions.
 * Used by cultureSessionStore and culture practice pages.
 */

import type {
  CultureQuestionResponse,
  CultureAnswerResponse,
  CultureLanguage,
  CultureCategory,
} from './culture';

/**
 * State of an individual question within a session
 */
export interface CultureQuestionState {
  /** The question data */
  question: CultureQuestionResponse;
  /** User's selected option (1-4) or null if not answered */
  selectedOption: number | null;
  /** Whether the answer was correct */
  isCorrect: boolean | null;
  /** XP earned for this question */
  xpEarned: number;
  /** Time taken to answer (milliseconds) */
  timeTaken: number | null;
  /** When the question was shown */
  startedAt: string | null;
  /** When the question was answered */
  answeredAt: string | null;
}

/**
 * Session configuration options
 */
export interface CultureSessionConfig {
  /** Number of questions in the session */
  questionCount: number;
  /** Language for displaying questions */
  language: CultureLanguage;
  /** Whether to randomize question order */
  randomize: boolean;
  /** Optional time limit per question (seconds) */
  timeLimitPerQuestion: number | null;
}

/**
 * Cumulative session statistics
 */
export interface CultureSessionStats {
  /** Total questions answered */
  questionsAnswered: number;
  /** Questions remaining in session */
  questionsRemaining: number;
  /** Number of correct answers */
  correctCount: number;
  /** Number of incorrect answers */
  incorrectCount: number;
  /** Accuracy percentage (0-100) */
  accuracy: number;
  /** Total time spent in seconds */
  totalTimeSeconds: number;
  /** Average time per question in seconds */
  averageTimeSeconds: number;
  /** Total XP earned */
  xpEarned: number;
}

/**
 * Session status enum
 */
export type CultureSessionStatus = 'idle' | 'active' | 'paused' | 'completed' | 'abandoned';

/**
 * Session phase within the practice flow
 */
export type CultureSessionPhase =
  | 'question' // Showing question, waiting for answer
  | 'feedback' // Showing feedback after answer
  | 'loading'; // Loading next question or processing

/**
 * Main culture practice session state
 */
export interface CultureSession {
  /** Unique session identifier */
  sessionId: string;
  /** Deck ID being practiced */
  deckId: string;
  /** Deck name for display */
  deckName: string;
  /** Deck category */
  category: CultureCategory;
  /** User ID */
  userId: string;
  /** Session configuration */
  config: CultureSessionConfig;
  /** All questions in the session */
  questions: CultureQuestionState[];
  /** Current question index (0-based) */
  currentIndex: number;
  /** Session status */
  status: CultureSessionStatus;
  /** Current phase within the session */
  phase: CultureSessionPhase;
  /** Cumulative session statistics */
  stats: CultureSessionStats;
  /** When the session started */
  startedAt: string;
  /** When the session was paused (if paused) */
  pausedAt: string | null;
  /** When the session ended (if completed/abandoned) */
  endedAt: string | null;
}

/**
 * Session summary displayed after completion
 */
export interface CultureSessionSummary {
  /** Session ID */
  sessionId: string;
  /** Deck ID */
  deckId: string;
  /** Deck name */
  deckName: string;
  /** Category */
  category: CultureCategory;
  /** User ID */
  userId: string;
  /** Session configuration used */
  config: CultureSessionConfig;
  /** Final statistics */
  stats: CultureSessionStats;
  /** Individual question results */
  questionResults: CultureQuestionResult[];
  /** Session duration in seconds */
  durationSeconds: number;
  /** When the session started */
  startedAt: string;
  /** When the session ended */
  endedAt: string;
}

/**
 * Individual question result for summary display
 */
export interface CultureQuestionResult {
  /** Question index (0-based) */
  index: number;
  /** Original question data */
  question: CultureQuestionResponse;
  /** User's selected option (1-4) */
  selectedOption: number;
  /** Correct option (1-4) */
  correctOption: number;
  /** Whether the answer was correct */
  isCorrect: boolean;
  /** XP earned */
  xpEarned: number;
  /** Time taken in seconds */
  timeSeconds: number;
}

/**
 * Recovery data stored in sessionStorage
 */
export interface CultureSessionRecoveryData {
  /** Session data at time of save */
  session: CultureSession;
  /** Timestamp when saved */
  savedAt: string;
  /** Version for compatibility */
  version: number;
}

/**
 * Culture session store state interface
 */
export interface CultureSessionState {
  /** Active session (null when not in session) */
  session: CultureSession | null;

  /** Session summary after completion (null before completion) */
  summary: CultureSessionSummary | null;

  /** Loading state for async operations */
  isLoading: boolean;

  /** Error message for user display */
  error: string | null;

  /** Whether there's a recoverable session */
  hasRecoverableSession: boolean;

  // Computed getters
  readonly currentQuestion: CultureQuestionState | null;
  readonly progress: { current: number; total: number };
  readonly hasNextQuestion: boolean;

  // Actions
  startSession: (
    deckId: string,
    deckName: string,
    category: CultureCategory,
    questions: CultureQuestionResponse[],
    config: CultureSessionConfig
  ) => void;
  answerQuestion: (selectedOption: number, answerResponse: CultureAnswerResponse) => void;
  nextQuestion: () => void;
  pauseSession: () => void;
  resumeSession: () => void;
  endSession: () => CultureSessionSummary;
  abandonSession: () => void;
  resetSession: () => void;
  clearError: () => void;
  clearSummary: () => void;
  checkRecoverableSession: () => boolean;
  recoverSession: () => boolean;
  dismissRecovery: () => void;
  setLanguage: (language: CultureLanguage) => void;
}

/**
 * Default session configuration
 */
export const DEFAULT_SESSION_CONFIG: CultureSessionConfig = {
  questionCount: 10,
  language: 'en',
  randomize: true,
  timeLimitPerQuestion: null,
};

/**
 * Default session statistics
 */
export const DEFAULT_SESSION_STATS: CultureSessionStats = {
  questionsAnswered: 0,
  questionsRemaining: 0,
  correctCount: 0,
  incorrectCount: 0,
  accuracy: 0,
  totalTimeSeconds: 0,
  averageTimeSeconds: 0,
  xpEarned: 0,
};

/**
 * Session storage key for recovery data
 */
export const CULTURE_SESSION_STORAGE_KEY = 'learn-greek-easy:culture-session';

/**
 * Current version of recovery data format
 */
export const CULTURE_SESSION_RECOVERY_VERSION = 1;
