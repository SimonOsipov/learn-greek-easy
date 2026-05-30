// src/features/practice/pf/Answer.tsx
//
// Post-reveal answer block for the practice session redesign.
//
// Renders:
//   - Check label + answer text (font determined by isElAnswer)
//   - Optional example block (sentence_ru translation + example audio chip)
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

import { Check } from 'lucide-react';

import type { StudyQueueCard } from '@/services/studyAPI';
import { resolveV2CardAudioUrl } from '@/stores/v2PracticeStore';

import { AudioChip } from './AudioChip';
import type { AudioChipState } from './AudioChip';
import type { Verdict } from './judge';
import { TypedResultChip } from './TypedInput';

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
   * Optional audio chip state for the example audio.
   * Rendered only when example_audio_url is present on the card.
   */
  exampleAudioState?: AudioChipState | null;
  /**
   * Type-mode verdict (PRACT2-1-08). When set, renders the typed-result chip
   * in the .pf-answer__type-slot. Absent in reveal mode.
   */
  typedResult?: Verdict | null;
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
}: AnswerProps) {
  // Declension suppression: the filled paradigm table IS the answer (PRACT2-1-05)
  if (cardType === 'declension') {
    return null;
  }

  const greek = isElAnswer(cardType);
  const exampleAudioUrl = resolveV2CardAudioUrl(card);
  const hasExample = Boolean(card.sentence_ru || card.example_audio_url);

  return (
    <div className="pf-answer" data-testid="pf-answer">
      {/* Check label */}
      <span className="pf-answer__label" aria-hidden="true">
        <Check className="pf-answer__check-icon" />
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

      {/* Typed-result chip slot — filled by PRACT2-1-08 type mode */}
      <div className="pf-answer__type-slot" data-testid="pf-answer-type-slot">
        {typedResult && <TypedResultChip verdict={typedResult} />}
      </div>

      {/* Example block — only when sentence_ru or example_audio_url present */}
      {hasExample && (
        <div className="pf-answer__example" data-testid="pf-answer-example">
          {card.sentence_ru && (
            <p className="pf-answer__example-ru" data-testid="pf-answer-example-ru">
              {card.sentence_ru}
            </p>
          )}
          {exampleAudioUrl && exampleAudioState && <AudioChip audioState={exampleAudioState} />}
        </div>
      )}
    </div>
  );
}
