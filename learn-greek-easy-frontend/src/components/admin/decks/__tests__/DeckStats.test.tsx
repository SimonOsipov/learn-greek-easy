// src/components/admin/decks/__tests__/DeckStats.test.tsx
//
// Vitest + RTL unit tests for DeckStats (DKDR-03 / DADM-03).
// Covers: all 4 StatCards render, tone order, subtitles, sparklines, click-to-filter.

import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DeckStats } from '../DeckStats';

const DEFAULT_PROPS = {
  totalDecks: 12,
  totalCards: 180,
  vocabularyCount: 8,
  totalVocabularyCards: 120,
  cultureCount: 4,
  totalCultureQuestions: 60,
  avgCardsPerDeck: 15,
  onCardClick: vi.fn(),
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

  it('renders subtitle text for each stat card', () => {
    const { getByText } = render(<DeckStats {...DEFAULT_PROPS} />);
    expect(getByText('180 cards across all decks')).toBeTruthy();
    expect(getByText('120 words · A1–B2')).toBeTruthy();
    expect(getByText('60 questions · 4 active')).toBeTruthy();
    expect(getByText('+0 vs last month')).toBeTruthy();
  });

  it('renders 9 sparkline bars in each stat card', () => {
    const { container } = render(<DeckStats {...DEFAULT_PROPS} />);
    const sparklines = container.querySelectorAll('.stat-bars');
    expect(sparklines).toHaveLength(4);
    sparklines.forEach((sparkline) => {
      expect(sparkline.querySelectorAll('span')).toHaveLength(9);
    });
  });

  it('fires onCardClick("all") when Total decks card is clicked', async () => {
    const onCardClick = vi.fn();
    const { getByText } = render(<DeckStats {...DEFAULT_PROPS} onCardClick={onCardClick} />);
    await userEvent.click(getByText('Total decks'));
    expect(onCardClick).toHaveBeenCalledWith('all');
  });

  it('fires onCardClick("vocabulary") when Vocabulary card is clicked', async () => {
    const onCardClick = vi.fn();
    const { getByText } = render(<DeckStats {...DEFAULT_PROPS} onCardClick={onCardClick} />);
    await userEvent.click(getByText('Vocabulary'));
    expect(onCardClick).toHaveBeenCalledWith('vocabulary');
  });

  it('fires onCardClick("culture") when Culture card is clicked', async () => {
    const onCardClick = vi.fn();
    const { getByText } = render(<DeckStats {...DEFAULT_PROPS} onCardClick={onCardClick} />);
    await userEvent.click(getByText('Culture'));
    expect(onCardClick).toHaveBeenCalledWith('culture');
  });

  it('fires onCardClick("all") when Avg cards / deck card is clicked', async () => {
    const onCardClick = vi.fn();
    const { getByText } = render(<DeckStats {...DEFAULT_PROPS} onCardClick={onCardClick} />);
    await userEvent.click(getByText('Avg cards / deck'));
    expect(onCardClick).toHaveBeenCalledWith('all');
  });
});
