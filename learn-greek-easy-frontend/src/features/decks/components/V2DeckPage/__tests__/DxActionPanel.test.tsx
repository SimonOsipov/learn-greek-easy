/**
 * DxActionPanel Component Tests
 *
 * Covers:
 * - chips single-select, default "all"
 * - CTA href omits param for "all", includes cardType otherwise
 * - counts derived from wordProgress
 * - bar width driven by wordProgress.progressPct
 * - no UnwiredDot
 */

import React from 'react';

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import i18n from '@/i18n';
import type { ProgressMetrics } from '@/services/progressAPI';

import { DxActionPanel } from '../DxActionPanel';

// ============================================
// Mocks
// ============================================

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// ============================================
// Fixtures
// ============================================

const mockProgress: ProgressMetrics = {
  total_cards: 20,
  cards_studied: 12,
  cards_mastered: 8,
  cards_due: 3,
  cards_new: 5,
  cards_learning: 7,
  cards_review: 2,
  mastery_percentage: 40,
  completion_percentage: 60,
};

// Word-level progress fixtures
const wordProgress40 = {
  totalWords: 10,
  masteredWords: 4,
  inProgressWords: 2,
  newWords: 4,
  progressPct: 40, // 1.0*4 + 0.5*2 = 5 / 10 = 50% → but we use explicit value
};

const wordProgress50 = {
  totalWords: 10,
  masteredWords: 5,
  inProgressWords: 0,
  newWords: 5,
  progressPct: 50,
};

// renderPanel always requires an explicit progress argument to avoid
// the JS default-parameter ambiguity (passing `undefined` triggers the default).
function renderPanel(
  progress: ProgressMetrics | null,
  wordProgress?: typeof wordProgress40 | undefined
) {
  const result = render(
    <MemoryRouter>
      <I18nextProvider i18n={i18n}>
        <DxActionPanel
          deckId="deck-xyz"
          progress={progress ?? undefined}
          wordProgress={wordProgress}
        />
      </I18nextProvider>
    </MemoryRouter>
  );
  return result;
}

// ============================================
// Tests
// ============================================

describe('DxActionPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders 5 chip buttons', () => {
    renderPanel(mockProgress);
    const chips = screen
      .getAllByRole('button')
      .filter((btn) => btn.getAttribute('aria-pressed') !== null);
    expect(chips.length).toBe(5);
  });

  it('has "all" chip selected by default', () => {
    renderPanel(mockProgress);
    const chips = screen
      .getAllByRole('button')
      .filter((btn) => btn.getAttribute('aria-pressed') !== null);
    expect(chips[0]).toHaveAttribute('aria-pressed', 'true');
    chips.slice(1).forEach((chip) => {
      expect(chip).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('single-selects a chip on click', async () => {
    const user = userEvent.setup();
    renderPanel(mockProgress);

    const chips = screen
      .getAllByRole('button')
      .filter((btn) => btn.getAttribute('aria-pressed') !== null);

    // Click second chip (meaning/translation)
    await user.click(chips[1]);

    const updatedChips = screen
      .getAllByRole('button')
      .filter((btn) => btn.getAttribute('aria-pressed') !== null);
    expect(updatedChips[0]).toHaveAttribute('aria-pressed', 'false');
    expect(updatedChips[1]).toHaveAttribute('aria-pressed', 'true');
    updatedChips.slice(2).forEach((chip) => {
      expect(chip).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('CTA navigates to /practice (no param) when "all" is selected', async () => {
    const user = userEvent.setup();
    renderPanel(mockProgress);

    await user.click(screen.getByTestId('start-review-button'));
    expect(mockNavigate).toHaveBeenCalledWith('/decks/deck-xyz/practice');
  });

  it('CTA includes ?cardType=meaning when meaning chip is selected', async () => {
    const user = userEvent.setup();
    renderPanel(mockProgress);

    const chips = screen
      .getAllByRole('button')
      .filter((btn) => btn.getAttribute('aria-pressed') !== null);
    await user.click(chips[1]); // meaning chip

    await user.click(screen.getByTestId('start-review-button'));
    expect(mockNavigate).toHaveBeenCalledWith('/decks/deck-xyz/practice?cardType=meaning');
  });

  it('CTA includes ?cardType=plural_form when plural_form chip is selected', async () => {
    const user = userEvent.setup();
    renderPanel(mockProgress);

    const chips = screen
      .getAllByRole('button')
      .filter((btn) => btn.getAttribute('aria-pressed') !== null);
    await user.click(chips[2]); // plural_form chip

    await user.click(screen.getByTestId('start-review-button'));
    expect(mockNavigate).toHaveBeenCalledWith('/decks/deck-xyz/practice?cardType=plural_form');
  });

  it('bar width reflects wordProgress.progressPct (40%)', () => {
    const { container } = renderPanel(mockProgress, wordProgress40);
    const barFill = within(container).getByTestId('dx-action-bar-fill');
    expect(barFill).toHaveStyle({ width: '40%' });
  });

  it('bar width reflects wordProgress.progressPct (50%)', () => {
    const { container } = renderPanel(mockProgress, wordProgress50);
    const barFill = within(container).getByTestId('dx-action-bar-fill');
    expect(barFill).toHaveStyle({ width: '50%' });
  });

  it('bar width is 0% when no wordProgress (undefined)', () => {
    const { container } = renderPanel(null, undefined);
    const barFill = within(container).getByTestId('dx-action-bar-fill');
    expect(barFill).toHaveStyle({ width: '0%' });
  });

  it('does not render UnwiredDot', () => {
    const { container } = renderPanel(mockProgress);
    const unwired = container.querySelector('.dx-unwired-dot');
    expect(unwired).toBeNull();
  });
});
