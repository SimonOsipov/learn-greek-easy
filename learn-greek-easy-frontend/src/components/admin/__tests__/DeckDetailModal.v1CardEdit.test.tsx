/**
 * Tests for DeckDetailModal V1 card edit in-dialog navigation (ADMINUX-06)
 *
 * Acceptance criteria covered:
 * AC-1  V1 row click opens in-dialog edit form (sets selectedV1Card, shows V1CardEditInDialog)
 * AC-2  V1 pencil button click also opens in-dialog edit form (same as row click)
 * AC-3  V1 back button (data-testid="v1-card-edit-back") navigates back to list
 * AC-4  V1 edit view shows card's front_text in DialogTitle and back_text_en in DialogDescription
 * AC-5  V1CardEditInDialog renders when selectedV1Card is set
 * AC-6  V1 cancel with clean form navigates back immediately (handled inside V1CardEditInDialog — mocked)
 * AC-7  V1 cancel with dirty form shows AlertDialog confirmation (handled inside V1CardEditInDialog — mocked)
 * AC-8  Escape key when in V1 edit view returns to list (not to modal close)
 * AC-9  V2 word entry click still works (existing behavior unaffected)
 * AC-10 V1 rows use card-item testid and cursor-pointer class
 * AC-11 Bulk actions (select-all, per-row checkboxes, word-list-toolbar) do NOT appear for V1 decks
 * AC-12 V1 card row click navigates into edit view; back button returns to list
 * AC-13 Deck change resets selectedV1Card (no stale edit view)
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';

import { DeckDetailModal } from '../DeckDetailModal';
import { adminAPI } from '@/services/adminAPI';
import type { AdminVocabularyCard, UnifiedDeckItem } from '@/services/adminAPI';
import i18n from '@/i18n';

// ============================================
// Mocks
// ============================================

vi.mock('@/services/adminAPI', () => ({
  adminAPI: {
    listVocabularyCards: vi.fn(),
    listWordEntries: vi.fn(),
    listCultureQuestions: vi.fn(),
    deleteVocabularyCard: vi.fn(),
    deleteCultureQuestion: vi.fn(),
  },
}));

vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}));

vi.mock('@/lib/analytics/adminAnalytics', () => ({
  trackAdminWordEntryDetailOpened: vi.fn(),
  trackAdminWordEntryDetailTabSwitched: vi.fn(),
}));

vi.mock('../CardDeleteDialog', () => ({
  CardDeleteDialog: () => null,
}));

vi.mock('../CardEditModal', () => ({
  CardEditModal: () => null,
}));

vi.mock('../CardCreateModal', () => ({
  CardCreateModal: () => null,
}));

// V1CardEditInDialog rendered as a real div so assertions can detect it.
// V2 components mocked to null (not under test here).
vi.mock('../vocabulary', () => ({
  VocabularyCardCreateModal: () => null,
  V1CardEditInDialog: () => <div data-testid="v1-card-edit-in-dialog" />,
}));

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
  card_system: 'V2',
  created_at: '2024-01-01',
  owner_id: null,
  owner_name: null,
  ...overrides,
});

const createV1Deck = (overrides?: Partial<UnifiedDeckItem>): UnifiedDeckItem => ({
  ...createV2Deck(),
  id: 'deck-v1',
  name: 'Basic Greek Nouns',
  card_system: 'V1',
  ...overrides,
});

const createCard = (id: string, overrides?: Partial<AdminVocabularyCard>): AdminVocabularyCard => ({
  id,
  deck_id: 'deck-v1',
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
  // Enrichment fields default to V1 no-op values
  translation_en_plural: null,
  translation_ru_plural: null,
  audio_status: 'missing',
  grammar_filled: 0,
  grammar_total: 0,
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

  // V1 decks call listVocabularyCards
  (adminAPI.listVocabularyCards as Mock).mockResolvedValue({
    total: 2,
    page: 1,
    page_size: 20,
    deck_id: 'deck-v1',
    cards: [
      createCard('card-1'),
      createCard('card-2', { front_text: 'γάτα', back_text_en: 'cat' }),
    ],
  });

  // V2 decks call listWordEntries
  (adminAPI.listWordEntries as Mock).mockResolvedValue({
    total: 1,
    page: 1,
    page_size: 20,
    deck_id: 'deck-v2',
    cards: [createCard('entry-1', { deck_id: 'deck-v2' })],
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
    deck: createV1Deck(),
    onItemDeleted: vi.fn(),
  };
  return render(
    <I18nextProvider i18n={i18n}>
      <DeckDetailModal {...defaultProps} {...props} />
    </I18nextProvider>
  );
};

// ============================================
// Tests
// ============================================

describe('DeckDetailModal V1 card edit in-dialog', () => {
  // ============================================
  // Group 1: V1 Row Rendering
  // ============================================

  describe('V1 row rendering', () => {
    it('renders V1 card rows with card-item testid', async () => {
      renderModal();
      await waitFor(() => {
        expect(screen.getByTestId('card-item-card-1')).toBeInTheDocument();
        expect(screen.getByTestId('card-item-card-2')).toBeInTheDocument();
      });
    });

    it('V1 rows do NOT use word-entry-row testid', async () => {
      renderModal();
      await waitFor(() => {
        expect(screen.queryByTestId('word-entry-row-card-1')).not.toBeInTheDocument();
      });
    });

    it('V1 rows have cursor-pointer class', async () => {
      renderModal();
      await waitFor(() => {
        expect(screen.getByTestId('card-item-card-1')).toHaveClass('cursor-pointer');
      });
    });
  });

  // ============================================
  // Group 2: V1 Row Click Opens Edit View
  // ============================================

  describe('V1 row click opens in-dialog edit form (AC-1)', () => {
    it('clicking a V1 row shows V1CardEditInDialog', async () => {
      const user = userEvent.setup();
      renderModal();
      await waitFor(() => screen.getByTestId('card-item-card-1'));
      await user.click(screen.getByTestId('card-item-card-1'));
      expect(screen.getByTestId('v1-card-edit-in-dialog')).toBeInTheDocument();
    });

    it('clicking a V1 row hides the card list', async () => {
      const user = userEvent.setup();
      renderModal();
      await waitFor(() => screen.getByTestId('card-item-card-1'));
      await user.click(screen.getByTestId('card-item-card-1'));
      expect(screen.queryByTestId('card-item-card-1')).not.toBeInTheDocument();
    });

    it('clicking a V1 row does NOT open word-entry detail view', async () => {
      const user = userEvent.setup();
      renderModal();
      await waitFor(() => screen.getByTestId('card-item-card-1'));
      await user.click(screen.getByTestId('card-item-card-1'));
      expect(screen.queryByTestId('word-entry-detail-view')).not.toBeInTheDocument();
    });
  });

  // ============================================
  // Group 3: Pencil Button Opens Edit View
  // ============================================

  describe('V1 pencil button click opens in-dialog edit form (AC-2)', () => {
    it('clicking the pencil/edit button shows V1CardEditInDialog', async () => {
      const user = userEvent.setup();
      renderModal();
      await waitFor(() => screen.getByTestId('vocabulary-card-edit-card-1'));
      await user.click(screen.getByTestId('vocabulary-card-edit-card-1'));
      expect(screen.getByTestId('v1-card-edit-in-dialog')).toBeInTheDocument();
    });

    it('pencil click for correct card shows that card\u2019s data in header', async () => {
      const user = userEvent.setup();
      renderModal();
      await waitFor(() => screen.getByTestId('vocabulary-card-edit-card-2'));
      await user.click(screen.getByTestId('vocabulary-card-edit-card-2'));
      // DialogTitle shows front_text of card-2
      expect(screen.getByTestId('deck-detail-title')).toHaveTextContent('γάτα');
    });
  });

  // ============================================
  // Group 4: Edit View Header (AC-4)
  // ============================================

  describe('V1 edit view header shows card data (AC-4)', () => {
    it('shows front_text in DialogTitle', async () => {
      const user = userEvent.setup();
      renderModal();
      await waitFor(() => screen.getByTestId('card-item-card-1'));
      await user.click(screen.getByTestId('card-item-card-1'));
      expect(screen.getByTestId('deck-detail-title')).toHaveTextContent('σπίτι');
    });

    it('shows back_text_en in DialogDescription area', async () => {
      const user = userEvent.setup();
      renderModal();
      await waitFor(() => screen.getByTestId('card-item-card-1'));
      await user.click(screen.getByTestId('card-item-card-1'));
      // DialogDescription renders the translation text
      expect(screen.getByText('house')).toBeInTheDocument();
    });

    it('shows back button with v1-card-edit-back testid', async () => {
      const user = userEvent.setup();
      renderModal();
      await waitFor(() => screen.getByTestId('card-item-card-1'));
      await user.click(screen.getByTestId('card-item-card-1'));
      expect(screen.getByTestId('v1-card-edit-back')).toBeInTheDocument();
    });
  });

  // ============================================
  // Group 5: Back Button Navigation (AC-3)
  // ============================================

  describe('V1 back button navigates back to list (AC-3)', () => {
    it('back button click hides V1CardEditInDialog', async () => {
      const user = userEvent.setup();
      renderModal();
      await waitFor(() => screen.getByTestId('card-item-card-1'));
      await user.click(screen.getByTestId('card-item-card-1'));
      expect(screen.getByTestId('v1-card-edit-in-dialog')).toBeInTheDocument();
      await user.click(screen.getByTestId('v1-card-edit-back'));
      await waitFor(() => {
        expect(screen.queryByTestId('v1-card-edit-in-dialog')).not.toBeInTheDocument();
      });
    });

    it('back button click restores card list', async () => {
      const user = userEvent.setup();
      renderModal();
      await waitFor(() => screen.getByTestId('card-item-card-1'));
      await user.click(screen.getByTestId('card-item-card-1'));
      await user.click(screen.getByTestId('v1-card-edit-back'));
      await waitFor(() => {
        expect(screen.getByTestId('card-item-card-1')).toBeInTheDocument();
      });
    });

    it('back button click removes v1-card-edit-back button itself', async () => {
      const user = userEvent.setup();
      renderModal();
      await waitFor(() => screen.getByTestId('card-item-card-1'));
      await user.click(screen.getByTestId('card-item-card-1'));
      await user.click(screen.getByTestId('v1-card-edit-back'));
      await waitFor(() => {
        expect(screen.queryByTestId('v1-card-edit-back')).not.toBeInTheDocument();
      });
    });
  });

  // ============================================
  // Group 6: Escape Key Returns to List (AC-8)
  // ============================================

  describe('Escape key returns to list when in V1 edit view (AC-8)', () => {
    it('pressing Escape while in V1 edit view returns to list', async () => {
      const user = userEvent.setup();
      renderModal();
      await waitFor(() => screen.getByTestId('card-item-card-1'));
      await user.click(screen.getByTestId('card-item-card-1'));
      expect(screen.getByTestId('v1-card-edit-in-dialog')).toBeInTheDocument();

      // Fire escape on the dialog content
      const dialogContent = screen.getByTestId('deck-detail-modal');
      fireEvent.keyDown(dialogContent, { key: 'Escape', code: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByTestId('v1-card-edit-in-dialog')).not.toBeInTheDocument();
      });
    });

    it('pressing Escape while in V1 edit view does NOT call onOpenChange(false)', async () => {
      const onOpenChange = vi.fn();
      const user = userEvent.setup();
      renderModal({ onOpenChange });
      await waitFor(() => screen.getByTestId('card-item-card-1'));
      await user.click(screen.getByTestId('card-item-card-1'));

      const dialogContent = screen.getByTestId('deck-detail-modal');
      fireEvent.keyDown(dialogContent, { key: 'Escape', code: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByTestId('v1-card-edit-in-dialog')).not.toBeInTheDocument();
      });
      // onOpenChange should NOT have been called with false (dialog stays open)
      expect(onOpenChange).not.toHaveBeenCalledWith(false);
    });
  });

  // ============================================
  // Group 7: V2 Word Entry Click Unaffected (AC-9)
  // ============================================

  describe('V2 word entry click still works (AC-9)', () => {
    it('clicking a V2 word entry row shows word-entry-detail-view', async () => {
      const user = userEvent.setup();
      renderModal({ deck: createV2Deck() });
      await waitFor(() => screen.getByTestId('word-entry-row-entry-1'));
      await user.click(screen.getByTestId('word-entry-row-entry-1'));
      expect(screen.getByTestId('word-entry-detail-view')).toBeInTheDocument();
    });

    it('clicking a V2 word entry row does NOT show V1CardEditInDialog', async () => {
      const user = userEvent.setup();
      renderModal({ deck: createV2Deck() });
      await waitFor(() => screen.getByTestId('word-entry-row-entry-1'));
      await user.click(screen.getByTestId('word-entry-row-entry-1'));
      expect(screen.queryByTestId('v1-card-edit-in-dialog')).not.toBeInTheDocument();
    });
  });

  // ============================================
  // Group 8: Bulk Actions Absent for V1 (AC-11)
  // ============================================

  describe('Bulk actions do NOT appear for V1 decks (AC-11)', () => {
    it('word-list-toolbar (search/filter/sort) is NOT rendered for V1 deck', async () => {
      renderModal();
      await waitFor(() => screen.getByTestId('card-item-card-1'));
      expect(screen.queryByTestId('word-list-toolbar')).not.toBeInTheDocument();
    });

    it('word-list-select-all checkbox is NOT rendered for V1 deck', async () => {
      renderModal();
      await waitFor(() => screen.getByTestId('card-item-card-1'));
      expect(screen.queryByTestId('word-list-select-all')).not.toBeInTheDocument();
    });

    it('per-row checkboxes are NOT rendered for V1 rows', async () => {
      renderModal();
      await waitFor(() => screen.getByTestId('card-item-card-1'));
      expect(screen.queryByTestId('word-entry-select-card-1')).not.toBeInTheDocument();
    });

    it('bulk delete button does NOT appear for V1 deck', async () => {
      renderModal();
      await waitFor(() => screen.getByTestId('card-item-card-1'));
      expect(screen.queryByTestId('word-list-bulk-delete-btn')).not.toBeInTheDocument();
    });
  });

  // ============================================
  // Group 9: State Reset When Deck Changes (AC-13)
  // ============================================

  describe('state reset when deck changes (AC-13)', () => {
    it('navigating to a different deck resets V1 edit view', async () => {
      const user = userEvent.setup();
      const { rerender } = renderModal({ deck: createV1Deck() });
      await waitFor(() => screen.getByTestId('card-item-card-1'));
      await user.click(screen.getByTestId('card-item-card-1'));
      expect(screen.getByTestId('v1-card-edit-in-dialog')).toBeInTheDocument();

      // Mock response for new deck
      (adminAPI.listVocabularyCards as Mock).mockResolvedValue({
        total: 0,
        page: 1,
        page_size: 20,
        deck_id: 'deck-v1-other',
        cards: [],
      });

      const otherDeck = createV1Deck({ id: 'deck-v1-other', name: 'Other V1 Deck' });
      rerender(
        <I18nextProvider i18n={i18n}>
          <DeckDetailModal
            open={true}
            onOpenChange={vi.fn()}
            deck={otherDeck}
            onItemDeleted={vi.fn()}
          />
        </I18nextProvider>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('v1-card-edit-in-dialog')).not.toBeInTheDocument();
      });
    });
  });

  // ============================================
  // Group 10: Close Button Works From V1 Edit View
  // ============================================

  describe('close button works from V1 edit view', () => {
    it('close button calls onOpenChange(false) while in V1 edit view', async () => {
      const onOpenChange = vi.fn();
      const user = userEvent.setup();
      renderModal({ onOpenChange });
      await waitFor(() => screen.getByTestId('card-item-card-1'));
      await user.click(screen.getByTestId('card-item-card-1'));
      expect(screen.getByTestId('v1-card-edit-in-dialog')).toBeInTheDocument();
      await user.click(screen.getByTestId('deck-detail-close'));
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  // ============================================
  // Group 11: Multiple V1 Cards — Correct Card Selected
  // ============================================

  describe('correct V1 card data shown after row click', () => {
    it('clicking second card shows second card front_text in header', async () => {
      const user = userEvent.setup();
      renderModal();
      await waitFor(() => screen.getByTestId('card-item-card-2'));
      await user.click(screen.getByTestId('card-item-card-2'));
      expect(screen.getByTestId('deck-detail-title')).toHaveTextContent('γάτα');
    });

    it('clicking second card shows second card back_text_en', async () => {
      const user = userEvent.setup();
      renderModal();
      await waitFor(() => screen.getByTestId('card-item-card-2'));
      await user.click(screen.getByTestId('card-item-card-2'));
      expect(screen.getByText('cat')).toBeInTheDocument();
    });

    it('clicking first card shows first card data not second', async () => {
      const user = userEvent.setup();
      renderModal();
      await waitFor(() => screen.getByTestId('card-item-card-1'));
      await user.click(screen.getByTestId('card-item-card-1'));
      expect(screen.getByTestId('deck-detail-title')).toHaveTextContent('σπίτι');
      expect(screen.queryByText('γάτα')).not.toBeInTheDocument();
    });
  });

  // ============================================
  // Group 12: Edit View Is Not Shown on Initial Load
  // ============================================

  describe('initial state shows list, not edit view', () => {
    it('V1CardEditInDialog is NOT shown on initial load', async () => {
      renderModal();
      await waitFor(() => screen.getByTestId('card-item-card-1'));
      expect(screen.queryByTestId('v1-card-edit-in-dialog')).not.toBeInTheDocument();
    });

    it('v1-card-edit-back is NOT shown on initial load', async () => {
      renderModal();
      await waitFor(() => screen.getByTestId('card-item-card-1'));
      expect(screen.queryByTestId('v1-card-edit-back')).not.toBeInTheDocument();
    });

    it('deck title (not card front_text) appears in header on initial load', async () => {
      renderModal();
      await waitFor(() => screen.getByTestId('deck-detail-title'));
      expect(screen.getByTestId('deck-detail-title')).toHaveTextContent('Basic Greek Nouns');
    });
  });
});
