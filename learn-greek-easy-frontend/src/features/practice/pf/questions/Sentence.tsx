// src/features/practice/pf/questions/Sentence.tsx
//
// Question renderers for the Sentence family card type:
//   - sentence_translation, direction el_to_en:
//       Greek sentence (Noto Serif, lang="el", never italic)
//       with curly-quote ::before/::after decorations tinted by family,
//       a prompt label, an AudioChip, and an optional grammar-tag chip.
//   - sentence_translation, direction en_to_el:
//       English prompt (Inter Tight 700) with the same optional grammar-tag chip.
//
// Direction is derived from front_content.prompt:
//   'Translate this sentence' → el_to_en (Greek sentence shown)
//   'Translate to Greek'      → en_to_el (English text shown)
//   (any other / undefined)   → defaults to el_to_en
//
// Field bindings (verified against PracticeCard.tsx:394-397 + V2 page):
//   front_content.prompt      → direction key + translated prompt label
//   front_content.main        → main text (Greek sentence for el_to_en; English for en_to_el)
//   front_content.sub         → IPA (optional; no sentence IPA source today)
//   front_content.grammar_tag → grammar label (optional; no generation source today)
//
// Grammar-tag chip (PRACT2-3-09):
//   Renders .pf-sentence-tag containing the real label ONLY when grammarTag is a
//   non-empty string. Renders NOTHING when absent — no red dot, no empty placeholder.
//   No grammar source exists in generated cards today — the chip will be absent for
//   all current sentence cards, which is the correct AC-satisfying outcome.

import { AudioChip } from '../AudioChip';

import type { AudioChipState } from '../AudioChip';

// ── Direction detection ────────────────────────────────────────────────────────

const PROMPT_EN_TO_EL = 'Translate to Greek';

type SentenceDirection = 'el_to_en' | 'en_to_el';

