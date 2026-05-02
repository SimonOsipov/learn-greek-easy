/**
 * Tests for DeckDetailModal word entry detail navigation (WDET01)
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
    deleteCultureQuestion: vi.fn(),
  },
}));

vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}));

// Mock child modal components to prevent them from rendering complex dependencies
vi.mock('../CardDeleteDialog', () => ({
  CardDeleteDialog: () => null,
}));

vi.mock('../CardEditModal', () => ({
  CardEditModal: () => null,
}));

vi.mock('../CardCreateModal', () => ({
  CardCreateModal: () => null,
}));

vi.mock('../vocabulary', () => ({}));

vi.mock('../WordEntryContent', () => ({
  WordEntryContent: () => null,
}));

vi.mock('../WordEntryCards', () => ({
  WordEntryCards: () => null,
}));

// ============================================
// Factory Functions
// ============================================

const createV2Deck = (overrides?: Partial<UnifiedDeckItem>): UnifiedDeckItem => ({
  id: 'deck-v2',
  name: 'Essential A1',
  type: 'vocabulary',
  level: 'A1',
  category: null,
  item_count: 5,
  is_active: true,
  is_premium: false,
  is_system_deck: true,
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
  // Granular enrichment fields (V2)
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

// ============================================
// Test Setup
// ============================================

beforeEach(() => {
  vi.clearAllMocks();
  (adminAPI.listWordEntries as Mock).mockResolvedValue({
    total: 2,
    page: 1,
    page_size: 20,
    deck_id: 'deck-v2',
    cards: [
      createWordEntry('entry-1'),
      createWordEntry('entry-2', {
        front_text: 'γάτα',
        back_text_en: 'cat',
        part_of_speech: null,
      }),
    ],
  });
  (adminAPI.listCultureQuestions as Mock).mockResolvedValue({
    total: 0,
    page: 1,
    page_size: 20,
    deck_id: 'deck-culture',
    questions: [],
  });
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
// Tests
// ============================================

describe('DeckDetailModal word entry detail navigation', () => {
  // ============================================
  // Group 1: V2 Row Rendering and Click
  // ============================================

  describe('V2 word entry row navigation', () => {
    it('renders V2 word entry rows with word-entry-row testid', async () => {
      renderModal();
      await waitFor(() => {
        expect(screen.getByTestId('word-entry-row-entry-1')).toBeInTheDocument();
        expect(screen.getByTestId('word-entry-row-entry-2')).toBeInTheDocument();
      });
    });

    it('renders V2 word entry rows with cursor-pointer class', async () => {
      renderModal();
      await waitFor(() => {
        expect(screen.getByTestId('word-entry-row-entry-1')).toHaveClass('cursor-pointer');
      });
    });

    it('clicking V2 word entry row shows detail view', async () => {
      const user = userEvent.setup();
      renderModal();
      await waitFor(() => screen.getByTestId('word-entry-row-entry-1'));
      await user.click(screen.getByTestId('word-entry-row-entry-1'));
      expect(screen.getByTestId('word-entry-detail-view')).toBeInTheDocument();
    });
  });

  // ============================================
  // Group 2: Detail View Rendering
  // ============================================

  describe('detail view rendering', () => {
    it('shows lemma in detail header', async () => {
      const user = userEvent.setup();
      renderModal();
      await waitFor(() => screen.getByTestId('word-entry-row-entry-1'));
      await user.click(screen.getByTestId('word-entry-row-entry-1'));
      expect(screen.getByTestId('word-entry-detail-header')).toHaveTextContent('σπίτι');
    });

    it('shows translation in detail header', async () => {
      const user = userEvent.setup();
      renderModal();
      await waitFor(() => screen.getByTestId('word-entry-row-entry-1'));
      await user.click(screen.getByTestId('word-entry-row-entry-1'));
      expect(screen.getByTestId('word-entry-detail-header')).toHaveTextContent('house');
    });

    it('shows POS badge when part_of_speech is set', async () => {
      const user = userEvent.setup();
      renderModal();
      await waitFor(() => screen.getByTestId('word-entry-row-entry-1'));
      await user.click(screen.getByTestId('word-entry-row-entry-1'));
      const header = screen.getByTestId('word-entry-detail-header');
      expect(within(header).getByText('noun')).toBeInTheDocument();
    });

    it('omits POS badge when part_of_speech is null', async () => {
      const user = userEvent.setup();
      renderModal();
      await waitFor(() => screen.getByTestId('word-entry-row-entry-2'));
      await user.click(screen.getByTestId('word-entry-row-entry-2'));
      const header = screen.getByTestId('word-entry-detail-header');
      // entry-2 has part_of_speech: null, so no badge
      expect(header).not.toHaveTextContent('noun');
    });

    it('shows back button in detail view', async () => {
      const user = userEvent.setup();
      renderModal();
      await waitFor(() => screen.getByTestId('word-entry-row-entry-1'));
      await user.click(screen.getByTestId('word-entry-row-entry-1'));
      expect(screen.getByTestId('word-entry-detail-back')).toBeInTheDocument();
    });
  });

  // ============================================
  // Group 3: Tab Behavior
  // ============================================

  describe('tab behavior', () => {
    it('Word Entry tab is active by default', async () => {
      const user = userEvent.setup();
      renderModal();
      await waitFor(() => screen.getByTestId('word-entry-row-entry-1'));
      await user.click(screen.getByTestId('word-entry-row-entry-1'));
      expect(screen.getByTestId('word-entry-tab-entry')).toHaveAttribute('data-state', 'active');
    });

    it('shows Word Entry and Cards tab triggers', async () => {
      const user = userEvent.setup();
      renderModal();
      await waitFor(() => screen.getByTestId('word-entry-row-entry-1'));
      await user.click(screen.getByTestId('word-entry-row-entry-1'));
      expect(screen.getByTestId('word-entry-tab-entry')).toBeInTheDocument();
      expect(screen.getByTestId('word-entry-tab-cards')).toBeInTheDocument();
    });
  });

  // ============================================
  // Group 4: Back Navigation
  // ============================================

  describe('back navigation', () => {
    it('back button click returns to deck list', async () => {
      const user = userEvent.setup();
      renderModal();
      await waitFor(() => screen.getByTestId('word-entry-row-entry-1'));
      await user.click(screen.getByTestId('word-entry-row-entry-1'));
      expect(screen.getByTestId('word-entry-detail-view')).toBeInTheDocument();
      await user.click(screen.getByTestId('word-entry-detail-back'));
      await waitFor(() => {
        expect(screen.queryByTestId('word-entry-detail-view')).not.toBeInTheDocument();
      });
    });

    it('word entry rows are visible after navigating back', async () => {
      const user = userEvent.setup();
      renderModal();
      await waitFor(() => screen.getByTestId('word-entry-row-entry-1'));
      await user.click(screen.getByTestId('word-entry-row-entry-1'));
      await user.click(screen.getByTestId('word-entry-detail-back'));
      await waitFor(() => {
        expect(screen.getByTestId('word-entry-row-entry-1')).toBeInTheDocument();
      });
    });
  });

  // ============================================
  // Group 5: State Reset
  // ============================================

  describe('state reset', () => {
    it('navigating to different deck resets detail view', async () => {
      const user = userEvent.setup();
      const { rerender } = renderModal({ deck: createV2Deck() });
      await waitFor(() => screen.getByTestId('word-entry-row-entry-1'));
      await user.click(screen.getByTestId('word-entry-row-entry-1'));
      expect(screen.getByTestId('word-entry-detail-view')).toBeInTheDocument();

      const newDeck = createV2Deck({ id: 'deck-v2-other', name: 'Other Deck' });
      (adminAPI.listWordEntries as Mock).mockResolvedValue({
        total: 0,
        page: 1,
        page_size: 20,
        deck_id: 'deck-v2-other',
        cards: [],
      });
      rerender(
        <I18nextProvider i18n={i18n}>
          <DeckDetailModal
            open={true}
            onOpenChange={vi.fn()}
            deck={newDeck}
            onItemDeleted={vi.fn()}
          />
        </I18nextProvider>
      );
      await waitFor(() => {
        expect(screen.queryByTestId('word-entry-detail-view')).not.toBeInTheDocument();
      });
    });
  });

  // ============================================
  // Group 6: Close Button
  // ============================================

  describe('close button', () => {
    it('close button works while in detail view', async () => {
      const onOpenChange = vi.fn();
      const user = userEvent.setup();
      renderModal({ onOpenChange });
      await waitFor(() => screen.getByTestId('word-entry-row-entry-1'));
      await user.click(screen.getByTestId('word-entry-row-entry-1'));
      await user.click(screen.getByTestId('deck-detail-close'));
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
