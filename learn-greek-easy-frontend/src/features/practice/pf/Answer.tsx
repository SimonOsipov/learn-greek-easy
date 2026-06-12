// src/features/practice/pf/Answer.tsx
//
// Post-reveal answer block for the practice session redesign.
//
// Renders:
//   - Check label + answer text (font determined by isElAnswer)
//   - Optional muted translation sub-line (plural_form only; page-computed)
//   - Optional example block (Greek example + EN gloss / RU translation + example audio)
//   - Inert typed-result chip slot (filled by PRACT2-1-08 type mode)
//
// isElAnswer derivation (centralised here):
//   - Greek answer (Noto Serif, lang="el", non-italic):
//       meaning_en_to_el, article, plural_form, singular
//   - English answer (Inter Tight):
//       meaning_el_to_en, sentence_translation (el→en direction)
//
// declension suppression: the filled-table IS the answer for declension;
//   this component renders nothing for that family (AC #5).
//
// Example block gate (PRACT2-3-07, updated Option C):
//   EN mode: example TEXT block renders iff example_el or example_en is present.
//   RU mode: example TEXT block renders iff sentence_ru is present.
//   Audio: the answer speaker renders whenever the resolved audio URL is present —
//   it is the visible "hear the Greek answer" affordance and does NOT require an
//   accompanying text example. Only the text block is gated on text presence.
//   PRACT2-5-05: on sentence-family cards (sentence_translation, cloze) the EN example TEXT is suppressed (it duplicates the prompt/answer); the audio chip is still shown.

import { Check } from 'lucide-react';

import type { StudyQueueCard } from '@/services/studyAPI';
import { resolveV2CardAudioUrl } from '@/stores/v2PracticeStore';

import { AudioChip } from './AudioChip';
import { familyForCardType } from './families';
import { TypedResultChip } from './TypedInput';

import type { AudioChipState } from './AudioChip';
import type { Verdict } from './judge';

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns true when the answer language is Greek (Noto Serif, lang="el").
 * Centralised here — not scattered across call sites.
 */
export function isElAnswer(cardType: string | null | undefined): boolean {
  if (!cardType) return false;
  return (
    cardType === 'meaning_en_to_el' ||
    cardType === 'article' ||
    cardType === 'plural_form' ||
    cardType === 'singular'
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface AnswerProps {
  /** The answer text to display. */
  answerText: string;
  /** Card type — drives font selection and declension suppression. */
  cardType: string | null | undefined;
  /** The raw StudyQueueCard — for example block and audio URL resolution. */
  card: StudyQueueCard;
  /**
   * Optional audio chip state for the example/answer audio.
   * Rendered whenever the resolved audio URL is present — the text example is not required.
   */
  exampleAudioState?: AudioChipState | null;
  /**
   * Type-mode verdict (PRACT2-1-08). When set, renders the typed-result chip
   * in the .pf-answer__type-slot. Absent in reveal mode.
   */
  typedResult?: Verdict | null;
  /**
   * Current card language selection.
   * When 'ru', show sentence_ru in the example block (if present).
   * When 'en', show example_el + example_en (if present).
   * Defaults to 'en' to preserve existing behaviour.
   */
  lang?: 'en' | 'ru';
  /**
   * Optional translation gloss shown beneath the main answer.
   * Currently only computed for `plural_form` cards (see V2FlashcardPracticePage).
   * Page-computed so Answer stays presentational. Absent/null → no sub-line.
   */
  answerSub?: string | null;
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Answer — renders the post-reveal answer block inside .pf-foot.
 *
 * For `declension` card type, renders nothing (the DeclTable IS the answer).
 */
export function Answer({
  answerText,
  cardType,
  card,
  exampleAudioState,
  typedResult,
  lang = 'en',
  answerSub,
}: AnswerProps) {
  // Declension suppression: the filled paradigm table IS the answer (PRACT2-1-05)
  if (cardType === 'declension') {
    return null;
  }

  const greek = isElAnswer(cardType);
  const exampleAudioUrl = resolveV2CardAudioUrl(card);

  // PRACT2-5-05: example TEXT is suppressed on sentence-family cards (it duplicates the prompt/answer).
  // Scoped to EN example text per the locked decision; showSentenceRu (RU) and the audio chip are intentionally kept.
  const isSentenceFamily = familyForCardType(cardType) === 'sentence';

  // sentence_ru is only shown when lang === 'ru'.
  const showSentenceRu = lang === 'ru' && Boolean(card.sentence_ru);

  // EN example: show Greek example + EN gloss in EN mode (PRACT2-3-07).
  // Suppressed on sentence-family cards where the example duplicates the prompt/answer (PRACT2-5-05).
  const showExampleEn =
    lang === 'en' && !isSentenceFamily && Boolean(card.example_el || card.example_en);

  // Text example present in either mode (gates only the text <p> nodes, not the audio chip).
  const hasTextExample = showSentenceRu || showExampleEn;

  // The answer speaker renders whenever the resolved audio and its state are present.
  // Text presence is not required — the chip is the visible "hear the Greek answer" affordance.
  const showExampleAudio = Boolean(exampleAudioUrl && exampleAudioState);

  const hasExample = hasTextExample || showExampleAudio;

  return (
    <div className="pf-answer" data-testid="pf-answer">
      {/* Check label — icon aria-hidden; kicker text exposed to AT (PRACT2-3-03) */}
      <span className="pf-answer__label">
        <Check className="pf-answer__check-icon" aria-hidden="true" />
        ANSWER
      </span>

      {/* Answer text — Greek or English font */}
      {greek ? (
        <p className="pf-answer__text pf-answer__text--el" lang="el" data-testid="pf-answer-text">
          {answerText}
        </p>
      ) : (
        <p className="pf-answer__text pf-answer__text--en" data-testid="pf-answer-text">
          {answerText}
        </p>
      )}

      {/* Translation sub-line — only when computed by the page (plural_form only) */}
      {answerSub && (
        <p className="pf-answer__sub" data-testid="pf-answer-sub">
          {answerSub}
        </p>
      )}

      {/* Typed-result chip slot — filled by PRACT2-1-08 type mode */}
      <div className="pf-answer__type-slot" data-testid="pf-answer-type-slot">
        {typedResult && <TypedResultChip verdict={typedResult} />}
      </div>

      {/* Example block — only when there is text (and optionally audio) to show */}
      {hasExample && (
        <div className="pf-answer__example" data-testid="pf-answer-example">
          {/* RU mode: Russian sentence translation */}
          {showSentenceRu && (
            <p className="pf-answer__example-ru" data-testid="pf-answer-example-ru">
              {card.sentence_ru}
            </p>
          )}

          {/* EN mode: Greek example + English gloss (PRACT2-3-07) */}
          {showExampleEn && card.example_el && (
            <p className="pf-answer__example-el" lang="el" data-testid="pf-answer-example-el">
              {card.example_el}
            </p>
          )}
          {showExampleEn && card.example_en && (
            <p className="pf-answer__example-en" data-testid="pf-answer-example-en">
              {card.example_en}
            </p>
          )}

          {/* Audio: renders whenever resolved audio is present — it's the "hear the answer" affordance */}
          {showExampleAudio && exampleAudioState && <AudioChip audioState={exampleAudioState} />}
        </div>
      )}
    </div>
  );
}
