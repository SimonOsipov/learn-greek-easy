// src/features/words/components/__tests__/AddToDeckModal.test.tsx

/**
 * Tests for AddToDeckModal — the add-word-to-my-deck picker on word pages.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createTestQueryClient, renderWithProviders } from '@/lib/test-utils';
import { deckAPI, type DeckListResponse, type DeckResponse } from '@/services/deckAPI';
import { wordEntryAPI } from '@/services/wordEntryAPI';

import { AddToDeckModal } from '../AddToDeckModal';

vi.mock('@/services/deckAPI', async () => {
  const actual = await vi.importActual<typeof import('@/services/deckAPI')>('@/services/deckAPI');
  return {
    ...actual,
    deckAPI: {
      ...actual.deckAPI,
      getMyDecks: vi.fn(),
      addWordToMyDeck: vi.fn(),
      removeWordFromMyDeck: vi.fn(),
    },
  };
});

vi.mock('@/services/wordEntryAPI', async () => {
  const actual =
    await vi.importActual<typeof import('@/services/wordEntryAPI')>('@/services/wordEntryAPI');
  return {
    ...actual,
    wordEntryAPI: {
      ...actual.wordEntryAPI,
      getMyDecksForWord: vi.fn(),
    },
  };
});

vi.mock('@/lib/analytics', async () => {
  const actual = await vi.importActual<typeof import('@/lib/analytics')>('@/lib/analytics');
  return {
    ...actual,
    track: vi.fn(),
  };
});

const WORD_ENTRY_ID = 'word-entry-1';
const LEMMA = 'θάλασσα';

const makeDeck = (overrides: Partial<DeckResponse> = {}): DeckResponse => ({
  id: 'deck-1',
  name: 'My Greek Words',
  description: null,
  level: 'A1',
  is_active: true,
  is_premium: false,
  card_count: 3,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

const makeDeckList = (decks: DeckResponse[]): DeckListResponse => ({
  total: decks.length,
  page: 1,
  page_size: 50,
  decks,
});

function renderModal() {
  const queryClient = createTestQueryClient();
  return renderWithProviders(
    <QueryClientProvider client={queryClient}>
      <AddToDeckModal
        open={true}
        onOpenChange={vi.fn()}
        wordEntryId={WORD_ENTRY_ID}
        lemma={LEMMA}
      />
    </QueryClientProvider>
  );
}

describe('AddToDeckModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists my decks and marks decks that already contain the word', async () => {
    vi.mocked(deckAPI.getMyDecks).mockResolvedValue(
      makeDeckList([
        makeDeck({ id: 'deck-1', name: 'My Greek Words' }),
        makeDeck({ id: 'deck-2', name: 'Travel Vocab', level: 'A2' }),
      ])
    );
    vi.mocked(wordEntryAPI.getMyDecksForWord).mockResolvedValue({ deck_ids: ['deck-2'] });

    renderModal();

    expect(await screen.findByText('My Greek Words')).toBeInTheDocument();
    expect(screen.getByText('Travel Vocab')).toBeInTheDocument();

    // deck-2 contains the word -> shows "Added"; deck-1 doesn't -> shows "Add"
    expect(screen.getByTestId('add-to-deck-row-deck-2')).toHaveTextContent('Added');
    expect(screen.getByTestId('add-to-deck-row-deck-1')).toHaveTextContent('Add');
    expect(screen.getByTestId('add-to-deck-row-deck-2')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('add-to-deck-row-deck-1')).toHaveAttribute('aria-pressed', 'false');
  });

  it('adds the word when clicking a deck that does not contain it and shows a toast', async () => {
    const user = userEvent.setup();
    vi.mocked(deckAPI.getMyDecks).mockResolvedValue(
      makeDeckList([makeDeck({ id: 'deck-1', name: 'My Greek Words' })])
    );
    vi.mocked(wordEntryAPI.getMyDecksForWord).mockResolvedValue({ deck_ids: [] });
    vi.mocked(deckAPI.addWordToMyDeck).mockResolvedValue({
      id: WORD_ENTRY_ID,
    } as Awaited<ReturnType<typeof deckAPI.addWordToMyDeck>>);

    renderModal();

    await user.click(await screen.findByTestId('add-to-deck-row-deck-1'));

    await waitFor(() => {
      expect(deckAPI.addWordToMyDeck).toHaveBeenCalledWith('deck-1', WORD_ENTRY_ID);
    });
    expect(await screen.findByText('Added to “My Greek Words”')).toBeInTheDocument();
    expect(deckAPI.removeWordFromMyDeck).not.toHaveBeenCalled();
  });

  it('removes the word after confirming when clicking a deck that already contains it', async () => {
    const user = userEvent.setup();
    vi.mocked(deckAPI.getMyDecks).mockResolvedValue(
      makeDeckList([makeDeck({ id: 'deck-1', name: 'My Greek Words' })])
    );
    vi.mocked(wordEntryAPI.getMyDecksForWord).mockResolvedValue({ deck_ids: ['deck-1'] });
    vi.mocked(deckAPI.removeWordFromMyDeck).mockResolvedValue(undefined);

    renderModal();

    await user.click(await screen.findByTestId('add-to-deck-row-deck-1'));

    // Removal is destructive (deletes progress) — a confirmation dialog opens first
    expect(await screen.findByText('Remove word from deck?')).toBeInTheDocument();
    expect(deckAPI.removeWordFromMyDeck).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Remove' }));

    await waitFor(() => {
      expect(deckAPI.removeWordFromMyDeck).toHaveBeenCalledWith('deck-1', WORD_ENTRY_ID);
    });
    expect(await screen.findByText('Removed from “My Greek Words”')).toBeInTheDocument();
    expect(deckAPI.addWordToMyDeck).not.toHaveBeenCalled();
  });

  it('does not remove the word when the confirmation is cancelled', async () => {
    const user = userEvent.setup();
    vi.mocked(deckAPI.getMyDecks).mockResolvedValue(
      makeDeckList([makeDeck({ id: 'deck-1', name: 'My Greek Words' })])
    );
    vi.mocked(wordEntryAPI.getMyDecksForWord).mockResolvedValue({ deck_ids: ['deck-1'] });

    renderModal();

    await user.click(await screen.findByTestId('add-to-deck-row-deck-1'));
    expect(await screen.findByText('Remove word from deck?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByText('Remove word from deck?')).not.toBeInTheDocument();
    });
    expect(deckAPI.removeWordFromMyDeck).not.toHaveBeenCalled();
  });

  it('shows an error state with retry when loading decks fails', async () => {
    vi.mocked(deckAPI.getMyDecks).mockRejectedValue(new Error('500'));
    vi.mocked(wordEntryAPI.getMyDecksForWord).mockResolvedValue({ deck_ids: [] });

    renderModal();

    expect(await screen.findByTestId('add-to-deck-error')).toBeInTheDocument();
    expect(screen.getByText('Failed to load your decks')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
    // The misleading "no decks yet" empty state must NOT render on errors
    expect(screen.queryByTestId('add-to-deck-empty')).not.toBeInTheDocument();
  });

  it('shows a destructive toast when adding fails', async () => {
    const user = userEvent.setup();
    vi.mocked(deckAPI.getMyDecks).mockResolvedValue(
      makeDeckList([makeDeck({ id: 'deck-1', name: 'My Greek Words' })])
    );
    vi.mocked(wordEntryAPI.getMyDecksForWord).mockResolvedValue({ deck_ids: [] });
    vi.mocked(deckAPI.addWordToMyDeck).mockRejectedValue(new Error('409 Conflict'));

    renderModal();

    await user.click(await screen.findByTestId('add-to-deck-row-deck-1'));

    expect(await screen.findByText('Failed to add word to deck')).toBeInTheDocument();
  });

  it('shows an empty state with a create-deck CTA when the user has no decks', async () => {
    vi.mocked(deckAPI.getMyDecks).mockResolvedValue(makeDeckList([]));
    vi.mocked(wordEntryAPI.getMyDecksForWord).mockResolvedValue({ deck_ids: [] });

    renderModal();

    expect(await screen.findByTestId('add-to-deck-empty')).toBeInTheDocument();
    expect(screen.getByText("You don't have any decks yet")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create a deck' })).toBeInTheDocument();
  });

  it('shows the word lemma in the modal description', async () => {
    vi.mocked(deckAPI.getMyDecks).mockResolvedValue(makeDeckList([]));
    vi.mocked(wordEntryAPI.getMyDecksForWord).mockResolvedValue({ deck_ids: [] });

    renderModal();

    expect(await screen.findByText(new RegExp(LEMMA))).toBeInTheDocument();
  });
});
