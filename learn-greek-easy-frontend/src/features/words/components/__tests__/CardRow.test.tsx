import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { CardRow } from '../CardRow';
import type { CardMasteryItem } from '../../hooks';

// Mutable language reference — tests can switch locale without re-mocking
let mockLanguage = 'en';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts?.defaultValue) return opts.defaultValue as string;
      return key;
    },
    i18n: { language: mockLanguage },
  }),
}));

function makeCard(
  card_type: string,
  mastery_status: 'none' | 'studied' | 'mastered' = 'none',
  id = 'c1',
  overrides: Partial<{
    front_content: Record<string, unknown>;
    back_content: Record<string, unknown>;
  }> = {}
): CardMasteryItem {
  return {
    id,
    card_type: card_type as CardMasteryItem['card_type'],
    front_content: overrides.front_content ?? { prompt: 'Test prompt?' },
    back_content: overrides.back_content ?? { answer: 'Test answer' },
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

  it('prompt shows front_content.prompt (EN locale)', () => {
    render(<CardRow card={makeCard('meaning_el_to_en')} />);
    expect(screen.getByTestId('card-row-prompt')).toHaveTextContent('Test prompt?');
  });

  it('answer shows back_content.answer (EN locale)', () => {
    render(<CardRow card={makeCard('meaning_el_to_en')} />);
    expect(screen.getByTestId('card-row-answer')).toHaveTextContent('Test answer');
  });
});

describe('CardRow — RU locale', () => {
  beforeEach(() => {
    mockLanguage = 'ru';
  });

  afterEach(() => {
    mockLanguage = 'en';
  });

  it('shows answer_ru when locale is "ru" and answer_ru is present', () => {
    const card = makeCard('meaning_el_to_en', 'none', 'ru1', {
      back_content: { answer: 'English answer', answer_ru: 'Русский ответ' },
    });
    render(<CardRow card={card} />);
    const answerEl = screen.getByTestId('card-row-answer');
    expect(answerEl).toHaveTextContent('Русский ответ');
    expect(answerEl).toHaveAttribute('lang', 'ru');
  });

  it('falls back to answer when locale is "ru" but answer_ru is absent', () => {
    const card = makeCard('meaning_el_to_en', 'none', 'ru2', {
      back_content: { answer: 'English answer' },
    });
    render(<CardRow card={card} />);
    expect(screen.getByTestId('card-row-answer')).toHaveTextContent('English answer');
  });

  it('translates prompt for meaning_el_to_en card type in RU locale', () => {
    const card = makeCard('meaning_el_to_en', 'none', 'ru3', {
      front_content: { prompt: 'What does this mean?' },
      back_content: { answer: 'answer' },
    });
    render(<CardRow card={card} />);
    expect(screen.getByTestId('card-row-prompt')).toHaveTextContent('Что это значит?');
  });

  it('translates prompt for meaning_en_to_el card type in RU locale', () => {
    const card = makeCard('meaning_en_to_el', 'none', 'ru4', {
      front_content: { prompt: 'Translate to Greek' },
      back_content: { answer: 'answer' },
    });
    render(<CardRow card={card} />);
    expect(screen.getByTestId('card-row-prompt')).toHaveTextContent('Как это сказать по-гречески?');
  });

  it('falls back to English prompt when no RU translation exists', () => {
    const card = makeCard('cloze', 'none', 'ru5', {
      front_content: { prompt: 'Unknown prompt type' },
      back_content: { answer: 'answer' },
    });
    render(<CardRow card={card} />);
    expect(screen.getByTestId('card-row-prompt')).toHaveTextContent('Unknown prompt type');
  });
});
