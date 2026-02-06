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

import { WordGrid, WordGridSkeleton } from '../WordGrid';

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
    cefr_level: 'A1',
    translation_en: 'test translation',
    translation_ru: 'test russian',
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
    cefr_level: 'A2',
    translation_en: 'another translation',
    translation_ru: null,
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
    cefr_level: 'B1',
    translation_en: 'third translation',
    translation_ru: null,
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
        gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
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

      const dots = screen.getByTestId('word-card-mastery-dots');
      expect(dots).toBeInTheDocument();
      // Should have 5 dots
      expect(dots.children).toHaveLength(5);
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
      gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
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
