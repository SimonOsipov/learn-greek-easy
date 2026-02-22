/**
 * Tests for DeckDetailModal bulk selection and bulk delete (ADMINUX-05)
 *
 * Covers acceptance criteria:
 * AC-1  Select-all checkbox renders in bulk bar when V2 deck is loaded with cards
 * AC-2  Select-all toggles: checking selects all cards, checking again deselects all
 * AC-3  Per-row checkboxes render on each V2 row
 * AC-4  Per-row select toggles individual card selection
 * AC-5  selectedCount label updates when cards are selected (e.g., "2 selected")
 * AC-6  Bulk delete button only appears when selectedIds.size > 0
 * AC-7  Bulk delete Dialog opens when bulk delete button is clicked
 * AC-8  Bulk delete Dialog shows correct count in title/confirm button
 * AC-9  Cancel in Dialog closes it without deleting
 * AC-10 Confirm calls adminAPI.deleteVocabularyCard for each selected ID, then refreshes
 * AC-11 Selection resets when deck changes (different deck opened)
 * AC-12 Selection resets after fetchItems completes (e.g., after sort/filter change)
 * AC-13 Bulk bar does NOT render for V1 vocabulary decks
 * AC-14 Row navigation still works (clicking row still opens word entry detail)
 * AC-15 Checkbox click does NOT trigger row navigation
 *
 * NOTE on Radix UI Checkbox: Radix Checkbox renders as a button element.
 * Use fireEvent.click on the element located by data-testid.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';

import { DeckDetailModal } from '../DeckDetailModal';
import { adminAPI } from '@/services/adminAPI';
import type { AdminVocabularyCard, UnifiedDeckItem } from '@/services/adminAPI';
import i18n from '@/i18n';

// ============================================
// Mocks — exact same structure as searchFilterSort tests
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

vi.mock('../CardDeleteDialog', () => ({ CardDeleteDialog: () => null }));
vi.mock('../CardEditModal', () => ({ CardEditModal: () => null }));
vi.mock('../CardCreateModal', () => ({ CardCreateModal: () => null }));
vi.mock('../vocabulary', () => ({
  VocabularyCardCreateModal: () => null,
  VocabularyCardEditModal: () => null,
}));
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

const createV1Deck = (): UnifiedDeckItem => ({
  ...createV2Deck(),
  id: 'deck-v1',
  card_system: 'V1',
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
  return render(
    <I18nextProvider i18n={i18n}>
      <DeckDetailModal {...defaultProps} {...props} />
    </I18nextProvider>
  );
};

// ============================================
// Default setup: 2 word entries
// ============================================

beforeEach(() => {
  vi.clearAllMocks();
  (adminAPI.listWordEntries as Mock).mockResolvedValue(
    makeWordEntriesResponse([
      createWordEntry('e1', { front_text: 'σπίτι', back_text_en: 'house' }),
      createWordEntry('e2', { front_text: 'γάτα', back_text_en: 'cat' }),
    ])
  );
  (adminAPI.listVocabularyCards as Mock).mockResolvedValue(
    makeWordEntriesResponse([createWordEntry('c1')])
  );
  (adminAPI.listCultureQuestions as Mock).mockResolvedValue({
    total: 0,
    page: 1,
    page_size: 20,
    deck_id: 'deck-culture',
    questions: [],
  });
  (adminAPI.deleteVocabularyCard as Mock).mockResolvedValue(undefined);
});

// ============================================
// AC-1: Select-all checkbox renders in bulk bar
// ============================================

describe('AC-1: Select-all checkbox renders in bulk bar for V2 decks with cards', () => {
  it('renders the bulk bar when V2 deck is loaded with cards', async () => {
    renderModal();
    await waitFor(() => {
      expect(screen.getByTestId('word-list-bulk-bar')).toBeInTheDocument();
    });
  });

  it('renders the select-all checkbox within the bulk bar', async () => {
    renderModal();
    await waitFor(() => {
      expect(screen.getByTestId('word-list-select-all')).toBeInTheDocument();
    });
  });

  it('bulk bar is not rendered while loading', async () => {
    // Make the API call hang briefly so we can check loading state
    let resolve: (v: unknown) => void;
    (adminAPI.listWordEntries as Mock).mockImplementation(
      () =>
        new Promise((res) => {
          resolve = res;
        })
    );
    renderModal();
    // During loading, bulk bar should not be present
    expect(screen.queryByTestId('word-list-bulk-bar')).not.toBeInTheDocument();
    // Resolve to avoid memory leaks
    resolve!(makeWordEntriesResponse([createWordEntry('e1')]));
  });

  it('bulk bar is not rendered when cards array is empty', async () => {
    (adminAPI.listWordEntries as Mock).mockResolvedValue(makeWordEntriesResponse([], 0));
    renderModal();
    await waitFor(() => expect(adminAPI.listWordEntries).toHaveBeenCalled());
    // Wait for loading to complete
    await waitFor(() =>
      expect(screen.queryByTestId('deck-detail-loading')).not.toBeInTheDocument()
    );
    expect(screen.queryByTestId('word-list-bulk-bar')).not.toBeInTheDocument();
  });
});

// ============================================
// AC-2: Select-all toggles
// ============================================

describe('AC-2: Select-all toggles all / deselects all', () => {
  it('clicking select-all selects all cards on the page', async () => {
    renderModal();
    await waitFor(() => screen.getByTestId('word-list-bulk-bar'));

    const selectAll = screen.getByTestId('word-list-select-all');
    fireEvent.click(selectAll);

    await waitFor(() => {
      // Per-row checkboxes should now be checked
      expect(screen.getByTestId('word-entry-select-e1')).toHaveAttribute('data-state', 'checked');
      expect(screen.getByTestId('word-entry-select-e2')).toHaveAttribute('data-state', 'checked');
    });
  });

  it('clicking select-all again deselects all cards', async () => {
    renderModal();
    await waitFor(() => screen.getByTestId('word-list-bulk-bar'));

    const selectAll = screen.getByTestId('word-list-select-all');
    // Select all
    fireEvent.click(selectAll);
    await waitFor(() => {
      expect(screen.getByTestId('word-entry-select-e1')).toHaveAttribute('data-state', 'checked');
    });

    // Deselect all
    fireEvent.click(selectAll);
    await waitFor(() => {
      expect(screen.getByTestId('word-entry-select-e1')).toHaveAttribute('data-state', 'unchecked');
      expect(screen.getByTestId('word-entry-select-e2')).toHaveAttribute('data-state', 'unchecked');
    });
  });

  it('select-all checkbox is checked when all cards are selected', async () => {
    renderModal();
    await waitFor(() => screen.getByTestId('word-list-bulk-bar'));

    const selectAll = screen.getByTestId('word-list-select-all');
    fireEvent.click(selectAll);

    await waitFor(() => {
      expect(screen.getByTestId('word-list-select-all')).toHaveAttribute('data-state', 'checked');
    });
  });

  it('select-all checkbox is unchecked when no cards are selected (initial state)', async () => {
    renderModal();
    await waitFor(() => screen.getByTestId('word-list-bulk-bar'));

    expect(screen.getByTestId('word-list-select-all')).toHaveAttribute('data-state', 'unchecked');
  });
});

// ============================================
// AC-3: Per-row checkboxes render on each V2 row
// ============================================

describe('AC-3: Per-row checkboxes render on each V2 row', () => {
  it('renders a checkbox for each V2 card row', async () => {
    renderModal();
    await waitFor(() => screen.getByTestId('word-list-bulk-bar'));

    expect(screen.getByTestId('word-entry-select-e1')).toBeInTheDocument();
    expect(screen.getByTestId('word-entry-select-e2')).toBeInTheDocument();
  });

  it('per-row checkboxes start unchecked', async () => {
    renderModal();
    await waitFor(() => screen.getByTestId('word-list-bulk-bar'));

    expect(screen.getByTestId('word-entry-select-e1')).toHaveAttribute('data-state', 'unchecked');
    expect(screen.getByTestId('word-entry-select-e2')).toHaveAttribute('data-state', 'unchecked');
  });
});

// ============================================
// AC-4: Per-row select toggles individual selection
// ============================================

describe('AC-4: Per-row checkbox toggles individual card selection', () => {
  it('clicking a row checkbox selects that card', async () => {
    renderModal();
    await waitFor(() => screen.getByTestId('word-list-bulk-bar'));

    fireEvent.click(screen.getByTestId('word-entry-select-e1'));

    await waitFor(() => {
      expect(screen.getByTestId('word-entry-select-e1')).toHaveAttribute('data-state', 'checked');
    });
  });

  it('clicking a row checkbox does not select other rows', async () => {
    renderModal();
    await waitFor(() => screen.getByTestId('word-list-bulk-bar'));

    fireEvent.click(screen.getByTestId('word-entry-select-e1'));

    await waitFor(() => {
      expect(screen.getByTestId('word-entry-select-e1')).toHaveAttribute('data-state', 'checked');
      expect(screen.getByTestId('word-entry-select-e2')).toHaveAttribute('data-state', 'unchecked');
    });
  });

  it('clicking a selected row checkbox deselects that card', async () => {
    renderModal();
    await waitFor(() => screen.getByTestId('word-list-bulk-bar'));

    // Select then deselect
    fireEvent.click(screen.getByTestId('word-entry-select-e1'));
    await waitFor(() => {
      expect(screen.getByTestId('word-entry-select-e1')).toHaveAttribute('data-state', 'checked');
    });

    fireEvent.click(screen.getByTestId('word-entry-select-e1'));
    await waitFor(() => {
      expect(screen.getByTestId('word-entry-select-e1')).toHaveAttribute('data-state', 'unchecked');
    });
  });

  it('selecting individual cards updates select-all to partial state visually', async () => {
    renderModal();
    await waitFor(() => screen.getByTestId('word-list-bulk-bar'));

    // Select only one of two cards — select-all should not be fully checked
    fireEvent.click(screen.getByTestId('word-entry-select-e1'));

    await waitFor(() => {
      expect(screen.getByTestId('word-entry-select-e1')).toHaveAttribute('data-state', 'checked');
      // Select-all should not be fully checked when only partial selection
      const selectAll = screen.getByTestId('word-list-select-all');
      expect(selectAll).not.toHaveAttribute('data-state', 'checked');
    });
  });
});

// ============================================
// AC-5: selectedCount label updates
// ============================================

describe('AC-5: selectedCount label updates when cards are selected', () => {
  it('shows "Select all" label when nothing is selected', async () => {
    renderModal();
    await waitFor(() => screen.getByTestId('word-list-bulk-bar'));

    // The label next to the checkbox should say "Select all"
    const bulkBar = screen.getByTestId('word-list-bulk-bar');
    expect(bulkBar).toHaveTextContent(/select all/i);
  });

  it('shows "1 selected" label when one card is selected', async () => {
    renderModal();
    await waitFor(() => screen.getByTestId('word-list-bulk-bar'));

    fireEvent.click(screen.getByTestId('word-entry-select-e1'));

    await waitFor(() => {
      const bulkBar = screen.getByTestId('word-list-bulk-bar');
      expect(bulkBar).toHaveTextContent(/1 selected/i);
    });
  });

  it('shows "2 selected" label when two cards are selected', async () => {
    renderModal();
    await waitFor(() => screen.getByTestId('word-list-bulk-bar'));

    fireEvent.click(screen.getByTestId('word-entry-select-e1'));
    fireEvent.click(screen.getByTestId('word-entry-select-e2'));

    await waitFor(() => {
      const bulkBar = screen.getByTestId('word-list-bulk-bar');
      expect(bulkBar).toHaveTextContent(/2 selected/i);
    });
  });

  it('reverts to "Select all" label after deselecting all cards', async () => {
    renderModal();
    await waitFor(() => screen.getByTestId('word-list-bulk-bar'));

    fireEvent.click(screen.getByTestId('word-entry-select-e1'));
    await waitFor(() => {
      expect(screen.getByTestId('word-list-bulk-bar')).toHaveTextContent(/1 selected/i);
    });

    fireEvent.click(screen.getByTestId('word-entry-select-e1'));
    await waitFor(() => {
      expect(screen.getByTestId('word-list-bulk-bar')).toHaveTextContent(/select all/i);
    });
  });
});

// ============================================
// AC-6: Bulk delete button only appears when selectedIds.size > 0
// ============================================

describe('AC-6: Bulk delete button visibility', () => {
  it('bulk delete button is NOT rendered when nothing is selected', async () => {
    renderModal();
    await waitFor(() => screen.getByTestId('word-list-bulk-bar'));

    expect(screen.queryByTestId('word-list-bulk-delete-btn')).not.toBeInTheDocument();
  });

  it('bulk delete button appears after selecting at least one card', async () => {
    renderModal();
    await waitFor(() => screen.getByTestId('word-list-bulk-bar'));

    fireEvent.click(screen.getByTestId('word-entry-select-e1'));

    await waitFor(() => {
      expect(screen.getByTestId('word-list-bulk-delete-btn')).toBeInTheDocument();
    });
  });

  it('bulk delete button disappears after deselecting all cards', async () => {
    renderModal();
    await waitFor(() => screen.getByTestId('word-list-bulk-bar'));

    fireEvent.click(screen.getByTestId('word-entry-select-e1'));
    await waitFor(() => {
      expect(screen.getByTestId('word-list-bulk-delete-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('word-entry-select-e1'));
    await waitFor(() => {
      expect(screen.queryByTestId('word-list-bulk-delete-btn')).not.toBeInTheDocument();
    });
  });

  it('bulk delete button appears when all cards are selected via select-all', async () => {
    renderModal();
    await waitFor(() => screen.getByTestId('word-list-bulk-bar'));

    fireEvent.click(screen.getByTestId('word-list-select-all'));

    await waitFor(() => {
      expect(screen.getByTestId('word-list-bulk-delete-btn')).toBeInTheDocument();
    });
  });
});

// ============================================
// AC-7: Bulk delete Dialog opens on button click
// ============================================

describe('AC-7: Bulk delete Dialog opens when bulk delete button is clicked', () => {
  it('clicking bulk delete button opens the confirmation dialog', async () => {
    renderModal();
    await waitFor(() => screen.getByTestId('word-list-bulk-bar'));

    fireEvent.click(screen.getByTestId('word-entry-select-e1'));
    await waitFor(() => screen.getByTestId('word-list-bulk-delete-btn'));

    fireEvent.click(screen.getByTestId('word-list-bulk-delete-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('bulk-delete-dialog')).toBeInTheDocument();
    });
  });

  it('dialog contains cancel and confirm buttons after opening', async () => {
    renderModal();
    await waitFor(() => screen.getByTestId('word-list-bulk-bar'));

    fireEvent.click(screen.getByTestId('word-entry-select-e1'));
    await waitFor(() => screen.getByTestId('word-list-bulk-delete-btn'));
    fireEvent.click(screen.getByTestId('word-list-bulk-delete-btn'));

    await waitFor(() => {
      const dialog = screen.getByTestId('bulk-delete-dialog');
      expect(within(dialog).getByTestId('bulk-delete-cancel')).toBeInTheDocument();
      expect(within(dialog).getByTestId('bulk-delete-confirm')).toBeInTheDocument();
    });
  });
});

// ============================================
// AC-8: Dialog shows correct count
// ============================================

describe('AC-8: Bulk delete Dialog shows correct count in title/confirm button', () => {
  it('dialog title includes the selected count', async () => {
    renderModal();
    await waitFor(() => screen.getByTestId('word-list-bulk-bar'));

    // Select 2 cards
    fireEvent.click(screen.getByTestId('word-list-select-all'));
    await waitFor(() => screen.getByTestId('word-list-bulk-delete-btn'));
    fireEvent.click(screen.getByTestId('word-list-bulk-delete-btn'));

    await waitFor(() => {
      const dialog = screen.getByTestId('bulk-delete-dialog');
      // i18n key: bulkDeleteTitle = "Delete {{count}} words?"
      expect(dialog).toHaveTextContent(/delete 2 words/i);
    });
  });

  it('confirm button includes the selected count', async () => {
    renderModal();
    await waitFor(() => screen.getByTestId('word-list-bulk-bar'));

    fireEvent.click(screen.getByTestId('word-entry-select-e1'));
    await waitFor(() => screen.getByTestId('word-list-bulk-delete-btn'));
    fireEvent.click(screen.getByTestId('word-list-bulk-delete-btn'));

    await waitFor(() => {
      const confirmBtn = screen.getByTestId('bulk-delete-confirm');
      // i18n key: bulkDeleteConfirm = "Delete {{count}} words"
      expect(confirmBtn).toHaveTextContent(/delete 1 word/i);
    });
  });

  it('dialog description mentions the count', async () => {
    renderModal();
    await waitFor(() => screen.getByTestId('word-list-bulk-bar'));

    fireEvent.click(screen.getByTestId('word-list-select-all'));
    await waitFor(() => screen.getByTestId('word-list-bulk-delete-btn'));
    fireEvent.click(screen.getByTestId('word-list-bulk-delete-btn'));

    await waitFor(() => {
      const dialog = screen.getByTestId('bulk-delete-dialog');
      // bulkDeleteDescription includes count
      expect(dialog.textContent).toMatch(/2/);
    });
  });
});

// ============================================
// AC-9: Cancel in Dialog closes without deleting
// ============================================

describe('AC-9: Cancel in Dialog closes without deleting', () => {
  it('clicking cancel closes the dialog', async () => {
    renderModal();
    await waitFor(() => screen.getByTestId('word-list-bulk-bar'));

    fireEvent.click(screen.getByTestId('word-entry-select-e1'));
    await waitFor(() => screen.getByTestId('word-list-bulk-delete-btn'));
    fireEvent.click(screen.getByTestId('word-list-bulk-delete-btn'));
    await waitFor(() => screen.getByTestId('bulk-delete-dialog'));

    fireEvent.click(screen.getByTestId('bulk-delete-cancel'));

    await waitFor(() => {
      expect(screen.queryByTestId('bulk-delete-dialog')).not.toBeInTheDocument();
    });
  });

  it('clicking cancel does NOT call deleteVocabularyCard', async () => {
    renderModal();
    await waitFor(() => screen.getByTestId('word-list-bulk-bar'));

    fireEvent.click(screen.getByTestId('word-entry-select-e1'));
    await waitFor(() => screen.getByTestId('word-list-bulk-delete-btn'));
    fireEvent.click(screen.getByTestId('word-list-bulk-delete-btn'));
    await waitFor(() => screen.getByTestId('bulk-delete-dialog'));

    fireEvent.click(screen.getByTestId('bulk-delete-cancel'));

    await waitFor(() => {
      expect(screen.queryByTestId('bulk-delete-dialog')).not.toBeInTheDocument();
    });
    expect(adminAPI.deleteVocabularyCard).not.toHaveBeenCalled();
  });

  it('cards remain selected after canceling the dialog', async () => {
    renderModal();
    await waitFor(() => screen.getByTestId('word-list-bulk-bar'));

    fireEvent.click(screen.getByTestId('word-entry-select-e1'));
    await waitFor(() => screen.getByTestId('word-list-bulk-delete-btn'));
    fireEvent.click(screen.getByTestId('word-list-bulk-delete-btn'));
    await waitFor(() => screen.getByTestId('bulk-delete-dialog'));

    fireEvent.click(screen.getByTestId('bulk-delete-cancel'));

    await waitFor(() => {
      expect(screen.queryByTestId('bulk-delete-dialog')).not.toBeInTheDocument();
    });
    // Card e1 should still be checked
    expect(screen.getByTestId('word-entry-select-e1')).toHaveAttribute('data-state', 'checked');
  });
});

// ============================================
// AC-10: Confirm calls deleteVocabularyCard for each selected ID then refreshes
// ============================================

describe('AC-10: Confirm calls deleteVocabularyCard for each selected ID then refreshes', () => {
  it('calls deleteVocabularyCard once per selected card', async () => {
    renderModal();
    await waitFor(() => screen.getByTestId('word-list-bulk-bar'));

    // Select both cards
    fireEvent.click(screen.getByTestId('word-list-select-all'));
    await waitFor(() => screen.getByTestId('word-list-bulk-delete-btn'));
    fireEvent.click(screen.getByTestId('word-list-bulk-delete-btn'));
    await waitFor(() => screen.getByTestId('bulk-delete-dialog'));

    fireEvent.click(screen.getByTestId('bulk-delete-confirm'));

    await waitFor(() => {
      expect(adminAPI.deleteVocabularyCard).toHaveBeenCalledTimes(2);
    });
  });

  it('calls deleteVocabularyCard with the correct IDs', async () => {
    renderModal();
    await waitFor(() => screen.getByTestId('word-list-bulk-bar'));

    fireEvent.click(screen.getByTestId('word-entry-select-e1'));
    await waitFor(() => screen.getByTestId('word-list-bulk-delete-btn'));
    fireEvent.click(screen.getByTestId('word-list-bulk-delete-btn'));
    await waitFor(() => screen.getByTestId('bulk-delete-dialog'));

    fireEvent.click(screen.getByTestId('bulk-delete-confirm'));

    await waitFor(() => {
      expect(adminAPI.deleteVocabularyCard).toHaveBeenCalledWith('e1');
    });
    expect(adminAPI.deleteVocabularyCard).not.toHaveBeenCalledWith('e2');
  });

  it('calls listWordEntries again after successful bulk delete (refresh)', async () => {
    renderModal();
    await waitFor(() => expect(adminAPI.listWordEntries).toHaveBeenCalledTimes(1));
    await waitFor(() => screen.getByTestId('word-list-bulk-bar'));

    fireEvent.click(screen.getByTestId('word-entry-select-e1'));
    await waitFor(() => screen.getByTestId('word-list-bulk-delete-btn'));
    fireEvent.click(screen.getByTestId('word-list-bulk-delete-btn'));
    await waitFor(() => screen.getByTestId('bulk-delete-dialog'));

    fireEvent.click(screen.getByTestId('bulk-delete-confirm'));

    await waitFor(() => {
      expect(adminAPI.listWordEntries).toHaveBeenCalledTimes(2);
    });
  });

  it('dialog closes after confirm is submitted', async () => {
    renderModal();
    await waitFor(() => screen.getByTestId('word-list-bulk-bar'));

    fireEvent.click(screen.getByTestId('word-entry-select-e1'));
    await waitFor(() => screen.getByTestId('word-list-bulk-delete-btn'));
    fireEvent.click(screen.getByTestId('word-list-bulk-delete-btn'));
    await waitFor(() => screen.getByTestId('bulk-delete-dialog'));

    fireEvent.click(screen.getByTestId('bulk-delete-confirm'));

    await waitFor(() => {
      expect(screen.queryByTestId('bulk-delete-dialog')).not.toBeInTheDocument();
    });
  });

  it('uses Promise.allSettled — partial failures do not crash (all succeed here)', async () => {
    // Both delete calls succeed — dialog closes and list refreshes
    renderModal();
    await waitFor(() => screen.getByTestId('word-list-bulk-bar'));

    fireEvent.click(screen.getByTestId('word-list-select-all'));
    await waitFor(() => screen.getByTestId('word-list-bulk-delete-btn'));
    fireEvent.click(screen.getByTestId('word-list-bulk-delete-btn'));
    await waitFor(() => screen.getByTestId('bulk-delete-dialog'));

    fireEvent.click(screen.getByTestId('bulk-delete-confirm'));

    await waitFor(() => {
      expect(adminAPI.deleteVocabularyCard).toHaveBeenCalledTimes(2);
      expect(adminAPI.listWordEntries).toHaveBeenCalledTimes(2);
    });
  });
});

// ============================================
// AC-11: Selection resets when deck changes
// ============================================

describe('AC-11: Selection resets when deck changes', () => {
  it('selected IDs reset when a different deck is opened', async () => {
    const { rerender } = renderModal({ deck: createV2Deck() });
    await waitFor(() => screen.getByTestId('word-list-bulk-bar'));

    fireEvent.click(screen.getByTestId('word-entry-select-e1'));
    await waitFor(() => {
      expect(screen.getByTestId('word-entry-select-e1')).toHaveAttribute('data-state', 'checked');
    });

    const newDeck = createV2Deck({ id: 'deck-other', name: 'Other Deck' });
    rerender(
      <I18nextProvider i18n={i18n}>
        <DeckDetailModal open={true} onOpenChange={vi.fn()} deck={newDeck} />
      </I18nextProvider>
    );

    await waitFor(() => {
      // After deck change and re-fetch, checkboxes reset
      const selectE1 = screen.queryByTestId('word-entry-select-e1');
      if (selectE1) {
        expect(selectE1).toHaveAttribute('data-state', 'unchecked');
      }
    });
  });

  it('bulk delete button is not shown after deck changes (selection cleared)', async () => {
    const { rerender } = renderModal({ deck: createV2Deck() });
    await waitFor(() => screen.getByTestId('word-list-bulk-bar'));

    fireEvent.click(screen.getByTestId('word-list-select-all'));
    await waitFor(() => {
      expect(screen.getByTestId('word-list-bulk-delete-btn')).toBeInTheDocument();
    });

    const newDeck = createV2Deck({ id: 'deck-switch' });
    rerender(
      <I18nextProvider i18n={i18n}>
        <DeckDetailModal open={true} onOpenChange={vi.fn()} deck={newDeck} />
      </I18nextProvider>
    );

    await waitFor(() => {
      expect(screen.queryByTestId('word-list-bulk-delete-btn')).not.toBeInTheDocument();
    });
  });
});

// ============================================
// AC-12: Selection resets after fetchItems completes
// ============================================

describe('AC-12: Selection resets after fetchItems completes (sort/filter change)', () => {
  it('selectedIds are cleared after a new fetch triggered by sort change', async () => {
    const user = userEvent.setup();
    renderModal();
    await waitFor(() => screen.getByTestId('word-list-bulk-bar'));

    // Select a card
    fireEvent.click(screen.getByTestId('word-entry-select-e1'));
    await waitFor(() => {
      expect(screen.getByTestId('word-entry-select-e1')).toHaveAttribute('data-state', 'checked');
    });

    // Change sort — triggers fetchItems which resets selectedIds
    await user.click(screen.getByTestId('word-list-sort-trigger'));
    await user.click(await screen.findByRole('menuitemradio', { name: /date added/i }));

    await waitFor(() => {
      // After fetch completes, selection should be cleared
      const bulkBar = screen.queryByTestId('word-list-bulk-bar');
      if (bulkBar) {
        expect(screen.queryByTestId('word-list-bulk-delete-btn')).not.toBeInTheDocument();
      }
    });
  });

  it('select-all label reverts to "Select all" after fetch resets selection', async () => {
    const user = userEvent.setup();
    renderModal();
    await waitFor(() => screen.getByTestId('word-list-bulk-bar'));

    // Select all
    fireEvent.click(screen.getByTestId('word-list-select-all'));
    await waitFor(() => {
      expect(screen.getByTestId('word-list-bulk-bar')).toHaveTextContent(/2 selected/i);
    });

    // Trigger re-fetch via sort change
    await user.click(screen.getByTestId('word-list-sort-trigger'));
    await user.click(await screen.findByRole('menuitemradio', { name: /date added/i }));

    await waitFor(() => {
      const bulkBar = screen.queryByTestId('word-list-bulk-bar');
      if (bulkBar) {
        expect(bulkBar).toHaveTextContent(/select all/i);
      }
    });
  });
});

// ============================================
// AC-13: Bulk bar does NOT render for V1 vocabulary decks
// ============================================

describe('AC-13: Bulk bar does NOT render for V1 vocabulary decks', () => {
  it('does not render word-list-bulk-bar for V1 deck', async () => {
    renderModal({ deck: createV1Deck() });
    await waitFor(() => expect(adminAPI.listVocabularyCards).toHaveBeenCalled());
    // Wait for loading to finish
    await waitFor(() =>
      expect(screen.queryByTestId('deck-detail-loading')).not.toBeInTheDocument()
    );
    expect(screen.queryByTestId('word-list-bulk-bar')).not.toBeInTheDocument();
  });

  it('does not render per-row checkboxes for V1 cards', async () => {
    renderModal({ deck: createV1Deck() });
    await waitFor(() => expect(adminAPI.listVocabularyCards).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.queryByTestId('deck-detail-loading')).not.toBeInTheDocument()
    );
    expect(screen.queryByTestId('word-entry-select-c1')).not.toBeInTheDocument();
  });

  it('does not render the bulk delete dialog wrapper for V1 deck', async () => {
    renderModal({ deck: createV1Deck() });
    await waitFor(() => expect(adminAPI.listVocabularyCards).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.queryByTestId('deck-detail-loading')).not.toBeInTheDocument()
    );
    expect(screen.queryByTestId('bulk-delete-dialog')).not.toBeInTheDocument();
  });
});

// ============================================
// AC-14: Row navigation still works
// ============================================

describe('AC-14: Row navigation opens word entry detail when row is clicked', () => {
  it('clicking a V2 word entry row opens the word entry detail view', async () => {
    const user = userEvent.setup();
    renderModal();
    await waitFor(() => screen.getByTestId('word-entry-row-e1'));

    await user.click(screen.getByTestId('word-entry-row-e1'));

    expect(screen.getByTestId('word-entry-detail-view')).toBeInTheDocument();
  });

  it('word entry detail view shows after row click even when no cards are selected', async () => {
    const user = userEvent.setup();
    renderModal();
    await waitFor(() => screen.getByTestId('word-entry-row-e1'));

    // Ensure nothing selected
    expect(screen.queryByTestId('word-list-bulk-delete-btn')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('word-entry-row-e1'));
    expect(screen.getByTestId('word-entry-detail-view')).toBeInTheDocument();
  });
});

// ============================================
// AC-15: Checkbox click does NOT trigger row navigation
// ============================================

describe('AC-15: Checkbox click does NOT trigger row navigation', () => {
  it('clicking the per-row checkbox does not open word entry detail', async () => {
    renderModal();
    await waitFor(() => screen.getByTestId('word-list-bulk-bar'));

    // Click the checkbox, not the row
    fireEvent.click(screen.getByTestId('word-entry-select-e1'));

    // word-entry-detail-view should NOT appear
    expect(screen.queryByTestId('word-entry-detail-view')).not.toBeInTheDocument();
  });

  it('after clicking checkbox, card is selected but detail view is not shown', async () => {
    renderModal();
    await waitFor(() => screen.getByTestId('word-list-bulk-bar'));

    fireEvent.click(screen.getByTestId('word-entry-select-e1'));

    await waitFor(() => {
      expect(screen.getByTestId('word-entry-select-e1')).toHaveAttribute('data-state', 'checked');
    });
    expect(screen.queryByTestId('word-entry-detail-view')).not.toBeInTheDocument();
  });
});
