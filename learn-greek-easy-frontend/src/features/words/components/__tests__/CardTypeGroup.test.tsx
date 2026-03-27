import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { CardTypeGroup } from '../CardTypeGroup';
import type { CardMasteryItem } from '../../hooks';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${JSON.stringify(opts)}` : key,
  }),
}));

vi.mock('../CardItem', () => ({
  CardItem: ({ card, index }: { card: CardMasteryItem; index: number }) => (
    <div data-testid={`mock-card-item-${card.card_type}-${index}`} />
  ),
}));

function makeCard(card_type: string): CardMasteryItem {
  return {
    card_type: card_type as CardMasteryItem['card_type'],
    front_content: { prompt: 'test' },
    back_content: { answer: 'test' },
    mastery_status: 'none',
  };
}

const defaultProps = {
  groupKey: 'translation' as const,
  i18nKey: 'groupTranslation',
  cards: [makeCard('meaning_el_to_en'), makeCard('meaning_en_to_el')],
  masteredCount: 1,
  totalCount: 2,
  wordEntryId: 'we-1',
  deckId: 'deck-1',
};

describe('CardTypeGroup', () => {
  it('renders with correct data-testid', () => {
    render(<CardTypeGroup {...defaultProps} />);
    expect(screen.getByTestId('card-group-translation')).toBeInTheDocument();
  });

  it('renders header with correct data-testid', () => {
    render(<CardTypeGroup {...defaultProps} />);
    expect(screen.getByTestId('card-group-header-translation')).toBeInTheDocument();
  });

  it('renders group name from i18n', () => {
    render(<CardTypeGroup {...defaultProps} />);
    expect(screen.getByText('wordReference.groupTranslation')).toBeInTheDocument();
  });

  it('renders mastered count text', () => {
    render(<CardTypeGroup {...defaultProps} />);
    const countText = screen.getByText(/groupMastered/);
    expect(countText.textContent).toContain('"mastered":1');
    expect(countText.textContent).toContain('"total":2');
  });

  it('renders correct number of CardItem children', () => {
    render(<CardTypeGroup {...defaultProps} />);
    expect(screen.getByTestId('mock-card-item-meaning_el_to_en-0')).toBeInTheDocument();
    expect(screen.getByTestId('mock-card-item-meaning_en_to_el-1')).toBeInTheDocument();
  });
});
