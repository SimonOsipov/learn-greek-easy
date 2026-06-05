// src/features/practice/pf/__tests__/cardLocale.test.tsx
//
// Regression guard for the practice-card i18n bug: the language switcher used to
// translate only the session header (TopBar) while the CARD UI stayed English.
// These tests render the card components under the Russian locale and assert the
// translated strings. afterEach in test-setup resets the language back to 'en'.

import { render, screen } from '@testing-library/react';
import i18n from 'i18next';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { Card } from '../Card';
import { CardHead } from '../CardHead';
import { RatingRow } from '../RatingRow';
import { formatReviewInterval } from '../Toast';
import { Declension } from '../questions/Declension';
import { TranslationElToEn, TranslationEnToEl } from '../questions/Translation';

const DECL_CARD = {
  back_content: {
    declension_table: {
      gender: 'Neuter',
      rows: [
        {
          case: 'Nominative',
          singular: 'το σπίτι',
          plural: 'τα σπίτια',
          highlight_singular: false,
          highlight_plural: false,
        },
        {
          case: 'Vocative',
          singular: 'σπίτι',
          plural: 'σπίτια',
          highlight_singular: false,
          highlight_plural: true,
        },
      ],
    },
  },
  front_content: { hint: 'house, home, household' },
};

describe('practice card — Russian locale', () => {
  // test-setup's global afterEach unmounts then resets the language back to 'en'.
  beforeEach(async () => {
    await i18n.changeLanguage('ru');
  });

  it('CardHead translates the family label (Declension → Склонение)', () => {
    render(<CardHead cardType="declension" />);
    expect(screen.getByTestId('pf-fam-badge').textContent).toBe('Склонение');
  });

  it('RatingRow translates the four rating labels', () => {
    render(<RatingRow onRate={vi.fn()} isFlipped />);
    expect(screen.getByTestId('pf-rating-btn-forgot').textContent).toContain('Забыл');
    expect(screen.getByTestId('pf-rating-btn-tough').textContent).toContain('Трудно');
    expect(screen.getByTestId('pf-rating-btn-ok').textContent).toContain('Нормально');
    expect(screen.getByTestId('pf-rating-btn-easy').textContent).toContain('Легко');
  });

  it('Declension translates case names and sg/pl headers', () => {
    render(<Declension card={DECL_CARD} revealed={false} />);
    // Case label via the shared review namespace
    expect(screen.getByText('Именительный')).toBeInTheDocument();
    expect(screen.getByText('Звательный')).toBeInTheDocument();
    // Column headers via deck namespace
    expect(screen.getByText('ед.')).toBeInTheDocument();
    expect(screen.getByText('мн.')).toBeInTheDocument();
  });

  it('Declension shows the Russian gloss (translation_ru) over the English hint', () => {
    render(<Declension card={DECL_CARD} revealed={false} glossRu="дом" />);
    const lemma = screen.getByTestId('pf-decl-lemma');
    expect(lemma.textContent).toContain('дом');
    expect(lemma.textContent).not.toContain('household');
  });

  it('TranslationElToEn direction subtitle is Russian (Греческий → Русский)', () => {
    render(<TranslationElToEn word="αδερφή" />);
    const subtitle = screen.getByTestId('pf-direction-subtitle');
    expect(subtitle.textContent).toContain('Греческий → Русский');
    expect(subtitle.textContent).not.toContain('Greek → English');
  });

  it('TranslationEnToEl direction subtitle is Russian (Русский → Греческий)', () => {
    render(<TranslationEnToEl word="сестра" />);
    const subtitle = screen.getByTestId('pf-direction-subtitle');
    expect(subtitle.textContent).toContain('Русский → Греческий');
    expect(subtitle.textContent).not.toContain('English → Greek');
  });

  it('Card reveal CTA is translated', () => {
    render(<Card body={<div />} foot={<div>answer</div>} isFlipped={false} />);
    const cta = document.querySelector('.pf-reveal-cta');
    expect(cta?.textContent).toContain('Тапните или нажмите');
    expect(cta?.textContent).toContain('Пробел');
    expect(cta?.textContent).toContain('чтобы увидеть ответ');
  });

  it('formatReviewInterval localizes intervals with Russian plurals', () => {
    expect(formatReviewInterval(0)).toBe('сегодня');
    expect(formatReviewInterval(1)).toBe('1 день');
    expect(formatReviewInterval(3)).toBe('3 дня');
    expect(formatReviewInterval(5)).toBe('5 дней');
  });
});

describe('practice card — English locale (interval baseline)', () => {
  it('formatReviewInterval keeps English output unchanged', () => {
    expect(formatReviewInterval(0)).toBe('today');
    expect(formatReviewInterval(1)).toBe('1 day');
    expect(formatReviewInterval(3)).toBe('3 days');
    expect(formatReviewInterval(14)).toBe('2 weeks');
    expect(formatReviewInterval(30)).toBe('1 month');
    expect(formatReviewInterval(365)).toBe('1 year');
  });
});
