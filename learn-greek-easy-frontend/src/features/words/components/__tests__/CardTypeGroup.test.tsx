import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import { track } from '@/lib/analytics';

import { CardTypeGroup } from '../CardTypeGroup';
import type { CardMasteryItem } from '../../hooks';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${JSON.stringify(opts)}` : key,
  }),
}));

let mockFlipState = false;

vi.mock('../MiniFlipCard', () => ({
  MiniFlipCard: ({ card, onFlip }: { card: CardMasteryItem; onFlip: (f: boolean) => void }) => (
    <div
      data-testid={`mock-mini-flip-card-${card.card_type}`}
      onClick={() => {
        mockFlipState = !mockFlipState;
        onFlip(mockFlipState);
      }}
    />
  ),
}));

vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
}));

function makeCard(card_type: string, id = 'card-1'): CardMasteryItem {
  return {
    id,
    card_type: card_type as CardMasteryItem['card_type'],
    front_content: { prompt: 'test' },
    back_content: { answer: 'test' },
    mastery_status: 'none',
  };
}

const defaultProps = {
  groupKey: 'translation' as const,
  i18nKey: 'groupTranslation',
  cards: [makeCard('meaning_el_to_en', 'card-1'), makeCard('meaning_en_to_el', 'card-2')],
  masteredCount: 1,
  totalCount: 2,
  tone: 'primary' as const,
  wordEntryId: 'we-1',
  deckId: 'deck-1',
};

describe('CardTypeGroup', () => {
  beforeEach(() => {
    mockFlipState = false;
    vi.clearAllMocks();
  });

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

  it('renders TypeChip with card count', () => {
    render(<CardTypeGroup {...defaultProps} />);
    // TypeChip renders the groupCardCount i18n key with n=2
    expect(screen.getByText(/groupCardCount/)).toBeInTheDocument();
  });

  it('renders accent marker via dx-cards-group class', () => {
    render(<CardTypeGroup {...defaultProps} />);
    const group = screen.getByTestId('card-group-translation');
    expect(group).toHaveClass('dx-cards-group');
    expect(group).toHaveAttribute('data-group', 'Translation');
  });

  it('renders correct number of MiniFlipCard children in grid view', () => {
    render(<CardTypeGroup {...defaultProps} />);
    const cards = screen.getAllByTestId(/^mock-mini-flip-card-/);
    expect(cards).toHaveLength(2);
  });

  it('renders cards in dx-cards-grid layout by default', () => {
    render(<CardTypeGroup {...defaultProps} />);
    const grid = document.querySelector('.dx-cards-grid');
    expect(grid).toBeInTheDocument();
  });

  it('renders list view when view="list"', () => {
    render(<CardTypeGroup {...defaultProps} view="list" />);
    const listView = document.querySelector('.dx-cards-list-view');
    expect(listView).toBeInTheDocument();
    // no grid in list mode
    const grid = document.querySelector('.dx-cards-grid');
    expect(grid).not.toBeInTheDocument();
  });

  it('Audio group shows exactly one UnwiredDot with danger tone', () => {
    render(
      <CardTypeGroup
        groupKey="audio"
        i18nKey="groupAudio"
        cards={[]}
        masteredCount={0}
        totalCount={0}
        tone="amber"
        isPlaceholder={true}
        wordEntryId="we-1"
        deckId="deck-1"
      />
    );
    const dots = document.querySelectorAll('.dx-unwired-dot');
    expect(dots).toHaveLength(1);
    // danger tone: the marker has no data-tone (danger is default, no attribute set)
    const marker = dots[0].querySelector('.dx-unwired-dot-marker');
    expect(marker).toBeInTheDocument();
    expect(marker).not.toHaveAttribute('data-tone', 'amber');
  });

  it('fires track("word_reference_card_flipped") with to_back on first flip', async () => {
    render(<CardTypeGroup {...defaultProps} />);
    const card = screen.getByTestId('mock-mini-flip-card-meaning_el_to_en');
    await userEvent.click(card);
    expect(track).toHaveBeenCalledWith('word_reference_card_flipped', {
      card_type: 'meaning_el_to_en',
      word_entry_id: 'we-1',
      deck_id: 'deck-1',
      direction: 'to_back',
    });
  });

  it('fires track("word_reference_card_flipped") with to_front on second flip', async () => {
    render(<CardTypeGroup {...defaultProps} />);
    const card = screen.getByTestId('mock-mini-flip-card-meaning_el_to_en');
    await userEvent.click(card); // to_back
    await userEvent.click(card); // to_front
    expect(track).toHaveBeenLastCalledWith('word_reference_card_flipped', {
      card_type: 'meaning_el_to_en',
      word_entry_id: 'we-1',
      deck_id: 'deck-1',
      direction: 'to_front',
    });
  });
});
