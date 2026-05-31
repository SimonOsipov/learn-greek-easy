/**
 * MockExamPage Tests
 *
 * Covers:
 * - formatTime: boundary values 0, 90, 3600 seconds
 * - can_start_exam ?? false: button disabled + warning when API returns partial data
 * - hasRecoverableSession: Continue button is shown
 * - Stats failure still renders queue UI (start button area)
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@/lib/test-utils';
import { useMockExamSessionStore } from '@/stores/mockExamSessionStore';
import type { MockExamStatisticsResponse, MockExamQueueResponse } from '@/types/mockExam';

import { MockExamPage } from '../MockExamPage';

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock analytics
vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
  registerTheme: vi.fn(),
  registerInterfaceLanguage: vi.fn(),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Mock API service
const mockGetStatistics = vi.fn();
const mockGetQuestionQueue = vi.fn();

vi.mock('@/services/mockExamAPI', () => ({
  mockExamAPI: {
    getStatistics: (...args: unknown[]) => mockGetStatistics(...args),
    getQuestionQueue: (...args: unknown[]) => mockGetQuestionQueue(...args),
    createSession: vi.fn(),
    submitAll: vi.fn(),
    abandonSession: vi.fn(),
  },
}));

// Mock react-i18next so the mockExam namespace resolves without the global test-setup
// (test-setup.ts registers common/deck/etc but NOT mockExam — we keep it scoped here).
vi.mock('react-i18next', async () => {
  const actual = await vi.importActual('react-i18next');
  return {
    ...actual,
    useTranslation: (ns?: string) => {
      if (ns === 'mockExam') {
        return {
          t: (key: string, opts?: Record<string, unknown>) => {
            // Minimal translations needed for the tested behaviours
            const map: Record<string, string | ((...a: unknown[]) => string)> = {
              'page.title': 'Culture Exam Practice',
              'page.subtitle': 'Practice subtitle',
              'stats.totalExams': 'Total Exams',
              'stats.passRate': 'Pass Rate',
              'stats.averageScore': 'Average Score',
              'stats.bestScore': 'Best Score',
              'stats.notAvailable': 'N/A',
              'history.title': 'Recent Exam History',
              'history.empty': "You haven't taken any exams yet.",
              'history.passed': 'Passed',
              'history.failed': 'Failed',
              'history.score': `${opts?.score}/${opts?.total}`,
              'history.percentage': `${opts?.percentage}%`,
              'history.timeTaken': `${opts?.minutes}m ${opts?.seconds}s`,
              'actions.startExam': 'Start Mock Exam',
              'actions.continueExam': 'Continue Exam',
              'states.error': 'Failed to load exam data',
              'states.retry': 'Try Again',
              'states.notEnoughQuestions':
                'Not enough questions available to start an exam. At least 25 questions are required.',
            };
            const val = map[key];
            if (typeof val === 'function') return val(opts);
            return val ?? key;
          },
          i18n: { language: 'en' },
        };
      }
      // Fall through to real i18n for other namespaces
      return { t: (k: string) => k, i18n: { language: 'en' } };
    },
  };
});

// Helpers

function makeStats(overrides?: Partial<MockExamStatisticsResponse>): MockExamStatisticsResponse {
  return {
    stats: {
      total_exams: 5,
      passed_exams: 3,
      pass_rate: 60,
      average_score: 72,
      best_score: 88,
      total_questions_answered: 125,
      average_time_seconds: 1800,
    },
    recent_exams: [],
    ...overrides,
  };
}

function makeQueue(overrides?: Partial<MockExamQueueResponse>): MockExamQueueResponse {
  return {
    total_questions: 25,
    available_questions: 25,
    can_start_exam: true,
    sample_questions: [],
    ...overrides,
  };
}

describe('MockExamPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();

    // Reset store to default state between tests
    useMockExamSessionStore.setState({
      session: null,
      summary: null,
      isLoading: false,
      error: null,
      hasRecoverableSession: false,
      currentQuestion: null,
      progress: { current: 0, total: 0 },
      hasNextQuestion: false,
      checkRecoverableSession: vi.fn(),
    } as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // formatTime boundary values
  // ---------------------------------------------------------------------------

  describe('formatTime display in history items', () => {
    it('renders 0m 0s for a history item with 0 seconds taken', async () => {
      mockGetStatistics.mockResolvedValue(
        makeStats({
          recent_exams: [
            {
              id: 'exam-1',
              started_at: '2024-01-01T10:00:00Z',
              completed_at: '2024-01-01T10:30:00Z',
              score: 20,
              total_questions: 25,
              passed: true,
              time_taken_seconds: 0,
            },
          ],
        })
      );
      mockGetQuestionQueue.mockResolvedValue(makeQueue());

      render(<MockExamPage />);

      await waitFor(() => {
        expect(screen.getByTestId('mock-exam-page')).toBeInTheDocument();
      });

      // formatTime(0) → { minutes: 0, seconds: 0 }
      expect(screen.getByText('0m 0s')).toBeInTheDocument();
    });

    it('renders 1m 30s for a history item with 90 seconds taken', async () => {
      mockGetStatistics.mockResolvedValue(
        makeStats({
          recent_exams: [
            {
              id: 'exam-2',
              started_at: '2024-01-01T10:00:00Z',
              completed_at: '2024-01-01T10:30:00Z',
              score: 18,
              total_questions: 25,
              passed: true,
              time_taken_seconds: 90,
            },
          ],
        })
      );
      mockGetQuestionQueue.mockResolvedValue(makeQueue());

      render(<MockExamPage />);

      await waitFor(() => {
        expect(screen.getByTestId('mock-exam-page')).toBeInTheDocument();
      });

      // formatTime(90) → { minutes: 1, seconds: 30 }
      expect(screen.getByText('1m 30s')).toBeInTheDocument();
    });

    it('renders 60m 0s for a history item with 3600 seconds taken', async () => {
      mockGetStatistics.mockResolvedValue(
        makeStats({
          recent_exams: [
            {
              id: 'exam-3',
              started_at: '2024-01-01T10:00:00Z',
              completed_at: '2024-01-01T11:00:00Z',
              score: 22,
              total_questions: 25,
              passed: true,
              time_taken_seconds: 3600,
            },
          ],
        })
      );
      mockGetQuestionQueue.mockResolvedValue(makeQueue());

      render(<MockExamPage />);

      await waitFor(() => {
        expect(screen.getByTestId('mock-exam-page')).toBeInTheDocument();
      });

      // formatTime(3600) → { minutes: 60, seconds: 0 }
      expect(screen.getByText('60m 0s')).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // can_start_exam ?? false — button disabled + warning when queue returns null
  // ---------------------------------------------------------------------------

  describe('can_start_exam defaults to false on partial API failure', () => {
    it('disables the start button when queue API fails (null queueInfo)', async () => {
      mockGetStatistics.mockResolvedValue(makeStats());
      // Queue API fails — component catches error and sets queueInfo to null
      mockGetQuestionQueue.mockRejectedValue(new Error('Network error'));

      render(<MockExamPage />);

      await waitFor(() => {
        expect(screen.getByTestId('start-exam-button')).toBeInTheDocument();
      });

      const startButton = screen.getByTestId('start-exam-button');
      // canStartExam = queueInfo?.can_start_exam ?? false → false when queueInfo is null
      expect(startButton).toBeDisabled();
    });

    it('does NOT show the not-enough-questions warning when queueInfo is null', async () => {
      // Warning card has condition: !canStartExam && queueInfo
      // When queueInfo is null, warning must not render even though button is disabled
      mockGetStatistics.mockResolvedValue(makeStats());
      mockGetQuestionQueue.mockRejectedValue(new Error('Network error'));

      render(<MockExamPage />);

      await waitFor(() => {
        expect(screen.getByTestId('start-exam-button')).toBeInTheDocument();
      });

      expect(screen.queryByText(/not enough questions/i)).not.toBeInTheDocument();
    });

    it('disables start button and shows warning when can_start_exam is explicitly false', async () => {
      mockGetStatistics.mockResolvedValue(makeStats());
      mockGetQuestionQueue.mockResolvedValue(
        makeQueue({ can_start_exam: false, available_questions: 10 })
      );

      render(<MockExamPage />);

      await waitFor(() => {
        expect(screen.getByTestId('start-exam-button')).toBeInTheDocument();
      });

      const startButton = screen.getByTestId('start-exam-button');
      expect(startButton).toBeDisabled();
      // Warning card visible since queueInfo is not null
      expect(screen.getByText(/not enough questions/i)).toBeInTheDocument();
    });

    it('enables start button when can_start_exam is true', async () => {
      mockGetStatistics.mockResolvedValue(makeStats());
      mockGetQuestionQueue.mockResolvedValue(makeQueue({ can_start_exam: true }));

      render(<MockExamPage />);

      await waitFor(() => {
        expect(screen.getByTestId('start-exam-button')).toBeInTheDocument();
      });

      const startButton = screen.getByTestId('start-exam-button');
      expect(startButton).not.toBeDisabled();
    });
  });

  // ---------------------------------------------------------------------------
  // hasRecoverableSession — Continue button is rendered
  // ---------------------------------------------------------------------------

  describe('hasRecoverableSession', () => {
    it('shows Continue Exam button when hasRecoverableSession is true', async () => {
      mockGetStatistics.mockResolvedValue(makeStats());
      mockGetQuestionQueue.mockResolvedValue(makeQueue());

      useMockExamSessionStore.setState({
        hasRecoverableSession: true,
        checkRecoverableSession: vi.fn(),
      } as any);

      render(<MockExamPage />);

      await waitFor(() => {
        expect(screen.getByTestId('continue-exam-button')).toBeInTheDocument();
      });
    });

    it('does not show Continue Exam button when hasRecoverableSession is false', async () => {
      mockGetStatistics.mockResolvedValue(makeStats());
      mockGetQuestionQueue.mockResolvedValue(makeQueue());

      useMockExamSessionStore.setState({
        hasRecoverableSession: false,
        checkRecoverableSession: vi.fn(),
      } as any);

      render(<MockExamPage />);

      await waitFor(() => {
        expect(screen.getByTestId('start-exam-button')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('continue-exam-button')).not.toBeInTheDocument();
    });

    it('clicking Continue Exam navigates to session', async () => {
      mockGetStatistics.mockResolvedValue(makeStats());
      mockGetQuestionQueue.mockResolvedValue(makeQueue());

      useMockExamSessionStore.setState({
        hasRecoverableSession: true,
        checkRecoverableSession: vi.fn(),
      } as any);

      render(<MockExamPage />);

      await waitFor(() => {
        expect(screen.getByTestId('continue-exam-button')).toBeInTheDocument();
      });

      screen.getByTestId('continue-exam-button').click();

      expect(mockNavigate).toHaveBeenCalledWith('/practice/culture-exam/session');
    });
  });

  // ---------------------------------------------------------------------------
  // Stats failure — queue UI still renders
  // ---------------------------------------------------------------------------

  describe('stats API failure still renders queue UI', () => {
    it('still shows Start Mock Exam button when stats fails but queue succeeds', async () => {
      // Stats fails — statsResponse will be null
      mockGetStatistics.mockRejectedValue(new Error('Stats unavailable'));
      mockGetQuestionQueue.mockResolvedValue(makeQueue({ can_start_exam: true }));

      render(<MockExamPage />);

      await waitFor(() => {
        expect(screen.getByTestId('start-exam-button')).toBeInTheDocument();
      });

      const startButton = screen.getByTestId('start-exam-button');
      expect(startButton).not.toBeDisabled();
    });

    it('shows empty history state when stats response is null', async () => {
      mockGetStatistics.mockRejectedValue(new Error('Stats unavailable'));
      mockGetQuestionQueue.mockResolvedValue(makeQueue({ can_start_exam: true }));

      render(<MockExamPage />);

      await waitFor(() => {
        expect(screen.getByTestId('mock-exam-page')).toBeInTheDocument();
      });

      // recent_exams undefined → EmptyHistoryState renders
      expect(screen.getByText(/haven't taken any exams yet/i)).toBeInTheDocument();
    });

    it('still shows stats grid with zeroed values when stats is null', async () => {
      mockGetStatistics.mockRejectedValue(new Error('Stats unavailable'));
      mockGetQuestionQueue.mockResolvedValue(makeQueue({ can_start_exam: true }));

      render(<MockExamPage />);

      await waitFor(() => {
        expect(screen.getByTestId('mock-exam-page')).toBeInTheDocument();
      });

      // stats?.total_exams ?? 0 → "0" for total exams
      expect(screen.getByText('0')).toBeInTheDocument();
      // stats?.total_exams is falsy so pass rate / average / best show "N/A"
      const naElements = screen.getAllByText('N/A');
      expect(naElements.length).toBeGreaterThanOrEqual(3);
    });
  });

  // ---------------------------------------------------------------------------
  // Basic page rendering
  // ---------------------------------------------------------------------------

  describe('basic rendering', () => {
    it('renders the page title after data loads', async () => {
      mockGetStatistics.mockResolvedValue(makeStats());
      mockGetQuestionQueue.mockResolvedValue(makeQueue());

      render(<MockExamPage />);

      await waitFor(() => {
        expect(screen.getByTestId('mock-exam-title')).toBeInTheDocument();
      });

      expect(screen.getByTestId('mock-exam-title')).toHaveTextContent('Culture Exam Practice');
    });

    it('hides main content while data is loading', () => {
      // Never resolve — stays in loading state
      mockGetStatistics.mockReturnValue(new Promise(() => {}));
      mockGetQuestionQueue.mockReturnValue(new Promise(() => {}));

      render(<MockExamPage />);

      // In loading state, main content (start button) is hidden
      expect(screen.queryByTestId('start-exam-button')).not.toBeInTheDocument();
    });
  });
});
