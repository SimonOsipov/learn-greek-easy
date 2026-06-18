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
import { render, screen, waitFor, within } from '@/lib/test-utils';
import type { CultureReadinessResponse } from '@/services/cultureDeckAPI';
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

// Mock the culture readiness API. These tests target the exam launcher / stats /
// queue behaviour (AC-6 graceful degradation), so readiness resolves a minimal
// VALID fixture by default — the readiness query simply succeeds and contributes
// the hero/category sections, which are orthogonal to the assertions below.
const mockGetReadiness = vi.fn();

vi.mock('@/services/cultureDeckAPI', () => ({
  cultureDeckAPI: {
    getReadiness: (...args: unknown[]) => mockGetReadiness(...args),
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
              'breadcrumb.culture': 'Culture',
              'breadcrumb.mock': 'Mock Exam',
              'page.kicker': 'Mock exam · 25 questions',
              'page.title': 'Culture Exam Practice',
              'page.subtitle': 'Practice subtitle',
              'stats.totalExams': 'Total Exams',
              'stats.passRate': 'Pass Rate',
              'stats.averageScore': 'Average Score',
              'stats.bestScore': 'Best Score',
              'stats.notAvailable': 'N/A',
              'history.eyebrow': 'Recent mock exams',
              'history.titleN': `Last ${opts?.n} attempts`,
              'history.meta': `Pass rate: ${opts?.passRate}% · Best: ${opts?.best}%`,
              'history.empty': "You haven't taken any exams yet.",
              'history.passed': 'Passed',
              'history.failed': 'Failed',
              'history.timeTaken': `${opts?.minutes}m ${opts?.seconds}s`,
              'actions.startExam': 'Start Mock Exam',
              'actions.continueExam': 'Continue Exam',
              'states.error': 'Failed to load exam data',
              'states.retry': 'Try Again',
              'states.notEnoughQuestions':
                'Not enough questions available to start an exam. At least 25 questions are required.',
              // Readiness copy migrated culture → mockExam in PRACT2-11-03; the
              // ported readiness sub-components now read t('readiness.*') from
              // the mockExam namespace.
              'readiness.heroKicker': 'What this means',
              'readiness.heroTitle': `${opts?.learned} of ${opts?.total} questions learned`,
              'readiness.heroAccuracy': `Overall accuracy ${opts?.pct}%`,
              'readiness.heroDesc':
                'The Cyprus culture & history exam asks 25 questions in 45 minutes and you need 60% to pass.',
              'readiness.ctaPractice': `Practice ${opts?.category}`,
              'readiness.metricAccuracy': 'Accuracy',
              'readiness.metricAccuracyTrend': 'on attempted questions',
              'readiness.metricLearned': 'Learned',
              'readiness.metricLearnedTrend': `across ${opts?.n} categories`,
              'readiness.metricStreak': 'Streak',
              'readiness.metricBestScore': 'Best Score',
              'readiness.days': 'days',
              'readiness.catEyebrow': "Where you're weakest",
              'readiness.catTitle': 'Progress by category',
              'readiness.catMeta': 'red bars are below 30% · pass-mark 60%',
              'readiness.catCta': `Practice ${opts?.category} — ${opts?.pct}% ready`,
              'readiness.catNoAttempts': 'No attempts yet',
              'readiness.catAccuracy': `Accuracy: ${opts?.pct}%`,
              'readiness.verdictNotReady': 'Not Ready',
              'readiness.verdictGettingThere': 'Getting There',
              'readiness.verdictReady': 'Ready',
              'readiness.verdictThoroughlyPrepared': 'Thoroughly Prepared',
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

// Minimal VALID readiness payload so the readiness query resolves in the
// generic tests (categories empty → no CategoryPanel, motivation null → no
// nudge; orthogonal to the launcher/stats/queue assertions here).
function makeReadiness(overrides?: Partial<CultureReadinessResponse>): CultureReadinessResponse {
  return {
    readiness_percentage: 0,
    verdict: 'not_ready',
    questions_learned: 0,
    questions_total: 0,
    accuracy_percentage: null,
    total_answers: 0,
    categories: [],
    motivation: null,
    ...overrides,
  };
}

// A rich readiness payload harvested from the deleted CultureReadinessPage.test
// (`readinessFixture`). Drives the merged hero / verdict / metric-strip /
// category-panel assertions now that those sections live on MockExamPage.
// Categories are ordered ASCENDING by readiness_percentage (the API contract),
// so history (22%) is the weakest and owns the hero/category "Practice" CTA.
function makeRichReadiness(
  overrides?: Partial<CultureReadinessResponse>
): CultureReadinessResponse {
  return {
    readiness_percentage: 45,
    verdict: 'getting_there',
    questions_learned: 220,
    questions_total: 490,
    accuracy_percentage: 72,
    total_answers: 650,
    categories: [
      {
        category: 'history',
        readiness_percentage: 22,
        questions_mastered: 25,
        questions_total: 110,
        deck_ids: ['deck-history-1'],
        accuracy_percentage: 65,
        needs_reinforcement: true,
      },
      {
        category: 'politics',
        readiness_percentage: 38,
        questions_mastered: 42,
        questions_total: 110,
        deck_ids: ['deck-politics-1'],
        accuracy_percentage: 70,
        needs_reinforcement: false,
      },
      {
        category: 'geography',
        readiness_percentage: 60,
        questions_mastered: 66,
        questions_total: 110,
        deck_ids: ['deck-geo-1'],
        accuracy_percentage: null,
        needs_reinforcement: false,
      },
    ],
    motivation: null,
    ...overrides,
  };
}

describe('MockExamPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();

    // Readiness resolves a valid payload by default so the readiness query
    // succeeds; individual tests that care about readiness can override.
    mockGetReadiness.mockResolvedValue(makeReadiness());

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

      // History items render only after statistics resolve; mock-exam-page is
      // present during loading, so wait for the text itself, not the container.
      // formatTime(0) → { minutes: 0, seconds: 0 }
      expect(await screen.findByText('0m 0s')).toBeInTheDocument();
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

      // History items render only after statistics resolve; mock-exam-page is
      // present during loading, so wait for the text itself, not the container.
      // formatTime(90) → { minutes: 1, seconds: 30 }
      expect(await screen.findByText('1m 30s')).toBeInTheDocument();
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

      // History items render only after statistics resolve; mock-exam-page is
      // present during loading, so wait for the text itself, not the container.
      // formatTime(3600) → { minutes: 60, seconds: 0 }
      expect(await screen.findByText('60m 0s')).toBeInTheDocument();
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

      // EmptyHistoryState renders only after stats settle; mock-exam-page is
      // present during loading, so wait for the text itself, not the container.
      // recent_exams undefined → EmptyHistoryState renders
      expect(await screen.findByText(/haven't taken any exams yet/i)).toBeInTheDocument();
    });

    it('renders the curated metric strip with Best=— when stats is null (no old StatsGrid)', async () => {
      // PRACT2-11-02 removed the old StatsGrid; the page now shows the curated
      // CultureMetricStrip (Accuracy · Learned · Best · Streak). When stats fails
      // but readiness + queue succeed: the launcher still renders, Best degrades
      // to `—` (best score comes from stats), Streak stays `—` (unwired, no
      // endpoint), and Accuracy / Learned come from readiness (AC-6).
      mockGetStatistics.mockRejectedValue(new Error('Stats unavailable'));
      mockGetReadiness.mockResolvedValue(makeRichReadiness());
      mockGetQuestionQueue.mockResolvedValue(makeQueue({ can_start_exam: true }));

      render(<MockExamPage />);

      // Launcher still renders (AC-6 — a stats failure must not block the page).
      expect(await screen.findByTestId('start-exam-button')).toBeInTheDocument();

      const strip = await screen.findByTestId('culture-metric-strip');
      // Cards are ordered: 0 Accuracy · 1 Learned · 2 Best · 3 Streak.
      // Accuracy (from readiness) → 72; Learned (from readiness) → 220.
      expect(within(screen.getByTestId('culture-metric-0')).getByText('72')).toBeInTheDocument();
      expect(within(screen.getByTestId('culture-metric-1')).getByText('220')).toBeInTheDocument();
      // Best degrades to `—` because the stats source failed (no best_score).
      expect(within(screen.getByTestId('culture-metric-2')).getByText('—')).toBeInTheDocument();
      // Streak is the permanently-unwired placeholder `—`.
      expect(within(screen.getByTestId('culture-metric-3')).getByText('—')).toBeInTheDocument();
      // Sanity: there is no leftover StatsGrid — the strip is the only metric block.
      expect(strip).toBeInTheDocument();
    });

    // F5 — symmetric to the stats-failure cases above: readiness REJECTS while
    // stats + queue SUCCEED. Readiness sections are ADDITIVE, so the exam launcher
    // must still render and the hero / category panel are simply omitted (AC-6).
    it('still renders the exam launcher when readiness fails but stats+queue succeed (F5)', async () => {
      mockGetReadiness.mockRejectedValue(new Error('Readiness unavailable'));
      mockGetStatistics.mockResolvedValue(makeStats());
      mockGetQuestionQueue.mockResolvedValue(makeQueue({ can_start_exam: true }));

      render(<MockExamPage />);

      // Launcher renders and is enabled — no crash, no error screen.
      const startButton = await screen.findByTestId('start-exam-button');
      expect(startButton).not.toBeDisabled();
      expect(screen.queryByText(/failed to load exam data/i)).not.toBeInTheDocument();

      // Readiness-derived sections are omitted when readiness is absent.
      // The donut carries an aria-label "{pct}% readiness"; none should exist.
      expect(screen.queryByLabelText(/readiness/i)).not.toBeInTheDocument();
      // "What this means" hero kicker and the category panel are gone too.
      expect(screen.queryByText(/what this means/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/where you're weakest/i)).not.toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Merged readiness content — hero, verdict, metric strip, category panel
  // (harvested from the deleted CultureReadinessPage.test.tsx)
  // ---------------------------------------------------------------------------

  describe('merged readiness content renders on the page', () => {
    beforeEach(() => {
      // Stats + queue succeed throughout this block; readiness is the variable.
      mockGetStatistics.mockResolvedValue(
        makeStats({ stats: { ...makeStats().stats, best_score: 88 } })
      );
      mockGetQuestionQueue.mockResolvedValue(makeQueue());
    });

    it('renders the readiness donut percentage and verdict pill', async () => {
      mockGetReadiness.mockResolvedValue(makeRichReadiness());

      render(<MockExamPage />);

      // Donut center shows the rounded readiness % (45). Scope to the donut via
      // its aria-label to avoid colliding with the per-category % values.
      const donut = await screen.findByLabelText('45% readiness');
      expect(within(donut).getByText('45%')).toBeInTheDocument();
      // Verdict pill resolves the verdict enum to its label.
      expect(screen.getByText('Getting There')).toBeInTheDocument();
    });

    it('renders the "what this means" explainer with learned + accuracy', async () => {
      mockGetReadiness.mockResolvedValue(makeRichReadiness());

      render(<MockExamPage />);

      // Hero kicker + heroTitle ("{learned} of {total} questions learned").
      expect(await screen.findByText('What this means')).toBeInTheDocument();
      expect(screen.getByText('220 of 490 questions learned')).toBeInTheDocument();
      // Overall accuracy line (accuracy_percentage = 72).
      expect(screen.getByText('Overall accuracy 72%')).toBeInTheDocument();
    });

    it('renders the curated metric strip with readiness-derived Accuracy + Learned and stats-derived Best', async () => {
      mockGetReadiness.mockResolvedValue(makeRichReadiness());

      render(<MockExamPage />);

      await screen.findByTestId('culture-metric-strip');
      // 0 Accuracy → 72 · 1 Learned → 220 · 2 Best → 88 (stats) · 3 Streak → `—`.
      expect(within(screen.getByTestId('culture-metric-0')).getByText('72')).toBeInTheDocument();
      expect(within(screen.getByTestId('culture-metric-1')).getByText('220')).toBeInTheDocument();
      expect(within(screen.getByTestId('culture-metric-2')).getByText('88')).toBeInTheDocument();
      expect(within(screen.getByTestId('culture-metric-3')).getByText('—')).toBeInTheDocument();
    });

    it('renders category rows weakest-first with a "Practice {weakest}" CTA to its deck', async () => {
      mockGetReadiness.mockResolvedValue(makeRichReadiness());

      render(<MockExamPage />);

      await screen.findByText('History');
      // All three category labels render (capitalised from the lowercase API).
      expect(screen.getByText('History')).toBeInTheDocument();
      expect(screen.getByText('Politics')).toBeInTheDocument();
      expect(screen.getByText('Geography')).toBeInTheDocument();

      // The weakest category (history, 22%) is the first row, and its panel CTA
      // links to the first deck id. catCta text → "Practice History — 22% ready".
      const catCta = screen.getByRole('link', { name: /practice history — 22% ready/i });
      expect(catCta).toHaveAttribute('href', '/culture/decks/deck-history-1');

      // A category with null accuracy shows the "No attempts yet" fallback.
      expect(screen.getByText('No attempts yet')).toBeInTheDocument();
    });

    it('renders the hero ghost "Practice {weakest}" CTA pointing at the weakest deck', async () => {
      mockGetReadiness.mockResolvedValue(makeRichReadiness());

      render(<MockExamPage />);

      // Hero CTA copy is just "Practice {category}" (no % suffix) → "Practice History".
      const heroCta = await screen.findByRole('link', { name: /^practice history$/i });
      expect(heroCta).toHaveAttribute('href', '/culture/decks/deck-history-1');
    });

    it('renders the motivation nudge when motivation is set', async () => {
      mockGetReadiness.mockResolvedValue(
        makeRichReadiness({
          motivation: {
            message_key: 'You are making great progress!',
            params: {},
            delta_direction: 'improving',
            delta_percentage: 5,
          },
        })
      );

      render(<MockExamPage />);

      const nudge = await screen.findByText('You are making great progress!');
      expect(nudge).toBeInTheDocument();
    });

    it('hides the motivation nudge when motivation is null', async () => {
      mockGetReadiness.mockResolvedValue(makeRichReadiness()); // motivation: null

      render(<MockExamPage />);

      // Wait for the page to settle on the readiness hero.
      await screen.findByLabelText('45% readiness');
      // The nudge is the only role="note" carrying the motivation message; with
      // motivation null and can_start_exam true, no nudge/warning note exists.
      expect(screen.queryByRole('note')).not.toBeInTheDocument();
    });

    it('omits the category panel when readiness has no categories', async () => {
      mockGetReadiness.mockResolvedValue(makeReadiness({ readiness_percentage: 10 }));

      render(<MockExamPage />);

      // Hero still renders (readiness present), but no category panel.
      await screen.findByLabelText('10% readiness');
      expect(screen.queryByText(/where you're weakest/i)).not.toBeInTheDocument();
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