function deriveDirection(prompt: string | null | undefined): SentenceDirection {
  if (prompt === PROMPT_EN_TO_EL) return 'en_to_el';
  return 'el_to_en'; // default: treat as el_to_en (Greek sentence shown)
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface SentenceProps {
  /**
   * Raw, untranslated front_content.prompt. Used ONLY to derive direction
   * (must never be localized, or el_to_en/en_to_el would invert). The `prompt`
   * prop carries the localized label for display.
   */
  rawPrompt?: string | null;
  /**
   * Prompt from front_content.prompt.
   * Used to derive direction ('Translate this sentence' → el_to_en;
   * 'Translate to Greek' → en_to_el).
   * The translated/localised prompt string (already passed through translatePrompt
   * by the page) is shown as the instruction label above the sentence.
   */
  prompt: string | null | undefined;
  /**
   * Main text from front_content.main.
   * For el_to_en: the Greek sentence.
   * For en_to_el: the English text to translate.
   */
  main: string;
  /**
   * IPA from front_content.sub (optional).
   * No IPA source exists for sentence cards today, so this renders absent
   * gracefully. Wired for future use when sentence IPA is authored.
   */
  ipa?: string | null;
  /** Lifted audio state — passed through to AudioChip (el_to_en only). */
  audioState?: AudioChipState | null;
  /** Current card language. No-op for Sentence question front (no RU front data exists). */
  lang?: 'en' | 'ru';
  /**
   * Grammar tag label from front_content.grammar_tag (optional).
   * Renders inside .pf-sentence-tag ONLY when this is a non-empty string.
   * Renders NOTHING when absent (no red dot, no empty chip).
   * No grammar source exists in generated cards today — graceful absence is correct.
   */
  grammarTag?: string | null;
}

// ── SentenceElToEn renderer ───────────────────────────────────────────────────

/**
 * SentenceElToEn — question view for sentence_translation cards in the
 * el_to_en direction.
 *
 * Greek text: Noto Serif, lang="el", never italic.
 * Curly-quote decorations (::before/::after) tinted by --pf-c (family colour).
 * Prompt label shown above as a muted instruction.
 * IPA: renders from `ipa` prop when present (no source today → graceful absence).
 * AudioChip shown when audioState has a URL.
 * Grammar-tag chip: renders .pf-sentence-tag ONLY when grammarTag is a non-empty string.
 */
export function SentenceElToEn({ prompt, main, audioState, ipa, grammarTag }: SentenceProps) {
  return (
    <div className="flex flex-col items-center gap-3 py-4" data-testid="pf-sentence-el-en">
      {/* Direction instruction label */}
      {prompt && (
        <p className="pf-sentence-prompt" data-testid="pf-sentence-prompt">
          {prompt}
        </p>
      )}

      {/* Greek sentence with curly-quote decoration */}
      <p className="pf-sentence-text" lang="el">
        {main}
      </p>

      {/* IPA — only when present (no source today; renders gracefully absent) */}
      {ipa && (
        <p className="pf-ipa" data-testid="pf-ipa">
          {ipa}
        </p>
      )}

      {/* Audio chip — only when audioState has a URL */}
      {audioState && <AudioChip audioState={audioState} />}

      {/* Grammar-tag chip — renders ONLY when a real label is present (PRACT2-3-09) */}
      {grammarTag && (
        <span className="pf-sentence-tag" data-testid="pf-sentence-tag">
          {grammarTag}
        </span>
      )}
    </div>
  );
}

// ── SentenceEnToEl renderer ───────────────────────────────────────────────────

/**
 * SentenceEnToEl — question view for sentence_translation cards in the
 * en_to_el direction.
 *
 * English text: Inter Tight 700.
 * IPA: renders from `ipa` prop when present (no source today → graceful absence).
 * Grammar-tag chip: renders .pf-sentence-tag ONLY when grammarTag is a non-empty string.
 */
export function SentenceEnToEl({
  prompt,
  main,
  ipa,
  grammarTag,
}: Omit<SentenceProps, 'audioState'>) {
  return (
    <div className="flex flex-col items-center gap-3 py-4" data-testid="pf-sentence-en-el">
      {/* Direction instruction label */}
      {prompt && (
        <p className="pf-sentence-prompt" data-testid="pf-sentence-prompt">
          {prompt}
        </p>
      )}

      {/* English text in Inter Tight */}
      <p className="pf-sentence-en-text">{main}</p>

      {/* IPA — only when present (no source today; renders gracefully absent) */}
      {ipa && (
        <p className="pf-ipa" data-testid="pf-ipa">
          {ipa}
        </p>
      )}

      {/* Grammar-tag chip — renders ONLY when a real label is present (PRACT2-3-09) */}
      {grammarTag && (
        <span className="pf-sentence-tag" data-testid="pf-sentence-tag">
          {grammarTag}
        </span>
      )}
    </div>
  );
}

// ── Unified Sentence renderer ─────────────────────────────────────────────────

/**
 * Sentence — unified entry point for sentence_translation cards.
 *
 * Derives the render direction from front_content.prompt and delegates to
 * SentenceElToEn or SentenceEnToEl accordingly.
 *
 * Usage in the dispatch block:
 *   <Sentence prompt={front.prompt} main={front.main} audioState={audioState}
 *             ipa={front.sub as string | null}
 *             grammarTag={front.grammar_tag as string | null} />
 */
export function Sentence({
  rawPrompt,
  prompt,
  main,
  audioState,
  ipa,
  grammarTag,
  lang: _lang,
}: SentenceProps) {
  const direction = deriveDirection((rawPrompt ?? prompt) as string | null | undefined);

  if (direction === 'en_to_el') {
    return <SentenceEnToEl prompt={prompt} main={main} ipa={ipa} grammarTag={grammarTag} />;
  }

  return (
    <SentenceElToEn
      prompt={prompt}
      main={main}
      audioState={audioState}
      ipa={ipa}
      grammarTag={grammarTag}
    />
  );
}
