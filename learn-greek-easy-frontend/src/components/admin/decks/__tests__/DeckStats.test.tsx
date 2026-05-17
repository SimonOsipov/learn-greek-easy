// src/components/admin/decks/__tests__/DeckStats.test.tsx
//
// Vitest + RTL unit tests for DeckStats (DKDR-03).
// Covers: all 4 StatCards render, tone order (blue → violet → cyan → green).

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DeckStats } from '../DeckStats';

const DEFAULT_PROPS = {
  totalDecks: 12,
  vocabularyCount: 8,
  cultureCount: 4,
  avgCardsPerDeck: 15,
};

describe('DeckStats', () => {
  it('renders all 4 stat cards with their values', () => {
    const { getByText } = render(<DeckStats {...DEFAULT_PROPS} />);
    expect(getByText('Total decks')).toBeTruthy();
    expect(getByText('Vocabulary')).toBeTruthy();
    expect(getByText('Culture')).toBeTruthy();
    expect(getByText('Avg cards / deck')).toBeTruthy();
  });

  it('displays the correct numbers from props', () => {
    const { getByText } = render(<DeckStats {...DEFAULT_PROPS} />);
    expect(getByText('12')).toBeTruthy();
    expect(getByText('8')).toBeTruthy();
    expect(getByText('4')).toBeTruthy();
    expect(getByText('15')).toBeTruthy();
  });

  it('renders cards in the correct tone order: blue, violet, cyan, green', () => {
    const { container } = render(<DeckStats {...DEFAULT_PROPS} />);
    const cards = container.querySelectorAll('.stat-card');
    expect(cards).toHaveLength(4);
    expect(cards[0].classList.contains('tone-blue')).toBe(true);
    expect(cards[1].classList.contains('tone-violet')).toBe(true);
    expect(cards[2].classList.contains('tone-cyan')).toBe(true);
    expect(cards[3].classList.contains('tone-green')).toBe(true);
  });

  it('renders the stat-grid wrapper with correct class', () => {
    const { container } = render(<DeckStats {...DEFAULT_PROPS} />);
    const grid = container.querySelector('.stat-grid');
    expect(grid).toBeTruthy();
  });
});
