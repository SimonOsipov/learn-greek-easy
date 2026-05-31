/**
 * DeckProgressBar Component Tests
 *
 * Tests for the DeckProgressBar component:
 * - Three percentage segments from raw counts (2/3/5/10 -> 20%/30%/50%)
 * - total=0 -> 0% segments, no error, no NaN in aria
 * - aria-valuenow / aria-valuemax validity (no NaN ratio at total=0)
 * - Legend visibility (showLegend true/false)
 * - Size variants (default h-2, large h-3)
 */

import React from 'react';

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';

import { DeckProgressBar } from '../DeckProgressBar';
import type { DeckProgress } from '@/types/deck';
import i18n from '@/i18n';

// ── Helpers ──────────────────────────────────────────────────────────────────

const makeProgress = (
  cardsNew: number,
  cardsLearning: number,
  cardsMastered: number
): DeckProgress => ({
  deckId: 'test-deck',
  status: 'in-progress',
  cardsTotal: cardsNew + cardsLearning + cardsMastered,
  cardsNew,
  cardsLearning,
  cardsReview: 0,
  cardsMastered,
  dueToday: 0,
  streak: 0,
  totalTimeSpent: 0,
  accuracy: 0,
});

const renderWithI18n = (ui: React.ReactElement) =>
  render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);

