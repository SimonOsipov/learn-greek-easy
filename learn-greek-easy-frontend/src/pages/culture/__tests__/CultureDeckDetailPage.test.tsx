/**
 * CultureDeckDetailPage tests
 *
 * Covers:
 * - null progress -> pct 0, toPractice = total
 * - total = 0 -> pct = 0 (not NaN, progress bar width safe)
 * - API fail -> error state shown; retry button triggers re-fetch
 * - loading skeleton while API is pending
 * - not-found state when deckId is absent
 * - time_on_deck_seconds wired to metric strip (DDR-03)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@/lib/test-utils';
import userEvent from '@testing-library/user-event';

import { CultureDeckDetailPage } from '../CultureDeckDetailPage';

// ── Router mocks ──────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();
let mockDeckId: string | undefined = 'deck-1';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: mockDeckId }),
  };
});

// ── API mocks ─────────────────────────────────────────────────────────────────

const mockGetById = vi.fn();

vi.mock('@/services/cultureDeckAPI', () => ({
  cultureDeckAPI: {
    getById: (...args: unknown[]) => mockGetById(...args),
    // QuestionBrowser also calls browseQuestions — return empty to keep it quiet
    browseQuestions: vi.fn().mockResolvedValue({ questions: [], total: 0 }),
  },
}));

// ── Component sub-tree mocks ──────────────────────────────────────────────────

// QuestionBrowser issues its own network calls; stub it out to keep tests fast
vi.mock('@/components/culture/QuestionBrowser', () => ({
  QuestionBrowser: () => <div data-testid="question-browser-stub" />,
}));

// Mock the dx.css import so jsdom doesn't choke on it
vi.mock('@/features/decks/dx/dx.css', () => ({}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** Deck with full progress data */
const deckWithProgress = {
  id: 'deck-1',
  name: 'Ancient Greece',
  description: 'History deck',
  category: 'history' as const,
  question_count: 10,
  is_premium: false,
  cover_image_url: null,
  progress: {
    questions_total: 10,
    questions_mastered: 4,
    questions_learning: 2,
    questions_new: 4,
    last_practiced_at: '2025-01-10T10:00:00Z',
  },
};

/** Deck with null/absent progress (fresh deck, never practised) */
const deckNoProgress = {
  id: 'deck-1',
  name: 'Ancient Greece',
  description: 'History deck',
  category: 'history' as const,
  question_count: 10,
  is_premium: false,
  cover_image_url: null,
  progress: undefined,
};

