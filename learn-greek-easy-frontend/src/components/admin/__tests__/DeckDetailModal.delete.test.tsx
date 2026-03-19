/**
 * Tests for DeckDetailModal single-item and bulk delete routing (WEDEL-02)
 *
 * Verifies that:
 * - V2 single delete calls adminAPI.deleteWordEntry
 * - V2 bulk delete calls adminAPI.deleteWordEntry for each selected ID
 * - CardDeleteDialog title reflects itemType="wordEntry" for V2 decks
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { DeckDetailModal } from '../DeckDetailModal';
import { adminAPI } from '@/services/adminAPI';
import type { AdminVocabularyCard, UnifiedDeckItem } from '@/services/adminAPI';
import i18n from '@/i18n';

// ============================================
// Mocks
// ============================================

vi.mock('@/services/adminAPI', () => ({
  GENERATE_WORD_ENTRY_STREAM_URL: '/api/v1/admin/word-entries/generate/stream',
  adminAPI: {
    listWordEntries: vi.fn(),
    listCultureQuestions: vi.fn(),
    deleteWordEntry: vi.fn(),
    deleteCultureQuestion: vi.fn(),
  },
}));

vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}));

// DO NOT mock CardDeleteDialog — let it render for real to verify dialog text
vi.mock('../CardEditModal', () => ({ CardEditModal: () => null }));
vi.mock('../CardCreateModal', () => ({ CardCreateModal: () => null }));
vi.mock('../vocabulary', () => ({}));
vi.mock('../WordEntryContent', () => ({ WordEntryContent: () => null }));
vi.mock('../WordEntryCards', () => ({ WordEntryCards: () => null }));

// ============================================
// Factory Functions
// ============================================

const createV2Deck = (overrides?: Partial<UnifiedDeckItem>): UnifiedDeckItem => ({
  id: 'deck-v2',
  name: 'Essential A1',
  type: 'vocabulary',
  level: 'A1',
  category: null,
  item_count: 30,
  is_active: true,
  is_premium: false,
  is_system_deck: true,
  card_system: 'V2',
  created_at: '2024-01-01',
  owner_id: null,
  owner_name: null,
  ...overrides,
});

const createWordEntry = (
  id: string,
  overrides?: Partial<AdminVocabularyCard>
): AdminVocabularyCard => ({
  id,
  deck_id: 'deck-v2',
  front_text: 'σπίτι',
  back_text_en: 'house',
  back_text_ru: 'дом',
  example_sentence: null,
  pronunciation: 'spíti',
  part_of_speech: 'noun',
  level: 'A1',
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
  gender: null,
  has_examples: false,
  has_audio: false,
  has_grammar: false,
  translation_en_plural: null,
  translation_ru_plural: null,
  audio_status: 'missing',
  grammar_filled: 0,
  grammar_total: 9,
  example_count: 0,
  examples_with_en: 0,
  examples_with_ru: 0,
  examples_with_audio: 0,
  ...overrides,
});

const makeWordEntriesResponse = (cards: AdminVocabularyCard[], total = cards.length) => ({
  total,
  page: 1,
  page_size: 20,
  deck_id: 'deck-v2',
  cards,
});

// ============================================
// Render Helper
// ============================================

const renderModal = (props?: Partial<Parameters<typeof DeckDetailModal>[0]>) => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    deck: createV2Deck(),
    onItemDeleted: vi.fn(),
  };
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
    </QueryClientProvider>
  );

  const mergedProps = { ...defaultProps, ...props };
  return render(<DeckDetailModal {...mergedProps} />, { wrapper: Wrapper });
};

// ============================================
// Default setup
// ============================================

beforeEach(() => {
  vi.clearAllMocks();
  (adminAPI.listWordEntries as Mock).mockResolvedValue(
    makeWordEntriesResponse([
      createWordEntry('e1', { front_text: 'σπίτι', back_text_en: 'house' }),
      createWordEntry('e2', { front_text: 'γάτα', back_text_en: 'cat' }),
    ])
  );
  (adminAPI.listCultureQuestions as Mock).mockResolvedValue({
    total: 0,
    page: 1,
    page_size: 20,
    deck_id: 'deck-culture',
    questions: [],
  });
  (adminAPI.deleteWordEntry as Mock).mockResolvedValue(undefined);
});

// ============================================
// Group 1: V2 single delete routing
// ============================================

describe('V2 single delete routing', () => {
  it('opens dialog with "Permanently Delete Word Entry" title when clicking delete on V2 word entry', async () => {
    renderModal();
    await waitFor(() => screen.getByTestId('delete-card-e1'));

    fireEvent.click(screen.getByTestId('delete-card-e1'));

    await waitFor(() => {
      expect(screen.getByTestId('card-delete-dialog')).toBeInTheDocument();
      expect(screen.getByText('Permanently Delete Word Entry')).toBeInTheDocument();
    });
  });

  it('confirming delete calls adminAPI.deleteWordEntry with the card id', async () => {
    renderModal();
    await waitFor(() => screen.getByTestId('delete-card-e1'));

    fireEvent.click(screen.getByTestId('delete-card-e1'));
    await waitFor(() => screen.getByTestId('card-delete-dialog'));

    fireEvent.click(screen.getByTestId('card-delete-confirm'));

    await waitFor(() => {
      expect(adminAPI.deleteWordEntry).toHaveBeenCalledWith('e1');
    });
  });
});

// ============================================
// Group 2: V2 bulk delete routing
// ============================================

describe('V2 bulk delete routing', () => {
  it('confirm bulk delete calls adminAPI.deleteWordEntry for each selected ID', async () => {
    renderModal();
    await waitFor(() => screen.getByTestId('word-list-bulk-bar'));

    // Select both cards
    fireEvent.click(screen.getByTestId('word-list-select-all'));
    await waitFor(() => screen.getByTestId('word-list-bulk-delete-btn'));
    fireEvent.click(screen.getByTestId('word-list-bulk-delete-btn'));
    await waitFor(() => screen.getByTestId('bulk-delete-dialog'));

    fireEvent.click(screen.getByTestId('bulk-delete-confirm'));

    await waitFor(() => {
      expect(adminAPI.deleteWordEntry).toHaveBeenCalledTimes(2);
    });
  });
});
