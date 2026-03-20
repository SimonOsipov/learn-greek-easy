import { useEffect } from 'react';

export interface UsePracticeKeyboardOptions {
  keymap: Record<string, () => void>;
  deps: React.DependencyList;
  preventDefault?: boolean;
}

/**
 * Generic keyboard shortcut hook for practice pages.
 *
 * Matches keys via e.key first, then e.code.
 * Special case: keymap entry 'Space' also matches e.key === ' '.
 * Skips when focus is in input, textarea, or select elements.
 */
export function usePracticeKeyboard(options: UsePracticeKeyboardOptions): void {
  const { keymap, deps, preventDefault = true } = options;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Focus guard: skip if user is typing
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      // Try matching by e.key, then e.code
      let handler = keymap[e.key] ?? keymap[e.code];

      // Special case: 'Space' keymap entry should also match e.key === ' '
      if (!handler && e.key === ' ' && keymap['Space']) {
        handler = keymap['Space'];
      }

      if (handler) {
        if (preventDefault) {
          e.preventDefault();
        }
        handler();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
