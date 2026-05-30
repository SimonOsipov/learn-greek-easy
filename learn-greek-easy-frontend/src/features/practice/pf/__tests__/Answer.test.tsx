// src/features/practice/pf/__tests__/Answer.test.tsx
//
// Tests for Answer.tsx (PRACT2-1-07):
//   - declension suppression (renders null)
//   - Greek font / lang="el" for el-answer card types
//   - English font for el_to_en card types
//   - Example block shown/hidden based on sentence_ru / example_audio_url
//   - Inert typed-result chip slot rendered

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import type { StudyQueueCard } from '@/services/studyAPI';

import { Answer, isElAnswer } from '../Answer';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../AudioChip', () => ({
  AudioChip: () => <div data-testid="mock-audio-chip" />,
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCard(overrides: Partial<StudyQueueCard> = {}): StudyQueueCard {
  return {
    card_record_id: 'cr-1',
    word_entry_id: 'we-1',
    deck_id: 'deck-1',
    deck_name: 'Test Deck',
    card_type: 'meaning_el_to_en',
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
    ...overrides,
  };
}

// ── isElAnswer ────────────────────────────────────────────────────────────────

describe('isElAnswer', () => {
  it('returns true for meaning_en_to_el', () => {
    expect(isElAnswer('meaning_en_to_el')).toBe(true);
  });
  it('returns true for article', () => {
    expect(isElAnswer('article')).toBe(true);
  });
  it('returns true for plural_form', () => {
    expect(isElAnswer('plural_form')).toBe(true);
  });
  it('returns false for meaning_el_to_en', () => {
    expect(isElAnswer('meaning_el_to_en')).toBe(false);
  });
  it('returns false for sentence_translation', () => {
    expect(isElAnswer('sentence_translation')).toBe(false);
  });
  it('returns false for null', () => {
    expect(isElAnswer(null)).toBe(false);
  });
});

// ── Answer component ──────────────────────────────────────────────────────────

describe('Answer', () => {
  it('renders nothing for declension card type', () => {
    const { container } = render(
      <Answer answerText="test" cardType="declension" card={makeCard({ card_type: 'declension' })} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders answer text', () => {
    render(
      <Answer
        answerText="σπίτι"
        cardType="meaning_en_to_el"
        card={makeCard({ card_type: 'meaning_en_to_el' })}
      />
    );
    expect(screen.getByTestId('pf-answer-text')).toHaveTextContent('σπίτι');
  });

  it('uses Greek font class for el-answer card types', () => {
    render(
      <Answer
        answerText="σπίτι"
        cardType="meaning_en_to_el"
        card={makeCard({ card_type: 'meaning_en_to_el' })}
      />
    );
    const textEl = screen.getByTestId('pf-answer-text');
    expect(textEl.classList.contains('pf-answer__text--el')).toBe(true);
    expect(textEl.getAttribute('lang')).toBe('el');
  });

  it('uses English font class for el_to_en card types', () => {
    render(
      <Answer
        answerText="house"
        cardType="meaning_el_to_en"
        card={makeCard({ card_type: 'meaning_el_to_en' })}
      />
    );
    const textEl = screen.getByTestId('pf-answer-text');
    expect(textEl.classList.contains('pf-answer__text--en')).toBe(true);
    expect(textEl.getAttribute('lang')).toBeNull();
  });

  it('renders inert typed-result chip slot', () => {
    render(
      <Answer
        answerText="house"
        cardType="meaning_el_to_en"
        card={makeCard()}
      />
    );
    expect(screen.getByTestId('pf-answer-type-slot')).toBeInTheDocument();
  });

  it('shows example block when sentence_ru is present', () => {
    render(
      <Answer
        answerText="house"
        cardType="meaning_el_to_en"
        card={makeCard({ sentence_ru: 'Мой дом большой.' })}
      />
    );
    expect(screen.getByTestId('pf-answer-example')).toBeInTheDocument();
    expect(screen.getByTestId('pf-answer-example-ru')).toHaveTextContent('Мой дом большой.');
  });

  it('hides example block when sentence_ru and example_audio_url are absent', () => {
    render(
      <Answer
        answerText="house"
        cardType="meaning_el_to_en"
        card={makeCard({ sentence_ru: null, example_audio_url: null })}
      />
    );
    expect(screen.queryByTestId('pf-answer-example')).toBeNull();
  });

  it('shows example block when example_audio_url is present even without sentence_ru', () => {
    render(
      <Answer
        answerText="house"
        cardType="sentence_translation"
        card={makeCard({ sentence_ru: null, example_audio_url: 'https://s3.test/ex.mp3' })}
        exampleAudioState={{
          audioUrl: 'https://s3.test/ex.mp3',
          isPlaying: false,
          isLoading: false,
          error: null,
          onToggle: vi.fn(),
          speed: 1,
          setSpeed: vi.fn(),
        }}
      />
    );
    expect(screen.getByTestId('pf-answer-example')).toBeInTheDocument();
  });
});
