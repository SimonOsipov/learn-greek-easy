/**
 * Mock Exam Keyboard Shortcuts Hook
 *
 * Handles additional keyboard shortcuts for the mock exam session:
 * - Escape: Open exit dialog
 * - Space/ArrowRight: Next question (only when in feedback mode)
 *
 * Note: MCQComponent handles 1-4 and Enter internally.
 */

import { useEffect } from 'react';

/**
 * Options for the mock exam keyboard shortcuts hook
 */
export interface UseMockExamKeyboardShortcutsOptions {
  /** Callback when escape is pressed (open exit dialog) */
  onEscape: () => void;
  /** Callback when next question is triggered (Space/ArrowRight) */
  onNextQuestion: () => void;
  /** Whether the user is in feedback mode (can proceed to next) */
  isInFeedback: boolean;
  /** Whether keyboard shortcuts are disabled (e.g., dialog open, loading) */
  disabled?: boolean;
}

/**
 * Hook for mock exam session keyboard shortcuts
 *
 * @param options - Configuration options for the hook
 *
 * @example
 * ```tsx
 * useMockExamKeyboardShortcuts({
 *   onEscape: () => setShowExitDialog(true),
 *   onNextQuestion: handleNextQuestion,
 *   isInFeedback: isInFeedbackMode,
 *   disabled: showExitDialog || isLoading,
 * });
 * ```
 */
export function useMockExamKeyboardShortcuts({
  onEscape,
  onNextQuestion,
  isInFeedback,
  disabled = false,
}: UseMockExamKeyboardShortcutsOptions): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't handle events if disabled
      if (disabled) {
        return;
      }

      // Ignore if typing in input or textarea
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Ignore if modifier keys are pressed (except for Space which needs no modifier check)
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      // Handle Escape key - open exit dialog
      if (event.code === 'Escape') {
        event.preventDefault();
        onEscape();
        return;
      }

      // Handle Space or ArrowRight - next question (only in feedback mode)
      if (isInFeedback && (event.code === 'Space' || event.code === 'ArrowRight')) {
        event.preventDefault();
        onNextQuestion();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onEscape, onNextQuestion, isInFeedback, disabled]);
}
