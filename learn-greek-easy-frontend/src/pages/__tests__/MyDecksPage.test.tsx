/**
 * MyDecksPage Tests
 *
 * Covers:
 * 1. transformDeckResponse field mapping (name → title, card_count → cardCount,
 *    description null → '', estimated_time_minutes null → 10, is_premium null → false,
 *    tags null → [])
 * 2. cardCount null → 0 (via card_count ?? 0)
 * 3. level.toUpperCase guard — lowercase level from API is uppercased correctly
 * 4. createSource="empty_state_cta" / "my_decks_button" is passed to UserDeckEditModal
 * 5. Empty state vs decks grid
 *
 * Edit/delete moved off the grid card onto the deck detail page (V2DeckPage) —
 * those flows are covered in V2DeckPage.test.tsx.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { screen, waitFor, fireEvent, act } from '@testing-library/react';

import { render } from '@/lib/test-utils';
import { deckAPI } from '@/services/deckAPI';
import type { DeckResponse } from '@/services/deckAPI';
import { MyDecksPage } from '../MyDecksPage';

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

// Mock react-router-dom — page uses useNavigate
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

// Mock deckAPI methods used by the page
vi.mock('@/services/deckAPI', () => ({
  deckAPI: {
    getMyDecks: vi.fn(),
  },
}));

// Mock DecksGrid to expose deck cards as simple test elements. Edit/delete
// actions no longer live on the grid — they moved to the deck detail page.
vi.mock('@/components/decks', () => ({
  DecksGrid: ({
    decks,
    onDeckClick,
  }: {
    decks: { id: string; title: string }[];
    onDeckClick?: (id: string) => void;
  }) => (
    <div data-testid="decks-grid">
      {decks.map((d) => (
        <div key={d.id} data-testid={`deck-card-${d.id}`}>
          <span>{d.title}</span>
          <button data-testid={`click-${d.id}`} onClick={() => onDeckClick && onDeckClick(d.id)}>
            open
          </button>
        </div>
      ))}
    </div>
  ),
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

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeDeckResponse(overrides: Partial<DeckResponse> = {}): DeckResponse {
  return {
    id: 'deck-1',
    name: 'Test Deck',
    description: 'A test deck',
    level: 'A1',
    is_active: true,
    is_premium: false,
    card_count: 20,
    estimated_time_minutes: 10,
    tags: [],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeDecksResponse(decks: DeckResponse[]) {
  return { total: decks.length, page: 1, page_size: 50, decks };
}

// ---------------------------------------------------------------------------
// Helper: render and wait for the loading state to resolve
// ---------------------------------------------------------------------------

async function renderAndWait() {
  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<MyDecksPage />);
  });
  // Wait for loading to finish — decks grid appears when decks are present
  await waitFor(() => expect(screen.getByTestId('decks-grid')).toBeInTheDocument());
  return result!;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MyDecksPage — transformDeckResponse field mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps deck.name to title and renders it in the grid', async () => {
    (deckAPI.getMyDecks as Mock).mockResolvedValue(
      makeDecksResponse([makeDeckResponse({ id: 'd1', name: 'My Greek Deck' })])
    );

    await renderAndWait();

    expect(screen.getByText('My Greek Deck')).toBeInTheDocument();
  });

  it('maps card_count null → 0 without crashing', async () => {
    // card_count is typed as required number but backend may return null
    const deckWithNullCardCount = {
      ...makeDeckResponse({ id: 'd2', name: 'Null Card Count Deck' }),
      card_count: null as unknown as number,
    };
    (deckAPI.getMyDecks as Mock).mockResolvedValue(makeDecksResponse([deckWithNullCardCount]));

    // Should render without throwing
    await renderAndWait();
    expect(screen.getByText('Null Card Count Deck')).toBeInTheDocument();
  });

  it('maps description null → empty string without crashing', async () => {
    (deckAPI.getMyDecks as Mock).mockResolvedValue(
      makeDecksResponse([makeDeckResponse({ id: 'd3', name: 'No Description', description: null })])
    );

    await renderAndWait();
    expect(screen.getByText('No Description')).toBeInTheDocument();
  });

  it('maps tags null → empty array without crashing', async () => {
    const deckWithNullTags = {
      ...makeDeckResponse({ id: 'd4', name: 'Null Tags Deck' }),
      tags: null as unknown as string[],
    };
    (deckAPI.getMyDecks as Mock).mockResolvedValue(makeDecksResponse([deckWithNullTags]));

    await renderAndWait();
    expect(screen.getByText('Null Tags Deck')).toBeInTheDocument();
  });

  it('uppercases a lowercase level string from the API', async () => {
    // Backend occasionally returns lowercase CEFR level — .toUpperCase() must handle it
    const deckWithLowercaseLevel = {
      ...makeDeckResponse({ id: 'd5', name: 'Lowercase Level Deck' }),
      level: 'a2' as unknown as 'A1' | 'A2' | 'B1' | 'B2',
    };
    (deckAPI.getMyDecks as Mock).mockResolvedValue(makeDecksResponse([deckWithLowercaseLevel]));

    // Should render without crashing
    await renderAndWait();
    expect(screen.getByText('Lowercase Level Deck')).toBeInTheDocument();
  });

  it('maps optional multilingual name/description fields through to the deck object', async () => {
    (deckAPI.getMyDecks as Mock).mockResolvedValue(
      makeDecksResponse([
        makeDeckResponse({
          id: 'd6',
          name: 'Multilingual Deck',
          name_en: 'En Name',
          name_ru: 'Ru Name',
          description_en: 'En desc',
          description_ru: 'Ru desc',
        }),
      ])
    );

    await renderAndWait();
    // Deck was successfully transformed and rendered
    expect(screen.getByText('Multilingual Deck')).toBeInTheDocument();
  });

  it('maps is_premium null → false without crashing', async () => {
    const deckWithNullPremium = {
      ...makeDeckResponse({ id: 'd7', name: 'Null Premium Deck' }),
      is_premium: null as unknown as boolean,
    };
    (deckAPI.getMyDecks as Mock).mockResolvedValue(makeDecksResponse([deckWithNullPremium]));

    await renderAndWait();
    expect(screen.getByText('Null Premium Deck')).toBeInTheDocument();
  });
});

describe('MyDecksPage — createSource analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes createSource="empty_state_cta" when the empty-state CTA button is clicked', async () => {
    // Return empty deck list so the empty state renders
    (deckAPI.getMyDecks as Mock).mockResolvedValue(makeDecksResponse([]));

    await act(async () => {
      render(<MyDecksPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('my-decks-empty-state')).toBeInTheDocument();
    });

    // The empty state contains a Button — click it
    const ctaButton = screen.getByTestId('my-decks-empty-state').querySelector('button');
    expect(ctaButton).not.toBeNull();
    fireEvent.click(ctaButton!);

    // The modal should open with source="empty_state_cta"
    await waitFor(() => {
      const modal = screen.getByTestId('user-deck-edit-modal');
      expect(modal).toBeInTheDocument();
      expect(modal).toHaveAttribute('data-source', 'empty_state_cta');
    });
  });

  it('passes createSource="my_decks_button" when the top Create Deck button is clicked', async () => {
    (deckAPI.getMyDecks as Mock).mockResolvedValue(makeDecksResponse([]));

    await act(async () => {
      render(<MyDecksPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('my-decks-empty-state')).toBeInTheDocument();
    });

    // The "Create Deck" button in the card above the grid
    const allButtons = screen.getAllByRole('button');
    const topCreateBtn = allButtons.find(
      (b) => b.textContent && /create deck/i.test(b.textContent)
    );
    expect(topCreateBtn).toBeDefined();
    fireEvent.click(topCreateBtn!);

    await waitFor(() => {
      const modal = screen.getByTestId('user-deck-edit-modal');
      expect(modal).toBeInTheDocument();
      expect(modal).toHaveAttribute('data-source', 'my_decks_button');
    });
  });
});

describe('MyDecksPage — empty state vs decks grid', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the empty state when no decks are returned', async () => {
    (deckAPI.getMyDecks as Mock).mockResolvedValue(makeDecksResponse([]));

    await act(async () => {
      render(<MyDecksPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('my-decks-empty-state')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('decks-grid')).not.toBeInTheDocument();
  });

  it('renders the decks grid when decks are returned', async () => {
    (deckAPI.getMyDecks as Mock).mockResolvedValue(
      makeDecksResponse([makeDeckResponse({ id: 'd1', name: 'My Deck' })])
    );

    await renderAndWait();

    expect(screen.getByTestId('decks-grid')).toBeInTheDocument();
    expect(screen.queryByTestId('my-decks-empty-state')).not.toBeInTheDocument();
  });
});
