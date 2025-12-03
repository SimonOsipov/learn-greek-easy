import { useEffect, useState } from 'react';

import { useReviewStore } from '@/stores/reviewStore';

/**
 * Global keyboard shortcuts for flashcard review
 *
 * Shortcuts:
 * - Space: Flip card
 * - 1: Rate as "again"
 * - 2: Rate as "hard"
 * - 3: Rate as "good"
 * - 4: Rate as "easy"
 * - ?: Show/hide keyboard shortcuts help
 * - Esc: Close help dialog or exit review
 */
export function useKeyboardShortcuts() {
  const { flipCard, rateCard, canRate } = useReviewStore();
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if typing in input or textarea
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Ignore if modifier keys are pressed (except for special keys)
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      // Handle "?" to toggle help dialog
      if (event.key === '?') {
        event.preventDefault();
        setShowHelp((prev) => !prev);
        return;
      }

      // Handle "Escape" to close help dialog first, then exit review
      if (event.key === 'Escape') {
        event.preventDefault();
        if (showHelp) {
          setShowHelp(false);
        }
        // Note: Exit review is handled in the page component
        return;
      }

      switch (event.code) {
        case 'Space':
          event.preventDefault();
          flipCard();
          break;
        case 'Digit1':
          if (canRate) {
            event.preventDefault();
            rateCard('again');
          }
          break;
        case 'Digit2':
          if (canRate) {
            event.preventDefault();
            rateCard('hard');
          }
          break;
        case 'Digit3':
          if (canRate) {
            event.preventDefault();
            rateCard('good');
          }
          break;
        case 'Digit4':
          if (canRate) {
            event.preventDefault();
            rateCard('easy');
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [flipCard, rateCard, canRate, showHelp]);

  return { showHelp, setShowHelp };
}
