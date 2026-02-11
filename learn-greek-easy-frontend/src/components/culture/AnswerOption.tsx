import React from 'react';

import { cn } from '@/lib/utils';

export type OptionLetter = 'A' | 'B' | 'C' | 'D';

export type AnswerOptionState = 'default' | 'selected' | 'correct' | 'incorrect' | 'dimmed';

export interface AnswerOptionProps {
  /** The letter identifier for this option (A, B, C, D) */
  letter: OptionLetter;
  /** The text content of the option */
  text: string;
  /** Whether this option is currently selected */
  isSelected: boolean;
  /** Click handler for selecting this option */
  onClick: () => void;
  /** Whether the option is disabled */
  disabled?: boolean;
  /** Optional aria-describedby for accessibility */
  'aria-describedby'?: string;
  // --- NEW PROPS (all optional for backward compatibility) ---
  /**
   * Whether the answer has been submitted.
   * When false or undefined, only default/selected/hover states are active.
   * When true, result styling (correct/incorrect) may apply based on other props.
   */
  submitted?: boolean;
  /**
   * Whether THIS specific option is the correct answer.
   * Only meaningful when `submitted` is true.
   */
  isCorrect?: boolean;
  /**
   * Whether this option was selected by the user AND is the wrong answer.
   * Only meaningful when `submitted` is true.
   */
  isSelectedIncorrect?: boolean;
  /**
   * Whether to show the keyboard shortcut number badge on this option.
   * Defaults to true. Set to false to hide the badge.
   */
  showKeyboardHint?: boolean;
  /**
   * The keyboard shortcut number to display in the badge (1-4).
   * Only rendered when `showKeyboardHint` is true.
   */
  keyboardHintNumber?: number;
  /**
   * Visual state of the option button. If provided, takes precedence over boolean props.
   * If not provided, state is derived from submitted/isCorrect/isSelectedIncorrect/isSelected.
   */
  state?: AnswerOptionState;
}

/**
 * Individual answer option button for multiple choice questions.
 *
 * Features:
 * - Letter badge (A, B, C, D) with option text
 * - Visual highlight when selected (ring/border effect)
 * - Hover and focus states
 * - Keyboard navigation support (Tab/focus)
 * - Accessible with aria-pressed state
 */
export const AnswerOption: React.FC<AnswerOptionProps> = ({
  letter,
  text,
  isSelected,
  onClick,
  disabled = false,
  'aria-describedby': ariaDescribedBy,
  submitted,
  isCorrect,
  isSelectedIncorrect,
  showKeyboardHint = true,
  keyboardHintNumber,
  state,
}) => {
  // Compute resolved state from props
  const resolvedState: AnswerOptionState =
    state ??
    (submitted && isCorrect
      ? 'correct'
      : submitted && isSelectedIncorrect
        ? 'incorrect'
        : submitted && !isCorrect && !isSelectedIncorrect
          ? 'dimmed'
          : isSelected
            ? 'selected'
            : 'default');
  return (
    <button
      type="button"
      data-testid={`answer-option-${letter.toLowerCase()}`}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={resolvedState === 'selected'}
      aria-describedby={ariaDescribedBy}
      className={cn(
        // Base styles
        'flex w-full items-center gap-3 rounded-2xl border-[1.5px] text-left',
        'px-[1.125rem] py-3.5',
        'duration-[250ms] ease-[cubic-bezier(0.4,0,0.2,1)] transition-all',
        // Focus styles
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',

        // Default state
        resolvedState === 'default' && [
          'border-[var(--cult-border)] bg-[var(--cult-card)]',
          'hover:border-slate-300 hover:bg-slate-50/60',
        ],

        // Selected state (before submit)
        resolvedState === 'selected' && [
          'border-[var(--cult-accent)] bg-[var(--cult-accent-soft)]',
          'shadow-[0_0_0_3px_var(--cult-accent-glow)]',
        ],

        // Correct state (after submit)
        resolvedState === 'correct' && [
          'border-[var(--cult-correct)] bg-[var(--cult-correct-soft)]',
          'shadow-[0_0_0_3px_var(--cult-correct-glow)]',
        ],

        // Incorrect state (after submit, selected + wrong)
        resolvedState === 'incorrect' && [
          'border-[var(--cult-incorrect)] bg-[var(--cult-incorrect-soft)]',
          'shadow-[0_0_0_3px_var(--cult-incorrect-glow)]',
        ],

        // Dimmed state (non-selected, non-correct after submit)
        resolvedState === 'dimmed' &&
          'border-[var(--cult-border)] bg-[var(--cult-card)] opacity-[0.35]',

        // Disabled (pointer-events-none after submit)
        disabled && 'pointer-events-none'
      )}
    >
      {/* Letter badge */}
      <span
        className={cn(
          'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-sm font-bold transition-colors duration-200',
          (resolvedState === 'default' || resolvedState === 'dimmed') &&
            'bg-muted text-muted-foreground',
          resolvedState === 'selected' && 'bg-indigo-500 text-white',
          resolvedState === 'correct' && 'bg-emerald-500 text-white',
          resolvedState === 'incorrect' && 'bg-red-500 text-white'
        )}
      >
        {letter}
      </span>

      {/* Option text */}
      <span className="flex-1 font-cult-serif text-base text-foreground">{text}</span>

      {/* Keyboard hint badge (visible only in default state) */}
      {resolvedState === 'default' && showKeyboardHint && keyboardHintNumber != null && (
        <span
          className="flex h-6 w-5 flex-shrink-0 items-center justify-center rounded-md bg-slate-100 font-mono text-xs text-slate-400 dark:bg-slate-800 dark:text-slate-500"
          aria-hidden="true"
          data-testid={`keyboard-hint-${letter.toLowerCase()}`}
        >
          {keyboardHintNumber}
        </span>
      )}
    </button>
  );
};
