// src/features/practice/pf/TypedInput.tsx
//
// Type-mode input for the practice session (PRACT2-1-08).
//
// Mounts in .pf-body (below the question renderer) ONLY when
//   inputMode === 'type' && !isFlipped
//
// Interactions:
//   Enter → run judge → surface verdict chip → flipCard()
//   Tab   → flipCard() WITHOUT judging (reveal, no verdict)
//   Skip  → flipCard() WITHOUT judging ("Don't know — show me")
//
// The verdict chip is rendered inside this component (pre-reveal it's hidden;
// after flip this component unmounts, and the chip in Answer's pf-answer__type-slot
// is filled by the parent passing `typedResult` to Answer).
//
// Keyboard coexistence: usePracticeKeyboard already skips when focus is in
// an input element (see hooks/usePracticeKeyboard.ts:22-32), so no extra
// `enabled` flag is required on the hook. We do call stopPropagation() on
// Space so it doesn't bubble to the document flip handler.
//
// Design-system: HSL tokens only; focus ring via var(--pf-c).
// Greek input: font-serif lang="el", never italic.
// English input: Inter Tight.

import { useRef, useEffect, useState } from 'react';

import { isElAnswer } from './Answer';
import { judge, resolveAnswerText } from './judge';

import type { Verdict } from './judge';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface TypedInputProps {
  /** The card's card_type (drives font selection). */
  cardType: string | null | undefined;
  /** The card's back_content (drives answer resolution). */
  backContent: Record<string, unknown>;
  /** Called when the user judges (Enter) or skips (Tab/skip). Flips the card. */
  onFlip: () => void;
  /**
   * Called after judging with the verdict result.
   * The parent stores this to display the .pf-typed-result chip in the Answer block.
   */
  onResult: (verdict: Verdict) => void;
  /**
   * cardId — used as the key driver by the parent (key={card.id}) so this
   * component remounts on every new card, resetting input + focus.
   * Not used internally, but documents the intent.
   */
  cardId?: string;
}

// ── Verdict colours ───────────────────────────────────────────────────────────

const VERDICT_LABEL: Record<Verdict, string> = {
  correct: 'Correct',
  lenient: 'Close enough',
  wrong: 'Wrong',
};

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * TypedInput — the pre-reveal typing field for type mode.
 *
 * Auto-focuses on mount (managed via per-card remount from `key={card.id}`
 * on the parent PfCard). Handles Enter/Tab/skip interactions.
 */
export function TypedInput({ cardType, backContent, onFlip, onResult }: TypedInputProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus on mount (per-card remount via key={card.id} handles card changes)
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const answerText = resolveAnswerText(cardType, backContent);
  const isGreek = isElAnswer(cardType);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Stop Space from bubbling to the document flip handler
    if (e.key === ' ') {
      e.stopPropagation();
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (!value.trim()) return; // empty input → no-op
      const verdict = judge(value, answerText);
      onResult(verdict);
      onFlip();
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      // Reveal without judging
      onFlip();
    }
  };

  const handleSkip = () => {
    // Don't know — reveal without judging
    onFlip();
  };

  return (
    <div className="pf-typed-input-wrap" data-testid="pf-typed-input-wrap">
      <div className="pf-typed-input-row">
        <input
          ref={inputRef}
          type="text"
          className={`pf-typed-input ${isGreek ? 'pf-typed-input--el' : 'pf-typed-input--en'}`}
          lang={isGreek ? 'el' : undefined}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isGreek ? 'Γράψε εδώ…' : 'Type here…'}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          data-testid="pf-typed-input"
          aria-label="Type your answer"
        />
        <button
          type="button"
          className="pf-typed-skip-btn"
          onClick={handleSkip}
          data-testid="pf-typed-skip-btn"
          tabIndex={-1}
          aria-label="Don't know — show me"
        >
          Skip
        </button>
      </div>
      <p className="pf-typed-hint" data-testid="pf-typed-hint">
        <kbd>Enter</kbd> to check · <kbd>Tab</kbd> to reveal
      </p>
    </div>
  );
}

// ── TypedResult chip ──────────────────────────────────────────────────────────

export interface TypedResultChipProps {
  verdict: Verdict;
}

/**
 * TypedResultChip — verdict chip rendered in Answer's .pf-answer__type-slot
 * after the card is flipped in type mode.
 */
export function TypedResultChip({ verdict }: TypedResultChipProps) {
  return (
    <div
      className={`pf-typed-result pf-typed-result--${verdict}`}
      data-testid="pf-typed-result"
      data-verdict={verdict}
      role="status"
      aria-label={`Result: ${VERDICT_LABEL[verdict]}`}
    >
      {VERDICT_LABEL[verdict]}
    </div>
  );
}
