import React from 'react';

import { cn } from '@/lib/utils';

export type OptionLetter = 'A' | 'B' | 'C' | 'D';

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
}) => {
  return (
    <button
      type="button"
      data-testid={`answer-option-${letter.toLowerCase()}`}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={isSelected}
      aria-describedby={ariaDescribedBy}
      className={cn(
        // Base styles
        'flex w-full items-center gap-3 rounded-lg border-2 p-4 text-left transition-all duration-200',
        // Focus styles (always visible for accessibility)
        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
        // Default state
        !isSelected &&
          !disabled &&
          'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-600 dark:hover:bg-gray-700',
        // Selected state - uses border AND background for accessibility (not just color)
        isSelected &&
          !disabled &&
          'border-blue-500 bg-blue-50 ring-2 ring-blue-500 ring-offset-2 dark:border-blue-400 dark:bg-blue-900/30 dark:ring-blue-400',
        // Disabled state
        disabled &&
          'cursor-not-allowed border-gray-200 bg-gray-100 opacity-60 dark:border-gray-700 dark:bg-gray-800'
      )}
    >
      {/* Letter badge */}
      <span
        className={cn(
          'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold',
          // Default badge state
          !isSelected && 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
          // Selected badge state
          isSelected && 'bg-blue-500 text-white dark:bg-blue-400'
        )}
      >
        {letter}
      </span>

      {/* Option text */}
      <span className="flex-1 text-base text-gray-900 dark:text-gray-100">{text}</span>

      {/* Selection indicator */}
      {isSelected && (
        <svg
          className="h-5 w-5 flex-shrink-0 text-blue-500 dark:text-blue-400"
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
      )}
    </button>
  );
};
