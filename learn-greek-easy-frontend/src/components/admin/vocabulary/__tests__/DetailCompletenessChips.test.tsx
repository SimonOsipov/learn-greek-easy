/**
 * Tests for DetailCompletenessChips component (ADMINUX-08-01)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { DetailCompletenessChips } from '../DetailCompletenessChips';
import type { AdminVocabularyCard } from '@/services/adminAPI';

// ============================================
// Factory Function
// ============================================

const createCard = (overrides?: Partial<AdminVocabularyCard>): AdminVocabularyCard => ({
  id: 'card-1',
  deck_id: 'deck-v2',
  front_text: 'μητέρα',
  back_text_en: 'mother',
  back_text_ru: 'мать',
  example_sentence: null,
  pronunciation: '/mi*te*ra/',
  part_of_speech: 'noun',
  level: 'A1',
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
  gender: 'feminine',
  has_examples: true,
  has_audio: true,
  has_grammar: true,
  translation_en_plural: 'mothers',
  translation_ru_plural: 'матери',
  audio_status: 'ready',
  grammar_filled: 9,
  grammar_total: 9,
  example_count: 2,
  examples_with_en: 2,
  examples_with_ru: 2,
  examples_with_audio: 2,
  ...overrides,
});

// ============================================
// Helpers
// ============================================

function renderChips(card: AdminVocabularyCard, activeTab = 'entry', onEnsureEntryTab = vi.fn()) {
  return render(
    <DetailCompletenessChips
      card={card}
      activeTab={activeTab}
      onEnsureEntryTab={onEnsureEntryTab}
    />
  );
}

// ============================================
// Tests
// ============================================

describe('DetailCompletenessChips', () => {
  beforeEach(() => {
    // Mock getElementById / scrollIntoView
    const mockScrollIntoView = vi.fn();
    const mockGetElementById = vi.fn().mockReturnValue({ scrollIntoView: mockScrollIntoView });
    vi.spyOn(document, 'getElementById').mockImplementation(mockGetElementById);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('rendering', () => {
    it('renders chips for a fully-enriched noun (6 chips)', () => {
      renderChips(createCard());
      // EN, RU, Pron, Audio, Gram, Ex
      expect(screen.getByTitle(/English:/)).toBeInTheDocument();
      expect(screen.getByTitle(/Russian:/)).toBeInTheDocument();
      expect(screen.getByTitle(/Pronunciation/)).toBeInTheDocument();
      expect(screen.getByTitle(/Audio:/)).toBeInTheDocument();
      expect(screen.getByTitle(/Grammar:/)).toBeInTheDocument();
      expect(screen.getByTitle(/Examples:/)).toBeInTheDocument();
    });

    it('renders 5 chips for a phrase (grammar chip hidden)', () => {
      renderChips(createCard({ grammar_total: 0, grammar_filled: 0 }));
      expect(screen.queryByTitle(/Grammar:/)).not.toBeInTheDocument();
    });

    it('chips are rendered as buttons', () => {
      renderChips(createCard());
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('click behavior when activeTab is "entry"', () => {
    it('does not call onEnsureEntryTab when already on entry tab', () => {
      const onEnsureEntryTab = vi.fn();
      renderChips(createCard(), 'entry', onEnsureEntryTab);
      fireEvent.click(screen.getByTitle(/English:/));
      expect(onEnsureEntryTab).not.toHaveBeenCalled();
    });

    it('calls scrollIntoView with section-en when EN chip clicked', () => {
      const mockScrollIntoView = vi.fn();
      vi.spyOn(document, 'getElementById').mockReturnValue({
        scrollIntoView: mockScrollIntoView,
      } as unknown as HTMLElement);

      renderChips(createCard(), 'entry');
      fireEvent.click(screen.getByTitle(/English:/));
      expect(document.getElementById).toHaveBeenCalledWith('section-en');
      expect(mockScrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    });
  });

  describe('cross-tab click behavior', () => {
    it('calls onEnsureEntryTab when activeTab is not "entry"', () => {
      const onEnsureEntryTab = vi.fn();
      renderChips(createCard(), 'cards', onEnsureEntryTab);
      fireEvent.click(screen.getByTitle(/English:/));
      expect(onEnsureEntryTab).toHaveBeenCalledOnce();
    });

    it('calls scrollIntoView after 100ms timeout when cross-tab click', async () => {
      vi.useFakeTimers();
      const mockScrollIntoView = vi.fn();
      vi.spyOn(document, 'getElementById').mockReturnValue({
        scrollIntoView: mockScrollIntoView,
      } as unknown as HTMLElement);

      const onEnsureEntryTab = vi.fn();
      renderChips(createCard(), 'cards', onEnsureEntryTab);
      fireEvent.click(screen.getByTitle(/English:/));

      // Before timeout fires, scrollIntoView should not have been called
      expect(mockScrollIntoView).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);
      expect(document.getElementById).toHaveBeenCalledWith('section-en');
      expect(mockScrollIntoView).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });
});