/** Deck whose question_count is 0 (edge case — total=0) */
const deckZeroQuestions = {
  id: 'deck-1',
  name: 'Empty Deck',
  description: null,
  category: 'culture' as const,
  question_count: 0,
  is_premium: false,
  cover_image_url: null,
  progress: undefined,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CultureDeckDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeckId = 'deck-1';
    mockNavigate.mockReset();
  });

  // ── Loading state ─────────────────────────────────────────────────────────

  it('renders loading skeleton while API is pending', () => {
    mockGetById.mockReturnValue(new Promise(() => {}));

    render(<CultureDeckDetailPage />);

    // The loading skeleton still renders the deck-detail container
    expect(screen.getByTestId('deck-detail')).toBeInTheDocument();
    // Action panel and start button are not yet rendered
    expect(screen.queryByTestId('start-practice-button')).not.toBeInTheDocument();
  });

  // ── Not-found state ───────────────────────────────────────────────────────

  it('renders not-found state when deckId param is absent', async () => {
    mockDeckId = undefined;
    mockGetById.mockResolvedValue(deckWithProgress);

    render(<CultureDeckDetailPage />);

    // Not-found renders the deck-detail container (same testid)
    expect(screen.getByTestId('deck-detail')).toBeInTheDocument();
    // The start-practice button must not appear
    expect(screen.queryByTestId('start-practice-button')).not.toBeInTheDocument();
  });

  // ── Error + retry ─────────────────────────────────────────────────────────

  it('renders error state when API rejects', async () => {
    mockGetById.mockRejectedValue(new Error('Network failure'));

    render(<CultureDeckDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Network failure')).toBeInTheDocument();
    });
  });

  it('retry button calls getById again after an error', async () => {
    const user = userEvent.setup();
    mockGetById
      .mockRejectedValueOnce(new Error('Network failure'))
      .mockResolvedValue(deckWithProgress);

    render(<CultureDeckDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Network failure')).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole('button', { name: /try again/i });
    await user.click(retryBtn);

    // getById should have been called twice — initial load + retry
    await waitFor(() => {
      expect(mockGetById).toHaveBeenCalledTimes(2);
    });
  });

  // ── Null progress: pct=0, toPractice=total ────────────────────────────────

  it('shows pct=0 when progress is null (progress bar width = 0%)', async () => {
    mockGetById.mockResolvedValue(deckNoProgress);

    render(<CultureDeckDetailPage />);

    await waitFor(() => {
      expect(screen.getByTestId('culture-action-panel')).toBeInTheDocument();
    });

    // Progress bar fill must have width: 0%
    const fill = screen.getByTestId('culture-action-bar-fill');
    expect(fill).toHaveStyle({ width: '0%' });

    // progressbar aria-valuenow must be 0
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '0');
  });

  it('toPractice equals total (question_count) when progress is absent', async () => {
    mockGetById.mockResolvedValue(deckNoProgress);

    render(<CultureDeckDetailPage />);

    await waitFor(() => {
      expect(screen.getByTestId('culture-action-panel')).toBeInTheDocument();
    });

    // With no progress: new=total=10, learning=0, mastered=0
    // The counts line contains "10 new"
    const panel = screen.getByTestId('culture-action-panel');
    expect(panel.textContent).toMatch(/10/);
  });

  // ── total=0: pct must be 0, not NaN ──────────────────────────────────────

  it('pct is 0 (not NaN) when question_count is 0', async () => {
    mockGetById.mockResolvedValue(deckZeroQuestions);

    render(<CultureDeckDetailPage />);

    await waitFor(() => {
      expect(screen.getByTestId('culture-action-panel')).toBeInTheDocument();
    });

    // Progress bar fill must have a valid CSS width (0%, not NaN%)
    const fill = screen.getByTestId('culture-action-bar-fill');
    expect(fill).toHaveStyle({ width: '0%' });

    // Confirm the displayed pct text is "0%" not "NaN%"
    const panel = screen.getByTestId('culture-action-panel');
    expect(panel.textContent).toContain('0%');
    expect(panel.textContent).not.toMatch(/NaN/);
  });

  // ── Time on deck metric (DDR-03) ─────────────────────────────────────────

  it('shows rounded minutes from time_on_deck_seconds in the metric strip', async () => {
    mockGetById.mockResolvedValue({
      ...deckWithProgress,
      time_on_deck_seconds: 420, // 7 minutes
    });

    render(<CultureDeckDetailPage />);

    await waitFor(() => {
      expect(screen.getByTestId('start-practice-button')).toBeInTheDocument();
    });

    // The metric strip should display "7" (420 / 60 = 7)
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('shows 0 minutes when time_on_deck_seconds is absent', async () => {
    mockGetById.mockResolvedValue(deckWithProgress); // no time_on_deck_seconds

    render(<CultureDeckDetailPage />);

    await waitFor(() => {
      expect(screen.getByTestId('start-practice-button')).toBeInTheDocument();
    });

    // The metric strip should display "0" when no time data available
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  // ── Successful load ───────────────────────────────────────────────────────

  it('renders deck name and action panel after successful API response', async () => {
    mockGetById.mockResolvedValue(deckWithProgress);

    render(<CultureDeckDetailPage />);

    await waitFor(() => {
      expect(screen.getByTestId('start-practice-button')).toBeInTheDocument();
    });

    // Deck name appears in breadcrumb/hero area
    expect(screen.getAllByText('Ancient Greece').length).toBeGreaterThan(0);
  });

  it('shows Continue Practice when mastered > 0', async () => {
    mockGetById.mockResolvedValue(deckWithProgress);

    render(<CultureDeckDetailPage />);

    await waitFor(() => {
      expect(screen.getByTestId('start-practice-button')).toBeInTheDocument();
    });

    // hasProgress is true (mastered=4 > 0) so CTA should say "Continue Practice"
    expect(screen.getByTestId('start-practice-button').textContent).toMatch(/Continue Practice/i);
  });

  it('CTA navigate goes to /culture/{deckId}/practice on click', async () => {
    const user = userEvent.setup();
    mockGetById.mockResolvedValue(deckWithProgress);

    render(<CultureDeckDetailPage />);

    await waitFor(() => {
      expect(screen.getByTestId('start-practice-button')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('start-practice-button'));

    expect(mockNavigate).toHaveBeenCalledWith('/culture/deck-1/practice');
  });

  // ── Breadcrumb ────────────────────────────────────────────────────────────

  it('renders the breadcrumb nav', async () => {
    mockGetById.mockResolvedValue(deckWithProgress);

    render(<CultureDeckDetailPage />);

    await waitFor(() => {
      expect(screen.getByTestId('breadcrumb')).toBeInTheDocument();
    });
  });

  // ── Metric tile descriptor second lines (DVP-02) ─────────────────────────

  it('renders descriptor trend lines for all four metric tiles', async () => {
    mockGetById.mockResolvedValue(deckWithProgress);

    render(<CultureDeckDetailPage />);

    await waitFor(() => {
      expect(screen.getByTestId('culture-metric-strip')).toBeInTheDocument();
    });

    // Tile 0: To practice — "new + learning"
    expect(screen.getByText('new + learning')).toBeInTheDocument();
    // Tile 1: In review — "working memory"
    expect(screen.getByText('working memory')).toBeInTheDocument();
    // Tile 3: Time on deck — "all-time"
    expect(screen.getByText('all-time')).toBeInTheDocument();
  });

  it('renders mastered tile trend as "{pct}% of deck" for known mastered/total', async () => {
    // deckWithProgress: mastered=4, total=10 → pct = Math.round(4/10*100) = 40
    mockGetById.mockResolvedValue(deckWithProgress);

    render(<CultureDeckDetailPage />);

    await waitFor(() => {
      expect(screen.getByTestId('culture-metric-strip')).toBeInTheDocument();
    });

    // Tile 2: Mastered — "40% of deck"
    expect(screen.getByText('40% of deck')).toBeInTheDocument();
  });
});
