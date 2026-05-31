/**
 * DeckDetailPage Tests
 *
 * Covers:
 * 1. deckId undefined -> immediate not-found (no fetch, no skeleton)
 * 2. In-flight (isLoading=true) shows skeleton
 * 3. hasFetched=false (before fetch resolves) shows skeleton (no flash of not-found)
 * 4. Fetch rejects -> error state rendered + retry button calls selectDeck again
 * 5. Fetch resolves but selectedDeck is null -> not-found (hasFetched && !isLoading double-gate)
 * 6. Fetch resolves with deck -> V2DeckPage rendered
 *
 * Note: clearSelection is intentionally NOT called in DeckDetailPage's cleanup.
 * This is documented in the source as an intentional omission (V2DeckPage owns cleanup).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent, act } from '@testing-library/react';

import { render } from '@/lib/test-utils';
import { DeckDetailPage } from '../DeckDetailPage';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/errorReporting', () => ({
  reportAPIError: vi.fn(),
}));

// Mock V2DeckPage so we don't need its full dependency tree
vi.mock('@/features/decks/components/V2DeckPage', () => ({
  V2DeckPage: ({ deckId }: { deckId: string }) => (
    <div data-testid="v2-deck-page">V2DeckPage:{deckId}</div>
  ),
}));

// useNavigate mock — used by NotFoundState
const mockNavigate = vi.fn();

// Per-test param control — must be defined before the mock factory runs
let mockUseParams: () => { id?: string } = () => ({ id: 'deck-123' });

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => mockUseParams(),
  };
});

// ---------------------------------------------------------------------------
// deckStore mock — mutable per-test
// ---------------------------------------------------------------------------

const mockSelectDeck = vi.fn();
const mockClearSelection = vi.fn();

interface MockStoreState {
  selectedDeck: object | null;
  isLoading: boolean;
  error: string | null;
  selectDeck: typeof mockSelectDeck;
  clearSelection: typeof mockClearSelection;
}

let mockStoreState: MockStoreState = {
  selectedDeck: null,
  isLoading: false,
  error: null,
  selectDeck: mockSelectDeck,
  clearSelection: mockClearSelection,
};

vi.mock('@/stores/deckStore', () => ({
  useDeckStore: vi.fn((selector?: (s: MockStoreState) => unknown) =>
    selector ? selector(mockStoreState) : mockStoreState
  ),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setStoreState(overrides: Partial<MockStoreState>) {
  mockStoreState = {
    selectedDeck: null,
    isLoading: false,
    error: null,
    selectDeck: mockSelectDeck,
    clearSelection: mockClearSelection,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DeckDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockReset();
    mockUseParams = () => ({ id: 'deck-123' });
  });

  // -------------------------------------------------------------------------
  // 1. deckId undefined — immediate not-found, no fetch triggered
  // -------------------------------------------------------------------------
  describe('when deckId is undefined', () => {
    it('renders not-found immediately without calling selectDeck', () => {
      mockUseParams = () => ({ id: undefined });
      // selectDeck never resolves — if it was called the test would hang
      mockSelectDeck.mockReturnValue(new Promise(() => {}));
      setStoreState({ isLoading: false, selectedDeck: null });

      render(<DeckDetailPage />);

      // The not-found card should be visible
      expect(screen.getByRole('button', { name: /browse all/i })).toBeInTheDocument();
      // selectDeck must not have been called
      expect(mockSelectDeck).not.toHaveBeenCalled();
    });

    it('navigates to /decks when "Browse all" button is clicked', () => {
      mockUseParams = () => ({ id: undefined });
      mockSelectDeck.mockReturnValue(new Promise(() => {}));
      setStoreState({ isLoading: false, selectedDeck: null });

      render(<DeckDetailPage />);

      fireEvent.click(screen.getByRole('button', { name: /browse all/i }));
      expect(mockNavigate).toHaveBeenCalledWith('/decks');
    });
  });

  // -------------------------------------------------------------------------
  // 2. In-flight (isLoading=true) — shows skeleton
  // -------------------------------------------------------------------------
  describe('when isLoading is true', () => {
    it('renders the loading skeleton', () => {
      // selectDeck never resolves (simulates pending request)
      mockSelectDeck.mockReturnValue(new Promise(() => {}));
      setStoreState({ isLoading: true, selectedDeck: null });

      render(<DeckDetailPage />);

      // V2DeckPage must be absent; not-found and error states must be absent
      expect(screen.queryByTestId('v2-deck-page')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /browse all/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // 3. hasFetched=false (before fetch resolves) — skeleton shown, no flash of not-found
  // -------------------------------------------------------------------------
  describe('before fetch resolves (hasFetched still false)', () => {
    it('shows skeleton and does NOT flash not-found while request is in-flight', () => {
      // isLoading=false but selectDeck has not resolved yet
      // The component starts with hasFetched=false internally, so it should show skeleton
      let resolveSelectDeck!: () => void;
      mockSelectDeck.mockReturnValue(
        new Promise<void>((resolve) => {
          resolveSelectDeck = resolve;
        })
      );
      setStoreState({ isLoading: false, selectedDeck: null });

      render(<DeckDetailPage />);

      // Before selectDeck resolves: hasFetched=false => skeleton shown
      expect(screen.queryByTestId('v2-deck-page')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /browse all/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();

      // Keep the promise alive for the duration of this test — no not-found flash
      void resolveSelectDeck;
    });
  });

  // -------------------------------------------------------------------------
  // 4. Fetch rejects — error state + retry
  // -------------------------------------------------------------------------
  describe('when selectDeck rejects', () => {
    it('renders the error state after rejection', async () => {
      const fetchError = new Error('Network error');
      mockSelectDeck.mockRejectedValue(fetchError);
      setStoreState({
        isLoading: false,
        selectedDeck: null,
        error: 'Failed to load deck',
      });

      render(<DeckDetailPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
      });

      expect(screen.queryByTestId('v2-deck-page')).not.toBeInTheDocument();
    });

    it('calls selectDeck again when retry button is clicked', async () => {
      mockSelectDeck.mockRejectedValueOnce(new Error('Network error'));
      // Second call resolves (retry succeeds — store stays in error state for test purposes)
      mockSelectDeck.mockResolvedValue(undefined);
      setStoreState({
        isLoading: false,
        selectedDeck: null,
        error: 'Failed to load deck',
      });

      render(<DeckDetailPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /try again/i }));
      });

      // selectDeck called once on mount, once on retry
      expect(mockSelectDeck).toHaveBeenCalledTimes(2);
      expect(mockSelectDeck).toHaveBeenCalledWith('deck-123');
    });

    it('calls reportAPIError with context when fetch rejects', async () => {
      const { reportAPIError } = await import('@/lib/errorReporting');
      const fetchError = new Error('Server error');
      mockSelectDeck.mockRejectedValue(fetchError);
      setStoreState({ isLoading: false, selectedDeck: null, error: 'Server error' });

      render(<DeckDetailPage />);

      await waitFor(() => {
        expect(reportAPIError).toHaveBeenCalledWith(fetchError, {
          operation: 'loadDeck',
          endpoint: '/decks/deck-123',
        });
      });
    });
  });

  // -------------------------------------------------------------------------
  // 5. Fetch resolves but selectedDeck is null — not-found (double-gate)
  // -------------------------------------------------------------------------
  describe('when fetch resolves but selectedDeck is null', () => {
    it('shows not-found after resolve (hasFetched=true ensures no premature flash)', async () => {
      mockSelectDeck.mockResolvedValue(undefined);
      setStoreState({ isLoading: false, selectedDeck: null, error: null });

      render(<DeckDetailPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /browse all/i })).toBeInTheDocument();
      });

      expect(screen.queryByTestId('v2-deck-page')).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // 6. Successful fetch with deck — V2DeckPage rendered
  // -------------------------------------------------------------------------
  describe('when deck is loaded successfully', () => {
    it('renders V2DeckPage after fetch completes', async () => {
      const deck = {
        id: 'deck-123',
        title: 'Test Deck',
        level: 'A1',
        category: 'vocabulary',
      };
      mockSelectDeck.mockResolvedValue(undefined);
      setStoreState({ isLoading: false, selectedDeck: deck, error: null });

      render(<DeckDetailPage />);

      await waitFor(() => {
        expect(screen.getByTestId('v2-deck-page')).toBeInTheDocument();
      });

      expect(screen.getByText('V2DeckPage:deck-123')).toBeInTheDocument();
    });

    it('does not show error or not-found state when deck loads', async () => {
      const deck = { id: 'deck-123', title: 'Test Deck' };
      mockSelectDeck.mockResolvedValue(undefined);
      setStoreState({ isLoading: false, selectedDeck: deck, error: null });

      render(<DeckDetailPage />);

      await waitFor(() => {
        expect(screen.getByTestId('v2-deck-page')).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: /browse all/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // 7. selectDeck called with correct deckId on mount
  // -------------------------------------------------------------------------
  describe('selectDeck invocation', () => {
    it('calls selectDeck with the current deckId on mount', async () => {
      mockSelectDeck.mockResolvedValue(undefined);
      setStoreState({ isLoading: false, selectedDeck: null, error: null });

      render(<DeckDetailPage />);

      await waitFor(() => {
        expect(mockSelectDeck).toHaveBeenCalledWith('deck-123');
      });
    });
  });
});
