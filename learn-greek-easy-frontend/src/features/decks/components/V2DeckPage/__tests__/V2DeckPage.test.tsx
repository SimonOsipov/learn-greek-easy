/**
 * V2DeckPage Tests
 *
 * Covers the owner-only affordances added when edit/delete moved off the
 * My Decks grid card onto the deck detail page:
 * 1. Breadcrumb "back" target — personal (owned) decks point to /my-decks,
 *    system decks keep pointing to /decks.
 * 2. Edit/delete buttons render only for the deck owner.
 * 3. Edit opens UserDeckEditModal with mode="edit" source="detail_page";
 *    success refetches the deck.
 * 4. Delete: tracks delete_started, confirms, calls deckAPI.deleteMyDeck,
 *    shows a success toast and navigates to /my-decks.
 * 5. Delete failure: destructive toast, no navigation.
 * 6. Cancel: tracks delete_cancelled.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { screen, waitFor, fireEvent, act } from '@testing-library/react';

import { render } from '@/lib/test-utils';
import { deckAPI } from '@/services/deckAPI';
import { track } from '@/lib/analytics';
import type { Deck } from '@/types/deck';
import { V2DeckPage } from '../V2DeckPage';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
  registerTheme: vi.fn(),
  registerInterfaceLanguage: vi.fn(),
}));

vi.mock('@/lib/errorReporting', () => ({
  reportAPIError: vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/services/deckAPI', () => ({
  deckAPI: {
    deleteMyDeck: vi.fn(),
  },
}));

const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast, toasts: [] }),
}));

// Stub the heavy header/word-browser children — this suite only exercises the
// page-level breadcrumb + owner actions.
vi.mock('../V2DeckHeader', () => ({
  V2DeckHeader: () => <div data-testid="v2-deck-header" />,
}));
vi.mock('../WordBrowser', () => ({
  WordBrowser: ({ isOwnDeck }: { isOwnDeck: boolean }) => (
    <div data-testid="word-browser" data-own={String(isOwnDeck)} />
  ),
}));

// Stub the edit modal — capture the props the page passes in.
vi.mock('@/components/decks', () => ({
  UserDeckEditModal: ({
    isOpen,
    source,
    mode,
    onClose,
    onSuccess,
  }: {
    isOpen: boolean;
    source: string;
    mode: string;
    onClose?: () => void;
    onSuccess?: () => void;
  }) =>
    isOpen ? (
      <div data-testid="user-deck-edit-modal" data-source={source} data-mode={mode}>
        <button onClick={onClose} data-testid="modal-close">
          close
        </button>
        <button onClick={onSuccess} data-testid="modal-success">
          success
        </button>
      </div>
    ) : null,
}));

// Stub ConfirmDialog — expose confirm/cancel callbacks.
vi.mock('@/components/dialogs/ConfirmDialog', () => ({
  ConfirmDialog: ({
    open,
    onConfirm,
    onCancel,
  }: {
    open: boolean;
    onConfirm?: () => void;
    onCancel?: () => void;
  }) =>
    open ? (
      <div data-testid="confirm-dialog">
        <button onClick={onConfirm} data-testid="confirm-ok">
          confirm
        </button>
        <button onClick={onCancel} data-testid="confirm-cancel">
          cancel
        </button>
      </div>
    ) : null,
}));

// Configurable deck store state.
const mockSelectDeck = vi.fn();
let mockStoreState: {
  selectedDeck: Deck | null;
  isLoading: boolean;
  error: string | null;
  selectDeck: typeof mockSelectDeck;
};
vi.mock('@/stores/deckStore', () => ({
  useDeckStore: () => mockStoreState,
}));

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

function makeDeck(overrides: Partial<Deck> = {}): Deck {
  return {
    id: 'deck-1',
    title: 'Travel Phrases',
    titleGreek: 'Travel Phrases',
    description: 'A personal deck',
    level: 'A1',
    category: 'vocabulary',
    cardCount: 5,
    estimatedTime: 10,
    isPremium: false,
    tags: [],
    thumbnail: '/images/decks/a1.jpg',
    createdBy: 'You',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    isOwned: true,
    ...overrides,
  } as Deck;
}

function setStore(deck: Deck | null) {
  mockStoreState = {
    selectedDeck: deck,
    isLoading: false,
    error: null,
    selectDeck: mockSelectDeck,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('V2DeckPage — breadcrumb back target', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('points an owned deck back to /my-decks with the "My Decks" label', () => {
    setStore(makeDeck({ isOwned: true }));
    render(<V2DeckPage deckId="deck-1" />);

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/my-decks');
    expect(link).toHaveTextContent('My Decks');
  });

  it('points a system deck back to /decks with the "Decks" label', () => {
    setStore(makeDeck({ isOwned: false }));
    render(<V2DeckPage deckId="deck-1" />);

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/decks');
    expect(link).toHaveTextContent('Decks');
  });
});

describe('V2DeckPage — owner actions visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders edit/delete buttons for the deck owner', () => {
    setStore(makeDeck({ isOwned: true }));
    render(<V2DeckPage deckId="deck-1" />);

    expect(screen.getByTestId('deck-detail-actions')).toBeInTheDocument();
    expect(screen.getByTestId('edit-deck-button')).toBeInTheDocument();
    expect(screen.getByTestId('delete-deck-button')).toBeInTheDocument();
  });

  it('hides edit/delete buttons on a system deck', () => {
    setStore(makeDeck({ isOwned: false }));
    render(<V2DeckPage deckId="deck-1" />);

    expect(screen.queryByTestId('deck-detail-actions')).not.toBeInTheDocument();
  });
});

describe('V2DeckPage — edit deck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens the edit modal with mode="edit" source="detail_page"', () => {
    setStore(makeDeck({ isOwned: true }));
    render(<V2DeckPage deckId="deck-1" />);

    fireEvent.click(screen.getByTestId('edit-deck-button'));

    const modal = screen.getByTestId('user-deck-edit-modal');
    expect(modal).toHaveAttribute('data-mode', 'edit');
    expect(modal).toHaveAttribute('data-source', 'detail_page');
  });

  it('refetches the deck after a successful edit', () => {
    setStore(makeDeck({ isOwned: true }));
    render(<V2DeckPage deckId="deck-1" />);

    fireEvent.click(screen.getByTestId('edit-deck-button'));
    fireEvent.click(screen.getByTestId('modal-success'));

    expect(mockSelectDeck).toHaveBeenCalledWith('deck-1');
    // Modal closes after success
    expect(screen.queryByTestId('user-deck-edit-modal')).not.toBeInTheDocument();
  });
});

describe('V2DeckPage — delete deck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('tracks delete_started and opens the confirm dialog', () => {
    setStore(makeDeck({ id: 'deck-del', title: 'Delete Me', isOwned: true }));
    render(<V2DeckPage deckId="deck-del" />);

    fireEvent.click(screen.getByTestId('delete-deck-button'));

    expect(track).toHaveBeenCalledWith('user_deck_delete_started', {
      deck_id: 'deck-del',
      deck_name: 'Delete Me',
      source: 'deck_detail',
    });
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
  });

  it('deletes the deck, shows a success toast and navigates to /my-decks', async () => {
    (deckAPI.deleteMyDeck as Mock).mockResolvedValue(undefined);
    setStore(makeDeck({ id: 'deck-del', isOwned: true }));
    render(<V2DeckPage deckId="deck-del" />);

    fireEvent.click(screen.getByTestId('delete-deck-button'));
    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-ok'));
    });

    await waitFor(() => {
      expect(deckAPI.deleteMyDeck).toHaveBeenCalledWith('deck-del');
      expect(mockNavigate).toHaveBeenCalledWith('/my-decks');
    });
    // Success toast is not destructive
    const [callArg] = (mockToast as Mock).mock.calls[0];
    expect(callArg.variant).not.toBe('destructive');
  });

  it('shows a destructive toast and does not navigate when delete fails', async () => {
    (deckAPI.deleteMyDeck as Mock).mockRejectedValue(new Error('Server error'));
    setStore(makeDeck({ id: 'deck-del', isOwned: true }));
    render(<V2DeckPage deckId="deck-del" />);

    fireEvent.click(screen.getByTestId('delete-deck-button'));
    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-ok'));
    });

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('tracks delete_cancelled when the user cancels', () => {
    setStore(makeDeck({ id: 'deck-del', title: 'Delete Me', isOwned: true }));
    render(<V2DeckPage deckId="deck-del" />);

    fireEvent.click(screen.getByTestId('delete-deck-button'));
    fireEvent.click(screen.getByTestId('confirm-cancel'));

    expect(track).toHaveBeenCalledWith('user_deck_delete_cancelled', {
      deck_id: 'deck-del',
      deck_name: 'Delete Me',
      source: 'deck_detail',
    });
  });
});
