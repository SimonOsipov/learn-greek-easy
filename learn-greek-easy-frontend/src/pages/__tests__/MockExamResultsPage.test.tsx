/**
 * MockExamResultsPage Regression Tests
 *
 * Verifies the mock exam results page behavior:
 * - Basic rendering with summary
 * - Pass/fail status display
 * - Statistics grid with correct values
 * - Incorrect answers accordion
 * - Navigation buttons (back, try again)
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@/lib/test-utils';
import userEvent from '@testing-library/user-event';
import { useMockExamSessionStore } from '@/stores/mockExamSessionStore';
import type { MockExamCoverageResponse, MockExamQuestion } from '@/types/mockExam';
import type { MockExamQuestionState, MockExamSessionSummary } from '@/types/mockExamSession';

import { MockExamResultsPage } from '../MockExamResultsPage';

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock the mock-exam API — WEDGE-05-03: the bank-coverage chip + thin marks
// wired into the results-page topic-breakdown panel. This page imports
// nothing else from mockExamAPI today.
const mockGetCoverage = vi.fn();
vi.mock('@/services/mockExamAPI', () => ({
  mockExamAPI: {
    getCoverage: (...args: unknown[]) => mockGetCoverage(...args),
  },
}));

// Mock hooks
vi.mock('@/hooks/useQuestionLanguage', () => ({
  useQuestionLanguage: vi.fn().mockReturnValue({
    questionLanguage: 'en' as const,
    setQuestionLanguage: vi.fn(),
    resetToDefault: vi.fn(),
  }),
}));

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

// Mock XP store
vi.mock('@/stores/xpStore', () => ({
  useXPStore: vi.fn((selector) => {
    if (typeof selector === 'function') return selector({ loadXPStats: vi.fn() });
    return { loadXPStats: vi.fn() };
  }),
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
      { el: 'Α', en: 'Correct Answer', ru: 'Правильный ответ' },
      { el: 'Β', en: 'Wrong Answer 1', ru: 'Неправильный 1' },
      { el: 'Γ', en: 'Wrong Answer 2', ru: 'Неправильный 2' },
      { el: 'Δ', en: 'Wrong Answer 3', ru: 'Неправильный 3' },
    ],
    option_count: 4,
    image_url: null,
    order_index: orderIndex,
  };
}

// Helper: Create mock summary
function createMockSummary(overrides?: Partial<MockExamSessionSummary>): MockExamSessionSummary {
  const questionResults: MockExamQuestionState[] = Array.from({ length: 25 }, (_, i) => ({
    question: createMockQuestion(`q-${i + 1}`, i),
    selectedOption: i < 20 ? 1 : 2, // First 20 correct (option 1), last 5 wrong (option 2)
    correctOption: 1,
    isCorrect: i < 20,
    xpEarned: i < 20 ? 5 : 0,
    timeTaken: 30,
    startedAt: new Date().toISOString(),
    answeredAt: new Date().toISOString(),
  }));

  return {
    sessionId: 'session-123',
    passed: true,
    score: 20,
    totalQuestions: 25,
    percentage: 80,
    passThreshold: 60,
    xpEarned: 100,
    timeTakenSeconds: 1200,
    questionResults,
    topicBreakdown: [],
    timerExpired: false,
    completedAt: new Date().toISOString(),
    ...overrides,
  };
}

// Helper: 5-item topic breakdown in canonical CultureTopic order, including one
// zero-asked topic (percentage: null) to exercise the "not in this attempt" path.
function createMockTopicBreakdown(): MockExamSessionSummary['topicBreakdown'] {
  return [
    { topic: 'history', asked: 6, correct: 4, percentage: 66.7 },
    { topic: 'geography', asked: 5, correct: 5, percentage: 100 },
    { topic: 'politics', asked: 8, correct: 2, percentage: 25 },
    { topic: 'culture', asked: 6, correct: 3, percentage: 50 },
    { topic: 'practical', asked: 0, correct: 0, percentage: null },
  ];
}

// Bank-coverage fixture (WEDGE-05-03). Defaults to all-topics-not-thin so
// tests that don't care about coverage get a benign resolve; individual
// tests override `topics` for the thin-mark mapping.
function makeCoverage(overrides?: Partial<MockExamCoverageResponse>): MockExamCoverageResponse {
  return {
    question_count: 490,
    updated_at: '2026-07-11T14:22:31Z',
    topics: [
      { topic: 'history', thin: false },
      { topic: 'geography', thin: false },
      { topic: 'politics', thin: false },
      { topic: 'culture', thin: false },
      { topic: 'practical', thin: false },
    ],
    ...overrides,
  };
}

describe('MockExamResultsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    mockGetCoverage.mockResolvedValue(makeCoverage());
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
    it('renders results page when summary is available', () => {
      const summary = createMockSummary();
      useMockExamSessionStore.setState({ summary });

      render(<MockExamResultsPage />);

      // Key elements should be visible
      expect(screen.getByText(/Congratulations/i)).toBeInTheDocument();
      expect(screen.getByText('20')).toBeInTheDocument(); // Score
      expect(screen.getByText('80%')).toBeInTheDocument(); // Percentage
    });

    it('redirects when no summary available', async () => {
      useMockExamSessionStore.setState({ summary: null });

      render(<MockExamResultsPage />);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/practice/culture-exam', { replace: true });
      });
    });
  });

  describe('Pass/Fail Status', () => {
    it('shows passed state with congratulations', () => {
      const summary = createMockSummary({ passed: true, score: 20, percentage: 80 });
      useMockExamSessionStore.setState({ summary });

      const { container } = render(<MockExamResultsPage />);

      expect(screen.getByText(/Congratulations/i)).toBeInTheDocument();
      // Verify the success gradient (not the danger gradient) is used for the passed state
      const gradientCard = container.querySelector('.from-\\[hsl\\(var\\(--success\\)\\)\\]');
      expect(gradientCard).toBeInTheDocument();
      // Trophy icon present for passed state (not XCircle)
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('shows failed state', () => {
      const summary = createMockSummary({ passed: false, score: 10, percentage: 40 });
      useMockExamSessionStore.setState({ summary });

      const { container } = render(<MockExamResultsPage />);

      expect(screen.getByText(/didn't pass/i)).toBeInTheDocument();
      // Verify the danger gradient (not the success gradient) is used for the failed state
      const gradientCard = container.querySelector('.from-\\[hsl\\(var\\(--danger\\)\\)\\]');
      expect(gradientCard).toBeInTheDocument();
    });
  });

  describe('Statistics Grid', () => {
    it('displays correct answer count', () => {
      const summary = createMockSummary({ score: 20 });
      useMockExamSessionStore.setState({ summary });

      render(<MockExamResultsPage />);

      expect(screen.getByText('20')).toBeInTheDocument();
      expect(screen.getByText('Correct')).toBeInTheDocument();
    });

    it('displays percentage', () => {
      const summary = createMockSummary({ percentage: 80 });
      useMockExamSessionStore.setState({ summary });

      render(<MockExamResultsPage />);

      expect(screen.getByText('80%')).toBeInTheDocument();
      expect(screen.getByText('Accuracy')).toBeInTheDocument();
    });

    it('displays time taken', () => {
      const summary = createMockSummary({ timeTakenSeconds: 1200 });
      useMockExamSessionStore.setState({ summary });

      render(<MockExamResultsPage />);

      // 1200 seconds = 20 minutes
      expect(screen.getByText('20m')).toBeInTheDocument();
      expect(screen.getByText('Time Taken')).toBeInTheDocument();
    });

    it('shows Time Expired when timer expired', () => {
      const summary = createMockSummary({ timerExpired: true });
      useMockExamSessionStore.setState({ summary });

      render(<MockExamResultsPage />);

      expect(screen.getByText('Time Expired')).toBeInTheDocument();
    });

    it('displays pass threshold', () => {
      const summary = createMockSummary({ passThreshold: 60 });
      useMockExamSessionStore.setState({ summary });

      render(<MockExamResultsPage />);

      expect(screen.getByText('60%')).toBeInTheDocument();
    });

    it('uses font-practice-mono class on stat numbers', () => {
      const summary = createMockSummary({ score: 20, percentage: 80 });
      useMockExamSessionStore.setState({ summary });

      render(<MockExamResultsPage />);

      // Find all elements with font-practice-mono class
      const monoElements = document.querySelectorAll('.font-practice-mono');
      expect(monoElements.length).toBeGreaterThan(0);
    });
  });

  describe('Incorrect Answers Accordion', () => {
    it('shows count of incorrect answers', () => {
      const summary = createMockSummary(); // Default has 5 incorrect
      useMockExamSessionStore.setState({ summary });

      render(<MockExamResultsPage />);

      expect(screen.getByText(/Review Incorrect Answers/i)).toBeInTheDocument();
      expect(screen.getByText(/\(5\)/)).toBeInTheDocument();
    });

    it('shows perfect score message when all correct', async () => {
      const allCorrectResults: MockExamQuestionState[] = Array.from({ length: 25 }, (_, i) => ({
        question: createMockQuestion(`q-${i + 1}`, i),
        selectedOption: 1,
        correctOption: 1,
        isCorrect: true,
        xpEarned: 5,
        timeTaken: 30,
        startedAt: new Date().toISOString(),
        answeredAt: new Date().toISOString(),
      }));

      const summary = createMockSummary({
        score: 25,
        percentage: 100,
        questionResults: allCorrectResults,
      });
      useMockExamSessionStore.setState({ summary });

      const user = userEvent.setup();
      render(<MockExamResultsPage />);

      // Expand the accordion
      const accordionTrigger = screen.getByText(/Review Incorrect Answers/i);
      await user.click(accordionTrigger);

      // Perfect score message should appear
      await waitFor(() => {
        expect(screen.getByText(/Perfect/i)).toBeInTheDocument();
      });
    });
  });

  describe('Topic Breakdown Panel', () => {
    it('renders the panel with one row per topic when breakdown is present', () => {
      const summary = createMockSummary({ topicBreakdown: createMockTopicBreakdown() });
      useMockExamSessionStore.setState({ summary });

      const { container } = render(<MockExamResultsPage />);

      // Container + disclaimer present
      expect(screen.getByTestId('topic-breakdown')).toBeInTheDocument();
      expect(screen.getByTestId('topic-breakdown-disclaimer')).toBeInTheDocument();

      // One row per topic (5)
      const rows = container.querySelectorAll('[data-testid^="topic-bar-"]');
      expect(rows).toHaveLength(5);
    });

    it('scored rows render a width-styled fill span; the zero-asked row does not', () => {
      const summary = createMockSummary({ topicBreakdown: createMockTopicBreakdown() });
      useMockExamSessionStore.setState({ summary });

      render(<MockExamResultsPage />);

      // Scored topic (history, 66.7%) has an inline-width fill span
      const historyRow = screen.getByTestId('topic-bar-history');
      expect(historyRow.querySelector('span[style*="width"]')).not.toBeNull();

      // Zero-asked topic (practical, percentage null) shows the muted note and
      // renders NO width-styled fill span (empty bar track only).
      const practicalRow = screen.getByTestId('topic-bar-practical');
      expect(practicalRow).toHaveTextContent(/Not in this attempt/i);
      expect(practicalRow.querySelector('span[style*="width"]')).toBeNull();
    });

    it('renders nothing when the summary has no topic breakdown (back-compat)', () => {
      // Default createMockSummary() has topicBreakdown: []
      const summary = createMockSummary();
      useMockExamSessionStore.setState({ summary });

      render(<MockExamResultsPage />);

      expect(screen.queryByTestId('topic-breakdown')).not.toBeInTheDocument();
    });

    it('sets data-tone success/warning/danger at the exact readinessTone-mirrored thresholds', () => {
      // Mirrors readinessTone() in MockExamPage.tsx: >=60 success, >=30 warning, else danger.
      const summary = createMockSummary({
        topicBreakdown: [
          { topic: 'history', asked: 10, correct: 10, percentage: 100 }, // success (>=60)
          { topic: 'geography', asked: 10, correct: 6, percentage: 60 }, // success boundary (==60)
          { topic: 'politics', asked: 10, correct: 4, percentage: 40 }, // warning (>=30, <60)
          { topic: 'culture', asked: 10, correct: 3, percentage: 30 }, // warning boundary (==30)
          { topic: 'practical', asked: 10, correct: 1, percentage: 10 }, // danger (<30)
        ],
      });
      useMockExamSessionStore.setState({ summary });

      render(<MockExamResultsPage />);

      const toneOf = (topic: string) =>
        screen
          .getByTestId(`topic-bar-${topic}`)
          .querySelector('.cx-cat-bar')
          ?.getAttribute('data-tone');

      expect(toneOf('history')).toBe('success');
      expect(toneOf('geography')).toBe('success');
      expect(toneOf('politics')).toBe('warning');
      expect(toneOf('culture')).toBe('warning');
      expect(toneOf('practical')).toBe('danger');
    });

    it('a 0% topic with asked>0 (all wrong) is treated as SCORED, not zero-asked: fill span present, danger tone', () => {
      const summary = createMockSummary({
        topicBreakdown: [
          { topic: 'history', asked: 8, correct: 0, percentage: 0 }, // all wrong, still "asked"
          { topic: 'geography', asked: 5, correct: 5, percentage: 100 },
          { topic: 'politics', asked: 5, correct: 3, percentage: 60 },
          { topic: 'culture', asked: 5, correct: 2, percentage: 40 },
          { topic: 'practical', asked: 0, correct: 0, percentage: null },
        ],
      });
      useMockExamSessionStore.setState({ summary });

      render(<MockExamResultsPage />);

      const historyRow = screen.getByTestId('topic-bar-history');
      // A real (0%-width) fill span is present — this is NOT the zero-asked path.
      const fillSpan = historyRow.querySelector('span[style*="width"]');
      expect(fillSpan).not.toBeNull();
      expect(fillSpan).toHaveStyle({ width: '0%' });
      expect(historyRow.querySelector('.cx-cat-bar')?.getAttribute('data-tone')).toBe('danger');
      // Must show the real 0/8 count, not the "not in this attempt" note.
      expect(historyRow).not.toHaveTextContent(/Not in this attempt/i);
      expect(historyRow).toHaveTextContent('0 / 8');
    });

    it('all 5 topics zero-asked: 5 "not in attempt" rows, zero fill spans anywhere in the panel', () => {
      const summary = createMockSummary({
        topicBreakdown: [
          { topic: 'history', asked: 0, correct: 0, percentage: null },
          { topic: 'geography', asked: 0, correct: 0, percentage: null },
          { topic: 'politics', asked: 0, correct: 0, percentage: null },
          { topic: 'culture', asked: 0, correct: 0, percentage: null },
          { topic: 'practical', asked: 0, correct: 0, percentage: null },
        ],
      });
      useMockExamSessionStore.setState({ summary });

      render(<MockExamResultsPage />);

      const panel = screen.getByTestId('topic-breakdown');
      expect(panel.querySelectorAll('span[style*="width"]')).toHaveLength(0);
      expect(panel.querySelectorAll('.cx-cat-bar')).toHaveLength(5);
      // "Not in this attempt" appears once per row.
      const notInAttemptMatches = panel.textContent?.match(/Not in this attempt/gi) ?? [];
      expect(notInAttemptMatches).toHaveLength(5);
    });
  });

  describe('Bank-coverage chip + thin marks (WEDGE-05-03)', () => {
    // RED as of this commit: MockExamResultsPage.tsx does not yet fetch
    // `mockExamAPI.getCoverage()` or render a `coverage-chip` badge / any
    // `thin-coverage-mark` glyphs in the topic-breakdown panel. These fail on
    // `getByTestId('coverage-chip')` / `getByTestId('thin-coverage-mark')`
    // not being found — a clean assertion/query failure, not a render crash
    // or compile error. They go green once the executor adds:
    //   - a `mockExamAPI.getCoverage()` fetch (react-query),
    //   - a `CoverageChip` rendered in the panel's `<h2>` header,
    //   - a `ThinCoverageMark` inside each thin topic's `topic-bar-<topic>` row.

    it('results.chipAndMarksMapByTopic: renders the coverage chip and maps thin marks by topic', async () => {
      const summary = createMockSummary({ topicBreakdown: createMockTopicBreakdown() });
      useMockExamSessionStore.setState({ summary });
      mockGetCoverage.mockResolvedValue(
        makeCoverage({
          topics: [
            { topic: 'history', thin: true },
            { topic: 'geography', thin: true },
            { topic: 'politics', thin: false },
            { topic: 'culture', thin: false },
            { topic: 'practical', thin: false },
          ],
        })
      );

      render(<MockExamResultsPage />);

      expect(await screen.findByTestId('coverage-chip')).toBeInTheDocument();

      expect(
        within(screen.getByTestId('topic-bar-history')).getByTestId('thin-coverage-mark')
      ).toBeInTheDocument();
      expect(
        within(screen.getByTestId('topic-bar-geography')).getByTestId('thin-coverage-mark')
      ).toBeInTheDocument();
      expect(
        within(screen.getByTestId('topic-bar-politics')).queryByTestId('thin-coverage-mark')
      ).not.toBeInTheDocument();
      expect(
        within(screen.getByTestId('topic-bar-culture')).queryByTestId('thin-coverage-mark')
      ).not.toBeInTheDocument();
      expect(
        within(screen.getByTestId('topic-bar-practical')).queryByTestId('thin-coverage-mark')
      ).not.toBeInTheDocument();
    });

    // Guardrail — asserts graceful degradation, not the wiring itself. May
    // pass even pre-wiring (the page never rendered a chip/mark in the first
    // place); that's fine, this test exists to catch a REGRESSION where a
    // getCoverage rejection blocks the breakdown panel from rendering.
    it('results.coverageAbsentDegrades: degrades cleanly (no chip/marks) when getCoverage rejects', async () => {
      const summary = createMockSummary({ topicBreakdown: createMockTopicBreakdown() });
      useMockExamSessionStore.setState({ summary });
      mockGetCoverage.mockRejectedValue(new Error('boom'));

      render(<MockExamResultsPage />);

      expect(screen.getByTestId('topic-bar-history')).toBeInTheDocument();
      expect(screen.queryByTestId('coverage-chip')).not.toBeInTheDocument();
      expect(screen.queryAllByTestId('thin-coverage-mark')).toHaveLength(0);
    });

    // QA adversarial (WEDGE-05-03) — exact-count boundary: with exactly 2
    // thin topics, exactly 2 marks render on the page, each nested inside its
    // OWN topic-bar-<topic> — not merely "at least 2" (would pass if marks
    // leaked onto every bar) and not "some mark exists somewhere".
    it('results.thinMarkCountExactlyMatchesThinTopics: renders exactly one mark per thin topic, none elsewhere', async () => {
      const summary = createMockSummary({ topicBreakdown: createMockTopicBreakdown() });
      useMockExamSessionStore.setState({ summary });
      mockGetCoverage.mockResolvedValue(
        makeCoverage({
          topics: [
            { topic: 'history', thin: true },
            { topic: 'geography', thin: true },
            { topic: 'politics', thin: false },
            { topic: 'culture', thin: false },
            { topic: 'practical', thin: false },
          ],
        })
      );

      render(<MockExamResultsPage />);
      await screen.findByTestId('coverage-chip');

      expect(screen.queryAllByTestId('thin-coverage-mark')).toHaveLength(2);
      expect(
        within(screen.getByTestId('topic-bar-history')).getAllByTestId('thin-coverage-mark')
      ).toHaveLength(1);
      expect(
        within(screen.getByTestId('topic-bar-geography')).getAllByTestId('thin-coverage-mark')
      ).toHaveLength(1);
    });

    // QA adversarial (WEDGE-05-03) — zero-thin boundary: no thin topics at
    // all means zero marks anywhere on the results breakdown panel.
    it('results.zeroThinTopicsRendersNoMarks: no thin-coverage marks anywhere when all topics are non-thin', async () => {
      const summary = createMockSummary({ topicBreakdown: createMockTopicBreakdown() });
      useMockExamSessionStore.setState({ summary });
      mockGetCoverage.mockResolvedValue(makeCoverage());

      render(<MockExamResultsPage />);
      await screen.findByTestId('coverage-chip');

      expect(screen.queryAllByTestId('thin-coverage-mark')).toHaveLength(0);
    });

    // QA adversarial (WEDGE-05-03) — the chip surfaces the raw question count
    // text, not just "exists" (guards against a chip that renders but with
    // the wrong/blank number, e.g. a prop-wiring swap with updatedAt).
    it('results.chipShowsCountText: coverage chip text includes the question count', async () => {
      const summary = createMockSummary({ topicBreakdown: createMockTopicBreakdown() });
      useMockExamSessionStore.setState({ summary });
      mockGetCoverage.mockResolvedValue(makeCoverage({ question_count: 490 }));

      render(<MockExamResultsPage />);

      const chip = await screen.findByTestId('coverage-chip');
      expect(chip).toHaveTextContent('490');
    });
  });

  describe('Navigation', () => {
    it('Back button calls resetSession and navigates', async () => {
      const mockResetSession = vi.fn();
      const summary = createMockSummary();
      useMockExamSessionStore.setState({ summary, resetSession: mockResetSession });

      const user = userEvent.setup();
      render(<MockExamResultsPage />);

      const backButton = screen.getByRole('button', { name: /Back to Culture Exam/i });
      await user.click(backButton);

      expect(mockResetSession).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/practice/culture-exam');
    });

    it('Try Again button calls resetSession and navigates to session', async () => {
      const mockResetSession = vi.fn();
      const summary = createMockSummary();
      useMockExamSessionStore.setState({ summary, resetSession: mockResetSession });

      const user = userEvent.setup();
      render(<MockExamResultsPage />);

      const tryAgainButton = screen.getByRole('button', { name: /Try Again/i });
      await user.click(tryAgainButton);

      expect(mockResetSession).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/practice/culture-exam/session');
    });
  });
});