const getProgressbar = () => screen.getByRole('progressbar');

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('DeckProgressBar', () => {
  beforeEach(() => {
    // No Zustand stores used — cleanup is handled by test-setup afterEach
  });

  // ── Segment widths ────────────────────────────────────────────────────────
  describe('Segment percentage calculation', () => {
    it('renders three segments with correct widths: 2/3/5 of 10 → 20%/30%/50%', () => {
      // cardsNew=2, cardsLearning=3, cardsMastered=5, total=10
      const progress = makeProgress(2, 3, 5);
      renderWithI18n(<DeckProgressBar progress={progress} />);

      const newSeg = screen.getByLabelText('2 new cards');
      const learnSeg = screen.getByLabelText('3 learning cards');
      const mastSeg = screen.getByLabelText('5 mastered cards');

      expect(newSeg.style.width).toBe('20%');
      expect(learnSeg.style.width).toBe('30%');
      expect(mastSeg.style.width).toBe('50%');
    });

    it('renders only mastered segment when cardsNew=0 and cardsLearning=0', () => {
      const progress = makeProgress(0, 0, 10);
      renderWithI18n(<DeckProgressBar progress={progress} />);

      expect(screen.queryByLabelText(/new cards/)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/learning cards/)).not.toBeInTheDocument();
      expect(screen.getByLabelText('10 mastered cards')).toBeInTheDocument();
      expect(screen.getByLabelText('10 mastered cards').style.width).toBe('100%');
    });

    it('renders only learning segment when cardsNew=0 and cardsMastered=0', () => {
      const progress = makeProgress(0, 10, 0);
      renderWithI18n(<DeckProgressBar progress={progress} />);

      expect(screen.queryByLabelText(/new cards/)).not.toBeInTheDocument();
      expect(screen.getByLabelText('10 learning cards').style.width).toBe('100%');
      expect(screen.queryByLabelText(/mastered cards/)).not.toBeInTheDocument();
    });

    it('renders only new segment when cardsLearning=0 and cardsMastered=0', () => {
      const progress = makeProgress(10, 0, 0);
      renderWithI18n(<DeckProgressBar progress={progress} />);

      expect(screen.getByLabelText('10 new cards').style.width).toBe('100%');
      expect(screen.queryByLabelText(/learning cards/)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/mastered cards/)).not.toBeInTheDocument();
    });
  });

  // ── total=0 edge case ─────────────────────────────────────────────────────
  describe('total=0 edge case', () => {
    it('renders without throwing when all counts are 0', () => {
      const progress = makeProgress(0, 0, 0);
      expect(() => renderWithI18n(<DeckProgressBar progress={progress} />)).not.toThrow();
    });

    it('renders no segments when total=0', () => {
      const progress = makeProgress(0, 0, 0);
      renderWithI18n(<DeckProgressBar progress={progress} />);

      expect(screen.queryByLabelText(/new cards/)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/learning cards/)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/mastered cards/)).not.toBeInTheDocument();
    });

    it('root wrapper is still present (data-testid=deck-progress) when total=0', () => {
      const progress = makeProgress(0, 0, 0);
      renderWithI18n(<DeckProgressBar progress={progress} />);
      expect(screen.getByTestId('deck-progress')).toBeInTheDocument();
    });
  });

  // ── ARIA attributes ───────────────────────────────────────────────────────
  describe('aria-valuenow / aria-valuemax (no NaN ratio)', () => {
    it('sets aria-valuenow=mastered and aria-valuemax=total when total>0', () => {
      const progress = makeProgress(2, 3, 5); // total=10, mastered=5
      renderWithI18n(<DeckProgressBar progress={progress} />);

      const bar = getProgressbar();
      expect(bar).toHaveAttribute('aria-valuenow', '5');
      expect(bar).toHaveAttribute('aria-valuemax', '10');
      expect(bar).toHaveAttribute('aria-valuemin', '0');
    });

    it('sets aria-valuenow=0 and aria-valuemax>=1 when total=0 (no NaN ratio)', () => {
      const progress = makeProgress(0, 0, 0);
      renderWithI18n(<DeckProgressBar progress={progress} />);

      const bar = getProgressbar();
      const valuenow = Number(bar.getAttribute('aria-valuenow'));
      const valuemax = Number(bar.getAttribute('aria-valuemax'));

      // valuenow must be a finite number (not NaN)
      expect(Number.isFinite(valuenow)).toBe(true);
      // valuemax must be >= 1 so the ratio valuenow/valuemax is defined (not 0/0 = NaN)
      expect(valuemax).toBeGreaterThanOrEqual(1);
      expect(bar).toHaveAttribute('aria-valuemin', '0');
    });

    it('progressbar has aria-label "Deck learning progress"', () => {
      const progress = makeProgress(5, 3, 2);
      renderWithI18n(<DeckProgressBar progress={progress} />);
      expect(getProgressbar()).toHaveAttribute('aria-label', 'Deck learning progress');
    });
  });

  // ── Legend visibility ─────────────────────────────────────────────────────
  describe('Legend visibility', () => {
    it('does NOT render legend by default (showLegend omitted)', () => {
      const progress = makeProgress(2, 3, 5);
      renderWithI18n(<DeckProgressBar progress={progress} />);

      // Legend would contain the translated keys "To practice", "Learning", "Mastered"
      expect(screen.queryByText(/To practice/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Learning/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Mastered/i)).not.toBeInTheDocument();
    });

    it('does NOT render legend when showLegend=false', () => {
      const progress = makeProgress(2, 3, 5);
      renderWithI18n(<DeckProgressBar progress={progress} showLegend={false} />);

      expect(screen.queryByText(/To practice/i)).not.toBeInTheDocument();
    });

    it('renders legend with card counts when showLegend=true', () => {
      const progress = makeProgress(2, 3, 5);
      renderWithI18n(<DeckProgressBar progress={progress} showLegend={true} />);

      // "To practice" is the translation for detail.new
      expect(screen.getByText(/To practice/i)).toBeInTheDocument();
      expect(screen.getByText(/Learning/i)).toBeInTheDocument();
      expect(screen.getByText(/Mastered/i)).toBeInTheDocument();
    });

    it('legend displays the raw card counts when showLegend=true', () => {
      const progress = makeProgress(2, 3, 5);
      renderWithI18n(<DeckProgressBar progress={progress} showLegend={true} />);

      // Each count should appear somewhere in the legend text
      const container = screen.getByTestId('deck-progress');
      expect(container.textContent).toContain('2');
      expect(container.textContent).toContain('3');
      expect(container.textContent).toContain('5');
    });

    it('legend is still correct when total=0 and showLegend=true (no throw)', () => {
      const progress = makeProgress(0, 0, 0);
      expect(() =>
        renderWithI18n(<DeckProgressBar progress={progress} showLegend={true} />)
      ).not.toThrow();

      const container = screen.getByTestId('deck-progress');
      // All counts should be 0
      expect(container.textContent).toContain('0');
    });
  });

  // ── Size prop ─────────────────────────────────────────────────────────────
  describe('Size prop', () => {
    it('uses h-2 class for default size', () => {
      const progress = makeProgress(5, 3, 2);
      renderWithI18n(<DeckProgressBar progress={progress} />);
      expect(getProgressbar().className).toContain('h-2');
    });

    it('uses h-3 class for large size', () => {
      const progress = makeProgress(5, 3, 2);
      renderWithI18n(<DeckProgressBar progress={progress} size="large" />);
      expect(getProgressbar().className).toContain('h-3');
    });
  });

  // ── className pass-through ────────────────────────────────────────────────
  describe('className pass-through', () => {
    it('applies custom className to root wrapper', () => {
      const progress = makeProgress(5, 3, 2);
      renderWithI18n(<DeckProgressBar progress={progress} className="my-custom-class" />);
      expect(screen.getByTestId('deck-progress').className).toContain('my-custom-class');
    });
  });
});
