import React from 'react';

import { Check, X } from 'lucide-react';

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
   * The keyboard shortcut number to display in the left badge (1-4).
   * When provided, replaces the letter in the badge.
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

  // Compute aria-label for post-submission feedback
  const ariaLabel =
    resolvedState === 'correct'
      ? `Correct answer: ${text}`
      : resolvedState === 'incorrect'
        ? `Your answer (incorrect): ${text}`
        : undefined;

  return (
    <button
      type="button"
      data-testid={`answer-option-${letter.toLowerCase()}`}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={resolvedState === 'selected'}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      className={cn(
        // Base styles
        'flex w-full items-center gap-3 rounded-2xl border-[1.5px] text-left',
        'px-[1.125rem] py-3.5',
        'duration-[250ms] ease-[cubic-bezier(0.4,0,0.2,1)] transition-all',
        // Focus styles
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',

        // Default state
        resolvedState === 'default' && [
          'border-practice-border bg-practice-card',
          'hover:border-practice-border/70 hover:bg-practice-bg',
        ],

        // Selected state (before submit)
        resolvedState === 'selected' && [
          'border-practice-accent bg-practice-accent-soft',
          'shadow-[0_0_0_3px_hsl(var(--practice-accent-glow))]',
        ],

        // Correct state (after submit)
        resolvedState === 'correct' && [
          'border-practice-correct bg-practice-correct-soft',
          'shadow-[0_0_0_3px_hsl(var(--practice-correct-glow))]',
        ],

        // Incorrect state (after submit, selected + wrong)
        resolvedState === 'incorrect' && [
          'border-practice-incorrect bg-practice-incorrect-soft',
          'shadow-[0_0_0_3px_hsl(var(--practice-incorrect-glow))]',
        ],

        // Dimmed state (non-selected, non-correct after submit)
        resolvedState === 'dimmed' && 'border-practice-border bg-practice-card opacity-[0.35]',

        // Disabled (pointer-events-none after submit)
        disabled && 'pointer-events-none'
      )}
    >
      {/* Letter/number badge */}
      <span
        className={cn(
          'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-sm font-bold transition-colors duration-200',
          (resolvedState === 'default' || resolvedState === 'dimmed') &&
            'bg-muted text-muted-foreground',
          resolvedState === 'selected' && 'bg-practice-accent text-primary-foreground',
          resolvedState === 'correct' && 'bg-practice-correct text-primary-foreground',
          resolvedState === 'incorrect' && 'bg-practice-incorrect text-primary-foreground'
        )}
      >
        {keyboardHintNumber != null ? keyboardHintNumber : letter}
      </span>

      {/* Option text */}
      <span className="flex-1 font-practice-serif text-base text-foreground">{text}</span>

      {/* Result icons (post-submit) */}
      {resolvedState === 'correct' && (
        <Check
          className="h-5 w-5 flex-shrink-0 animate-practice-pop-in text-practice-correct"
          aria-hidden="true"
          data-testid="result-icon-correct"
        />
      )}
      {resolvedState === 'incorrect' && (
        <X
          className="h-5 w-5 flex-shrink-0 animate-practice-pop-in text-practice-incorrect"
          aria-hidden="true"
          data-testid="result-icon-incorrect"
        />
      )}
    </button>
  );
};
