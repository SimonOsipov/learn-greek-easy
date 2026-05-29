import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { CardRow } from '../CardRow';
import type { CardMasteryItem } from '../../hooks';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts?.defaultValue) return opts.defaultValue as string;
      return key;
    },
  }),
}));

function makeCard(
  card_type: string,
  mastery_status: 'none' | 'studied' | 'mastered' = 'none',
  id = 'c1'
): CardMasteryItem {
  return {
    id,
    card_type: card_type as CardMasteryItem['card_type'],
    front_content: { prompt: 'Test prompt?' },
    back_content: { answer: 'Test answer' },
    mastery_status,
  };
}

describe('CardRow', () => {
  it('renders with correct testid', () => {
    render(<CardRow card={makeCard('meaning_el_to_en')} />);
    expect(screen.getByTestId('card-row-c1')).toBeInTheDocument();
  });

  it('mastery dot data-state is empty string for none', () => {
    render(<CardRow card={makeCard('meaning_el_to_en', 'none')} />);
    const dot = screen.getByTestId('card-row-mastery-dot');
    expect(dot).not.toHaveAttribute('data-state');
  });

  it('mastery dot data-state is "learning" for studied', () => {
    render(<CardRow card={makeCard('meaning_el_to_en', 'studied')} />);
    const dot = screen.getByTestId('card-row-mastery-dot');
    expect(dot).toHaveAttribute('data-state', 'learning');
  });

  it('mastery dot data-state is "mastered" for mastered', () => {
    render(<CardRow card={makeCard('meaning_el_to_en', 'mastered')} />);
    const dot = screen.getByTestId('card-row-mastery-dot');
    expect(dot).toHaveAttribute('data-state', 'mastered');
  });

  it('answer has lang="el" for Greek-answer card types (declension)', () => {
    render(<CardRow card={makeCard('declension')} />);
    const answer = screen.getByTestId('card-row-answer');
    expect(answer).toHaveAttribute('lang', 'el');
  });

  it('answer has lang="en" for meaning_el_to_en (English answer)', () => {
    render(<CardRow card={makeCard('meaning_el_to_en')} />);
    const answer = screen.getByTestId('card-row-answer');
    expect(answer).toHaveAttribute('lang', 'en');
  });

  it('answer has lang="el" for meaning_en_to_el (Greek answer)', () => {
    render(<CardRow card={makeCard('meaning_en_to_el')} />);
    const answer = screen.getByTestId('card-row-answer');
    expect(answer).toHaveAttribute('lang', 'el');
  });

  it('due column always shows inert "—"', () => {
    render(<CardRow card={makeCard('meaning_el_to_en')} />);
    expect(screen.getByTestId('card-row-due')).toHaveTextContent('—');
  });

  it('prompt shows front_content.prompt', () => {
    render(<CardRow card={makeCard('meaning_el_to_en')} />);
    expect(screen.getByTestId('card-row-prompt')).toHaveTextContent('Test prompt?');
  });

  it('answer shows back_content.answer', () => {
    render(<CardRow card={makeCard('meaning_el_to_en')} />);
    expect(screen.getByTestId('card-row-answer')).toHaveTextContent('Test answer');
  });
});
