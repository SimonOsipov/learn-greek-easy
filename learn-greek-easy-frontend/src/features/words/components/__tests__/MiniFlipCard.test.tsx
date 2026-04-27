import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { MiniFlipCard } from '../MiniFlipCard';
import type { CardMasteryItem } from '../../hooks';

const mockLanguage = { current: 'en' };

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts?.defaultValue ? String(opts.defaultValue) : key,
    i18n: {
      get language() {
        return mockLanguage.current;
      },
    },
  }),
}));

function makeCard(overrides: Partial<CardMasteryItem> = {}): CardMasteryItem {
  return {
    id: 'test-card-1',
    card_type: 'meaning_el_to_en',
    front_content: { prompt: 'What does this mean?', main: 'σπίτι' },
    back_content: { answer: 'house', answer_sub: 'home' },
    mastery_status: 'none',
    ...overrides,
  };
}

describe('MiniFlipCard', () => {
  it('renders front face by default', () => {
    render(<MiniFlipCard card={makeCard()} />);
    expect(screen.getByTestId('mini-flip-card-test-card-1')).toBeInTheDocument();
    expect(screen.getByText('σπίτι')).toBeInTheDocument();
  });

  it('flips on click to reveal back answer', () => {
    render(<MiniFlipCard card={makeCard()} />);
    const card = screen.getByTestId('mini-flip-card-test-card-1');
    const inner = card.firstElementChild as HTMLElement;
    expect(inner.className).not.toContain('[transform:rotateY(180deg)]');
    fireEvent.click(card);
    expect(inner.className).toContain('[transform:rotateY(180deg)]');
  });

  it('flips back on second click', () => {
    render(<MiniFlipCard card={makeCard()} />);
    const card = screen.getByTestId('mini-flip-card-test-card-1');
    fireEvent.click(card);
    fireEvent.click(card);
    // After second click inner div should NOT have the rotateY class
    const inner = card.firstElementChild as HTMLElement;
    expect(inner.className).not.toContain('[transform:rotateY(180deg)]');
  });

  it('shows mastery dot with practice-correct color for mastered status', () => {
    // REBASELINE (RESKIN-01-06): bg-green-500 → bg-practice-correct (practice token)
    render(<MiniFlipCard card={makeCard({ mastery_status: 'mastered' })} />);
    const dot = document.querySelector('.bg-practice-correct');
    expect(dot).toBeInTheDocument();
  });

  it('shows card type label', () => {
    render(<MiniFlipCard card={makeCard({ card_type: 'meaning_el_to_en' })} />);
    // t() mock returns defaultValue — card_type is passed as defaultValue
    expect(screen.getByText('meaning_el_to_en')).toBeInTheDocument();
  });

  it('calls onFlip callback with true on first click and false on second click', () => {
    const onFlip = vi.fn();
    render(<MiniFlipCard card={makeCard()} onFlip={onFlip} />);
    const card = screen.getByTestId('mini-flip-card-test-card-1');

    fireEvent.click(card);
    expect(onFlip).toHaveBeenCalledWith(true);

    fireEvent.click(card);
    expect(onFlip).toHaveBeenCalledWith(false);
  });

  it('applies line-clamp-2 class to main text for truncation', () => {
    render(<MiniFlipCard card={makeCard()} />);
    const mainText = screen.getByText('σπίτι');
    expect(mainText.className).toContain('line-clamp-2');
  });

  it('handles missing backSub gracefully — no sub element rendered', () => {
    render(
      <MiniFlipCard
        card={makeCard({
          back_content: { answer: 'house' },
        })}
      />
    );
    // backSub is empty string — the conditional span should not be present
    const subElements = document.querySelectorAll('.text-xs.text-muted-foreground');
    expect(subElements).toHaveLength(0);
  });

  it('flips on Enter keypress', () => {
    render(<MiniFlipCard card={makeCard()} />);
    const card = screen.getByTestId('mini-flip-card-test-card-1');
    fireEvent.keyDown(card, { key: 'Enter' });
    const inner = card.firstElementChild as HTMLElement;
    expect(inner.className).toContain('[transform:rotateY(180deg)]');
  });

  it('flips on Space keypress', () => {
    render(<MiniFlipCard card={makeCard()} />);
    const card = screen.getByTestId('mini-flip-card-test-card-1');
    fireEvent.keyDown(card, { key: ' ' });
    const inner = card.firstElementChild as HTMLElement;
    expect(inner.className).toContain('[transform:rotateY(180deg)]');
  });

  it('renders correct data-testid based on card id', () => {
    render(<MiniFlipCard card={makeCard({ id: 'my-card-42' })} />);
    expect(screen.getByTestId('mini-flip-card-my-card-42')).toBeInTheDocument();
  });

  describe('Russian language', () => {
    beforeEach(() => {
      mockLanguage.current = 'ru';
    });
    afterEach(() => {
      mockLanguage.current = 'en';
    });

    it('translates prompt for meaning_el_to_en card type', () => {
      render(
        <MiniFlipCard
          card={makeCard({
            card_type: 'meaning_el_to_en',
            front_content: { prompt: 'What does this mean?', main: 'σπίτι' },
          })}
        />
      );
      expect(screen.getByText('Что это значит?')).toBeInTheDocument();
    });

    it('shows answer_ru on back face for sentence_translation card', () => {
      render(
        <MiniFlipCard
          card={makeCard({
            card_type: 'sentence_translation',
            back_content: {
              answer: 'My sister lives in London.',
              answer_ru: 'Моя сестра живёт в Лондоне.',
            },
          })}
        />
      );
      fireEvent.click(screen.getByTestId('mini-flip-card-test-card-1'));
      expect(screen.getByText('Моя сестра живёт в Лондоне.')).toBeInTheDocument();
    });

    it('shows gender_ru as backSub for article card', () => {
      render(
        <MiniFlipCard
          card={makeCard({
            card_type: 'article',
            back_content: {
              answer: 'η',
              gender: 'Feminine',
              gender_ru: 'Женский',
            },
          })}
        />
      );
      fireEvent.click(screen.getByTestId('mini-flip-card-test-card-1'));
      expect(screen.getByText('Женский')).toBeInTheDocument();
    });

    it('shows answer_sub_ru as backSub for plural_form card', () => {
      render(
        <MiniFlipCard
          card={makeCard({
            card_type: 'plural_form',
            back_content: {
              answer: 'αδερφές',
              answer_sub: 'sisters',
              answer_sub_ru: 'сёстры',
            },
          })}
        />
      );
      fireEvent.click(screen.getByTestId('mini-flip-card-test-card-1'));
      expect(screen.getByText('сёстры')).toBeInTheDocument();
    });

    it('translates accusative plural prompt for declension card', () => {
      render(
        <MiniFlipCard
          card={makeCard({
            card_type: 'declension',
            front_content: { prompt: 'What is the accusative plural?', main: 'αδερφή' },
          })}
        />
      );
      expect(screen.getByText('Какой винительный падеж мн. числа?')).toBeInTheDocument();
    });
  });
});
