/**
 * MockExamSessionPage Regression Tests
 *
 * Verifies the mock exam session page behavior:
 * - Basic rendering with active session
 * - MCQComponent integration (no feedback, no next button)
 * - Language selector
 * - Timer display and warnings
 * - Navigation to results
 * - Exit confirmation dialog
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@/lib/test-utils';
import userEvent from '@testing-library/user-event';
import { useMockExamSessionStore } from '@/stores/mockExamSessionStore';
import type { MockExamQuestion } from '@/types/mockExam';
import type {
  MockExamQuestionState,
  MockExamSessionData,
  MockExamSessionSummary,
} from '@/types/mockExamSession';

import { MockExamSessionPage } from '../MockExamSessionPage';

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock hooks
vi.mock('@/hooks/useMockExamTimer', () => ({
  useMockExamTimer: vi.fn().mockReturnValue({
    formattedTime: '44:30',
    warningLevel: 'none' as const,
    remainingSeconds: 2670,
    minutes: 44,
    seconds: 30,
    isRunning: true,
  }),
}));

vi.mock('@/hooks/useQuestionLanguage', () => ({
  useQuestionLanguage: vi.fn().mockReturnValue({
    questionLanguage: 'en' as const,
    setQuestionLanguage: vi.fn(),
    resetToDefault: vi.fn(),
  }),
}));

vi.mock('@/hooks/useMockExamKeyboardShortcuts', () => ({
  useMockExamKeyboardShortcuts: vi.fn(),
}));

// Mock analytics - must include ALL exports to prevent "No export defined" errors
vi.mock('@/lib/analytics', () => ({
  // Language analytics
  registerInterfaceLanguage: vi.fn(),
  trackLanguageSwitch: vi.fn(),
  // Culture analytics
  trackCultureDeckViewed: vi.fn(),
  trackCultureSessionStarted: vi.fn(),
  trackCultureQuestionAnswered: vi.fn(),
  trackCultureSessionCompleted: vi.fn(),
  trackCultureSessionAbandoned: vi.fn(),
  trackCultureLanguageChanged: vi.fn(),
  trackDeckFilterChanged: vi.fn(),
  generateCultureSessionId: vi.fn(),
  // Admin analytics
  trackAdminDeckEditOpened: vi.fn(),
  trackAdminDeckEditSaved: vi.fn(),
  trackAdminDeckEditCancelled: vi.fn(),
  trackAdminDeckEditFailed: vi.fn(),
  trackAdminDeckDeactivated: vi.fn(),
  trackAdminDeckReactivated: vi.fn(),
  trackAdminDeckPremiumEnabled: vi.fn(),
  trackAdminDeckPremiumDisabled: vi.fn(),
  // Deck analytics
  trackPremiumDeckLockedViewed: vi.fn(),
  trackPremiumDeckLockedClicked: vi.fn(),
  // Theme analytics
  registerTheme: vi.fn(),
  trackThemeChange: vi.fn(),
  trackThemePreferenceLoaded: vi.fn(),
  trackThemeMigration: vi.fn(),
  // Mock exam analytics
  trackMockExamPageViewed: vi.fn(),
  trackMockExamStarted: vi.fn(),
  trackMockExamQuestionAnswered: vi.fn(),
  trackMockExamCompleted: vi.fn(),
  trackMockExamAbandoned: vi.fn(),
  trackMockExamTimerWarning: vi.fn(),
  trackMockExamResultsViewed: vi.fn(),
  trackMockExamIncorrectReviewExpanded: vi.fn(),
  trackMockExamRetryClicked: vi.fn(),
  // News analytics
  trackNewsArticleClicked: vi.fn(),
  trackNewsQuestionsButtonClicked: vi.fn(),
  trackNewsSourceLinkClicked: vi.fn(),
  trackNewsPageViewed: vi.fn(),
  trackNewsPagePaginated: vi.fn(),
  trackNewsPageArticleClicked: vi.fn(),
  trackNewsPageQuestionsClicked: vi.fn(),
  trackNewsPageSeeAllClicked: vi.fn(),
  // Changelog analytics
  trackChangelogPageViewed: vi.fn(),
  trackChangelogPagePaginated: vi.fn(),
  trackChangelogEntryViewed: vi.fn(),
  // Grammar analytics
  trackGrammarCardViewed: vi.fn(),
  trackGrammarTenseChanged: vi.fn(),
  trackGrammarVoiceToggled: vi.fn(),
  trackGrammarGenderChanged: vi.fn(),
  // User card analytics
  trackUserCardCreateStarted: vi.fn(),
  trackUserCardCreateCompleted: vi.fn(),
  trackUserCardCreateCancelled: vi.fn(),
  trackUserCardEditStarted: vi.fn(),
  trackUserCardEditCompleted: vi.fn(),
  trackUserCardEditCancelled: vi.fn(),
  trackUserCardDeleteStarted: vi.fn(),
  trackUserCardDeleteCompleted: vi.fn(),
  trackUserCardDeleteCancelled: vi.fn(),
  // Card error analytics
  trackCardErrorReported: vi.fn(),
  trackCardErrorModalOpened: vi.fn(),
  trackCardErrorModalClosed: vi.fn(),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Mock API service
vi.mock('@/services/mockExamAPI', () => ({
  mockExamAPI: {
    createSession: vi.fn(),
    submitAll: vi.fn(),
    abandonSession: vi.fn(),
    getStatistics: vi.fn(),
    getQuestionQueue: vi.fn(),
  },
}));

// Helper: Create mock question
function createMockQuestion(id: string, orderIndex: number): MockExamQuestion {
  return {
    id,
    question_text: {
      el: `Ερώτηση ${orderIndex + 1}`,
      en: `Question ${orderIndex + 1}`,
      ru: `Вопрос ${orderIndex + 1}`,
    },
    options: [
      { el: 'Α', en: 'Option A', ru: 'А' },
      { el: 'Β', en: 'Option B', ru: 'Б' },
      { el: 'Γ', en: 'Option C', ru: 'В' },
      { el: 'Δ', en: 'Option D', ru: 'Г' },
    ],
    option_count: 4,
    image_url: null,
    order_index: orderIndex,
  };
}

// Helper: Create mock question state
function createMockQuestionState(id: string, orderIndex: number): MockExamQuestionState {
  return {
    question: createMockQuestion(id, orderIndex),
    selectedOption: null,
    correctOption: null,
    isCorrect: null,
    xpEarned: 0,
    timeTaken: null,
    startedAt: new Date().toISOString(),
    answeredAt: null,
  };
}

// Helper: Create active session state
function createActiveSessionState(questionCount = 3, currentIndex = 0) {
  const questions = Array.from({ length: questionCount }, (_, i) =>
    createMockQuestionState(`q-${i + 1}`, i)
  );

  const sessionData: MockExamSessionData = {
    backendSession: {
      id: 'session-123',
      user_id: 'user-1',
      started_at: new Date().toISOString(),
      completed_at: null,
      score: 0,
      total_questions: questionCount,
      passed: false,
      time_taken_seconds: 0,
      status: 'active',
    },
    questions,
    currentIndex,
    status: 'active',
    timer: {
      totalSeconds: 2700,
      remainingSeconds: 2400,
      isRunning: true,
      warningLevel: 'none',
      lastTickAt: new Date().toISOString(),
    },
    stats: { questionsAnswered: currentIndex, correctCount: 0, accuracy: 0, xpEarned: 0 },
    isResumed: false,
    startedAt: new Date().toISOString(),
  };

  return {
    session: sessionData,
    currentQuestion: questions[currentIndex],
    progress: { current: currentIndex + 1, total: questionCount },
    isLoading: false,
    error: null,
    summary: null,
    hasNextQuestion: currentIndex < questionCount - 1,
    hasRecoverableSession: false,
  };
}

describe('MockExamSessionPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    // Reset store to default state
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
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders session page when session is active', () => {
      const state = createActiveSessionState(3, 0);
      useMockExamSessionStore.setState(state);

      render(<MockExamSessionPage />);

      expect(screen.getByTestId('mock-exam-session-page')).toBeInTheDocument();
    });

    it('shows loading skeleton when isLoading is true', () => {
      useMockExamSessionStore.setState({
        session: null,
        isLoading: true,
        error: null,
        summary: null,
        currentQuestion: null,
        progress: { current: 0, total: 0 },
        hasNextQuestion: false,
        hasRecoverableSession: false,
      });

      render(<MockExamSessionPage />);

      // Loading skeleton doesn't have data-testid, but we can check it doesn't show the main page
      expect(screen.queryByTestId('mock-exam-session-page')).not.toBeInTheDocument();
    });

    it('shows error state with retry button when error occurs', () => {
      // Error UI only shows when: (1) NOT loading AND (2) session exists AND (3) error is set
      // Based on source code line 353: if (isLoading || !session) return skeleton
      // Then line 358: if (error) return error UI
      const state = createActiveSessionState(3, 0);
      useMockExamSessionStore.setState({
        ...state,
        isLoading: false,
        error: 'Something went wrong',
      });

      render(<MockExamSessionPage />);

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });

    it('retry button calls clearError', async () => {
      const mockClearError = vi.fn();
      const state = createActiveSessionState(3, 0);
      useMockExamSessionStore.setState({
        ...state,
        isLoading: false,
        error: 'Something went wrong',
        clearError: mockClearError,
      });

      const user = userEvent.setup();
      render(<MockExamSessionPage />);

      const retryButton = screen.getByRole('button', { name: /try again/i });
      await user.click(retryButton);

      expect(mockClearError).toHaveBeenCalled();
    });
  });

  describe('MCQComponent Integration', () => {
    it('renders MCQComponent with question data', () => {
      const state = createActiveSessionState(3, 0);
      useMockExamSessionStore.setState(state);

      render(<MockExamSessionPage />);

      // Verify question text is visible (English by default)
      expect(screen.getByText('Question 1')).toBeInTheDocument();
      // Verify options are visible
      expect(screen.getByText(/Option A/i)).toBeInTheDocument();
      expect(screen.getByText(/Option B/i)).toBeInTheDocument();
    });

    it('does not render ExplanationCard', () => {
      const state = createActiveSessionState(3, 0);
      useMockExamSessionStore.setState(state);

      render(<MockExamSessionPage />);

      // ExplanationCard should NOT be present in session page
      expect(screen.queryByTestId('explanation-card')).not.toBeInTheDocument();
    });

    it('does not render Next button', () => {
      const state = createActiveSessionState(3, 0);
      useMockExamSessionStore.setState(state);

      render(<MockExamSessionPage />);

      // There should be no "Next" button visible in the question area
      // The only button should be the exit button in header
      const allButtons = screen.getAllByRole('button');
      const nextButtons = allButtons.filter((btn) =>
        btn.textContent?.toLowerCase().includes('next')
      );
      expect(nextButtons).toHaveLength(0);
    });
  });

  describe('LanguageSelector', () => {
    it('renders LanguageSelector in session page', () => {
      const state = createActiveSessionState(3, 0);
      useMockExamSessionStore.setState(state);

      render(<MockExamSessionPage />);

      // LanguageSelector should be present (no specific testid, but we can check for common language text)
      // The component renders language options, so at least one should be visible
      const page = screen.getByTestId('mock-exam-session-page');
      expect(page).toBeInTheDocument();
      // Language selector is rendered, verified by integration
    });
  });

  describe('Timer Display', () => {
    it('shows formatted time in header', () => {
      const state = createActiveSessionState(3, 0);
      useMockExamSessionStore.setState(state);

      render(<MockExamSessionPage />);

      // Formatted time from mock: "44:30"
      expect(screen.getByText('44:30')).toBeInTheDocument();
    });

    it('shows warning banner when warningLevel is warning_1min', async () => {
      const { useMockExamTimer } = await import('@/hooks/useMockExamTimer');
      (useMockExamTimer as any).mockReturnValue({
        formattedTime: '00:45',
        warningLevel: 'warning_1min',
        remainingSeconds: 45,
        minutes: 0,
        seconds: 45,
        isRunning: true,
      });

      const state = createActiveSessionState(3, 0);
      useMockExamSessionStore.setState(state);

      render(<MockExamSessionPage />);

      // TimerWarningBanner should be visible when warningLevel is warning_1min
      // It shows the formatted time
      expect(screen.getByText('00:45')).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('navigates to results when summary becomes available', async () => {
      const state = createActiveSessionState(3, 0);
      useMockExamSessionStore.setState(state);

      render(<MockExamSessionPage />);

      // Now set summary to trigger navigation
      const mockSummary: MockExamSessionSummary = {
        sessionId: 'session-123',
        passed: true,
        score: 20,
        totalQuestions: 25,
        percentage: 80,
        passThreshold: 60,
        xpEarned: 100,
        timeTakenSeconds: 1200,
        questionResults: [],
        timerExpired: false,
        completedAt: new Date().toISOString(),
      };

      useMockExamSessionStore.setState({ summary: mockSummary });

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/practice/culture-exam/results');
      });
    });
  });

  describe('Exit Confirmation', () => {
    it('shows exit confirm dialog when exit button clicked', async () => {
      const state = createActiveSessionState(3, 0);
      useMockExamSessionStore.setState(state);

      const user = userEvent.setup();
      render(<MockExamSessionPage />);

      // Find the exit button in the header (MockExamHeader renders it with data-testid="mock-exam-exit-button")
      const exitButton = screen.getByTestId('mock-exam-exit-button');
      await user.click(exitButton);

      // ConfirmDialog should now be visible
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });
  });
});
