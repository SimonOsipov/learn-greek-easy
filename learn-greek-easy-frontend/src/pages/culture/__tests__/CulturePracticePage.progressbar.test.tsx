/**
 * CulturePracticePage ProgressBar Integration Tests
 *
 * Verifies that the ProgressBar component is correctly integrated
 * into the practice page with proper current/total values.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { render, screen } from '@/lib/test-utils';
import { useCultureSessionStore } from '@/stores/cultureSessionStore';

import { CulturePracticePage } from '../CulturePracticePage';

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ deckId: 'test-deck-1' }),
  };
});

// Mock API to prevent real network calls
vi.mock('@/services/cultureDeckAPI', () => ({
  cultureDeckAPI: {
    getQuestionQueue: vi.fn().mockResolvedValue({
      questions: [],
      deck_name: { en: 'Test Deck', el: 'Test Deck', ru: 'Test Deck' },
      category: 'history',
      has_studied_questions: false,
    }),
    submitAnswer: vi.fn(),
  },
}));

vi.mock('@/lib/errorReporting', () => ({
  reportAPIError: vi.fn(),
}));

vi.mock('@/hooks/useTrackEvent', () => ({
  useTrackEvent: () => ({ track: vi.fn() }),
}));

vi.mock('posthog-js', () => ({
  default: { capture: vi.fn() },
}));

// Mock XP store
vi.mock('@/stores/xpStore', () => ({
  useXPStore: () => vi.fn(),
}));

const mockQuestion = {
  id: 'q1',
  question_text: { en: 'Test question?', el: 'Ερώτηση;', ru: 'Вопрос?' },
  options: [
    { en: 'A', el: 'Α', ru: 'А' },
    { en: 'B', el: 'Β', ru: 'Б' },
    { en: 'C', el: 'Γ', ru: 'В' },
    { en: 'D', el: 'Δ', ru: 'Г' },
  ],
  option_count: 4,
  image_url: null,
  order_index: 0,
  original_article_url: null,
};

describe('CulturePracticePage - ProgressBar integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCultureSessionStore.getState().abandonSession();
  });

  it('renders ProgressBar with correct current and total when session is active', () => {
    // Set up store with an active session at question 3 of 10
    const store = useCultureSessionStore.getState();

    // Create mock questions array
    const questions = Array.from({ length: 10 }, (_, i) => ({
      ...mockQuestion,
      id: `q${i + 1}`,
      order_index: i,
    }));

    // We need to manually set the store state since startSession requires auth
    useCultureSessionStore.setState({
      session: {
        sessionId: 'test-session',
        deckId: 'test-deck-1',
        deckName: 'Test Deck',
        category: 'history',
        status: 'active' as const,
        phase: 'question' as const,
        questions,
        questionStates: questions.map((q) => ({
          question: q,
          selectedOption: null,
          isCorrect: null,
          xpEarned: 0,
          timeTaken: null,
          startedAt: null,
          answeredAt: null,
        })),
        currentIndex: 2,
        results: [],
        stats: {
          questionsAnswered: 2,
          correctAnswers: 1,
          incorrectAnswers: 1,
          totalXPEarned: 10,
          totalTimeSeconds: 30,
        },
        config: {
          questionCount: 10,
          language: 'en',
          shuffleQuestions: true,
          showExplanations: true,
          timeLimit: null,
          srsEnabled: true,
        },
        startedAt: new Date().toISOString(),
        userId: 'test-user',
      },
      currentQuestion: {
        question: questions[2],
        selectedOption: null,
        isCorrect: null,
        xpEarned: 0,
        timeTaken: null,
        startedAt: new Date().toISOString(),
        answeredAt: null,
      },
      progress: { current: 3, total: 10 },
      isLoading: false,
      error: null,
      summary: null,
    });

    render(<CulturePracticePage />);

    // Verify ProgressBar is rendered
    const progressBar = screen.getByTestId('progress-bar');
    expect(progressBar).toBeInTheDocument();

    // Verify counter shows "3 / 10"
    const counter = screen.getByTestId('progress-bar-counter');
    expect(counter).toHaveTextContent('3 / 10');

    // Verify ARIA attributes
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '3');
    expect(bar).toHaveAttribute('aria-valuemax', '10');

    // Verify fill width (3/10 = 30%)
    const fill = screen.getByTestId('progress-bar-fill');
    expect(fill).toHaveStyle({ width: '30%' });
  });

  it('does not render ProgressBar when session is loading', () => {
    useCultureSessionStore.setState({
      session: null,
      isLoading: true,
      error: null,
    });

    render(<CulturePracticePage />);

    expect(screen.queryByTestId('progress-bar')).not.toBeInTheDocument();
  });
});
