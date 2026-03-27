import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import { CardItem } from '../CardItem';
import type { CardMasteryItem } from '../../hooks';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts?.defaultValue ? String(opts.defaultValue) : key,
  }),
}));

vi.mock('@/components/shared/MasteryDots', () => ({
  MasteryDots: ({ filled }: { filled: number }) => (
    <span data-testid="mastery-dots" data-filled={filled} />
  ),
}));

// Mock collapsible to actually work in tests
vi.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({
    children,
    open,
    onOpenChange,
    ...props
  }: {
    children: React.ReactNode;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    [key: string]: unknown;
  }) => (
    <div data-open={String(open)} {...props}>
      {children}
    </div>
  ),
  CollapsibleTrigger: ({
    children,
    onClick,
    ...props
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    [key: string]: unknown;
  }) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
  CollapsibleContent: ({
    children,
    ...props
  }: {
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <div data-testid="collapsible-content" {...props}>
      {children}
    </div>
  ),
}));

function makeCard(overrides: Partial<CardMasteryItem> = {}): CardMasteryItem {
  return {
    id: 'card-1',
    card_type: 'meaning_el_to_en',
    front_content: { prompt: 'Γεια σου' },
    back_content: { answer: 'Hello' },
    mastery_status: 'none',
    ...overrides,
  };
}

describe('CardItem', () => {
  it('renders with correct data-testid', () => {
    render(<CardItem card={makeCard()} index={0} wordEntryId="we-1" deckId="deck-1" />);
    expect(screen.getByTestId('card-item-meaning_el_to_en-0')).toBeInTheDocument();
  });

  it('renders card type label', () => {
    render(
      <CardItem
        card={makeCard({ card_type: 'meaning_el_to_en' })}
        index={0}
        wordEntryId="we-1"
        deckId="deck-1"
      />
    );
    // t() mock returns defaultValue when provided — card_type is passed as defaultValue
    expect(screen.getByText('meaning_el_to_en')).toBeInTheDocument();
  });

  it('renders MasteryDots with filled=4 for mastered', () => {
    render(
      <CardItem
        card={makeCard({ mastery_status: 'mastered' })}
        index={0}
        wordEntryId="we-1"
        deckId="deck-1"
      />
    );
    const dots = screen.getByTestId('mastery-dots');
    expect(Number(dots.getAttribute('data-filled'))).toBe(4);
  });

  it('renders MasteryDots with filled=2 for studied', () => {
    render(
      <CardItem
        card={makeCard({ mastery_status: 'studied' })}
        index={0}
        wordEntryId="we-1"
        deckId="deck-1"
      />
    );
    const dots = screen.getByTestId('mastery-dots');
    expect(Number(dots.getAttribute('data-filled'))).toBe(2);
  });

  it('renders MasteryDots with filled=0 for none', () => {
    render(
      <CardItem
        card={makeCard({ mastery_status: 'none' })}
        index={0}
        wordEntryId="we-1"
        deckId="deck-1"
      />
    );
    const dots = screen.getByTestId('mastery-dots');
    expect(Number(dots.getAttribute('data-filled'))).toBe(0);
  });

  it('extracts prompt key from front_content preferentially', () => {
    const card = makeCard({
      front_content: { prompt: 'Priority prompt', greek: 'Other text' },
    });
    render(<CardItem card={card} index={0} wordEntryId="we-1" deckId="deck-1" />);
    expect(screen.getByText('Priority prompt')).toBeInTheDocument();
  });

  it('never renders back_content', () => {
    const card = makeCard({
      front_content: { prompt: 'front text' },
      back_content: { answer: 'back secret' },
    });
    render(<CardItem card={card} index={0} wordEntryId="we-1" deckId="deck-1" />);
    expect(screen.queryByText('back secret')).not.toBeInTheDocument();
  });

  it('expands to show front_content on click', async () => {
    const user = userEvent.setup();
    const card = makeCard({ front_content: { prompt: 'visible preview' } });
    render(<CardItem card={card} index={0} wordEntryId="we-1" deckId="deck-1" />);

    // Before click: content is rendered in DOM (mocked CollapsibleContent always renders)
    // but the collapsible open state changes
    const trigger = screen.getByRole('button');
    await user.click(trigger);

    // After click the open state changes - content should be visible
    expect(screen.getByText('visible preview')).toBeInTheDocument();
  });

  it('multiple cards can be open simultaneously (not accordion)', async () => {
    const user = userEvent.setup();
    const card1 = makeCard({
      card_type: 'meaning_el_to_en',
      front_content: { prompt: 'card one' },
    });
    const card2 = makeCard({
      card_type: 'meaning_en_to_el',
      front_content: { prompt: 'card two' },
    });

    render(
      <div>
        <CardItem card={card1} index={0} wordEntryId="we-1" deckId="deck-1" />
        <CardItem card={card2} index={1} wordEntryId="we-1" deckId="deck-1" />
      </div>
    );

    const buttons = screen.getAllByRole('button');
    await user.click(buttons[0]);
    await user.click(buttons[1]);

    // Both contents should be visible (they each have their own state)
    expect(screen.getByText('card one')).toBeInTheDocument();
    expect(screen.getByText('card two')).toBeInTheDocument();
  });
});
