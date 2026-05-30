// src/features/practice/pf/questions/Sentence.tsx
//
// Question renderers for the Sentence family card type:
//   - sentence_translation, direction el_to_en:
//       Greek sentence (Noto Serif, lang="el", never italic)
//       with curly-quote ::before/::after decorations tinted by family,
//       a prompt label, an AudioChip, and a red-dotted grammar-tag chip.
//   - sentence_translation, direction en_to_el:
//       English prompt (Inter Tight 700) with the same grammar-tag chip.
//
// Direction is derived from front_content.prompt:
//   'Translate this sentence' → el_to_en (Greek sentence shown)
//   'Translate to Greek'      → en_to_el (English text shown)
//   (any other / undefined)   → defaults to el_to_en
//
// Field bindings (verified against PracticeCard.tsx:394-397 + V2 page):
//   front_content.prompt → direction key + translated prompt label
//   front_content.main   → main text (Greek sentence for el_to_en; English for en_to_el)
//
// Grammar-tag chip:
//   Sentence cards carry NO structured grammar-label field. The chip is rendered
//   inert with UnwiredDot tone="danger" — a placeholder signalling that grammar
//   tagging is not yet wired to backend data. NO fabricated label is shown.
//
// dx.css MUST be imported here so .dx-unwired-dot / .dx-unwired-dot-marker rules
// are present when UnwiredDot renders (mirrors CardHead.tsx precedent).

import '@/features/decks/dx/dx.css';

import { UnwiredDot } from '@/features/decks/dx/atoms/UnwiredDot';

import { AudioChip } from '../AudioChip';

import type { AudioChipState } from '../AudioChip';

// ── Direction detection ────────────────────────────────────────────────────────

const PROMPT_EN_TO_EL = 'Translate to Greek';

type SentenceDirection = 'el_to_en' | 'en_to_el';

function deriveDirection(prompt: string | null | undefined): SentenceDirection {
  if (prompt === PROMPT_EN_TO_EL) return 'en_to_el';
  return 'el_to_en'; // default: treat as el_to_en (Greek sentence shown)
}

// ── Grammar-tag chip (inert, red-dotted) ─────────────────────────────────────

/**
 * SentenceGrammarTag — renders an inert grammar-tag chip wrapped in
 * UnwiredDot tone="danger". NO fabricated grammar label is shown.
 * The dot signals that grammar tagging is not yet connected to backend data.
 */
function SentenceGrammarTag() {
  return (
    <span className="pf-sentence-tag" data-testid="pf-sentence-tag">
      <UnwiredDot tone="danger" aria-label="Grammar tag not yet connected to backend data" />
    </span>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface SentenceProps {
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
  /** Lifted audio state — passed through to AudioChip (el_to_en only). */
  audioState?: AudioChipState | null;
}

// ── SentenceElToEn renderer ───────────────────────────────────────────────────

/**
 * SentenceElToEn — question view for sentence_translation cards in the
 * el_to_en direction.
 *
 * Greek text: Noto Serif, lang="el", never italic.
 * Curly-quote decorations (::before/::after) tinted by --pf-c (family colour).
 * Prompt label shown above as a muted instruction.
 * AudioChip shown when audioState has a URL.
 * Grammar-tag chip: inert red-dotted UnwiredDot (no fabricated label).
 */
export function SentenceElToEn({ prompt, main, audioState }: SentenceProps) {
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

      {/* Audio chip — only when audioState has a URL */}
      {audioState && <AudioChip audioState={audioState} />}

      {/* Grammar-tag chip — inert, red-dotted, no fabricated label */}
      <SentenceGrammarTag />
    </div>
  );
}

// ── SentenceEnToEl renderer ───────────────────────────────────────────────────

/**
 * SentenceEnToEl — question view for sentence_translation cards in the
 * en_to_el direction.
 *
 * English text: Inter Tight 700.
 * Grammar-tag chip: inert red-dotted UnwiredDot (no fabricated label).
 */
export function SentenceEnToEl({ prompt, main }: Omit<SentenceProps, 'audioState'>) {
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

      {/* Grammar-tag chip — inert, red-dotted, no fabricated label */}
      <SentenceGrammarTag />
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
 *   <Sentence prompt={front.prompt} main={front.main} audioState={audioState} />
 */
export function Sentence({ prompt, main, audioState }: SentenceProps) {
  const direction = deriveDirection(prompt as string | null | undefined);

  if (direction === 'en_to_el') {
    return <SentenceEnToEl prompt={prompt} main={main} />;
  }

  return <SentenceElToEn prompt={prompt} main={main} audioState={audioState} />;
}
