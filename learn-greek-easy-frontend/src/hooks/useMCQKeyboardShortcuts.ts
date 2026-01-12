import { useEffect } from 'react';

/**
 * Options for the MCQ keyboard shortcuts hook
 */
export interface UseMCQKeyboardShortcutsOptions {
  /** Callback when an option is selected (1-N where N = optionCount) */
  onSelectOption: (option: number) => void;
  /** Callback when submit is triggered */
  onSubmit: () => void;
  /** Whether submission is allowed (option must be selected) */
  canSubmit: boolean;
  /** Whether the component is disabled */
  disabled?: boolean;
  /** Number of available options (2-4) */
  optionCount: number;
}

/**
 * Keyboard shortcuts for Multiple Choice Question component
 *
 * Shortcuts:
 * - 1-N: Select option A-N (where N = optionCount, max 4)
 * - Enter: Submit answer (when option selected)
 *
 * @param options - Configuration options for the hook
 */
export function useMCQKeyboardShortcuts({
  onSelectOption,
  onSubmit,
  canSubmit,
  disabled = false,
  optionCount,
}: UseMCQKeyboardShortcutsOptions): void {
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

      // Ignore if modifier keys are pressed
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      // Map digit keys to option numbers
      const digitMap: Record<string, number> = {
        Digit1: 1,
        Digit2: 2,
        Digit3: 3,
        Digit4: 4,
      };

      // Handle digit keys for option selection
      const optionNumber = digitMap[event.code];
      if (optionNumber !== undefined && optionNumber <= optionCount) {
        event.preventDefault();
        onSelectOption(optionNumber);
        return;
      }

      // Handle Enter key for submission
      if (event.code === 'Enter' && canSubmit) {
        event.preventDefault();
        onSubmit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSelectOption, onSubmit, canSubmit, disabled, optionCount]);
}
