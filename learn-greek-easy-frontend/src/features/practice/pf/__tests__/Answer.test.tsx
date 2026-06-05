// src/features/practice/pf/__tests__/Answer.test.tsx
//
// Tests for Answer.tsx (PRACT2-1-07, PRACT2-3-03, PRACT2-3-07):
//   - declension suppression (renders null)
//   - Greek font / lang="el" for el-answer card types
//   - English font for el_to_en card types
//   - Example block shown/hidden based on sentence_ru / example_en / example_el
//   - EN mode: Greek example + EN gloss renders when example_el/example_en present
//   - EN mode (Option C): audio chip IS visible even without example text (audio-only block)
//   - EN mode: no example TEXT paragraphs when only audio present (no empty text box)
//   - RU mode: sentence_ru path unchanged
//   - Inert typed-result chip slot rendered
//   - PRACT2-3-03: ✓ ANSWER kicker text present and exposed to AT
//   - PRACT2-3-03: aria-hidden on the Check icon only (not on the span)

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
    example_el: null,
    example_en: null,
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
      <Answer
        answerText="test"
        cardType="declension"
        card={makeCard({ card_type: 'declension' })}
      />
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
    render(<Answer answerText="house" cardType="meaning_el_to_en" card={makeCard()} />);
    expect(screen.getByTestId('pf-answer-type-slot')).toBeInTheDocument();
  });

  // PRACT2-3-03: ✓ ANSWER kicker
  it('renders ANSWER kicker text', () => {
    render(<Answer answerText="house" cardType="meaning_el_to_en" card={makeCard()} />);
    // The kicker span contains the text "ANSWER"
    const label = document.querySelector('.pf-answer__label');
    expect(label?.textContent).toContain('ANSWER');
  });

  it('ANSWER kicker span is NOT aria-hidden (text exposed to AT)', () => {
    render(<Answer answerText="house" cardType="meaning_el_to_en" card={makeCard()} />);
    const label = document.querySelector('.pf-answer__label');
    expect(label?.getAttribute('aria-hidden')).toBeNull();
  });

  it('Check icon inside .pf-answer__label has aria-hidden', () => {
    const { container } = render(
      <Answer answerText="house" cardType="meaning_el_to_en" card={makeCard()} />
    );
    const label = container.querySelector('.pf-answer__label');
    // The first element child should be the Check svg with aria-hidden
    const icon = label?.querySelector('svg');
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
  });

  // ── RU mode (sentence_ru path — unchanged) ─────────────────────────────────

  it('shows example block with sentence_ru when lang=ru and sentence_ru is present', () => {
    render(
      <Answer
        answerText="house"
        cardType="meaning_el_to_en"
        card={makeCard({ sentence_ru: 'Мой дом большой.' })}
        lang="ru"
      />
    );
    expect(screen.getByTestId('pf-answer-example')).toBeInTheDocument();
    expect(screen.getByTestId('pf-answer-example-ru')).toHaveTextContent('Мой дом большой.');
  });

  it('hides sentence_ru when lang=en even when sentence_ru is present', () => {
    render(
      <Answer
        answerText="house"
        cardType="meaning_el_to_en"
        card={makeCard({ sentence_ru: 'Мой дом большой.', example_audio_url: null })}
        lang="en"
      />
    );
    // No example block — no EN example text, so nothing to show
    expect(screen.queryByTestId('pf-answer-example')).toBeNull();
  });

  it('hides example block when all example fields are absent', () => {
    render(
      <Answer
        answerText="house"
        cardType="meaning_el_to_en"
        card={makeCard({
          sentence_ru: null,
          example_audio_url: null,
          example_el: null,
          example_en: null,
        })}
      />
    );
    expect(screen.queryByTestId('pf-answer-example')).toBeNull();
  });

  // ── EN mode: example_el + example_en — sentence-family suppression (PRACT2-5-05) ─

  it('suppresses Greek example text on sentence-family cards in EN mode', () => {
    render(
      <Answer
        answerText="house"
        cardType="sentence_translation"
        card={makeCard({
          card_type: 'sentence_translation',
          example_el: 'Το σπίτι μου είναι μικρό.',
          example_en: 'My house is small.',
        })}
        lang="en"
      />
    );
    // Text nodes suppressed on sentence-family (PRACT2-5-05): example_el and example_en absent
    expect(screen.queryByTestId('pf-answer-example-el')).toBeNull();
    expect(screen.queryByTestId('pf-answer-example-en')).toBeNull();
  });

  it('suppresses Greek example text (lang="el" check) on sentence-family cards in EN mode', () => {
    render(
      <Answer
        answerText="house"
        cardType="sentence_translation"
        card={makeCard({
          card_type: 'sentence_translation',
          example_el: 'Το σπίτι μου είναι μικρό.',
        })}
        lang="en"
      />
    );
    expect(screen.queryByTestId('pf-answer-example-el')).toBeNull();
  });

  it('suppresses EN gloss on sentence-family cards in EN mode', () => {
    render(
      <Answer
        answerText="house"
        cardType="sentence_translation"
        card={makeCard({
          card_type: 'sentence_translation',
          example_el: 'Το σπίτι μου είναι μικρό.',
          example_en: 'My house is small.',
        })}
        lang="en"
      />
    );
    expect(screen.queryByTestId('pf-answer-example-en')).toBeNull();
  });

  it('suppresses example block on sentence-family when only example_en is present (no example_el)', () => {
    render(
      <Answer
        answerText="house"
        cardType="sentence_translation"
        card={makeCard({
          card_type: 'sentence_translation',
          example_el: null,
          example_en: 'My house is small.',
        })}
        lang="en"
      />
    );
    // No text example — example block absent entirely (no audio either in this case)
    expect(screen.queryByTestId('pf-answer-example-el')).toBeNull();
    expect(screen.queryByTestId('pf-answer-example-en')).toBeNull();
  });

  // ── EN mode: positive example coverage on NON-sentence card (meaning_el_to_en) ──

  it('shows Greek example text on meaning card (translation family) in EN mode', () => {
    render(
      <Answer
        answerText="house"
        cardType="meaning_el_to_en"
        card={makeCard({
          card_type: 'meaning_el_to_en',
          example_el: 'Το σπίτι μου είναι μικρό.',
          example_en: 'My house is small.',
        })}
        lang="en"
      />
    );
    expect(screen.getByTestId('pf-answer-example')).toBeInTheDocument();
    expect(screen.getByTestId('pf-answer-example-el')).toHaveTextContent(
      'Το σπίτι μου είναι μικρό.'
    );
  });

  it('Greek example element has lang="el" on meaning card', () => {
    render(
      <Answer
        answerText="house"
        cardType="meaning_el_to_en"
        card={makeCard({
          card_type: 'meaning_el_to_en',
          example_el: 'Το σπίτι μου είναι μικρό.',
        })}
        lang="en"
      />
    );
    const el = screen.getByTestId('pf-answer-example-el');
    expect(el.getAttribute('lang')).toBe('el');
  });

  it('shows EN gloss on meaning card in EN mode when example_en is present', () => {
    render(
      <Answer
        answerText="house"
        cardType="meaning_el_to_en"
        card={makeCard({
          card_type: 'meaning_el_to_en',
          example_el: 'Το σπίτι μου είναι μικρό.',
          example_en: 'My house is small.',
        })}
        lang="en"
      />
    );
    expect(screen.getByTestId('pf-answer-example-en')).toHaveTextContent('My house is small.');
  });

  it('shows example block on meaning card when only example_en is present (no example_el)', () => {
    render(
      <Answer
        answerText="house"
        cardType="meaning_el_to_en"
        card={makeCard({
          card_type: 'meaning_el_to_en',
          example_el: null,
          example_en: 'My house is small.',
        })}
        lang="en"
      />
    );
    expect(screen.getByTestId('pf-answer-example')).toBeInTheDocument();
    expect(screen.getByTestId('pf-answer-example-en')).toHaveTextContent('My house is small.');
    expect(screen.queryByTestId('pf-answer-example-el')).toBeNull();
  });

  // ── sentence-family de-dup: audio kept, text dropped (PRACT2-5-05) ─────────

  it('sentence-family: audio chip present but example text absent when both example + audio set', () => {
    render(
      <Answer
        answerText="house"
        cardType="sentence_translation"
        card={makeCard({
          card_type: 'sentence_translation',
          example_el: 'Το σπίτι μου είναι μικρό.',
          example_en: 'My house is small.',
          example_audio_url: 'https://s3.test/ex.mp3',
        })}
        exampleAudioState={{
          audioUrl: 'https://s3.test/ex.mp3',
          isPlaying: false,
          isLoading: false,
          error: null,
          onToggle: vi.fn(),
          speed: 1,
          setSpeed: vi.fn(),
        }}
        lang="en"
      />
    );
    // Text suppressed on sentence-family
    expect(screen.queryByTestId('pf-answer-example-el')).toBeNull();
    expect(screen.queryByTestId('pf-answer-example-en')).toBeNull();
    // But audio chip still present (audio not gated on family)
    expect(screen.getByTestId('pf-answer-example')).toBeInTheDocument();
    expect(screen.getByTestId('mock-audio-chip')).toBeInTheDocument();
  });

  // PRACT2-3-07 / Option C: audio-only example block (no example text, but resolved audio present)
  // The speaker IS the "hear the Greek answer" affordance — it renders regardless of text presence.
  it('shows example block with audio chip in EN mode when audio present but example_el/en absent', () => {
    render(
      <Answer
        answerText="house"
        cardType="sentence_translation"
        card={makeCard({
          card_type: 'sentence_translation',
          sentence_ru: null,
          example_audio_url: 'https://s3.test/ex.mp3',
          example_el: null,
          example_en: null,
        })}
        exampleAudioState={{
          audioUrl: 'https://s3.test/ex.mp3',
          isPlaying: false,
          isLoading: false,
          error: null,
          onToggle: vi.fn(),
          speed: 1,
          setSpeed: vi.fn(),
        }}
        lang="en"
      />
    );
    // Block renders with the audio chip (Option C: speaker is its own affordance)
    expect(screen.getByTestId('pf-answer-example')).toBeInTheDocument();
    expect(screen.getByTestId('mock-audio-chip')).toBeInTheDocument();
    // But no example TEXT paragraphs (no empty text box)
    expect(screen.queryByTestId('pf-answer-example-el')).toBeNull();
    expect(screen.queryByTestId('pf-answer-example-en')).toBeNull();
    expect(screen.queryByTestId('pf-answer-example-ru')).toBeNull();
  });

  // ── RU mode unchanged ──────────────────────────────────────────────────────

  it('RU mode: shows sentence_ru and does NOT show EN example fields', () => {
    render(
      <Answer
        answerText="house"
        cardType="sentence_translation"
        card={makeCard({
          card_type: 'sentence_translation',
          sentence_ru: 'Мой дом маленький.',
          example_el: 'Το σπίτι μου είναι μικρό.',
          example_en: 'My house is small.',
        })}
        lang="ru"
      />
    );
    expect(screen.getByTestId('pf-answer-example-ru')).toHaveTextContent('Мой дом маленький.');
    // EN example elements must not appear in RU mode
    expect(screen.queryByTestId('pf-answer-example-el')).toBeNull();
    expect(screen.queryByTestId('pf-answer-example-en')).toBeNull();
  });
});
