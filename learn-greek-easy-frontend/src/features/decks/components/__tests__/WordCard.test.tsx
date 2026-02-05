/**
 * WordCard Component Tests
 *
 * Tests for the WordCard and WordCardSkeleton components, covering:
 * - Display of lemma, pronunciation, translation
 * - Mastery indicator and dots rendering
 * - Click handler and keyboard navigation
 * - Accessibility attributes (role, tabIndex, aria-label)
 * - Skeleton loading state
 * - Missing pronunciation handling
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import type { WordEntryResponse } from '@/services/wordEntryAPI';

import { WordCard, WordCardSkeleton } from '../WordCard';

// Mock word entry data
const mockWordEntry: WordEntryResponse = {
  id: 'test-word-id',
  deck_id: 'test-deck-id',
  lemma: 'μιλάω',
  part_of_speech: 'VERB',
  cefr_level: 'A1',
  translation_en: 'to speak, to talk',
  translation_ru: 'говорить',
  pronunciation: 'miláo',
  grammar_data: null,
  examples: null,
  audio_key: null,
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

describe('WordCard', () => {
  describe('Content Display', () => {
    it('renders lemma correctly', () => {
      render(<WordCard wordEntry={mockWordEntry} />);

      const lemma = screen.getByTestId('word-card-lemma');
      expect(lemma).toHaveTextContent('μιλάω');
      expect(lemma.tagName).toBe('H3');
    });

    it('renders pronunciation when available', () => {
      render(<WordCard wordEntry={mockWordEntry} />);

      const pronunciation = screen.getByTestId('word-card-pronunciation');
      expect(pronunciation).toHaveTextContent('miláo');
      expect(pronunciation).toHaveClass('italic');
    });

    it('renders translation correctly', () => {
      render(<WordCard wordEntry={mockWordEntry} />);

      const translation = screen.getByTestId('word-card-translation');
      expect(translation).toHaveTextContent('to speak, to talk');
    });

    it('does not render pronunciation when not provided', () => {
      const entryNoPronunciation = { ...mockWordEntry, pronunciation: null };
      render(<WordCard wordEntry={entryNoPronunciation} />);

      expect(screen.queryByTestId('word-card-pronunciation')).not.toBeInTheDocument();
    });
  });

  describe('Mastery Indicators', () => {
    it('renders mastery indicator (top-right dot)', () => {
      render(<WordCard wordEntry={mockWordEntry} />);

      const indicator = screen.getByTestId('word-card-mastery-indicator');
      expect(indicator).toBeInTheDocument();
      expect(indicator).toHaveAttribute('aria-label', 'Mastery level: 0 of 5');
    });

    it('renders mastery dots (bottom row)', () => {
      render(<WordCard wordEntry={mockWordEntry} />);

      const dots = screen.getByTestId('word-card-mastery-dots');
      expect(dots).toBeInTheDocument();
      expect(dots).toHaveAttribute('aria-label', 'Progress: 0 of 5');
      // Should have 5 dots
      expect(dots.children).toHaveLength(5);
    });
  });

  describe('Click Handler', () => {
    it('calls onClick when card is clicked', () => {
      const handleClick = vi.fn();
      render(<WordCard wordEntry={mockWordEntry} onClick={handleClick} />);

      const card = screen.getByTestId('word-card');
      fireEvent.click(card);

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('does not call onClick when no handler provided', () => {
      render(<WordCard wordEntry={mockWordEntry} />);

      const card = screen.getByTestId('word-card');
      // Should not throw
      fireEvent.click(card);
    });

    it('has cursor-pointer class when clickable', () => {
      const handleClick = vi.fn();
      render(<WordCard wordEntry={mockWordEntry} onClick={handleClick} />);

      const card = screen.getByTestId('word-card');
      expect(card).toHaveClass('cursor-pointer');
    });

    it('does not have cursor-pointer class when not clickable', () => {
      render(<WordCard wordEntry={mockWordEntry} />);

      const card = screen.getByTestId('word-card');
      expect(card).not.toHaveClass('cursor-pointer');
    });
  });

  describe('Keyboard Navigation', () => {
    it('calls onClick when Enter key is pressed', () => {
      const handleClick = vi.fn();
      render(<WordCard wordEntry={mockWordEntry} onClick={handleClick} />);

      const card = screen.getByTestId('word-card');
      fireEvent.keyDown(card, { key: 'Enter' });

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('calls onClick when Space key is pressed', () => {
      const handleClick = vi.fn();
      render(<WordCard wordEntry={mockWordEntry} onClick={handleClick} />);

      const card = screen.getByTestId('word-card');
      fireEvent.keyDown(card, { key: ' ' });

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('does not call onClick for other keys', () => {
      const handleClick = vi.fn();
      render(<WordCard wordEntry={mockWordEntry} onClick={handleClick} />);

      const card = screen.getByTestId('word-card');
      fireEvent.keyDown(card, { key: 'Tab' });
      fireEvent.keyDown(card, { key: 'Escape' });

      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has role="button" when clickable', () => {
      const handleClick = vi.fn();
      render(<WordCard wordEntry={mockWordEntry} onClick={handleClick} />);

      const card = screen.getByTestId('word-card');
      expect(card).toHaveAttribute('role', 'button');
    });

    it('does not have role when not clickable', () => {
      render(<WordCard wordEntry={mockWordEntry} />);

      const card = screen.getByTestId('word-card');
      expect(card).not.toHaveAttribute('role');
    });

    it('has tabIndex=0 when clickable', () => {
      const handleClick = vi.fn();
      render(<WordCard wordEntry={mockWordEntry} onClick={handleClick} />);

      const card = screen.getByTestId('word-card');
      expect(card).toHaveAttribute('tabIndex', '0');
    });

    it('does not have tabIndex when not clickable', () => {
      render(<WordCard wordEntry={mockWordEntry} />);

      const card = screen.getByTestId('word-card');
      expect(card).not.toHaveAttribute('tabIndex');
    });

    it('has aria-label with lemma and translation', () => {
      render(<WordCard wordEntry={mockWordEntry} />);

      const card = screen.getByTestId('word-card');
      expect(card).toHaveAttribute('aria-label', 'μιλάω - to speak, to talk');
    });
  });

  describe('Loading State', () => {
    it('renders skeleton when loading is true', () => {
      render(<WordCard wordEntry={mockWordEntry} loading />);

      expect(screen.getByTestId('word-card-skeleton')).toBeInTheDocument();
      expect(screen.queryByTestId('word-card')).not.toBeInTheDocument();
    });

    it('renders card when loading is false', () => {
      render(<WordCard wordEntry={mockWordEntry} loading={false} />);

      expect(screen.getByTestId('word-card')).toBeInTheDocument();
      expect(screen.queryByTestId('word-card-skeleton')).not.toBeInTheDocument();
    });
  });
});

describe('WordCardSkeleton', () => {
  it('renders skeleton with test id', () => {
    render(<WordCardSkeleton />);

    expect(screen.getByTestId('word-card-skeleton')).toBeInTheDocument();
  });

  it('renders skeleton placeholder elements', () => {
    render(<WordCardSkeleton />);

    const skeleton = screen.getByTestId('word-card-skeleton');
    // Should contain skeleton elements (divs with animate-pulse class)
    const skeletonElements = skeleton.querySelectorAll('[class*="animate-pulse"]');
    expect(skeletonElements.length).toBeGreaterThan(0);
  });

  it('renders 5 mastery dot skeletons', () => {
    render(<WordCardSkeleton />);

    const skeleton = screen.getByTestId('word-card-skeleton');
    // Find the container with the dot skeletons (the one with gap-1)
    const dotsContainer = skeleton.querySelector('.flex.gap-1.pt-2');
    expect(dotsContainer).toBeInTheDocument();
    expect(dotsContainer?.children).toHaveLength(5);
  });
});
