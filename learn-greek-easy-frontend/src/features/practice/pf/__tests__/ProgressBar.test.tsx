/**
 * pf/ProgressBar.tsx — unit tests (PRACT2-1-02)
 *
 * Covers:
 * - Renders one tick per card
 * - Current tick has .is-current class
 * - Rated ticks carry the correct data-rate attribute
 * - Count reads "{idx+1} / {total}"
 * - Count with currentIndex at last card reads "{total} / {total}"
 * - Family class set on each tick per card_type
 */

import React from 'react';

import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import type { StudyQueueCard } from '@/services/studyAPI';
import type { RatingKey } from '@/stores/v2PracticeStore';

import { ProgressBar } from '../ProgressBar';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeCard(id: string, cardType = 'meaning_el_to_en'): StudyQueueCard {
  return {
    card_record_id: id,
    word_entry_id: `we-${id}`,
    deck_id: 'deck-1',
    deck_name: 'Test Deck',
    card_type: cardType as StudyQueueCard['card_type'],
    variant_key: null,
    front_content: {},
    back_content: {},
    status: 'new',
    is_new: true,
    is_early_practice: false,
    due_date: null,
    easiness_factor: null,
    interval: null,
    audio_url: null,
    example_audio_url: null,
    translation_ru: null,
    translation_ru_plural: null,
    sentence_ru: null,
  };
}

const CARDS = [
  makeCard('c1', 'meaning_el_to_en'), // → translation family
  makeCard('c2', 'conjugation'), // → grammar family
  makeCard('c3', 'sentence_translation'), // → sentence family
];

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ProgressBar', () => {
  it('renders one tick per card', () => {
    const { container } = render(
      <ProgressBar cards={CARDS} currentIndex={0} ratings={[null, null, null]} />
    );
    const ticks = container.querySelectorAll('.pf-seg');
    expect(ticks.length).toBe(3);
  });

  it('current tick (idx === currentIndex) has .is-current', () => {
    const { container } = render(
      <ProgressBar cards={CARDS} currentIndex={1} ratings={[null, null, null]} />
    );
    const ticks = container.querySelectorAll('.pf-seg');
    expect(ticks[0].classList.contains('is-current')).toBe(false);
    expect(ticks[1].classList.contains('is-current')).toBe(true);
    expect(ticks[2].classList.contains('is-current')).toBe(false);
  });

  it('rated tick has correct data-rate="forgot"', () => {
    const ratings: (RatingKey | null)[] = ['forgot', null, null];
    const { container } = render(<ProgressBar cards={CARDS} currentIndex={1} ratings={ratings} />);
    const ticks = container.querySelectorAll('.pf-seg');
    expect(ticks[0].getAttribute('data-rate')).toBe('forgot');
  });

  it('rated tick has correct data-rate="tough"', () => {
    const ratings: (RatingKey | null)[] = ['tough', null, null];
    const { container } = render(<ProgressBar cards={CARDS} currentIndex={1} ratings={ratings} />);
    const ticks = container.querySelectorAll('.pf-seg');
    expect(ticks[0].getAttribute('data-rate')).toBe('tough');
  });

  it('rated tick has correct data-rate="ok"', () => {
    const ratings: (RatingKey | null)[] = ['ok', null, null];
    const { container } = render(<ProgressBar cards={CARDS} currentIndex={1} ratings={ratings} />);
    const ticks = container.querySelectorAll('.pf-seg');
    expect(ticks[0].getAttribute('data-rate')).toBe('ok');
  });

  it('rated tick has correct data-rate="easy"', () => {
    const ratings: (RatingKey | null)[] = ['easy', null, null];
    const { container } = render(<ProgressBar cards={CARDS} currentIndex={1} ratings={ratings} />);
    const ticks = container.querySelectorAll('.pf-seg');
    expect(ticks[0].getAttribute('data-rate')).toBe('easy');
  });

  it('unrated tick has no data-rate attribute', () => {
    const { container } = render(
      <ProgressBar cards={CARDS} currentIndex={0} ratings={[null, null, null]} />
    );
    const ticks = container.querySelectorAll('.pf-seg');
    expect(ticks[1].getAttribute('data-rate')).toBeNull();
  });

  it('count reads "{currentIndex+1} / {total}" for first card', () => {
    const { container } = render(
      <ProgressBar cards={CARDS} currentIndex={0} ratings={[null, null, null]} />
    );
    const count = container.querySelector('.pf-progress-count');
    expect(count?.textContent).toBe('1 / 3');
  });

  it('count reads "{total} / {total}" when currentIndex equals last', () => {
    const { container } = render(
      <ProgressBar cards={CARDS} currentIndex={2} ratings={['ok', 'easy', null]} />
    );
    const count = container.querySelector('.pf-progress-count');
    expect(count?.textContent).toBe('3 / 3');
  });

  it('family class pf-fam-translation set for meaning_el_to_en', () => {
    const { container } = render(
      <ProgressBar cards={CARDS} currentIndex={0} ratings={[null, null, null]} />
    );
    const ticks = container.querySelectorAll('.pf-seg');
    expect(ticks[0].classList.contains('pf-fam-translation')).toBe(true);
  });

  it('family class pf-fam-grammar set for conjugation card', () => {
    const { container } = render(
      <ProgressBar cards={CARDS} currentIndex={0} ratings={[null, null, null]} />
    );
    const ticks = container.querySelectorAll('.pf-seg');
    expect(ticks[1].classList.contains('pf-fam-grammar')).toBe(true);
  });

  it('family class pf-fam-sentence set for sentence_translation card', () => {
    const { container } = render(
      <ProgressBar cards={CARDS} currentIndex={0} ratings={[null, null, null]} />
    );
    const ticks = container.querySelectorAll('.pf-seg');
    expect(ticks[2].classList.contains('pf-fam-sentence')).toBe(true);
  });
});
