/**
 * V2DeckHeader Component Tests
 *
 * Covers:
 * - Filter pill selection (default "All", single-select)
 * - Study Now navigation without card type filter
 * - Study Now navigation with card type filter (Translation -> meaning)
 */

import React from 'react';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import i18n from '@/i18n';
import type { Deck } from '@/types/deck';

import { V2DeckHeader } from '../V2DeckHeader';

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

const mockDeck: Deck = {
  id: 'deck-abc',
  title: 'Test Deck',
  titleGreek: 'Δοκιμαστικό',
  description: 'A test deck',
  level: 'A1',
  category: 'vocabulary',
  tags: [],
  cardCount: 20,
  estimatedTime: 15,
  isPremium: false,
  coverImageUrl: undefined,
  createdBy: 'system',
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
  cardSystem: 'V2',
};

function renderV2DeckHeader() {
  return render(
    <MemoryRouter>
      <I18nextProvider i18n={i18n}>
        <V2DeckHeader deck={mockDeck} />
      </I18nextProvider>
    </MemoryRouter>
  );
}

// ============================================
// Tests
// ============================================

describe('V2DeckHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Study Now button with correct data-testid', () => {
    renderV2DeckHeader();
    expect(screen.getByTestId('start-review-button')).toBeInTheDocument();
  });

  it('renders all five filter pills', () => {
    renderV2DeckHeader();
    // All pills should be present - check by aria-pressed
    const allPressedButtons = screen.getAllByRole('button');
    // Filter pills: All, Translation, Sentence, Plural Form, Article
    // Look for aria-pressed attribute
    const pills = allPressedButtons.filter((btn) => btn.getAttribute('aria-pressed') !== null);
    expect(pills.length).toBe(5);
  });

  it('has "All" selected by default', () => {
    renderV2DeckHeader();
    // Find pill with aria-pressed="true" - should be "All"
    const pressedPills = screen
      .getAllByRole('button')
      .filter((btn) => btn.getAttribute('aria-pressed') === 'true');
    expect(pressedPills.length).toBe(1);
    expect(pressedPills[0]).toHaveAttribute('aria-pressed', 'true');
  });

  it('selects a pill on click and deselects previous', async () => {
    const user = userEvent.setup();
    renderV2DeckHeader();

    // Find all pill buttons by aria-pressed
    const buttons = screen.getAllByRole('button');
    const pills = buttons.filter((btn) => btn.getAttribute('aria-pressed') !== null);

    // Initially "All" (first pill) is selected
    expect(pills[0]).toHaveAttribute('aria-pressed', 'true');
    expect(pills[1]).toHaveAttribute('aria-pressed', 'false');

    // Click second pill (Translation)
    await user.click(pills[1]);

    // Now Translation should be selected and All should not
    const updatedButtons = screen.getAllByRole('button');
    const updatedPills = updatedButtons.filter((btn) => btn.getAttribute('aria-pressed') !== null);
    expect(updatedPills[0]).toHaveAttribute('aria-pressed', 'false');
    expect(updatedPills[1]).toHaveAttribute('aria-pressed', 'true');
  });

  it('navigates to practice without cardType when "All" is selected', async () => {
    const user = userEvent.setup();
    renderV2DeckHeader();

    await user.click(screen.getByTestId('start-review-button'));

    expect(mockNavigate).toHaveBeenCalledWith('/decks/deck-abc/practice');
  });

  it('navigates with ?cardType=meaning when Translation pill is selected', async () => {
    const user = userEvent.setup();
    renderV2DeckHeader();

    // Click Translation pill (2nd pill, aria-pressed=false)
    const buttons = screen.getAllByRole('button');
    const pills = buttons.filter((btn) => btn.getAttribute('aria-pressed') !== null);
    await user.click(pills[1]); // Translation pill

    // Click Study Now
    await user.click(screen.getByTestId('start-review-button'));

    expect(mockNavigate).toHaveBeenCalledWith('/decks/deck-abc/practice?cardType=meaning');
  });
});
