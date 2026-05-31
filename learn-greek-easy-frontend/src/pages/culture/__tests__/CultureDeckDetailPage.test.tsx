/**
 * CultureDeckDetailPage tests
 *
 * Covers:
 * - null progress -> pct 0, toPractice = total
 * - total = 0 -> pct = 0 (not NaN, progress bar width safe)
 * - topic chip changes CTA label; navigate does NOT include topic param (documented gap)
 * - API fail -> error state shown; retry button triggers re-fetch
 * - loading skeleton while API is pending
 * - not-found state when deckId is absent
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

  // ── Topic chip: label changes; navigate WITHOUT topic param ──────────────

  it('CTA label changes when a topic chip is selected', async () => {
    const user = userEvent.setup();
    mockGetById.mockResolvedValue(deckNoProgress);

    render(<CultureDeckDetailPage />);

    await waitFor(() => {
      expect(screen.getByTestId('start-practice-button')).toBeInTheDocument();
    });

    // Before any chip click, CTA says "Start Practice" (no progress)
    expect(screen.getByTestId('start-practice-button').textContent).toMatch(/Start Practice/i);

    // Click the "Politics" chip
    const politicsChip = screen.getByRole('button', { name: /politics/i });
    await user.click(politicsChip);

    // CTA label now contains the topic name
    await waitFor(() => {
      expect(screen.getByTestId('start-practice-button').textContent).toMatch(/politics/i);
    });
  });

  it('topic chip selection marks the chip as pressed (aria-pressed)', async () => {
    const user = userEvent.setup();
    mockGetById.mockResolvedValue(deckNoProgress);

    render(<CultureDeckDetailPage />);

    await waitFor(() => {
      expect(screen.getByTestId('culture-action-panel')).toBeInTheDocument();
    });

    // Initially "All" chip is pressed
    const allChip = screen.getByRole('button', { name: /all/i });
    expect(allChip).toHaveAttribute('aria-pressed', 'true');

    // Click "History" chip
    const historyChip = screen.getByRole('button', { name: /history/i });
    await user.click(historyChip);

    await waitFor(() => {
      expect(historyChip).toHaveAttribute('aria-pressed', 'true');
      expect(allChip).toHaveAttribute('aria-pressed', 'false');
    });
  });

  /**
   * DOCUMENTED GAP: The topic chip updates the CTA label but the navigate()
   * call (onClick of start-practice-button) always navigates to
   * `/culture/${deckId}/practice` WITHOUT a topic query param.
   * If topic filtering is wired up on the backend in a future story,
   * the navigate call should append `?topic=<selectedTopic>`.
   *
   * This test pins current behavior so any accidental change is caught.
   */
  it('navigate is called WITHOUT topic param even when a non-all topic chip is selected', async () => {
    const user = userEvent.setup();
    mockGetById.mockResolvedValue(deckNoProgress);

    render(<CultureDeckDetailPage />);

    await waitFor(() => {
      expect(screen.getByTestId('start-practice-button')).toBeInTheDocument();
    });

    // Select the "Politics" topic chip
    const politicsChip = screen.getByRole('button', { name: /politics/i });
    await user.click(politicsChip);

    // Click the CTA
    const cta = screen.getByTestId('start-practice-button');
    await user.click(cta);

    // navigate must be called with the plain practice URL — no topic param
    expect(mockNavigate).toHaveBeenCalledWith('/culture/deck-1/practice');
    // Confirm it does NOT include a topic query string
    const callArg = mockNavigate.mock.calls[0][0] as string;
    expect(callArg).not.toContain('topic');
    expect(callArg).not.toContain('politics');
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
});
