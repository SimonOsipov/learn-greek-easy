/**
 * WordGrid Component Tests
 *
 * Tests for the WordGrid and WordGridSkeleton components, covering:
 * - Responsive grid layout
 * - Correct number of cards rendered
 * - Loading skeleton
 *
 * Note: Individual WordCard tests are in components/__tests__/WordCard.test.tsx
 */

import React from 'react';

import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect } from 'vitest';

import type { WordEntryResponse } from '@/services/wordEntryAPI';

import { WordGrid, WordGridSkeleton, isWideCard } from '../WordGrid';

/**
 * Helper to render WordGrid within a router context
 */
function renderWithRouter(entries: WordEntryResponse[], deckId: string = 'deck-1') {
  return render(
    <MemoryRouter initialEntries={[`/decks/${deckId}`]}>
      <Routes>
        <Route path="/decks/:id" element={<WordGrid entries={entries} />} />
      </Routes>
    </MemoryRouter>
  );
}

// Mock word entries data
const mockWordEntries: WordEntryResponse[] = [
  {
    id: '1',
    deck_id: 'deck-1',
    lemma: 'test',
    part_of_speech: 'NOUN',
    translation_en: 'test translation',
    translation_en_plural: null,
    translation_ru: 'test russian',
    translation_ru_plural: null,
    pronunciation: 'tehst',
    grammar_data: null,
    examples: null,
    audio_key: null,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    deck_id: 'deck-1',
    lemma: 'another',
    part_of_speech: 'VERB',
    translation_en: 'another translation',
    translation_en_plural: null,
    translation_ru: null,
    translation_ru_plural: null,
    pronunciation: null,
    grammar_data: null,
    examples: null,
    audio_key: 'audio-key',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '3',
    deck_id: 'deck-1',
    lemma: 'third',
    part_of_speech: 'ADJECTIVE',
    translation_en: 'third translation',
    translation_en_plural: null,
    translation_ru: null,
    translation_ru_plural: null,
    pronunciation: 'thrd',
    grammar_data: null,
    examples: null,
    audio_key: null,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
];

describe('WordGrid Component', () => {
  describe('Grid Layout', () => {
    it('should render grid container with test id', () => {
      renderWithRouter(mockWordEntries);
      expect(screen.getByTestId('word-grid')).toBeInTheDocument();
    });

    it('should have responsive grid styles', () => {
      renderWithRouter(mockWordEntries);
      const grid = screen.getByTestId('word-grid');

      // Check for grid class
      expect(grid).toHaveClass('grid');
      expect(grid).toHaveClass('gap-4');

      // Check for responsive grid template
      expect(grid).toHaveStyle({
        gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
      });
    });

    it('should render correct number of word cards', () => {
      renderWithRouter(mockWordEntries);

      // WordCard uses data-testid="word-card" for each card
      const cards = screen.getAllByTestId('word-card');
      expect(cards).toHaveLength(3);
    });

    it('should render empty grid when no entries', () => {
      renderWithRouter([]);
      const grid = screen.getByTestId('word-grid');

      expect(grid).toBeInTheDocument();
      expect(grid.children).toHaveLength(0);
    });

    it('should have dense grid auto flow', () => {
      renderWithRouter(mockWordEntries);
      const grid = screen.getByTestId('word-grid');
      expect(grid).toHaveStyle({ gridAutoFlow: 'dense' });
    });
  });

  describe('WordCard - Content Display', () => {
    it('should display lemma prominently', () => {
      renderWithRouter([mockWordEntries[0]]);

      // Lemma should be in an h3 heading using word-card-lemma testid
      const lemma = screen.getByTestId('word-card-lemma');
      expect(lemma).toHaveTextContent('test');
      expect(lemma.tagName).toBe('H3');
    });

    it('should display pronunciation when available', () => {
      renderWithRouter([mockWordEntries[0]]);

      // Pronunciation is displayed without brackets in standalone WordCard
      const pronunciation = screen.getByTestId('word-card-pronunciation');
      expect(pronunciation).toHaveTextContent('tehst');
    });

    it('should not display pronunciation when not available', () => {
      renderWithRouter([mockWordEntries[1]]);

      // Entry 2 has no pronunciation
      expect(screen.queryByTestId('word-card-pronunciation')).not.toBeInTheDocument();
    });

    it('should display English translation', () => {
      renderWithRouter([mockWordEntries[0]]);

      const translation = screen.getByTestId('word-card-translation');
      expect(translation).toHaveTextContent('test translation');
    });

    it('should display all entries with translations', () => {
      renderWithRouter(mockWordEntries);

      // Each entry should have its translation visible
      expect(screen.getByText('test translation')).toBeInTheDocument();
      expect(screen.getByText('another translation')).toBeInTheDocument();
      expect(screen.getByText('third translation')).toBeInTheDocument();
    });
  });

  describe('WordCard - Mastery Indicators', () => {
    it('should render mastery indicator for each card', () => {
      renderWithRouter([mockWordEntries[0]]);

      const indicator = screen.getByTestId('word-card-mastery-indicator');
      expect(indicator).toBeInTheDocument();
    });

    it('should render mastery dots for each card', () => {
      renderWithRouter([mockWordEntries[0]]);

      const dots = screen.getByTestId('mastery-dots');
      expect(dots).toBeInTheDocument();
      // Should have 4 dots
      expect(dots.children).toHaveLength(4);
    });
  });

  describe('WordCard - Accessibility', () => {
    it('should have aria-label on each card', () => {
      renderWithRouter([mockWordEntries[0]]);

      const card = screen.getByTestId('word-card');
      expect(card).toHaveAttribute('aria-label', 'test - test translation');
    });
  });
});

describe('isWideCard', () => {
  const makeEntry = (overrides: Partial<WordEntryResponse>): WordEntryResponse => ({
    ...mockWordEntries[0],
    ...overrides,
  });

  describe('lemma threshold (>12)', () => {
    it('should return false for short lemmas', () => {
      expect(isWideCard(makeEntry({ lemma: 'σπίτι' }))).toBe(false); // 5 chars
      expect(isWideCard(makeEntry({ lemma: 'γείτονας' }))).toBe(false); // 8 chars
    });

    it('should return false at the boundary (12 chars)', () => {
      expect(isWideCard(makeEntry({ lemma: 'αρραβωνιαστι' }))).toBe(false);
    });

    it('should return true above the boundary (>12 chars)', () => {
      expect(isWideCard(makeEntry({ lemma: 'αρραβωνιαστικ' }))).toBe(true); // 13
      expect(isWideCard(makeEntry({ lemma: 'αρραβωνιαστικιά' }))).toBe(true); // 15
    });
  });

  describe('translation threshold (>17)', () => {
    it('should return false for short translations', () => {
      expect(isWideCard(makeEntry({ translation_en: 'aunt' }))).toBe(false);
      expect(isWideCard(makeEntry({ translation_en: 'sister-in-law' }))).toBe(false); // 13
    });

    it('should return false at the boundary (17 chars)', () => {
      expect(isWideCard(makeEntry({ translation_en: '12345678901234567' }))).toBe(false);
    });

    it('should return true for long EN translation', () => {
      expect(isWideCard(makeEntry({ translation_en: 'baptism, baptizing, christening' }))).toBe(
        true
      ); // 31
      expect(isWideCard(makeEntry({ translation_en: 'friend, boyfriend, acquaintance' }))).toBe(
        true
      ); // 31
    });

    it('should return true for long RU translation', () => {
      expect(
        isWideCard(
          makeEntry({
            translation_en: 'short',
            translation_ru: 'очень длинный русский перевод слова',
          })
        )
      ).toBe(true);
    });

    it('should return false when RU translation is null', () => {
      expect(isWideCard(makeEntry({ translation_en: 'short', translation_ru: null }))).toBe(false);
    });
  });

  it('should return true when both lemma and translation are long', () => {
    expect(
      isWideCard(
        makeEntry({ lemma: 'αρραβωνιαστικιά', translation_en: 'baptism, baptizing, christening' })
      )
    ).toBe(true);
  });
});

describe('WordGrid - Wide Cards', () => {
  const longLemmaEntry: WordEntryResponse = {
    ...mockWordEntries[0],
    id: 'long-1',
    lemma: 'αρραβωνιαστικιά', // 15 chars
  };

  const longTranslationEntry: WordEntryResponse = {
    ...mockWordEntries[0],
    id: 'long-2',
    lemma: 'βάφτιση',
    translation_en: 'baptism, baptizing, christening', // 31 chars
  };

  it('should apply gridColumn span 2 for long lemma cards', () => {
    renderWithRouter([longLemmaEntry]);
    const grid = screen.getByTestId('word-grid');
    const wrapper = grid.firstElementChild as HTMLElement;
    expect(wrapper.style.gridColumn).toBe('span 2');
  });

  it('should apply gridColumn span 2 for long translation cards', () => {
    renderWithRouter([longTranslationEntry]);
    const grid = screen.getByTestId('word-grid');
    const wrapper = grid.firstElementChild as HTMLElement;
    expect(wrapper.style.gridColumn).toBe('span 2');
  });

  it('should not apply gridColumn for short cards', () => {
    renderWithRouter([mockWordEntries[0]]);
    const grid = screen.getByTestId('word-grid');
    const wrapper = grid.firstElementChild as HTMLElement;
    expect(wrapper.style.gridColumn).toBe('');
  });

  it('should apply span only to wide cards in mixed entries', () => {
    renderWithRouter([
      mockWordEntries[0],
      longLemmaEntry,
      mockWordEntries[1],
      longTranslationEntry,
    ]);
    const grid = screen.getByTestId('word-grid');
    const wrappers = Array.from(grid.children) as HTMLElement[];

    expect(wrappers[0].style.gridColumn).toBe(''); // 'test' - short
    expect(wrappers[1].style.gridColumn).toBe('span 2'); // long lemma
    expect(wrappers[2].style.gridColumn).toBe('span 2'); // 'another translation' = 19 chars > 17
    expect(wrappers[3].style.gridColumn).toBe('span 2'); // long translation
  });
});

describe('WordGridSkeleton Component', () => {
  it('should render skeleton with test id', () => {
    render(<WordGridSkeleton />);
    expect(screen.getByTestId('word-grid-skeleton')).toBeInTheDocument();
  });

  it('should render default 12 skeleton cards', () => {
    render(<WordGridSkeleton />);
    const skeleton = screen.getByTestId('word-grid-skeleton');

    expect(skeleton.children).toHaveLength(12);
  });

  it('should render custom count of skeleton cards', () => {
    render(<WordGridSkeleton count={6} />);
    const skeleton = screen.getByTestId('word-grid-skeleton');

    expect(skeleton.children).toHaveLength(6);
  });

  it('should have same responsive grid styles as WordGrid', () => {
    render(<WordGridSkeleton />);
    const skeleton = screen.getByTestId('word-grid-skeleton');

    expect(skeleton).toHaveClass('grid');
    expect(skeleton).toHaveClass('gap-4');
    expect(skeleton).toHaveStyle({
      gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
    });
  });

  it('should render skeleton placeholders for each card field', () => {
    render(<WordGridSkeleton count={1} />);
    const skeleton = screen.getByTestId('word-grid-skeleton');

    // Should have a Card with skeleton elements
    const card = skeleton.firstChild;
    expect(card).toBeInTheDocument();

    // Card should contain Skeleton elements (they have skeleton class)
    const skeletonElements = skeleton.querySelectorAll('[class*="animate-pulse"]');
    // Note: Skeleton components use animate-pulse or similar - check for multiple elements
    expect(card?.childNodes.length).toBeGreaterThan(0);
  });
});
