import { useEffect } from 'react';

/**
 * Options for the MCQ keyboard shortcuts hook
 */
export interface UseMCQKeyboardShortcutsOptions {
  /** Callback when an option is selected (1-4) */
  onSelectOption: (option: number) => void;
  /** Callback when submit is triggered */
  onSubmit: () => void;
  /** Whether submission is allowed (option must be selected) */
  canSubmit: boolean;
  /** Whether the component is disabled */
  disabled?: boolean;
}

/**
 * Keyboard shortcuts for Multiple Choice Question component
 *
 * Shortcuts:
 * - 1: Select option A
 * - 2: Select option B
 * - 3: Select option C
 * - 4: Select option D
 * - Enter: Submit answer (when option selected)
 *
 * @param options - Configuration options for the hook
 */
export function useMCQKeyboardShortcuts({
  onSelectOption,
  onSubmit,
  canSubmit,
  disabled = false,
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

      switch (event.code) {
        case 'Digit1':
          event.preventDefault();
          onSelectOption(1);
          break;
        case 'Digit2':
          event.preventDefault();
          onSelectOption(2);
          break;
        case 'Digit3':
          event.preventDefault();
          onSelectOption(3);
          break;
        case 'Digit4':
          event.preventDefault();
          onSelectOption(4);
          break;
        case 'Enter':
          if (canSubmit) {
            event.preventDefault();
            onSubmit();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSelectOption, onSubmit, canSubmit, disabled]);
}
