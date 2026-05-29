/**
 * DecksPage RTL Tests — DCSPL-04 + DX-03
 *
 * Verifies that after the vocabulary-only refactor:
 * 1. No deck-type toggle buttons exist in the DOM (All / Vocabulary / Culture removed)
 * 2. CEFR level filter buttons (A1, A2, B1, B2) are rendered and NOT disabled
 * 3. Vocab deck names appear in the grid
 * 4. Culture deck names do NOT appear (store never fetches them)
 *
 * DX-03 additions:
 * 5. Kicker with list.kicker text renders above the title
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';

import { render } from '@/lib/test-utils';
import { DecksPage } from '../DecksPage';

// ---------------------------------------------------------------------------
// Mock reportAPIError
// ---------------------------------------------------------------------------
vi.mock('@/lib/errorReporting', () => ({
  reportAPIError: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock react-router-dom (DecksPage uses useLocation)
// ---------------------------------------------------------------------------
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useLocation: () => ({ key: 'default', pathname: '/decks', search: '', hash: '', state: null }),
    useNavigate: () => vi.fn(),
  };
});

// ---------------------------------------------------------------------------
// Mock useDeckStore — returns only vocabulary decks; no culture in the list
// ---------------------------------------------------------------------------
const mockFetchDecks = vi.fn().mockResolvedValue(undefined);
const mockSetFilters = vi.fn();
const mockClearFilters = vi.fn();
const mockClearError = vi.fn();

const vocabDeck1 = {
  id: 'vocab-1',
  title: 'Vocabulary Deck Alpha',
  titleGreek: 'Vocabulary Deck Alpha',
  description: 'A vocabulary deck',
  level: 'A1' as const,
  category: 'vocabulary' as const,
  cardCount: 20,
  estimatedTime: 10,
  isPremium: false,
  tags: [],
  thumbnail: '/images/decks/a1.jpg',
  createdBy: 'Greeklish',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const vocabDeck2 = {
  id: 'vocab-2',
  title: 'Vocabulary Deck Beta',
  titleGreek: 'Vocabulary Deck Beta',
  description: 'Another vocabulary deck',
  level: 'B1' as const,
  category: 'vocabulary' as const,
  cardCount: 30,
  estimatedTime: 15,
  isPremium: false,
  tags: [],
  thumbnail: '/images/decks/b1.jpg',
  createdBy: 'Greeklish',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockStoreState = {
  decks: [vocabDeck1, vocabDeck2],
  rawDecks: [vocabDeck1, vocabDeck2],
  totalDecks: 2,
  selectedDeck: null,
  filters: {
    search: '',
    levels: [],
    categories: [],
    status: [],
  },
  isLoading: false,
  error: null,
  fetchDecks: mockFetchDecks,
  setFilters: mockSetFilters,
  clearFilters: mockClearFilters,
  clearError: mockClearError,
  applyFilters: vi.fn(),
  selectDeck: vi.fn(),
  clearSelection: vi.fn(),
};

vi.mock('@/stores/deckStore', () => ({
  useDeckStore: vi.fn((selector?: (s: typeof mockStoreState) => unknown) =>
    selector ? selector(mockStoreState) : mockStoreState
  ),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('DecksPage — vocabulary-only (DCSPL-04)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders vocab deck titles', async () => {
    render(<DecksPage />);

    await waitFor(() => {
      expect(screen.getByText('Vocabulary Deck Alpha')).toBeInTheDocument();
      expect(screen.getByText('Vocabulary Deck Beta')).toBeInTheDocument();
    });
  });

  it('does not render a deck-type toggle (All / Vocabulary / Culture buttons absent)', async () => {
    render(<DecksPage />);

    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: /^(All|Vocabulary|Culture)$/i })
      ).not.toBeInTheDocument();
    });
  });

  it('renders CEFR level buttons and they are not disabled', async () => {
    render(<DecksPage />);

    await waitFor(() => {
      const a1 = screen.getByRole('button', { name: /^A1$/i });
      const a2 = screen.getByRole('button', { name: /^A2$/i });
      const b1 = screen.getByRole('button', { name: /^B1$/i });
      const b2 = screen.getByRole('button', { name: /^B2$/i });

      expect(a1).not.toBeDisabled();
      expect(a2).not.toBeDisabled();
      expect(b1).not.toBeDisabled();
      expect(b2).not.toBeDisabled();
    });
  });

  it('does not render any culture deck name when store contains only vocab decks', () => {
    render(<DecksPage />);

    // Culture decks are never fetched by the store, so they cannot appear
    expect(screen.queryByText(/culture deck/i)).not.toBeInTheDocument();
  });
});

describe('DecksPage — DX-03 header kicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Kicker with list.kicker text above the title', async () => {
    render(<DecksPage />);

    await waitFor(() => {
      // The kicker text (English locale)
      const kicker = screen.getByText(/browse.*public decks/i);
      expect(kicker).toBeInTheDocument();
      expect(kicker).toHaveClass('dx-kicker');

      // The H1 title is below the kicker in the DOM
      const title = screen.getByTestId('decks-title');
      expect(title).toBeInTheDocument();
    });
  });

  it('Kicker appears before the H1 in document order', async () => {
    render(<DecksPage />);

    await waitFor(() => {
      const kicker = screen.getByText(/browse.*public decks/i);
      const title = screen.getByTestId('decks-title');

      // compareDocumentPosition: 4 = DOCUMENT_POSITION_FOLLOWING (kicker before title)
      const position = kicker.compareDocumentPosition(title);
      expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });
});
